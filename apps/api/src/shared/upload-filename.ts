export function normalizeUploadFileName(originalName: string): string {
  const value = typeof originalName === "string" ? originalName.trim() : "";
  if (!value) return "file";
  if (containsCjk(value)) return value;

  const decoded = decodeLatin1Utf8(value);
  if (decoded && decoded !== value && containsCjk(decoded)) {
    return decoded;
  }

  return value;
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff\uF900-\uFAFF]/.test(value);
}

function decodeLatin1Utf8(value: string): string {
  try {
    return Buffer.from(value, "latin1").toString("utf8").trim();
  } catch {
    return value;
  }
}
