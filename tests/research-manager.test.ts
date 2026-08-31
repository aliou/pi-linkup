import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MESSAGE_TYPE_RESEARCH_RESULT,
  ResearchTaskManager,
} from "../src/extensions/web-research/manager";
import type { ResearchSettings } from "../src/lib/settings";
import type { LinkupResearchTask } from "../src/types";

const SETTINGS: ResearchSettings = {
  enabled: true,
  pollInitialMs: 2000,
  pollMaxMs: 10000,
  pollBackoffMultiplier: 2,
  maxWaitMs: 20 * 60 * 1000,
  deliverResult: "full",
};

const completedOutput = (answer = "The answer.") => ({
  answer,
  sources: [
    { name: "Example", url: "https://example.com", snippet: "Example snippet" },
  ],
});

function makeTask(
  overrides: Partial<LinkupResearchTask> = {},
): LinkupResearchTask {
  return {
    id: "task-1",
    type: "research",
    status: "pending",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    error: null,
    input: { q: "test query" },
    output: null,
    ...overrides,
  } as LinkupResearchTask;
}

interface TestHarness {
  manager: ResearchTaskManager;
  sendMessage: ReturnType<typeof vi.fn>;
  appendEntry: ReturnType<typeof vi.fn>;
  client: { getResearch: ReturnType<typeof vi.fn> };
}

function createHarness(settings: Partial<ResearchSettings> = {}): TestHarness {
  const sendMessage = vi.fn();
  const appendEntry = vi.fn();
  const client = { getResearch: vi.fn() };
  const manager = new ResearchTaskManager(
    { sendMessage, appendEntry },
    { ...SETTINGS, ...settings },
    {
      client: client as unknown as {
        getResearch: (id: string) => Promise<LinkupResearchTask>;
      },
    },
  );
  return { manager, sendMessage, appendEntry, client };
}

