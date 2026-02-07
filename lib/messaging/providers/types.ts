export interface SendSmsRequest {
  to: string; // E.164
  from: string; // E.164
  body: string;
  mediaUrls?: string[]; // Public URLs for MMS
}

export interface SendSmsResult {
  vendorMessageId: string;
  status: "queued" | "sent" | "failed";
  errorCode?: string;
  errorMessage?: string;
}

export interface SmsMmsProvider {
  send(request: SendSmsRequest): Promise<SendSmsResult>;
}
