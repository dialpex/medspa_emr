import { formatGiftCardCode } from "@/lib/utils/gift-card-code";

type GiftCardEmailData = {
  code: string;
  amount: number;
  buyerName: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  expiresAt: Date;
  clinicName?: string;
};

export async function sendGiftCardEmail(data: GiftCardEmailData): Promise<void> {
  const formattedCode = formatGiftCardCode(data.code);
  const expiresFormatted = data.expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const emailContent = [
    `To: ${data.recipientEmail}`,
    `Subject: You've received a $${data.amount.toFixed(2)} gift card!`,
    ``,
    `Hi ${data.recipientName || "there"},`,
    ``,
    `You've received a $${data.amount.toFixed(2)} gift card${data.buyerName ? ` from ${data.buyerName}` : ""}!`,
    ``,
    `Your code: ${formattedCode}`,
    `Expires: ${expiresFormatted}`,
    ``,
    `Book an appointment to use your gift card.`,
  ].join("\n");

  // Stub: log for now — no email provider configured yet
  console.log("[GiftCard Email Stub]", emailContent);
}
