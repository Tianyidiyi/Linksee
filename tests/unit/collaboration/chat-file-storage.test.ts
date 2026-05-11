import { describe, it, expect, jest } from '@jest/globals';
import {
  buildChatObjectKey,
  isAllowedChatMimeType,
  ensureChatFileSize,
  CHAT_FILE_MAX_BYTES,
  isObjectKeyInScope,
  normalizeChatFiles,
  presignChatDownload,
  presignChatUpload,
  toChatFileMetadata,
} from '../../../apps/api/src/collaboration/chat-file-storage.js';
import { minioClient } from '../../../apps/api/src/infra/minio.js';

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

  describe('object key and scope', () => {
    it('should build scoped object key and validate scope', () => {
      const key = buildChatObjectKey('course', '123', '../../a b?.pdf');
      expect(key.startsWith('chat/course/123/')).toBe(true);
      expect(isObjectKeyInScope(key, 'course', '123')).toBe(true);
      expect(isObjectKeyInScope(key, 'group', '123')).toBe(false);
    });

    it('should fallback to "file" when sanitized name is empty', () => {
      const key = buildChatObjectKey('group', '1', '////');
      expect(key.endsWith('-file')).toBe(true);
    });
  });

  describe('presign operations', () => {
    it('should call minio presignedPutObject/presignedGetObject', async () => {
      const putSpy = jest.spyOn(minioClient, 'presignedPutObject').mockResolvedValue('put-url' as any);
      const getSpy = jest.spyOn(minioClient, 'presignedGetObject').mockResolvedValue('get-url' as any);
      await expect(presignChatUpload('chat/course/1/a.txt', 'text/plain')).resolves.toBe('put-url');
      await expect(presignChatDownload('chat/course/1/a.txt')).resolves.toBe('get-url');
      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledTimes(1);
      putSpy.mockRestore();
      getSpy.mockRestore();
    });
  });

  describe('normalize and metadata', () => {
    it('should return empty array for non-array input', () => {
      expect(normalizeChatFiles(undefined)).toEqual([]);
      expect(normalizeChatFiles(null)).toEqual([]);
      expect(normalizeChatFiles({})).toEqual([]);
    });

    it('should normalize only valid file records', () => {
      const files = normalizeChatFiles([
        null,
        [],
        'x',
        { foo: 'bar' },
        { name: 'a.pdf', objectKey: 'k1', size: 12, mimeType: 'application/pdf' },
        { name: 'c.pdf', objectKey: 'k7', size: 12, mimeType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00.000Z' },
        { name: 'a.pdf', objectKey: 'k3', size: 12, mimeType: 'application/pdf', uploadedAt: 1 },
        { name: '', objectKey: 'k4', size: 12, mimeType: 'application/pdf' },
        { name: 'a.pdf', objectKey: '', size: 12, mimeType: 'application/pdf' },
        { name: 'a.pdf', objectKey: 'k5', size: null, mimeType: 'application/pdf' },
        { name: 'a.pdf', objectKey: 'k6', size: 12, mimeType: '' },
        { name: 'b.pdf', objectKey: 'k2', size: 'bad', mimeType: 'application/pdf' },
      ]);
      expect(files).toHaveLength(3);
      expect(files[0].name).toBe('a.pdf');
      expect(files[1].objectKey).toBe('k7');
      expect(files[1].uploadedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(files[2].objectKey).toBe('k3');
    });

    it('should map metadata and set thumbnailKey for images', () => {
      const imageMeta = toChatFileMetadata({
        name: 'a.png',
        objectKey: 'k',
        size: 1,
        mimeType: 'image/png',
      });
      expect(imageMeta.thumbnailKey).toBe('k');

      const docMeta = toChatFileMetadata({
        name: 'a.pdf',
        objectKey: 'k2',
        size: 1,
        mimeType: 'application/pdf',
        uploadedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(docMeta.thumbnailKey).toBeUndefined();
      expect(docMeta.uploadedAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
