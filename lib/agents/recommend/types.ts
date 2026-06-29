export interface OverdueService {
  serviceName: string;
  lastDate: string; // ISO date
  avgIntervalDays: number;
  daysSinceLast: number;
}

export interface FrequentService {
  serviceName: string;
  visitCount: number;
  avgIntervalDays: number;
}

export interface SuggestedCombo {
  serviceName: string;
  reason: string;
}

export interface PatientServiceProfile {
  overdueServices: OverdueService[];
  frequentServices: FrequentService[];
  suggestedCombos: SuggestedCombo[];
}

export interface UpsellSuggestion {
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
}
