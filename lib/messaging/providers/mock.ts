import type { SmsMmsProvider, SendSmsRequest, SendSmsResult } from "./types";

export class MockProvider implements SmsMmsProvider {
  async send(request: SendSmsRequest): Promise<SendSmsResult> {
    const vendorMessageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[MockSMS][DEV ONLY] To: ${request.to}`);
    console.log(`[MockSMS][DEV ONLY] From: ${request.from}`);
    console.log(`[MockSMS][DEV ONLY] Body: ${request.body}`);
    if (request.mediaUrls?.length) {
      console.log(`[MockSMS][DEV ONLY] Media: ${request.mediaUrls.join(", ")}`);
    }
    console.log(`[MockSMS][DEV ONLY] VendorMessageId: ${vendorMessageId}`);

    return {
      vendorMessageId,
      status: "sent",
    };
  }
}
