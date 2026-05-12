import { describe, expect, it } from "@jest/globals";
import { generatePassword, isStrongPassword } from "../../../apps/api/src/auth/password-utils.js";

describe("password-utils", () => {
  describe("generatePassword", () => {
    it("should generate an 8-char password with required complexity", () => {
      for (let i = 0; i < 50; i += 1) {
        const password = generatePassword();
        expect(password).toHaveLength(8);
        expect(/[A-Z]/.test(password)).toBe(true);
        expect(/[a-z]/.test(password)).toBe(true);
        expect(/[0-9]/.test(password)).toBe(true);
      }
    });
  });

  describe("isStrongPassword", () => {
    it("should accept valid strong passwords", () => {
      expect(isStrongPassword("Abcd1234")).toBe(true);
      expect(isStrongPassword("XyZ9abcdEF")).toBe(true);
      expect(isStrongPassword("A1bcdefg")).toBe(true);
    });

    it("should reject passwords shorter than 8", () => {
      expect(isStrongPassword("Abc123")).toBe(false);
    });

    it("should reject passwords longer than 72", () => {
      const tooLong = `A1a${"x".repeat(70)}`;
      expect(tooLong.length).toBe(73);
      expect(isStrongPassword(tooLong)).toBe(false);
    });

    it("should reject passwords missing uppercase/lowercase/digit", () => {
      expect(isStrongPassword("abcdef12")).toBe(false);
      expect(isStrongPassword("ABCDEF12")).toBe(false);
      expect(isStrongPassword("Abcdefgh")).toBe(false);
    });
  });
});
