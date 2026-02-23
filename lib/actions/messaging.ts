"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  enforceTenantIsolation,
  hasPermission,
} from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-flags";
import { revalidatePath } from "next/cache";
import { sendMessage, normalizeToE164 } from "@/lib/messaging/service";
import type { MessagePurpose, MessageChannel } from "@prisma/client";

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get all conversations for the current clinic
 */
export async function getConversations(search?: string) {
  await requireFeature("sms_messaging");
  const user = await requirePermission("messaging", "view");

  const where: Record<string, unknown> = { clinicId: user.clinicId };

  if (search) {
    where.patient = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    };
  }

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      patient: {
        include: {
          communicationPreference: true,
        },
      },
    },
    orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
  });

  return conversations;
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(conversationId: string) {
  await requireFeature("sms_messaging");
  const user = await requirePermission("messaging", "view");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    return [];
  }

  enforceTenantIsolation(user, conversation.clinicId);

  // Reset unread count
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      clinicId: user.clinicId,
      userId: user.id,
      action: "ConversationView",
      entityType: "Conversation",
      entityId: conversationId,
    },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return messages;
}

/**
 * Send a message in a conversation
 */
export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
  channel?: MessageChannel;
  purpose?: MessagePurpose;
  mediaUrls?: string[];
  appointmentId?: string;
}): Promise<ActionResult<{ messageId: string }>> {
  await requireFeature("sms_messaging");
  const user = await requirePermission("messaging", "create");

  // Find conversation and verify tenant isolation
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      patient: {
        include: {
          communicationPreference: true,
        },
      },
    },
  });

  if (!conversation) {
    return { success: false, error: "Conversation not found" };
  }

  enforceTenantIsolation(user, conversation.clinicId);

  // Check opt-in
  const pref = conversation.patient.communicationPreference;
  if (!pref?.smsOptIn) {
    return { success: false, error: "Patient has not opted in to SMS messaging" };
  }

  // Check phone
  const phone = pref.phoneE164 || conversation.patient.phone;
  if (!phone) {
    return { success: false, error: "Patient has no phone number on file" };
  }

  const recipientPhone = normalizeToE164(phone);

  const result = await sendMessage({
    clinicId: user.clinicId,
    conversationId: input.conversationId,
    patientId: conversation.patientId,
    bodyText: input.body,
    mediaUrls: input.mediaUrls,
    purpose: input.purpose || "Generic",
    appointmentId: input.appointmentId,
    createdByUserId: user.id,
    recipientPhone,
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      clinicId: user.clinicId,
      userId: user.id,
      action: result.success ? "MessageSend" : "MessageFailed",
      entityType: "Message",
      entityId: result.messageId,
      details: JSON.stringify({
        conversationId: input.conversationId,
        patientId: conversation.patientId,
        purpose: input.purpose || "Generic",
        error: result.error,
      }),
    },
  });

  revalidatePath("/inbox");

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: { messageId: result.messageId! } };
}

/**
 * Retry a failed message
 */
export async function retryMessageAction(
  messageId: string
): Promise<ActionResult<{ messageId: string }>> {
  const user = await requirePermission("messaging", "create");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    return { success: false, error: "Message not found" };
  }

  enforceTenantIsolation(user, message.clinicId);

  if (message.status !== "Failed") {
    return { success: false, error: "Only failed messages can be retried" };
  }

  return sendMessageAction({
    conversationId: message.conversationId,
    body: message.bodyTextSnapshot,
    purpose: message.purpose,
    mediaUrls: message.mediaUrls ? JSON.parse(message.mediaUrls) : undefined,
    appointmentId: message.appointmentId || undefined,
  });
}

/**
 * Get active message templates for the clinic
 */
export async function getMessageTemplates() {
  const user = await requirePermission("messaging", "view");

  return prisma.messageTemplate.findMany({
    where: {
      clinicId: user.clinicId,
      isActive: true,
    },
    orderBy: { key: "asc" },
  });
}

/**
 * Get messaging permissions for the current user
 */
export async function getMessagingPermissions() {
  const user = await requirePermission("messaging", "view");

  return {
    canView: true,
    canSend: hasPermission(user.role, "messaging", "create"),
  };
}

/**
 * Get total unread message count across all conversations
 */
export async function getTotalUnreadCount(): Promise<number> {
  try {
    const user = await requirePermission("messaging", "view");

    const result = await prisma.conversation.aggregate({
      where: { clinicId: user.clinicId },
      _sum: { unreadCount: true },
    });

    return result._sum.unreadCount || 0;
  } catch {
    return 0;
  }
}
