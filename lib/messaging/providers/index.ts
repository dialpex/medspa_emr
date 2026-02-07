import type { SmsMmsProvider } from "./types";
import { MockProvider } from "./mock";
import { TwilioProvider } from "./twilio";

let providerInstance: SmsMmsProvider | null = null;

export function getProvider(): SmsMmsProvider {
  if (providerInstance) return providerInstance;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (sid && token && fromNumber) {
    providerInstance = new TwilioProvider();
  } else {
    console.warn("[Messaging] Twilio env vars not set — using MockProvider (dev only)");
    providerInstance = new MockProvider();
  }

  return providerInstance;
}
