import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchTaskManager } from "../src/extensions/web-research/manager";
import {
  createWebResearchStatusTool,
  createWebResearchTool,
} from "../src/extensions/web-research/tool";
import type { ResearchSettings } from "../src/lib/settings";
import type { LinkupResearchTask } from "../src/types";

const SETTINGS: ResearchSettings = {
  enabled: true,
  pollInitialMs: 60 * 60 * 1000, // effectively frozen during the test
  pollMaxMs: 60 * 60 * 1000,
  pollBackoffMultiplier: 2,
  maxWaitMs: 60 * 60 * 1000,
  deliverResult: "full",
};

function createHarness() {
  const sendMessage = vi.fn();
  const appendEntry = vi.fn();
  const client = { getResearch: vi.fn() };
  const manager = new ResearchTaskManager(
    { sendMessage, appendEntry },
    SETTINGS,
    {
      client: client as unknown as {
        getResearch: (id: string) => Promise<LinkupResearchTask>;
      },
    },
  );
  const research = createWebResearchTool(manager);
  const status = createWebResearchStatusTool(manager);
  return {
    research,
    status,
    manager,
    sendMessage,
    appendEntry,
    client,
  };
}

const mockResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status === 200,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);

function submittedTask(): LinkupResearchTask {
  return {
    id: "task-42",
    type: "research",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    error: null,
    input: { q: "query about x" },
    output: null,
  } as LinkupResearchTask;
}

describe("linkup_research tool", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("submits and returns immediately with the task id (fire and forget)", async () => {
    const h = createHarness();
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      mockResponse(submittedTask()),
    );

    const result = await h.research.execute(
      "call-1",
      { query: "query about x" },
      undefined,
      undefined,
      {} as never,
    );

    // Only the submission request: no polling inside the tool call.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linkup.so/v1/research");
    expect(init.method).toBe("POST");

    const text =
      result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("task-42");
    expect(text).toContain("follow-up");
    expect(text).toContain("linkup_research_status");
    expect(h.manager.get("task-42")).toMatchObject({ phase: "pending" });
    // The task was handed to the background manager.
    expect(h.appendEntry).toHaveBeenCalledWith(
      "linkup-research-task",
      expect.objectContaining({ phase: "submitted", id: "task-42" }),
    );
  });

  it("reports the expected duration by reasoning depth", async () => {
    const h = createHarness();
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      mockResponse(submittedTask()),
    );

    const result = await h.research.execute(
      "call-1",
      { query: "q", reasoningDepth: "XL" },
      undefined,
      undefined,
      {} as never,
    );

    const text =
      result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("10-20 min");
  });

  it("propagates submission failures", async () => {
    const h = createHarness();
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      mockResponse({ error: { message: "Invalid key" } }, 401),
    );

    await expect(
      h.research.execute(
        "call-1",
        { query: "q" },
        undefined,
        undefined,
        {} as never,
      ),
    ).rejects.toThrow("Invalid key");
    expect(h.manager.list()).toHaveLength(0);
  });
});

describe("linkup_research_status tool", () => {
  it("lists tracked tasks when no taskId is given", async () => {
    const h = createHarness();
    h.manager.track(submittedTask(), "query about x");

    const result = await h.status.execute(
      "call-2",
      {},
      undefined,
      undefined,
      {} as never,
    );

    const text =
      result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("task-42");
    expect(text).toContain("query about x");
  });

  it("returns no-tasks guidance for an empty session", async () => {
    const h = createHarness();

    const result = await h.status.execute(
      "call-1",
      {},
      undefined,
      undefined,
      {} as never,
    );

    const text =
      result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("No research tasks");
  });

  it("returns the completed result inline for any task id", async () => {
    const h = createHarness();
    h.client.getResearch.mockResolvedValue({
      ...submittedTask(),
      id: "old-task",
      status: "completed",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:01:00.000Z",
      output: {
        answer: "The sourced answer.",
        sources: [{ name: "Example", url: "https://example.com" }],
      },
    });

    const result = await h.status.execute(
      "call-1",
      { taskId: "old-task" },
      undefined,
      undefined,
      {} as never,
    );

    const text =
      result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("The sourced answer.");
    expect(text).toContain("https://example.com");
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("reports a still-running task", async () => {
    const h = createHarness();
    h.client.getResearch.mockResolvedValue({
      ...submittedTask(),
      status: "processing",
    });

    const result = await h.status.execute(
      "call-1",
      { taskId: "task-42" },
      undefined,
      undefined,
      {} as never,
    );

    const text =
      result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("processing");
    expect(text).toContain("follow-up");
  });

  it("throws for failed tasks", async () => {
    const h = createHarness();
    h.client.getResearch.mockResolvedValue({
      ...submittedTask(),
      status: "failed",
      error: "research engine exploded",
    });

    await expect(
      h.status.execute(
        "call-1",
        { taskId: "task-42" },
        undefined,
        undefined,
        {} as never,
      ),
    ).rejects.toThrow("research engine exploded");
  });
});
