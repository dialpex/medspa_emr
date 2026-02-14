export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  userRole: string;
  clinicId: string;
  userName: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context: ChatContext;
}

export interface ClarifyChoice {
  id: string;
  label: string;
}

export interface PlanStep {
  step_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  preview: string;
}

export interface ClarifyResponse {
  type: "clarify";
  domain: string;
  rationale_muted: string;
  clarification: {
    question: string;
    choices: ClarifyChoice[];
  };
  plan: null;
  result: null;
  permission_check: { allowed: boolean; reason_if_denied: string | null };
}

export interface PlanResponse {
  type: "plan";
  domain: string;
  rationale_muted: string;
  clarification: null;
  plan: {
    execution_mode_prompt: boolean;
    steps: PlanStep[];
    confirm_prompt: string;
  };
  result: null;
  permission_check: { allowed: boolean; reason_if_denied: string | null };
}

export interface ResultResponse {
  type: "result";
  domain: string;
  rationale_muted: string;
  clarification: null;
  plan: null;
  result: {
    summary: string;
    details: Record<string, unknown>;
  };
  permission_check: { allowed: boolean; reason_if_denied: string | null };
}

export interface RefuseResponse {
  type: "refuse";
  domain: string;
  rationale_muted: string;
  clarification: null;
  plan: null;
  result: null;
  permission_check: { allowed: boolean; reason_if_denied: string | null };
}

export type AIResponse =
  | ClarifyResponse
  | PlanResponse
  | ResultResponse
  | RefuseResponse;

export interface AiProvider {
  chat(request: ChatRequest): Promise<AIResponse>;
}
