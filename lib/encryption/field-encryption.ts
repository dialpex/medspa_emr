import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.MIGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for PHI field encryption"
    );
  }
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length === 32) {
    return buf;
  }
  throw new Error(
    "ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)"
  );
}

export function encryptField(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, encrypted, authTag]);
  return ENCRYPTED_PREFIX + combined.toString("base64");
}

export function decryptField(ciphertext: string): string {
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    // Plaintext value (not yet encrypted)
    return ciphertext;
  }

  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function encryptOptional(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return encryptField(value);
}

export function decryptOptional(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return decryptField(value);
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Generate a deterministic HMAC-SHA256 blind index for encrypted field lookups.
 * Normalizes value (lowercase, trim) before hashing for consistent matching.
 */
export function blindIndex(value: string): string {
  const key = getEncryptionKey();
  const normalized = value.toLowerCase().trim();
  return createHmac("sha256", key).update(normalized).digest("hex");
}

/** Blind index for optional fields — returns null if value is empty */
export function blindIndexOptional(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return blindIndex(value);
}
