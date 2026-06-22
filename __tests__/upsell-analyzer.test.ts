import { describe, it, expect } from "vitest";
import { analyzeServiceHistory, profileToSuggestions } from "../lib/agents/upsell/analyzer";

describe("upsell analyzer", () => {
  const now = new Date();

  function daysAgo(days: number): Date {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  it("returns empty profile for no appointments", () => {
    const profile = analyzeServiceHistory([]);
    expect(profile.overdueServices).toEqual([]);
    expect(profile.frequentServices).toEqual([]);
    expect(profile.suggestedCombos).toEqual([]);
  });

  it("detects overdue services", () => {
    const appointments = [
      { startTime: daysAgo(120), serviceName: "Botox", status: "Completed" },
      { startTime: daysAgo(90), serviceName: "Botox", status: "Completed" },
      // avg interval = 30 days, last visit 90 days ago → overdue (90 > 30*1.2=36)
    ];

    const profile = analyzeServiceHistory(appointments);
    expect(profile.overdueServices).toHaveLength(1);
    expect(profile.overdueServices[0].serviceName).toBe("Botox");
    expect(profile.overdueServices[0].avgIntervalDays).toBe(30);
  });

  it("does not flag recent services as overdue", () => {
    const appointments = [
      { startTime: daysAgo(60), serviceName: "Facial", status: "Completed" },
      { startTime: daysAgo(5), serviceName: "Facial", status: "Completed" },
      // avg interval = 55 days, last visit 5 days ago → not overdue
    ];

    const profile = analyzeServiceHistory(appointments);
    expect(profile.overdueServices).toHaveLength(0);
  });

  it("identifies frequent services", () => {
    const appointments = [
      { startTime: daysAgo(180), serviceName: "Botox", status: "Completed" },
      { startTime: daysAgo(90), serviceName: "Botox", status: "Completed" },
      { startTime: daysAgo(5), serviceName: "Botox", status: "Completed" },
    ];

    const profile = analyzeServiceHistory(appointments);
    expect(profile.frequentServices).toHaveLength(1);
    expect(profile.frequentServices[0].visitCount).toBe(3);
  });

  it("suggests complementary services for botox patients", () => {
    const appointments = [
      { startTime: daysAgo(60), serviceName: "Botox", status: "Completed" },
      { startTime: daysAgo(5), serviceName: "Botox", status: "Completed" },
    ];

    const profile = analyzeServiceHistory(appointments);
    expect(profile.suggestedCombos.length).toBeGreaterThan(0);
    const comboNames = profile.suggestedCombos.map((c) => c.serviceName);
    expect(comboNames.some((n) => n.includes("Filler") || n.includes("Peel"))).toBe(true);
  });

  it("does not suggest services patient already receives", () => {
    const appointments = [
      { startTime: daysAgo(60), serviceName: "Botox", status: "Completed" },
      { startTime: daysAgo(5), serviceName: "Botox", status: "Completed" },
      { startTime: daysAgo(30), serviceName: "Dermal Filler", status: "Completed" },
      { startTime: daysAgo(10), serviceName: "Dermal Filler", status: "Completed" },
    ];

    const profile = analyzeServiceHistory(appointments);
    const comboNames = profile.suggestedCombos.map((c) => c.serviceName.toLowerCase());
    expect(comboNames).not.toContain("dermal filler");
  });

  it("skips non-completed appointments", () => {
    const appointments = [
      { startTime: daysAgo(60), serviceName: "Botox", status: "Cancelled" },
      { startTime: daysAgo(30), serviceName: "Botox", status: "NoShow" },
    ];

    const profile = analyzeServiceHistory(appointments);
    expect(profile.frequentServices).toHaveLength(0);
  });

  it("profileToSuggestions converts overdue to high urgency", () => {
    const profile = {
      overdueServices: [
        { serviceName: "Botox", lastDate: daysAgo(120).toISOString(), avgIntervalDays: 30, daysSinceLast: 120 },
      ],
      frequentServices: [],
      suggestedCombos: [],
    };

    const suggestions = profileToSuggestions(profile);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].urgency).toBe("high");
    expect(suggestions[0].title).toContain("Overdue");
  });

  it("profileToSuggestions limits to 3 suggestions", () => {
    const profile = {
      overdueServices: [
        { serviceName: "Botox", lastDate: daysAgo(120).toISOString(), avgIntervalDays: 30, daysSinceLast: 120 },
        { serviceName: "Filler", lastDate: daysAgo(200).toISOString(), avgIntervalDays: 60, daysSinceLast: 200 },
      ],
      frequentServices: [],
      suggestedCombos: [
        { serviceName: "PRP", reason: "Good combo" },
        { serviceName: "Peel", reason: "Another combo" },
      ],
    };

    const suggestions = profileToSuggestions(profile);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
