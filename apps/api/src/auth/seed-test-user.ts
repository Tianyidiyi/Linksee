import argon2 from "argon2";
import { prisma } from "../infra/prisma.js";

const SEED_ACCOUNTS = [
  { id: "2023010001", password: "ChangeMe123!", role: "student" as const, forceChangePassword: true },
  { id: "1000000001", password: "Academic@2026", role: "academic" as const, forceChangePassword: false },
  { id: "2000000001", password: "Teacher@2026", role: "teacher" as const, forceChangePassword: false },
] as const;

async function main(): Promise<void> {
  const hashOpts = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 };

  for (const acct of SEED_ACCOUNTS) {
    const passwordHash = await argon2.hash(acct.password, hashOpts);
    await prisma.user.upsert({
      where: { id: acct.id },
      update: { passwordHash, role: acct.role, isActive: true, forceChangePassword: acct.forceChangePassword },
      create: { id: acct.id, passwordHash, role: acct.role, isActive: true, forceChangePassword: acct.forceChangePassword },
    });
    console.log(`[seed] ${acct.role.padEnd(8)} ${acct.id}  password: ${acct.password}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
