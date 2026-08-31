import { describe, expect, it, vi } from "vitest";
import {
  RESEARCH_SETTINGS_DEFAULTS,
  RESEARCH_TOOL_NAMES,
  sanitizeResearchSettings,
  setResearchToolsActive,
} from "../src/lib/settings";

describe("sanitizeResearchSettings", () => {
  it("fills defaults for an empty config", () => {
    expect(sanitizeResearchSettings({})).toEqual(RESEARCH_SETTINGS_DEFAULTS);
  });

  it("preserves valid values", () => {
    expect(
      sanitizeResearchSettings({
        enabled: true,
        pollInitialMs: 5000,
        pollMaxMs: 20000,
        pollBackoffMultiplier: 3,
        maxWaitMs: 30 * 60 * 1000,
        deliverResult: "ping",
      }),
    ).toEqual({
      enabled: true,
      pollInitialMs: 5000,
      pollMaxMs: 20000,
      pollBackoffMultiplier: 3,
      maxWaitMs: 30 * 60 * 1000,
      deliverResult: "ping",
    });
  });

  it("never polls faster than once per second (min pollInitialMs 1000)", () => {
    const s = sanitizeResearchSettings({ pollInitialMs: 50, pollMaxMs: 100 });
    expect(s.pollInitialMs).toBe(1000);
    expect(s.pollMaxMs).toBeGreaterThanOrEqual(s.pollInitialMs);
  });

  it("raises pollMaxMs to at least pollInitialMs", () => {
    const s = sanitizeResearchSettings({
      pollInitialMs: 8000,
      pollMaxMs: 2000,
    });
    expect(s.pollMaxMs).toBe(8000);
  });

  it("clamps backoff multiplier to [1, 5]", () => {
    expect(
      sanitizeResearchSettings({ pollBackoffMultiplier: 0 })
        .pollBackoffMultiplier,
    ).toBe(2);
    expect(
      sanitizeResearchSettings({ pollBackoffMultiplier: 99 })
        .pollBackoffMultiplier,
    ).toBe(5);
  });

  it("enforces a maxWaitMs deadline of at least pollMaxMs", () => {
    const s = sanitizeResearchSettings({ maxWaitMs: 100 });
    expect(s.maxWaitMs).toBeGreaterThanOrEqual(s.pollMaxMs);
  });

  it("normalizes invalid deliverResult to full", () => {
    expect(
      sanitizeResearchSettings({ deliverResult: "carrier-pigeon" as never })
        .deliverResult,
    ).toBe("full");
  });
});

describe("setResearchToolsActive", () => {
  function createPi(active: string[]) {
    const pi = {
      activeTools: [...active],
      getActiveTools: () => pi.activeTools,
      setActiveTools: vi.fn((tools: string[]) => {
        pi.activeTools = [...tools];
      }),
    };
    return pi;
  }

  it("adds the research tools when enabling and absent", () => {
    const pi = createPi(["read", "linkup_web_search"]);
    setResearchToolsActive(pi as never, true);
    expect(pi.setActiveTools).toHaveBeenCalledTimes(1);
    expect(pi.setActiveTools).toHaveBeenCalledWith([
      "read",
      "linkup_web_search",
      ...RESEARCH_TOOL_NAMES,
    ]);
  });

  it("removes the research tools when disabling and present", () => {
    const pi = createPi(["read", "linkup_research", "linkup_research_status"]);
    setResearchToolsActive(pi as never, false);
    expect(pi.setActiveTools).toHaveBeenCalledWith(["read"]);
  });

  it("is a no-op when the state already matches", () => {
    const off = createPi(["read"]);
    setResearchToolsActive(off as never, false);
    expect(off.setActiveTools).not.toHaveBeenCalled();

    const on = createPi(["read", "linkup_research"]);
    setResearchToolsActive(on as never, true);
    expect(on.setActiveTools).not.toHaveBeenCalled();
  });
});
