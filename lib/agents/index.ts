// Agent Registry — All available agents and shared infrastructure.
//
// Shared infrastructure:
//   @/lib/agents/_shared/llm   — LLMProvider interface + implementations
//   @/lib/agents/_shared/phi   — PHI redaction and safe context building
//   @/lib/agents/_shared/memory — File-based caching utilities
//
// Agents:
//   @/lib/agents/migration     — Data migration intelligence (schema discovery, mapping)
//   @/lib/agents/clinical      — Clinical draft generation
//   @/lib/agents/chat          — AI chat assistant (AI OS)
//   @/lib/agents/templates     — Template generation/import prompts and schemas

export { getLLMProvider } from "./_shared/llm";
export type { LLMProvider, LLMProviderConfig } from "./_shared/llm";
export { getAiProvider } from "./chat";
export type { AiProvider } from "./chat";
