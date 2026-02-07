import {
  getConversations,
  getConversationMessages,
  getMessagingPermissions,
  getMessageTemplates,
} from "@/lib/actions/messaging";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string; q?: string }>;
}) {
  const params = await searchParams;
  const [conversations, permissions, templates] = await Promise.all([
    getConversations(params.q),
    getMessagingPermissions(),
    getMessageTemplates(),
  ]);

  let messages: Awaited<ReturnType<typeof getConversationMessages>> = [];
  let activeConversation = null;

  if (params.conversationId) {
    messages = await getConversationMessages(params.conversationId);
    activeConversation = conversations.find(
      (c) => c.id === params.conversationId
    ) ?? null;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ConversationList
        conversations={conversations}
        activeId={params.conversationId}
        search={params.q}
      />
      <MessageThread
        conversation={activeConversation}
        messages={messages}
        permissions={permissions}
        templates={templates}
      />
    </div>
  );
}