describe("ResearchTaskManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks a submitted task and writes a session entry", async () => {
    const h = createHarness();
    h.client.getResearch.mockResolvedValue(makeTask({ status: "pending" }));

    h.manager.track(makeTask(), "test query");

    await vi.advanceTimersByTimeAsync(0);
    expect(h.appendEntry).toHaveBeenCalledWith(
      "linkup-research-task",
      expect.objectContaining({ phase: "submitted", id: "task-1" }),
    );
    expect(h.manager.list()).toHaveLength(1);
    expect(h.manager.list()[0]).toMatchObject({
      id: "task-1",
      phase: "pending",
      finished: false,
    });
  });

  it("polls with backoff until completion and delivers the result as a follow-up", async () => {
    const h = createHarness();
    const pending = makeTask({ status: "pending" });
    const processing = makeTask({ status: "processing" });
    const completed = makeTask({
      status: "completed",
      output: completedOutput(),
      updatedAt: new Date("2026-01-01T00:00:30.000Z").toISOString(),
    });
    h.client.getResearch
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(completed);

    h.manager.track(makeTask(), "test query");

    await vi.advanceTimersByTimeAsync(2000); // first poll (initial interval)
    await vi.advanceTimersByTimeAsync(4000); // second poll (2s * 2)
    await vi.advanceTimersByTimeAsync(8000); // third poll (4s * 2)

    expect(h.client.getResearch).toHaveBeenCalledTimes(3);
    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    const call = h.sendMessage.mock.calls[0];
    expect(call[0]).toMatchObject({
      customType: MESSAGE_TYPE_RESEARCH_RESULT,
      display: true,
    });
    expect(call[0].content).toContain("test query");
    expect(call[0].content).toContain("The answer.");
    expect(call[0].content).toContain("https://example.com");
    expect(call[1]).toEqual({ triggerTurn: true, deliverAs: "followUp" });
    expect(h.manager.get("task-1")).toMatchObject({
      phase: "completed",
      finished: true,
    });
    expect(h.appendEntry).toHaveBeenCalledWith(
      "linkup-research-task",
      expect.objectContaining({ phase: "finished", status: "completed" }),
    );
  });

  it("delivers a short ping instead of the full answer in ping mode", async () => {
    const h = createHarness({ deliverResult: "ping" });
    const completed = makeTask({
      status: "completed",
      output: completedOutput("A very long answer.".repeat(50)),
    });
    h.client.getResearch.mockResolvedValue(completed);

    h.manager.track(makeTask(), "test query");
    await vi.advanceTimersByTimeAsync(2000);

    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.sendMessage.mock.calls[0][0].content).toContain(
      'taskId: "task-1"',
    );
    expect(h.sendMessage.mock.calls[0][0].content).not.toContain(
      "A very long answer.",
    );
  });

  it("delivers an error message when the task fails", async () => {
    const h = createHarness();
    h.client.getResearch.mockResolvedValue(
      makeTask({ status: "failed", error: "boom" }),
    );

    h.manager.track(makeTask(), "test query");
    await vi.advanceTimersByTimeAsync(2000);

    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.sendMessage.mock.calls[0][0].content).toContain("boom");
    expect(h.manager.get("task-1")).toMatchObject({
      phase: "failed",
      finished: true,
    });
  });

  it("stops polling and notifies when the maxWaitMs deadline is exceeded", async () => {
    const h = createHarness({ maxWaitMs: 5000 });
    h.client.getResearch.mockResolvedValue(makeTask({ status: "pending" }));

    h.manager.track(makeTask(), "test query");

    await vi.advanceTimersByTimeAsync(2000); // first poll, elapsed ~2s
    await vi.advanceTimersByTimeAsync(4000); // next sleep would end at ~6s > 5s

    expect(h.manager.get("task-1")?.phase).toBe("expired");
    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.sendMessage.mock.calls[0][0].content).toContain("deadline");
    // No further polling after the deadline.
    const calls = h.client.getResearch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(h.client.getResearch.mock.calls.length).toBe(calls);
  });

  it("keeps polling through transient poll errors", async () => {
    const h = createHarness();
    const completed = makeTask({
      status: "completed",
      output: completedOutput(),
    });
    h.client.getResearch
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(completed);

    h.manager.track(makeTask(), "test query");
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.manager.get("task-1")?.phase).toBe("completed");
  });

  it("stop() ends all polling on session shutdown", async () => {
    const h = createHarness();
    h.client.getResearch.mockResolvedValue(makeTask({ status: "pending" }));

    h.manager.track(makeTask(), "test query");
    h.manager.stop();
    await vi.advanceTimersByTimeAsync(120000);

    expect(h.client.getResearch).not.toHaveBeenCalled();
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("check() returns the inline result without duplicating the follow-up", async () => {
    const h = createHarness();
    const completed = makeTask({
      status: "completed",
      output: completedOutput(),
    });
    h.client.getResearch.mockResolvedValue(completed);

    h.manager.track(makeTask(), "test query");
    // The user checks status before the first poll fires.
    const result = await h.manager.check("task-1");

    expect(result.snapshot.phase).toBe("completed");
    expect(result.remote.status).toBe("completed");
    // The status tool renders the answer inline: no follow-up message.
    expect(h.sendMessage).not.toHaveBeenCalled();
    // The poll loop must not deliver a second copy afterwards.
    await vi.advanceTimersByTimeAsync(120000);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("check() works for tasks unknown to this session (server-side persistence)", async () => {
    const h = createHarness();
    const completed = makeTask({
      id: "old-task",
      status: "completed",
      output: completedOutput(),
    });
    h.client.getResearch.mockResolvedValue(completed);

    const result = await h.manager.check("old-task");

    expect(result.snapshot.id).toBe("old-task");
    expect(result.snapshot.query).toBe("test query");
    expect(result.snapshot.finished).toBe(true);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("gives recovered tasks a fresh poll budget (old submissions are not instantly expired)", async () => {
    const h = createHarness({ maxWaitMs: 5000 });
    const completed = makeTask({
      status: "completed",
      output: completedOutput(),
    });
    h.client.getResearch.mockResolvedValue(completed);

    // A task submitted hours ago (e.g. from a resumed session).
    h.manager.recoverFromEntries([
      {
        type: "custom",
        data: {
          phase: "submitted",
          id: "ancient-task",
          query: "ancient query",
          submittedAt: Date.now() - 3 * 60 * 60 * 1000,
        },
      },
    ]);

    await vi.advanceTimersByTimeAsync(2000);

    expect(h.client.getResearch).toHaveBeenCalledWith("ancient-task");
    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.sendMessage.mock.calls[0][0].content).toContain("ancient query");
    expect(h.manager.get("ancient-task")?.phase).toBe("completed");
  });

  it("recovers unfinished tasks from session entries on reattach", async () => {
    const h = createHarness();
    const completed = makeTask({
      status: "completed",
      output: completedOutput(),
    });
    h.client.getResearch.mockResolvedValue(completed);

    h.manager.recoverFromEntries([
      {
        type: "custom",
        data: {
          phase: "submitted",
          id: "task-9",
          query: "resumed query",
          submittedAt: Date.now(),
        },
      },
      // A finished task must not be re-polled.
      {
        type: "custom",
        data: { phase: "finished", id: "task-8", status: "completed" },
      },
    ]);

    const before = h.manager
      .list()
      .map((t) => t.id)
      .sort();
    expect(before).toEqual(["task-9"]);

    await vi.advanceTimersByTimeAsync(2000);
    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.sendMessage.mock.calls[0][0].content).toContain("resumed query");
  });

  it("ignores re-tracking of a known task id", async () => {
    const h = createHarness();
    h.client.getResearch.mockResolvedValue(makeTask());

    h.manager.track(makeTask(), "first");
    h.manager.track(makeTask(), "second");

    expect(h.manager.list()).toHaveLength(1);
    expect(h.manager.list()[0]?.query).toBe("first");
  });
});
