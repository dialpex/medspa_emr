import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getStripe } from "@/lib/stripe/client";
import { processWebhookEvent } from "@/lib/services/stripe-webhooks";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    const result = await processWebhookEvent(event);
    for (const path of result.revalidatePaths) {
      revalidatePath(path);
    }
  } catch (err) {
    // Log but don't fail — event is recorded for debugging
    console.error("Webhook processing error:", err);
  }

  return NextResponse.json({ received: true });
}
