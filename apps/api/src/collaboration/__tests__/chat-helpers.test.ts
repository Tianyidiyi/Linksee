import { describe, it, expect } from '@jest/globals';
import {
  parseLimit,
  parseCursorParam,
  resolveMessageType,
  normalizeMentions,
  CHAT_MENTION_LIMIT,
} from '../chat-helpers.js';

describe('chat-helpers — Pure function unit tests', () => {
  describe('parseLimit', () => {
    it('should return default 50 for invalid input', () => {
      expect(parseLimit(undefined)).toBe(50);
      expect(parseLimit(null)).toBe(50);
      expect(parseLimit('invalid')).toBe(50);
      expect(parseLimit(-5)).toBe(50);
      expect(parseLimit(0)).toBe(50);
    });

    it('should return input if valid and less than 100', () => {
      expect(parseLimit(30)).toBe(30);
      expect(parseLimit('50')).toBe(50);
      expect(parseLimit(100)).toBe(100);
    });

    it('should cap at 100 for values exceeding limit', () => {
      expect(parseLimit(150)).toBe(100);
      expect(parseLimit('200')).toBe(100);
    });

    it('should floor decimal values', () => {
      expect(parseLimit(50.7)).toBe(50);
      expect(parseLimit('75.5')).toBe(75);
    });
  });

  describe('parseCursorParam', () => {
    it('should return null for missing value', () => {
      const mockRes = {
        status: () => ({ json: () => {} }),
      } as any;
      expect(parseCursorParam(undefined, mockRes, 'beforeId')).toBeNull();
      expect(parseCursorParam(null, mockRes, 'beforeId')).toBeNull();
    });

    it('should parse valid bigint strings', () => {
      const mockRes = {
        status: () => ({ json: () => {} }),
      } as any;
      const result = parseCursorParam('12345', mockRes, 'beforeId');
      expect(result).toBe(BigInt('12345'));
    });

    it('should parse numeric values', () => {
      const mockRes = {
        status: () => ({ json: () => {} }),
      } as any;
      const result = parseCursorParam(999, mockRes, 'beforeId');
      expect(result).toBe(BigInt('999'));
    });

    it('should reject invalid values and call res.status', () => {
      let statusCalled = false;
      const mockRes = {
        status: (code: number) => {
          statusCalled = true;
          expect(code).toBe(400);
          return {
            json: (body: any) => {
              expect(body.code).toBe('VALIDATION_FAILED');
            },
          };
        },
      } as any;
      expect(parseCursorParam('abc', mockRes, 'beforeId')).toBeNull();
      expect(statusCalled).toBe(true);
    });

    it('should reject negative values', () => {
      let statusCalled = false;
      const mockRes = {
        status: (code: number) => {
          statusCalled = true;
          return { json: () => {} };
        },
      } as any;
      expect(parseCursorParam('-123', mockRes, 'beforeId')).toBeNull();
      expect(statusCalled).toBe(true);
    });
  });

  describe('resolveMessageType', () => {
    it('should return "announcement" if files.type === "announcement"', () => {
      expect(resolveMessageType({ type: 'announcement' }, 'some content')).toBe('announcement');
    });

    it('should return "file" if files exists and is not announcement', () => {
      expect(resolveMessageType({ key: 'value' }, '')).toBe('file');
      expect(resolveMessageType([{ name: 'file.pdf' }], null)).toBe('file');
    });

    it('should return "text" if content has text and no files', () => {
      expect(resolveMessageType(null, 'Hello world')).toBe('text');
      expect(resolveMessageType(undefined, '  text  ')).toBe('text');
    });

    it('should return "text" as default for empty content and no files', () => {
      expect(resolveMessageType(null, null)).toBe('text');
      expect(resolveMessageType(undefined, '')).toBe('text');
      expect(resolveMessageType(undefined, '   ')).toBe('text');
    });
  });

  describe('normalizeMentions', () => {
    it('should return empty array for non-array input', () => {
      expect(normalizeMentions(undefined)).toEqual([]);
      expect(normalizeMentions(null)).toEqual([]);
      expect(normalizeMentions('string')).toEqual([]);
      expect(normalizeMentions(123)).toEqual([]);
    });

    it('should filter out non-string elements', () => {
      expect(normalizeMentions(['user1', 123, null, 'user2'])).toEqual(['user1', 'user2']);
    });

    it('should trim whitespace and remove empty strings', () => {
      expect(normalizeMentions(['  user1  ', '', '  ', 'user2'])).toEqual(['user1', 'user2']);
    });

    it('should deduplicate mentions', () => {
      expect(normalizeMentions(['user1', 'user2', 'user1'])).toEqual(['user1', 'user2']);
    });

    it('should enforce CHAT_MENTION_LIMIT', () => {
      const mentions = Array.from({ length: 30 }, (_, i) => `user${i}`);
      const result = normalizeMentions(mentions);
      expect(result.length).toBe(CHAT_MENTION_LIMIT);
    });

    it('should preserve order and stop at limit', () => {
      const mentions = Array.from({ length: 30 }, (_, i) => `user${i}`);
      const result = normalizeMentions(mentions);
      expect(result[0]).toBe('user0');
      expect(result[CHAT_MENTION_LIMIT - 1]).toBe(`user${CHAT_MENTION_LIMIT - 1}`);
    });
  });
});
