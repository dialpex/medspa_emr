import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getProvider } from "./providers";
import type { MessagePurpose, SmsVendor } from "@prisma/client";

export interface SendMessageInput {
  clinicId: string;
  conversationId: string;
  patientId: string;
  bodyText: string;
  mediaUrls?: string[];
  purpose: MessagePurpose;
  appointmentId?: string;
  createdByUserId: string;
  recipientPhone: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate a SHA-256 content hash for message integrity
 */
export function generateContentHash(body: string, mediaUrls?: string[]): string {
  const content = JSON.stringify({ body, mediaUrls: mediaUrls ?? [] });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

/**
 * Normalize a US phone number to E.164 format
 */
export function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

/**
 * Send a message via the configured provider
 */
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const bodyHash = generateContentHash(input.bodyText, input.mediaUrls);
  const channel = input.mediaUrls?.length ? "MMS" : "SMS";

  // Create the message record in Queued status
  const message = await prisma.message.create({
    data: {
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      direction: "Outbound",
      channel,
      purpose: input.purpose,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      bodyTextSnapshot: input.bodyText,
      bodyHash,
      mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
      status: "Queued",
      createdByUserId: input.createdByUserId,
    },
  });

  // Send via provider
  const provider = getProvider();
  const fromNumber = process.env.TWILIO_FROM_NUMBER || "+15555550000";

  const result = await provider.send({
    to: input.recipientPhone,
    from: fromNumber,
    body: input.bodyText,
    mediaUrls: input.mediaUrls,
  });

  // Determine vendor based on provider type
  const vendor: SmsVendor | null = process.env.TWILIO_ACCOUNT_SID ? "Twilio" : null;

  if (result.status === "failed") {
    // Update message to Failed
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: "Failed",
        vendor,
        vendorMessageId: result.vendorMessageId || null,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
    });

    return {
      success: false,
      messageId: message.id,
      error: result.errorMessage || "Message delivery failed",
    };
  }

  // Update message to Sent
  const now = new Date();
  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: "Sent",
      vendor,
      vendorMessageId: result.vendorMessageId,
      sentAt: now,
      // For mock provider, mark as delivered immediately
      ...(vendor === null ? { status: "Delivered", deliveredAt: now } : {}),
    },
  });

  // Update conversation preview
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: {
      lastMessageAt: now,
      lastMessagePreview: input.bodyText.length > 100
        ? input.bodyText.substring(0, 100) + "..."
        : input.bodyText,
    },
  });

  return {
    success: true,
    messageId: message.id,
  };
}
