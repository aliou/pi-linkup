import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  InMemoryCredentialStore,
  InMemoryModelsStore,
  validateToolArguments,
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
import {
  STRUCTURED_MAX_BYTES,
  structuredOutputSchema,
} from "../src/lib/output";

let context: ExtensionToolContext;
let agentDirectory: string;
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

beforeEach(async () => {
  vi.stubEnv("LINKUP_API_KEY", "test-key");
  agentDirectory = await mkdtemp(join(tmpdir(), "pi-linkup-test-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", agentDirectory);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(
    [...directories, agentDirectory].map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
  directories.clear();
});

describe("tool rendering", () => {
  it.each(cases)(
    "$tool.name renders empty successes with host keybinding hints",
    async ({ tool, params, response }) => {
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
    },
  );

  it.each(cases)(
    "$tool.name renders errors from the host error flag",
    ({ tool, params }) => {
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
      expect(component.render(100).join("\n")).toContain(
        "Upstream unavailable",
      );
    },
  );
});

describe("structured search and rich content", () => {
  it.each(["flash", "fast", "standard", "deep"] as const)(
    "returns typed %s search data with sources and the composition rate",
    async (depth) => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      const sources = [
        {
          type: "text",
          name: "Acme",
          url: "https://example.com",
          content: "Acme",
          favicon: "",
        },
      ];
      let body: unknown;
      const fetch = vi.fn<typeof global.fetch>(async (url, options) => {
        body = await new Request(url, options).json();
        return Response.json({ data: { name: "Acme" }, sources });
      });
      vi.stubGlobal("fetch", fetch);
      const result = await webSearchTool.execute(
        "test",
        {
          query: "acme",
          depth,
          schema,
          limit: 3,
          includeDomains: ["example.com"],
        },
        undefined,
        undefined,
        context,
      );
      expect(body).toEqual({
        q: "acme",
        depth,
        outputType: "structured",
        structuredOutputSchema: JSON.stringify(schema),
        includeSources: true,
        maxResults: 3,
        includeDomains: ["example.com"],
      });
      expect(result.structuredContent).toEqual({
        query: "acme",
        data: { name: "Acme" },
        results: sources,
        truncated: false,
      });
      expect(result.content).toEqual([
        expect.objectContaining({
          text: expect.stringContaining('"name": "Acme"'),
        }),
      ]);
      expect(result.usage?.cost.total).toBe(depth === "deep" ? 0.055 : 0.006);
      expect(fetch).toHaveBeenCalledTimes(1);
      if (!webSearchTool.outputSchema) throw new Error("Missing output schema");
      expect(
        Value.Check(webSearchTool.outputSchema, result.structuredContent),
      ).toBe(true);
    },
  );

  it("renders typed search data without requiring any source results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: { name: "Acme" }, sources: [] })),
    );
    const params = { query: "acme", schema: { type: "object" } };
    const result = await webSearchTool.execute(
      "test",
      params,
      undefined,
      undefined,
      context,
    );
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
      keyHint: () => "EXPAND DATA",
      keyText: () => "",
    };
    if (!webSearchTool.renderResult) throw new Error("Missing renderer");
    const collapsed = webSearchTool
      .renderResult(
        result,
        { expanded: false, isPartial: false },
        context.ui.theme,
        renderContext,
      )
      .render(100)
      .join("\n");
    expect(collapsed).toContain("EXPAND DATA");
    expect(collapsed).not.toContain("no results");
    const expanded = webSearchTool
      .renderResult(
        result,
        { expanded: true, isPartial: false },
        context.ui.theme,
        renderContext,
      )
      .render(100)
      .join("\n");
    expect(expanded).toContain("Acme");
    expect(expanded).toContain("Structured Data");
  });

  it("rejects a non-object search schema without sending a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      webSearchTool.execute(
        "test",
        { query: "acme", schema: { type: "array" } },
        undefined,
        undefined,
        context,
      ),
    ).rejects.toThrow("type 'object'");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { sources: [] },
    { data: "invalid", sources: [] },
    { data: {}, sources: "invalid" },
    { data: {}, sources: [{ name: "Acme" }] },
  ])("rejects malformed structured search responses %j", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response)),
    );
    await expect(
      webSearchTool.execute(
        "test",
        { query: "acme", schema: { type: "object" } },
        undefined,
        undefined,
        context,
      ),
    ).rejects.toThrow();
  });

  it.each([DEFAULT_MAX_BYTES * 2, STRUCTURED_MAX_BYTES * 2])(
    "retains complete %i-byte structured search data independently of the preview",
    async (size) => {
      const data = { description: "x".repeat(size) };
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ data, sources: [] })),
      );
      const result = await webSearchTool.execute(
        "test",
        { query: "acme", schema: { type: "object" } },
        undefined,
        undefined,
        context,
      );
      trackFiles(result);
      expect(
        Buffer.byteLength(JSON.stringify(result.content)),
      ).toBeLessThanOrEqual(DEFAULT_MAX_BYTES);
      const output = Value.Parse(
        structuredOutputSchema(
          Type.Object({ data: Type.Record(Type.String(), Type.Any()) }),
        ),
        result.structuredContent,
      );
      if (output.truncated) {
        const spilled = await readFile(output.fullOutputPath, "utf8");
        expect(JSON.parse(spilled).data).toEqual(data);
        const stats = await stat(output.fullOutputPath);
        expect(stats.mode & 0o777).toBe(0o600);
      } else expect(output.data).toEqual(data);
      expect(output.truncated).toBe(size > STRUCTURED_MAX_BYTES);
    },
  );

  it.each([true, false])(
    "forwards includeImages=%s and retains image search results",
    async (includeImages) => {
      const results = [
        {
          type: "image",
          name: "Acme logo",
          url: "https://example.com/logo.png",
        },
      ];
      let body: unknown;
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof global.fetch>(async (url, options) => {
          body = await new Request(url, options).json();
          return Response.json({ results });
        }),
      );
      const result = await webSearchTool.execute(
        "test",
        { query: "acme", includeImages },
        undefined,
        undefined,
        context,
      );
      expect(body).toMatchObject({ includeImages });
      expect(result.structuredContent).toMatchObject({ results });
      expect(result.usage?.cost.total).toBe(0.005);
    },
  );

  it.each([true, false])(
    "forwards raw-content/image fetch flags=%s and keeps returned fields",
    async (enabled) => {
      const response = {
        markdown: "Acme",
        rawContent: "<h1>Acme</h1>",
        contentType: "html",
        images: [{ alt: "Acme logo", url: "https://example.com/logo.png" }],
        data: { name: "Acme" },
      };
      let body: unknown;
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof global.fetch>(async (url, options) => {
          body = await new Request(url, options).json();
          return Response.json(response);
        }),
      );
      const result = await webFetchTool.execute(
        "test",
        {
          url: "https://example.com",
          includeRawContent: enabled,
          extractImages: enabled,
        },
        undefined,
        undefined,
        context,
      );
      expect(body).toMatchObject({
        includeRawContent: enabled,
        extractImages: enabled,
        renderJs: true,
      });
      expect(result.structuredContent).toEqual({
        url: "https://example.com",
        ...response,
        truncated: false,
      });
      expect(result.content).toEqual([
        expect.objectContaining({
          text: expect.stringContaining("<h1>Acme</h1>"),
        }),
      ]);
      expect(result.usage?.cost.total).toBe(0.005);
      if (!webFetchTool.outputSchema) throw new Error("Missing output schema");
      expect(
        Value.Check(webFetchTool.outputSchema, result.structuredContent),
      ).toBe(true);
    },
  );

  it.each([
    { markdown: "Acme", images: [{ url: "https://example.com/logo.png" }] },
    { markdown: "Acme", images: [1] },
  ])("rejects malformed fetch images %j", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response)),
    );
    await expect(
      webFetchTool.execute(
        "test",
        { url: "https://example.com", extractImages: true },
        undefined,
        undefined,
        context,
      ),
    ).rejects.toThrow();
  });

  it("spills large raw content without losing markdown, images, or extracted data", async () => {
    const response = {
      markdown: "Acme",
      rawContent: `<html>${"x".repeat(STRUCTURED_MAX_BYTES)}</html>`,
      contentType: "html",
      images: [{ alt: "Acme", url: "https://example.com/logo.png" }],
      data: { name: "Acme" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response)),
    );
    const result = await webFetchTool.execute(
      "test",
      {
        url: "https://example.com",
        includeRawContent: true,
        extractImages: true,
        schema: { type: "object" },
      },
      undefined,
      undefined,
      context,
    );
    trackFiles(result);
    expect(
      Buffer.byteLength(JSON.stringify(result.content)),
    ).toBeLessThanOrEqual(DEFAULT_MAX_BYTES);
    const output = Value.Parse(
      Type.Object({
        truncated: Type.Literal(true),
        fullOutputPath: Type.String(),
      }),
      result.structuredContent,
    );
    const raw = await readFile(output.fullOutputPath, "utf8");
    expect(JSON.parse(raw)).toEqual({
      url: "https://example.com",
      ...response,
      truncated: false,
    });
    expect(result.usage?.cost.total).toBe(0.006);
  });
});

