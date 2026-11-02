import { readFile, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import {
  InMemoryCredentialStore,
  InMemoryModelsStore,
} from "@earendil-works/pi-ai";
import {
  createExtensionRuntime,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  ExtensionRunner,
  type ExtensionToolContext,
  initTheme,
  ModelRegistry,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Value } from "typebox/value";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { webAnswerTool } from "../src/extensions/web-answer/tool";
import { webFetchTool } from "../src/extensions/web-fetch/tool";
import { webSearchTool } from "../src/extensions/web-search/tool";
import { STRUCTURED_MAX_BYTES } from "../src/lib/output";

let context: ExtensionToolContext;
const directories = new Set<string>();

beforeAll(async () => {
  initTheme("dark", false);
  const runtime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsStore: new InMemoryModelsStore(),
    modelsPath: null,
    refreshOnCreate: false,
  });
  const runner = new ExtensionRunner(
    [],
    createExtensionRuntime(),
    process.cwd(),
    SessionManager.inMemory(),
    new ModelRegistry(runtime),
  );
  context = runner.createToolContext("test", undefined);
});
const cases = [
  {
    tool: webSearchTool,
    params: { query: "acme" },
    response: (text: string) => ({
      results: [{ name: "Acme", url: "https://example.com", content: text }],
    }),
  },
  {
    tool: webAnswerTool,
    params: { query: "acme" },
    response: (text: string) => ({
      answer: text,
      sources: [{ name: "Acme", url: "https://example.com", snippet: text }],
    }),
  },
  {
    tool: webFetchTool,
    params: { url: "https://example.com" },
    response: (text: string) => ({ markdown: text, data: { company: "Acme" } }),
  },
];

function trackFiles(value: unknown) {
  const paths =
    JSON.stringify(value).match(
      /\/[^"\s\\]*pi-linkup-[^"\s\\]+\/(?:output\.md|output\.json)/g,
    ) ?? [];
  for (const path of paths) directories.add(dirname(path));
}

beforeEach(() => {
  vi.stubEnv("LINKUP_API_KEY", "test-key");
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(
    [...directories].map((path) => rm(path, { recursive: true, force: true })),
  );
  directories.clear();
});

describe("tool rendering", () => {
  it.each(
    cases,
  )("$tool.name renders empty successes with host keybinding hints", async ({
    tool,
    params,
    response,
  }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          tool.name === "linkup_web_fetch" ? { markdown: "" } : response(""),
        ),
      ),
    );
    const result = await tool.execute(
      "test",
      params,
      undefined,
      undefined,
      context,
    );
    const keyHint = vi.fn(() => "CONFIGURED EXPAND");
    const renderContext = {
      args: params,
      state: {},
      toolCallId: "test",
      cwd: process.cwd(),
      invalidate: vi.fn(),
      lastComponent: undefined,
      executionStarted: true,
      argsComplete: true,
      isPartial: false,
      expanded: false,
      showImages: false,
      isError: false,
      durationMs: 0,
      outputPad: 0,
      keyHint,
      keyText: () => "CONFIGURED",
    };
    if (!tool.renderResult) throw new Error("Missing renderer");
    const component = tool.renderResult(
      result,
      { expanded: false, isPartial: false },
      context.ui.theme,
      renderContext,
    );
    const text = component.render(100).join("\n");
    expect(text).toContain("CONFIGURED EXPAND");
    expect(text).not.toMatch(/failed/i);
    expect(keyHint).toHaveBeenCalledWith("app.tools.expand", "to expand");
    Reflect.deleteProperty(renderContext, "keyHint");
    expect(() =>
      tool
        .renderResult?.(
          result,
          { expanded: false, isPartial: false },
          context.ui.theme,
          renderContext,
        )
        .render(100),
    ).not.toThrow();
  });

  it.each(cases)("$tool.name renders errors from the host error flag", ({
    tool,
    params,
  }) => {
    const renderContext = {
      args: params,
      state: {},
      toolCallId: "test",
      cwd: process.cwd(),
      invalidate: vi.fn(),
      lastComponent: undefined,
      executionStarted: true,
      argsComplete: true,
      isPartial: false,
      expanded: false,
      showImages: false,
      isError: true,
      durationMs: 0,
      outputPad: 0,
      keyHint: () => "",
      keyText: () => "",
    };
    if (!tool.renderResult) throw new Error("Missing renderer");
    const component = tool.renderResult(
      {
        content: [{ type: "text", text: "Upstream unavailable" }],
        details: {},
      },
      { expanded: false, isPartial: false },
      context.ui.theme,
      renderContext,
    );
    expect(component.render(100).join("\n")).toContain("Upstream unavailable");
  });
});

