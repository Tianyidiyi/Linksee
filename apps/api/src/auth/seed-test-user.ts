import argon2 from "argon2";
import { prisma } from "../infra/prisma.js";

async function main(): Promise<void> {
  const password = "ChangeMe123!";
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });

  const users = [
    { id: "2022000001", role: "academic" },
    { id: "2023000001", role: "teacher" },
    { id: "2023019001", role: "assistant" },
    { id: "2023010001", role: "student" },
  ] as const;

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        passwordHash,
        role: user.role,
        isActive: true,
        forceChangePassword: true,
      },
      create: {
        id: user.id,
        passwordHash,
        role: user.role,
        isActive: true,
        forceChangePassword: true,
      },
    });

    console.log(`[seed] user created: ${user.id}, role=${user.role}`);
  }

  console.log(`[seed] default password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