describe("search options", () => {
  it.each(cases.slice(0, 2))(
    "$tool.name forwards flash retrieval and filters",
    async ({ tool, response }) => {
      let body: unknown;
      const fetch = vi.fn<typeof global.fetch>(async (url, options) => {
        body = await new Request(url, options).json();
        return Response.json(response("Acme"));
      });
      vi.stubGlobal("fetch", fetch);
      const filters = {
        includeDomains: ["example.com"],
        excludeDomains: ["example.org"],
        fromDate: "2026-01-01",
        toDate: "2026-02-01",
      };
      await tool.execute(
        "test",
        {
          query: "acme",
          depth: "flash",
          ...filters,
          includeInlineCitations: true,
        },
        undefined,
        undefined,
        context,
      );
      expect(body).toMatchObject({ q: "acme", depth: "flash", ...filters });
      if (tool.name === "linkup_web_answer")
        expect(body).toMatchObject({ includeInlineCitations: true });
    },
  );

  it("preserves upstream search metadata in structured output", async () => {
    const results = [
      {
        name: "Acme",
        url: "https://example.com",
        content: "Acme",
        type: "text",
        favicon: "https://example.com/favicon.ico",
      },
    ];
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
    expect(result.structuredContent).toMatchObject({
      results,
      truncated: false,
    });
  });

  it.each([0, -1])(
    "rejects invalid search limit %s through Pi validation",
    (limit) => {
      expect(() =>
        validateToolArguments(webSearchTool, {
          type: "toolCall",
          id: "test",
          name: webSearchTool.name,
          arguments: { query: "acme", limit },
        }),
      ).toThrow();
    },
  );

  it("uses Pi integer coercion for fractional limits", () => {
    expect(
      validateToolArguments(webSearchTool, {
        type: "toolCall",
        id: "test",
        name: webSearchTool.name,
        arguments: { query: "acme", limit: 1.5 },
      }),
    ).toMatchObject({ limit: 1 });
  });

  it("uses Pi JSON Schema coercion for numeric strings and single domains", () => {
    expect(
      validateToolArguments(webSearchTool, {
        type: "toolCall",
        id: "test",
        name: webSearchTool.name,
        arguments: {
          query: "acme",
          limit: "3",
          includeDomains: "example.com",
          excludeDomains: null,
        },
      }),
    ).toMatchObject({
      query: "acme",
      limit: 3,
      includeDomains: ["example.com"],
    });
  });

  it("rejects invalid calendar dates through Pi validation", () => {
    expect(() =>
      validateToolArguments(webSearchTool, {
        type: "toolCall",
        id: "test",
        name: webSearchTool.name,
        arguments: { query: "acme", fromDate: "2026-02-30" },
      }),
    ).toThrow();
  });

  it("rejects oversized domain lists through Pi validation", () => {
    expect(() =>
      validateToolArguments(webSearchTool, {
        type: "toolCall",
        id: "test",
        name: webSearchTool.name,
        arguments: {
          query: "acme",
          includeDomains: Array(101).fill("example.com"),
        },
      }),
    ).toThrow();
  });

  it("rejects oversized fetch instructions through Pi validation", () => {
    expect(() =>
      validateToolArguments(webFetchTool, {
        type: "toolCall",
        id: "test",
        name: webFetchTool.name,
        arguments: {
          url: "https://example.com",
          instructions: "x".repeat(4001),
        },
      }),
    ).toThrow();
  });
});