describe("tool results", () => {
  it.each(
    cases,
  )("$tool.name keeps complete structured data beyond the preview limit", async ({
    tool,
    params,
    response,
  }) => {
    const fullText = "é".repeat(DEFAULT_MAX_BYTES);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response(fullText))),
    );
    const result = await tool.execute(
      "test",
      params,
      undefined,
      undefined,
      context,
    );
    trackFiles(result);
    const text = result.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(DEFAULT_MAX_BYTES);
    expect(text.split("\n").length).toBeLessThanOrEqual(DEFAULT_MAX_LINES);
    expect(result.structuredContent).toMatchObject({
      ...response(fullText),
      truncated: false,
    });
    if (!tool.outputSchema) throw new Error("Missing output schema");
    expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(true);
    expect(tool.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: true,
    });
    for (const directory of directories) {
      expect((await stat(directory)).mode & 0o077).toBe(0);
      expect((await stat(`${directory}/output.md`)).mode & 0o077).toBe(0);
    }
  });

  it.each(
    cases,
  )("$tool.name spills oversized structured data as complete private JSON", async ({
    tool,
    params,
    response,
  }) => {
    const fullText = "x".repeat(STRUCTURED_MAX_BYTES + 1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response(fullText))),
    );
    const result = await tool.execute(
      "test",
      params,
      undefined,
      undefined,
      context,
    );
    trackFiles(result);
    if (!tool.outputSchema) throw new Error("Missing output schema");
    expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(true);
    expect(result.structuredContent).toMatchObject({
      truncated: true,
      fullOutputPath: expect.any(String),
    });
    const output = Value.Parse(
      Type.Object({
        truncated: Type.Literal(true),
        fullOutputPath: Type.String(),
      }),
      result.structuredContent,
    );
    if (!output.truncated) throw new Error("Expected a spill file");
    expect(
      JSON.parse(await readFile(output.fullOutputPath, "utf8")),
    ).toMatchObject(response(fullText));
    expect((await stat(output.fullOutputPath)).mode & 0o077).toBe(0);
    expect(Buffer.byteLength(JSON.stringify(output))).toBeLessThan(
      STRUCTURED_MAX_BYTES,
    );
  });

  it("bounds the combined search output, not only each result", async () => {
    const results = Array.from({ length: 10 }, (_, index) => ({
      name: `Source ${index}`,
      url: `https://example.com/${index}`,
      content: "x".repeat(DEFAULT_MAX_BYTES),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ results })),
    );
    const result = await webSearchTool.execute(
      "test",
      { query: "acme" },
      undefined,
      undefined,
      context,
    );
    trackFiles(result);
    const text = result.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(DEFAULT_MAX_BYTES);
    expect(result.structuredContent).toMatchObject({
      results,
      truncated: false,
    });
  });

  it("bounds newline-heavy answers including their source list", async () => {
    const response = {
      answer: "line\n".repeat(DEFAULT_MAX_LINES + 10),
      sources: Array.from({ length: 10 }, () => ({
        name: "Acme",
        url: "https://example.com",
        snippet: "source\n".repeat(DEFAULT_MAX_LINES),
      })),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response)),
    );
    const result = await webAnswerTool.execute(
      "test",
      { query: "acme" },
      undefined,
      undefined,
      context,
    );
    trackFiles(result);
    const text = result.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");
    expect(text.split("\n").length).toBeLessThanOrEqual(DEFAULT_MAX_LINES);
    expect(result.structuredContent).toMatchObject({
      ...response,
      truncated: false,
    });
  });

  it.each(
    cases,
  )("$tool.name rejects malformed upstream success responses", async ({
    tool,
    params,
  }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ unexpected: true })),
    );
    await expect(
      tool.execute("test", params, undefined, undefined, context),
    ).rejects.toThrow();
  });

  it.each(
    cases,
  )("$tool.name forwards cancellation to the HTTP request", async ({
    tool,
    params,
  }) => {
    const controller = new AbortController();
    const fetch = vi.fn(async (_url, options) => {
      expect(options.signal).toBe(controller.signal);
      throw new DOMException("Aborted", "AbortError");
    });
    vi.stubGlobal("fetch", fetch);
    controller.abort();
    await expect(
      tool.execute("test", params, controller.signal, undefined, context),
    ).rejects.toThrow("Aborted");
  });
});
