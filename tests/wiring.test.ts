import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { __resetSettingsLoaderForTests } from "../src/lib/settings";

function createMockPi(activeTools: string[] = []) {
  const pi = {
    tools: [] as Array<{ name: string }>,
    activeTools: [...activeTools],
    handlers: new Map<string, Array<(...args: unknown[]) => unknown>>(),
    renderers: new Map<string, unknown>(),
    entries: [] as Array<{ type: string; customType?: string; data?: unknown }>,
    sendMessage: vi.fn(),
    appendEntry: vi.fn((customType: string, data: unknown) => {
      pi.entries.push({ type: "custom", customType, data });
    }),
    registerTool: vi.fn((tool: { name: string }) => {
      pi.tools.push(tool);
      // Real pi activates extension-registered tools by default.
      pi.activeTools.push(tool.name);
    }),
    registerCommand: vi.fn(),
    registerMessageRenderer: vi.fn((customType: string, renderer: unknown) => {
      pi.renderers.set(customType, renderer);
    }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      pi.handlers.set(event, (pi.handlers.get(event) ?? []).concat(handler));
    }),
    getActiveTools: () => pi.activeTools,
    setActiveTools: vi.fn((tools: string[]) => {
      pi.activeTools = [...tools];
    }),
    sessionManager: {
      getEntries: () => pi.entries,
    },
  };
  return pi;
}

import commandSettingsExtension from "../src/extensions/command-settings/index";
import webResearchExtension from "../src/extensions/web-research/index";

const wrappers: Record<
  string,
  (pi: ReturnType<typeof createMockPi>) => Promise<void>
> = {
  "web-research": webResearchExtension as never,
  "command-settings": commandSettingsExtension as never,
};

function loadExtension(name: string, pi: ReturnType<typeof createMockPi>) {
  return wrappers[name]?.(pi);
}

describe("extension wiring", () => {
  let homeBackup: string | undefined;
  let tempHome: string;
  let linkupKeyBackup: string | undefined;

  beforeAll(() => {
    homeBackup = process.env.HOME;
    tempHome = mkdtempSync(join(tmpdir(), "pi-linkup-test-"));
    // Isolate settings from the real user config: the loader resolves
    // ~/.pi/agent/extensions/pi-linkup.json. With an empty temp HOME the
    // research tools are disabled by default.
    process.env.HOME = tempHome;
    linkupKeyBackup = process.env.LINKUP_API_KEY;
    process.env.LINKUP_API_KEY = process.env.LINKUP_API_KEY ?? "test-key";
  });

  afterAll(() => {
    if (homeBackup) process.env.HOME = homeBackup;
    if (linkupKeyBackup === undefined) delete process.env.LINKUP_API_KEY;
    rmSync(tempHome, { recursive: true, force: true });
    __resetSettingsLoaderForTests();
  });

  beforeEach(() => {
    __resetSettingsLoaderForTests();
  });

  it("web-research registers both tools + renderer and deactivates them by default", async () => {
    const pi = createMockPi(["read"]);
    await loadExtension("web-research", pi);

    expect(pi.tools.map((t) => t.name)).toEqual([
      "linkup_research",
      "linkup_research_status",
    ]);
    expect(pi.renderers.has("linkup-research-result")).toBe(true);
    // Registered = active per pi defaults...
    expect(pi.activeTools).toContain("linkup_research");

    // ...until session_start applies the opt-in gate (default: off).
    await pi.handlers.get("session_start")?.[0]?.({}, pi);
    expect(pi.setActiveTools).toHaveBeenCalledWith(["read"]);
    expect(pi.activeTools).toEqual(["read"]);
  });

  it("web-research reattaches pending tasks from session entries", async () => {
    const pi = createMockPi(["read"]);
    await loadExtension("web-research", pi);
    // A task submitted earlier in the session lineage (e.g. before resume):
    pi.entries.push({
      type: "custom",
      customType: "linkup-research-task",
      data: {
        phase: "submitted",
        id: "task-x",
        query: "old query",
        submittedAt: Date.now(),
      },
    });

    await pi.handlers.get("session_start")?.[0]?.({}, pi);
    // The task is now tracked (server-side polling in the background).
    // No send/append side effects before any poll fires.
    expect(pi.sendMessage).not.toHaveBeenCalled();
  });

  it("web-research stops polling on session_shutdown", async () => {
    const pi = createMockPi();
    await loadExtension("web-research", pi);
    const shutdown = pi.handlers.get("session_shutdown")?.[0];
    expect(shutdown).toBeTruthy();
    expect(() => shutdown?.()).not.toThrow();
  });

  it("command-settings registers the /linkup:settings command", async () => {
    const pi = createMockPi();
    await loadExtension("command-settings", pi);

    expect(pi.registerCommand).toHaveBeenCalledTimes(1);
    const [name, options] = (pi.registerCommand as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [string, { handler: () => Promise<unknown> }];
    expect(name).toBe("linkup:settings");
    expect(typeof options.handler).toBe("function");
  });
});
