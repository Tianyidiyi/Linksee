import { Prisma } from "@prisma/client";

export function isUniqueViolation(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    || (error !== null
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === "P2002")
  );
}
