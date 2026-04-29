import argon2 from "argon2";
import { prisma } from "../infra/prisma.js";

async function main(): Promise<void> {
  const id = "2023010001";
  const password = "ChangeMe123!";
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });

  await prisma.user.upsert({
    where: { id },
    update: {
      passwordHash,
      role: "student",
      isActive: true,
      forceChangePassword: true,
    },
    create: {
      id,
      passwordHash,
      role: "student",
      isActive: true,
      forceChangePassword: true,
    },
  });

  console.log(`[seed] user created: ${id}, password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
