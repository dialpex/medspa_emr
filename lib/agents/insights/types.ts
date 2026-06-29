export interface ChatContext {
  userRole: string;
  clinicId: string;
  userName: string;
}

export interface InsightsResult {
  sessionId: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  toolCallCount: number;
}
