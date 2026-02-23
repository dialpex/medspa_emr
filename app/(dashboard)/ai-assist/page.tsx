import { isFeatureEnabled } from "@/lib/feature-flags";
import { FeatureGate } from "@/components/feature-gate";
import AiChatClient from "./ai-chat-client";

export default async function AiAssistPage() {
  if (!(await isFeatureEnabled("ai_chat"))) {
    return <FeatureGate feature="ai_chat" />;
  }

  return <AiChatClient />;
}
