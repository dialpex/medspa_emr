import * as OTPAuth from "otpauth";
import { randomBytes, createHash } from "crypto";

const ISSUER = "Neuvvia EMR";

export function generateTOTPSecret(email: string): {
  secret: string;
  uri: string;
} {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyTOTP(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Allow 1 period of drift (±30 seconds)
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export function generateBackupCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase(); // 8-char hex code
    codes.push(code);
    hashes.push(createHash("sha256").update(code).digest("hex"));
  }

  return { codes, hashes };
}

export function verifyBackupCode(code: string, hashes: string[]): { valid: boolean; remainingHashes: string[] } {
  const inputHash = createHash("sha256").update(code.toUpperCase()).digest("hex");
  const index = hashes.indexOf(inputHash);

  if (index === -1) {
    return { valid: false, remainingHashes: hashes };
  }

  const remainingHashes = [...hashes];
  remainingHashes.splice(index, 1);
  return { valid: true, remainingHashes };
}
