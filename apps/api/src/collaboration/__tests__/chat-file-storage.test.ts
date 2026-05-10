import { describe, it, expect } from '@jest/globals';
import {
  isAllowedChatMimeType,
  ensureChatFileSize,
  CHAT_FILE_MAX_BYTES,
} from '../chat-file-storage.js';

describe('chat-file-storage', () => {
  describe('isAllowedChatMimeType', () => {
    it('should allow office document types', () => {
      expect(isAllowedChatMimeType('application/pdf')).toBe(true);
      expect(isAllowedChatMimeType('application/msword')).toBe(true);
      expect(isAllowedChatMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(isAllowedChatMimeType('application/vnd.ms-excel')).toBe(true);
      expect(isAllowedChatMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    });

    it('should allow image types', () => {
      expect(isAllowedChatMimeType('image/jpeg')).toBe(true);
      expect(isAllowedChatMimeType('image/png')).toBe(true);
      expect(isAllowedChatMimeType('image/gif')).toBe(true);
      expect(isAllowedChatMimeType('image/webp')).toBe(true);
    });

    it('should allow video types', () => {
      expect(isAllowedChatMimeType('video/mp4')).toBe(true);
      expect(isAllowedChatMimeType('video/quicktime')).toBe(true);
      expect(isAllowedChatMimeType('video/webm')).toBe(true);
    });

    it('should allow archive types', () => {
      expect(isAllowedChatMimeType('application/zip')).toBe(true);
      expect(isAllowedChatMimeType('application/x-rar-compressed')).toBe(true);
      expect(isAllowedChatMimeType('application/x-7z-compressed')).toBe(true);
    });

    it('should allow text/* types', () => {
      expect(isAllowedChatMimeType('text/plain')).toBe(true);
      expect(isAllowedChatMimeType('text/markdown')).toBe(true);
      expect(isAllowedChatMimeType('text/x-latex')).toBe(true);
      expect(isAllowedChatMimeType('text/csv')).toBe(true);
    });

    it('should reject non-whitelisted MIME types', () => {
      expect(isAllowedChatMimeType('application/x-executable')).toBe(false);
      expect(isAllowedChatMimeType('application/x-msdownload')).toBe(false);
      expect(isAllowedChatMimeType('application/octet-stream')).toBe(false);
    });

    it('should handle null/undefined gracefully', () => {
      expect(isAllowedChatMimeType(null as any)).toBe(false);
      expect(isAllowedChatMimeType(undefined as any)).toBe(false);
      expect(isAllowedChatMimeType('' as any)).toBe(false);
    });
  });

  describe('ensureChatFileSize', () => {
    it('should allow files under size limit', () => {
      expect(ensureChatFileSize(1024)).toBe(true); // 1 KB
      expect(ensureChatFileSize(1024 * 1024 * 100)).toBe(true); // 100 MB
      expect(ensureChatFileSize(CHAT_FILE_MAX_BYTES)).toBe(true); // Exactly 500 MB
    });

    it('should reject files exceeding size limit', () => {
      expect(ensureChatFileSize(CHAT_FILE_MAX_BYTES + 1)).toBe(false);
      expect(ensureChatFileSize(1024 * 1024 * 1024)).toBe(false); // 1 GB
    });

    it('should handle edge cases', () => {
      expect(ensureChatFileSize(1)).toBe(true); // 1 byte
      expect(ensureChatFileSize(0)).toBe(false); // Empty file (not allowed)
      expect(ensureChatFileSize(-1)).toBe(false); // Negative
      expect(ensureChatFileSize(NaN)).toBe(false); // NaN
      expect(ensureChatFileSize(Infinity)).toBe(false); // Infinity
    });
  });

  describe('CHAT_FILE_MAX_BYTES constant', () => {
    it('should be 500MB', () => {
      expect(CHAT_FILE_MAX_BYTES).toBe(500 * 1024 * 1024);
    });

    it('should be within reason for file uploads', () => {
      expect(CHAT_FILE_MAX_BYTES).toBeGreaterThan(1024 * 1024 * 10); // At least 10 MB
      expect(CHAT_FILE_MAX_BYTES).toBeLessThan(1024 * 1024 * 1024); // Less than 1 GB
    });
  });
});
