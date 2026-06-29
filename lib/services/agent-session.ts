// Agent session service — CRUD for persistent AI agent conversations.

import { prisma } from "@/lib/prisma";

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
}

export async function createSession(
  clinicId: string,
  userId: string,
  agentType: string
) {
  return prisma.agentSession.create({
    data: { clinicId, userId, agentType, messages: "[]" },
  });
}

export async function appendMessage(
  sessionId: string,
  message: SessionMessage
) {
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const messages: SessionMessage[] = JSON.parse(session.messages);
  messages.push(message);

  return prisma.agentSession.update({
    where: { id: sessionId },
    data: { messages: JSON.stringify(messages) },
  });
}

export async function appendMessages(
  sessionId: string,
  newMessages: SessionMessage[]
) {
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const messages: SessionMessage[] = JSON.parse(session.messages);
  messages.push(...newMessages);

  return prisma.agentSession.update({
    where: { id: sessionId },
    data: { messages: JSON.stringify(messages) },
  });
}

export async function getSession(sessionId: string) {
  return prisma.agentSession.findUnique({
    where: { id: sessionId },
  });
}

export async function getSessionMessages(
  sessionId: string
): Promise<SessionMessage[]> {
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return [];
  return JSON.parse(session.messages);
}

export async function listSessions(
  clinicId: string,
  userId: string,
  agentType?: string
) {
  return prisma.agentSession.findMany({
    where: {
      clinicId,
      userId,
      ...(agentType ? { agentType } : {}),
      status: "active",
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function completeSession(sessionId: string) {
  return prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: "completed" },
  });
}
