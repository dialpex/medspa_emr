/**
 * Patient PHI field encryption/decryption layer.
 *
 * Encrypted fields: firstName, lastName, email, phone, address
 * Blind indexes: emailHash, phoneHash (HMAC-SHA256 for exact lookups)
 *
 * This module provides helpers to encrypt before write and decrypt after read,
 * applied at the action layer rather than Prisma middleware to keep the
 * Prisma client type-safe and Edge-compatible.
 */
import {
  encryptField,
  decryptField,
  encryptOptional,
  decryptOptional,
  isEncrypted,
  blindIndexOptional,
} from "./field-encryption";

/** Fields on Patient that contain PHI and must be encrypted */
const ENCRYPTED_REQUIRED_FIELDS = ["firstName", "lastName"] as const;
const ENCRYPTED_OPTIONAL_FIELDS = ["email", "phone", "address"] as const;

type AnyRecord = Record<string, any>;

/**
 * Encrypt PHI fields and compute blind indexes before writing to DB.
 * Accepts a partial patient data object (for create or update).
 */
export function encryptPatientData(data: AnyRecord): AnyRecord {
  const result = { ...data };

  for (const field of ENCRYPTED_REQUIRED_FIELDS) {
    if (typeof result[field] === "string" && !isEncrypted(result[field])) {
      result[field] = encryptField(result[field]);
    }
  }

  for (const field of ENCRYPTED_OPTIONAL_FIELDS) {
    if (typeof result[field] === "string" && !isEncrypted(result[field])) {
      result[field] = encryptOptional(result[field]);
    }
  }

  // Compute blind indexes
  if ("email" in data && data.email !== undefined) {
    result.emailHash = blindIndexOptional(data.email);
  }
  if ("phone" in data && data.phone !== undefined) {
    result.phoneHash = blindIndexOptional(data.phone);
  }

  return result;
}

/**
 * Decrypt PHI fields after reading from DB.
 */
export function decryptPatientData(record: AnyRecord): AnyRecord {
  const result = { ...record };

  for (const field of ENCRYPTED_REQUIRED_FIELDS) {
    if (typeof result[field] === "string") {
      result[field] = decryptField(result[field]);
    }
  }

  for (const field of ENCRYPTED_OPTIONAL_FIELDS) {
    if (typeof result[field] === "string") {
      result[field] = decryptOptional(result[field]);
    }
  }

  return result;
}

/** Decrypt an array of patient records */
export function decryptPatientList(records: AnyRecord[]): AnyRecord[] {
  return records.map(decryptPatientData);
}
