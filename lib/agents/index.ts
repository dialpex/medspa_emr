// Agent Registry — All available agents and shared infrastructure.
//
// Shared infrastructure:
//   @/lib/agents/_shared/llm   — LLMProvider interface + implementations
//   @/lib/agents/_shared/phi   — PHI redaction and safe context building
//   @/lib/agents/_shared/memory — File-based caching utilities
//
// Agents (Neuvvia-branded):
//   @/lib/agents/insights      — Neuvvia Insights: conversational AI copilot
//   @/lib/agents/copilot       — Neuvvia Copilot: template builder assistant
//   @/lib/agents/recommend     — Neuvvia Recommend: smart service suggestions
//   @/lib/agents/migrate       — Neuvvia Migrate: data migration intelligence
//   @/lib/agents/scribe        — Neuvvia Scribe: voice-to-chart drafting (future)

export { getLLMProvider } from "./_shared/llm";
export type { LLMProvider, LLMProviderConfig } from "./_shared/llm";
export { getAiProvider } from "./insights";
export type { AiProvider } from "./insights";
