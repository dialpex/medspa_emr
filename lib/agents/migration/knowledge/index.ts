// Knowledge Store — Public API
//
// The Migration Agent's intelligence layer. Import from here.

export { KnowledgeStore } from "./store";
export { distill } from "./distiller";
export {
  getMappingKnowledge,
  getClassificationKnowledge,
  getFieldSemanticKnowledge,
  getIntelligenceSummary,
  lookupFieldSemantic,
  lookupFormArchetype,
} from "./retrieval";
export type {
  MappingKnowledge,
  ClassificationKnowledge,
  FieldSemanticKnowledge,
} from "./retrieval";
export type {
  KnowledgeFact,
  KnowledgeType,
  KnowledgeMetrics,
  KnowledgeQuery,
  RunOutcome,
  MappingPatternValue,
  FormArchetypeValue,
  FieldSemanticValue,
  ApiQuirkValue,
  ErrorPatternValue,
  Conviction,
} from "./types";
