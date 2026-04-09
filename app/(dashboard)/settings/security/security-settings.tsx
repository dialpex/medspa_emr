"use client";

import { useState } from "react";
import { setupMFA, verifyAndActivateMFA, disableMFA } from "@/lib/actions/mfa";

export function SecuritySettings({ mfaEnabled: initialEnabled }: { mfaEnabled: boolean }) {
  const [mfaEnabled, setMfaEnabled] = useState(initialEnabled);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "disable">("idle");

  async function handleSetup() {
    setError("");
    const result = await setupMFA();
    if (result.success && result.uri) {
      setSetupUri(result.uri);
      setStep("setup");
    } else {
      setError(result.error || "Failed to set up MFA");
    }
  }

  async function handleVerify() {
    setError("");
    const result = await verifyAndActivateMFA(verifyCode);
    if (result.success) {
      setMfaEnabled(true);
      setBackupCodes(result.backupCodes || null);
      setSetupUri(null);
      setStep("idle");
      setVerifyCode("");
    } else {
      setError(result.error || "Verification failed");
    }
  }

  async function handleDisable() {
    setError("");
    const result = await disableMFA(disableCode);
    if (result.success) {
      setMfaEnabled(false);
      setStep("idle");
      setDisableCode("");
    } else {
      setError(result.error || "Failed to disable MFA");
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-medium mb-2">Two-Factor Authentication (TOTP)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Add an extra layer of security to your account using an authenticator app.
        </p>

        {mfaEnabled ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">MFA is enabled</span>
            </div>

            {step === "disable" ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Enter your TOTP code to disable MFA:</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                  className="border rounded px-3 py-2 text-center tracking-widest w-40"
                  placeholder="000000"
                />
                <div className="flex gap-2">
                  <button onClick={handleDisable} disabled={disableCode.length !== 6}
                    className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50">
                    Confirm Disable
                  </button>
                  <button onClick={() => { setStep("idle"); setError(""); }}
                    className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setStep("disable")}
                className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50">
                Disable MFA
              </button>
            )}
          </div>
        ) : (
          <div>
            {step === "setup" && setupUri ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Scan this URI with your authenticator app, or copy it manually:
                </p>
                <code className="block bg-gray-100 p-3 rounded text-xs break-all">{setupUri}</code>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Enter the 6-digit code to verify:</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                    className="border rounded px-3 py-2 text-center tracking-widest w-40"
                    placeholder="000000"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleVerify} disabled={verifyCode.length !== 6}
                      className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
                      Verify & Enable
                    </button>
                    <button onClick={() => { setStep("idle"); setSetupUri(null); setError(""); }}
                      className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={handleSetup}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
                Enable MFA
              </button>
            )}
          </div>
        )}

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        {backupCodes && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-4">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">Backup Codes</h3>
            <p className="text-xs text-yellow-700 mb-3">
              Save these codes securely. Each can be used once if you lose access to your authenticator.
            </p>
            <div className="grid grid-cols-2 gap-1">
              {backupCodes.map((code) => (
                <code key={code} className="text-sm font-mono bg-white px-2 py-1 rounded">{code}</code>
              ))}
            </div>
            <button onClick={() => setBackupCodes(null)}
              className="text-xs text-yellow-700 underline mt-3">
              I have saved these codes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
