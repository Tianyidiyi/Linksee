import crypto from "node:crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;

/**
 * 生成随机密码：8 位，含大写、小写、数字各至少一个。
 * 使用 crypto.randomInt 确保安全随机性。
 */
export function generatePassword(): string {
  const chars = [
    UPPER[crypto.randomInt(UPPER.length)],
    LOWER[crypto.randomInt(LOWER.length)],
    DIGITS[crypto.randomInt(DIGITS.length)],
    ...Array.from({ length: 5 }, () => ALL[crypto.randomInt(ALL.length)]),
  ];
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** 密码强度校验：8-72字符，含大写、小写、数字各至少一个 */
export function isStrongPassword(password: string): boolean {
  return (
    /^.{8,72}$/.test(password) &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