describe("usage costs", () => {
  it.each([
    {
      tool: webSearchTool,
      depth: "flash",
      cost: 0.005,
      response: { results: [] },
    },
    {
      tool: webAnswerTool,
      depth: "flash",
      cost: 0.006,
      response: { answer: "Acme", sources: [] },
    },
    {
      tool: webSearchTool,
      depth: "fast",
      cost: 0.005,
      response: { results: [] },
    },
    {
      tool: webSearchTool,
      depth: "standard",
      cost: 0.005,
      response: { results: [] },
    },
    {
      tool: webSearchTool,
      depth: "deep",
      cost: 0.05,
      response: { results: [] },
    },
    {
      tool: webAnswerTool,
      depth: "fast",
      cost: 0.006,
      response: { answer: "Acme", sources: [] },
    },
    {
      tool: webAnswerTool,
      depth: "standard",
      cost: 0.006,
      response: { answer: "Acme", sources: [] },
    },
    {
      tool: webAnswerTool,
      depth: "deep",
      cost: 0.055,
      response: { answer: "Acme", sources: [] },
    },
  ] as const)(
    "$tool.name reports $depth cost $cost without token usage",
    async ({ tool, depth, cost, response }) => {
      const fetch = vi.fn(async () => Response.json(response));
      vi.stubGlobal("fetch", fetch);
      const result = await tool.execute(
        "test",
        { query: "acme", depth },
        undefined,
        undefined,
        context,
      );
      expect(result.usage).toEqual({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: cost,
          totalFromProvider: false,
        },
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { mode: "standard", renderJs: false, structured: false, cost: 0.001 },
    { mode: "standard", renderJs: true, structured: false, cost: 0.005 },
    { mode: "pro", renderJs: false, structured: false, cost: 0.005 },
    { mode: "pro", renderJs: true, structured: false, cost: 0.01 },
    { mode: "standard", renderJs: false, structured: true, cost: 0.002 },
    { mode: "standard", renderJs: true, structured: true, cost: 0.006 },
    { mode: "pro", renderJs: false, structured: true, cost: 0.006 },
    { mode: "pro", renderJs: true, structured: true, cost: 0.011 },
  ] as const)(
    "fetch reports $mode / JS $renderJs / extraction $structured cost $cost",
    async ({ mode, renderJs, structured, cost }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ markdown: "Acme" })),
      );
      const result = await webFetchTool.execute(
        "test",
        {
          url: "https://example.com",
          mode,
          renderJs,
          schema: structured ? { type: "object" } : undefined,
        },
        undefined,
        undefined,
        context,
      );
      expect(result.usage?.cost.total).toBeCloseTo(cost);
    },
  );

  it("fetch accounts for its default JavaScript rendering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ markdown: "Acme" })),
    );
    const result = await webFetchTool.execute(
      "test",
      { url: "https://example.com" },
      undefined,
      undefined,
      context,
    );
    expect(result.usage?.cost.total).toBe(0.005);
  });
});

