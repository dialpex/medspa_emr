import type { SmsMmsProvider, SendSmsRequest, SendSmsResult } from "./types";

export class TwilioProvider implements SmsMmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID!;
    this.authToken = process.env.TWILIO_AUTH_TOKEN!;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER!;
  }

  async send(request: SendSmsRequest): Promise<SendSmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append("To", request.to);
    params.append("From", request.from || this.fromNumber);
    params.append("Body", request.body);

    if (request.mediaUrls) {
      for (const mediaUrl of request.mediaUrls) {
        params.append("MediaUrl", mediaUrl);
      }
    }

    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          vendorMessageId: "",
          status: "failed",
          errorCode: String(data.code || response.status),
          errorMessage: data.message || "Twilio API error",
        };
      }

      return {
        vendorMessageId: data.sid,
        status: "queued",
      };
    } catch (error) {
      return {
        vendorMessageId: "",
        status: "failed",
        errorCode: "NETWORK_ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