describe("tool results", () => {
  it.each(cases)(
    "$tool.name keeps complete structured data beyond the preview limit",
    async ({ tool, params, response }) => {
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
      expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(
        true,
      );
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        openWorldHint: true,
      });
      for (const directory of directories) {
        const directoryStats = await stat(directory);
        const fileStats = await stat(`${directory}/output.md`);
        expect(directoryStats.mode & 0o077).toBe(0);
        expect(fileStats.mode & 0o077).toBe(0);
      }
    },
  );

  it.each(cases)(
    "$tool.name spills oversized structured data as complete private JSON",
    async ({ tool, params, response }) => {
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
      expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(
        true,
      );
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
      const raw = await readFile(output.fullOutputPath, "utf8");
      expect(JSON.parse(raw)).toMatchObject(response(fullText));
      const stats = await stat(output.fullOutputPath);
      expect(stats.mode & 0o077).toBe(0);
      expect(Buffer.byteLength(JSON.stringify(output))).toBeLessThan(
        STRUCTURED_MAX_BYTES,
      );
    },
  );

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

  it.each(cases)(
    "$tool.name rejects malformed upstream success responses",
    async ({ tool, params }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ unexpected: true })),
      );
      await expect(
        tool.execute("test", params, undefined, undefined, context),
      ).rejects.toThrow();
    },
  );

  it.each(cases)(
    "$tool.name forwards cancellation to the HTTP request",
    async ({ tool, params }) => {
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
    },
  );
});
