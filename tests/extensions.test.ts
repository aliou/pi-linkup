import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  InMemoryCredentialStore,
  InMemoryModelsStore,
} from "@earendil-works/pi-ai";
import {
  discoverAndLoadExtensions,
  ExtensionRunner,
  initTheme,
  type KeybindingsManager,
  ModelRegistry,
  ModelRuntime,
  SessionManager,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import {
  type Component,
  ProcessTerminal,
  type TUI,
  TuiMainScreen,
} from "@earendil-works/pi-tui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager as HostKeybindingsManager } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings";
import packageJson from "../package.json";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pi-linkup-test-"));
  vi.stubEnv("LINKUP_API_KEY", "test-key");
  vi.stubEnv("PI_CODING_AGENT_DIR", directory);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

describe("extension loading", () => {
  it("loads the package entries with the host SDK and registers the balance command once", async () => {
    const paths = packageJson.pi.extensions.map((path) => resolve(path));
    const loaded = await discoverAndLoadExtensions(paths, directory, directory);

    expect(loaded.errors).toEqual([]);
    expect(
      loaded.extensions.flatMap((entry) => [...entry.tools.keys()]),
    ).toEqual(["linkup_web_search", "linkup_web_answer", "linkup_web_fetch"]);
    expect(
      loaded.extensions.flatMap((entry) => [...entry.commands.keys()]),
    ).toEqual(["linkup:balance", "linkup:settings"]);
  });

  it.each(["direct", "model-only", "codemode", "deferred", "hidden"])(
    "registers configured %s exposure without hiding other tools",
    async (exposure) => {
      await mkdir(join(directory, "extensions"));
      await writeFile(
        join(directory, "extensions/linkup.json"),
        JSON.stringify({ toolExposure: { linkup_web_search: exposure } }),
      );
      const loaded = await discoverAndLoadExtensions(
        packageJson.pi.extensions.map((path) => resolve(path)),
        directory,
        directory,
      );
      expect(loaded.errors).toEqual([]);
      const tools = loaded.extensions.flatMap((entry) => [
        ...entry.tools.values(),
      ]);
      expect(
        tools.map(({ definition }) => [definition.name, definition.exposure]),
      ).toEqual([
        ["linkup_web_search", exposure],
        ["linkup_web_answer", "direct"],
        ["linkup_web_fetch", "direct"],
      ]);
    },
  );

  it("keeps settings available without an API key", async () => {
    vi.stubEnv("LINKUP_API_KEY", "");
    const loaded = await discoverAndLoadExtensions(
      packageJson.pi.extensions.map((path) => resolve(path)),
      directory,
      directory,
    );
    expect(loaded.errors).toEqual([]);
    expect(
      loaded.extensions.flatMap((entry) => [...entry.tools.keys()]),
    ).toEqual([]);
    expect(
      loaded.extensions.flatMap((entry) => [...entry.commands.keys()]),
    ).toEqual(["linkup:settings"]);
  });

  it("registers tools and balance without an API key when a proxy is configured", async () => {
    vi.stubEnv("LINKUP_API_KEY", "");
    await mkdir(join(directory, "extensions"));
    await writeFile(
      join(directory, "extensions/linkup.json"),
      JSON.stringify({ proxyUrl: "https://proxy.example.com/api" }),
    );
    const loaded = await discoverAndLoadExtensions(
      packageJson.pi.extensions.map((path) => resolve(path)),
      directory,
      directory,
    );
    expect(loaded.errors).toEqual([]);
    expect(
      loaded.extensions.flatMap((entry) => [...entry.tools.keys()]),
    ).toEqual(["linkup_web_search", "linkup_web_answer", "linkup_web_fetch"]);
    expect(
      loaded.extensions.flatMap((entry) => [...entry.commands.keys()]),
    ).toEqual(["linkup:balance", "linkup:settings"]);
  });

  it.each([
    undefined,
    "{",
    JSON.stringify({ toolExposure: { linkup_web_search: "unsupported" } }),
    JSON.stringify({ toolExposure: { linkup_web_search: 42 } }),
  ])(
    "cycles settings and saves only on Ctrl+S with initial config %j",
    async (initial) => {
      if (initial !== undefined) {
        await mkdir(join(directory, "extensions"));
        await writeFile(join(directory, "extensions/linkup.json"), initial);
      }
      initTheme("dark", false);
      const fetch = vi.fn<typeof global.fetch>(async (url, options) => {
        expect(url).toBe("https://proxy.example.com/api/credits/balance");
        expect(options?.method).toBe("GET");
        expect(new Headers(options?.headers).has("authorization")).toBe(false);
        return Response.json({ balance: 0 });
      });
      vi.stubGlobal("fetch", fetch);
      const loaded = await discoverAndLoadExtensions(
        packageJson.pi.extensions.map((path) => resolve(path)),
        directory,
        directory,
      );
      const command = loaded.extensions
        .flatMap((entry) => [...entry.commands.values()])
        .find((entry) => entry.name === "linkup:settings");
      if (!command) throw new Error("Missing settings command");
      const runtime = await ModelRuntime.create({
        credentials: new InMemoryCredentialStore(),
        modelsStore: new InMemoryModelsStore(),
        modelsPath: null,
        refreshOnCreate: false,
      });
      const runner = new ExtensionRunner(
        loaded.extensions,
        loaded.runtime,
        directory,
        SessionManager.inMemory(),
        new ModelRegistry(runtime),
      );
      const ctx = runner.createCommandContext();
      const tui = new TuiMainScreen(new ProcessTerminal(), false);
      vi.spyOn(tui, "requestRender").mockImplementation(() => {});
      runner.setUIContext(
        {
          ...ctx.ui,
          custom<T>(
            factory: (
              tui: TUI,
              theme: Theme,
              keybindings: KeybindingsManager,
              done: (result: T) => void,
            ) => Component | Promise<Component>,
          ) {
            return new Promise<T>((resolve, reject) => {
              Promise.resolve(
                factory(
                  tui,
                  ctx.ui.theme,
                  new HostKeybindingsManager(),
                  resolve,
                ),
              ).then(async (panel) => {
                try {
                  expect(panel.render(100).join("\n")).toContain(
                    "Linkup Settings",
                  );
                  expect(panel.render(100).join("\n")).not.toContain("Local");
                  for (let i = 0; i < 3; i++) panel.handleInput?.("\r");
                  expect(panel.render(100).join("\n")).toContain("deferred");
                  if (initial === undefined) {
                    await expect(
                      readFile(join(directory, "extensions/linkup.json")),
                    ).rejects.toThrow();
                  } else {
                    const saved = await readFile(
                      join(directory, "extensions/linkup.json"),
                      "utf8",
                    );
                    expect(saved).toBe(initial);
                  }
                  for (let i = 0; i < 3; i++) panel.handleInput?.("\x1b[B");
                  panel.handleInput?.("\r");
                  panel.handleInput?.("\r");
                  panel.handleInput?.("ftp://proxy.example.com");
                  panel.handleInput?.("\r");
                  expect(panel.render(100).join("\n")).toContain(
                    "absolute HTTP(S)",
                  );
                  panel.handleInput?.("\x15");
                  panel.handleInput?.("https://proxy.example.com/api/");
                  panel.handleInput?.("\r");
                  panel.handleInput?.("\x1b");
                  panel.handleInput?.("\x13");
                  await vi.waitFor(async () => {
                    const raw = await readFile(
                      join(directory, "extensions/linkup.json"),
                      "utf8",
                    );
                    const saved = JSON.parse(raw);
                    expect(saved.toolExposure.linkup_web_search).toBe(
                      "deferred",
                    );
                    expect(saved.proxyUrl).toBe(
                      "https://proxy.example.com/api",
                    );
                    expect(fetch).toHaveBeenCalledTimes(1);
                  });
                  panel.handleInput?.("\x1b");
                } catch (error) {
                  reject(error);
                }
              }, reject);
            });
          },
        },
        "tui",
      );
      await command.handler("global", ctx);
      const reloaded = await discoverAndLoadExtensions(
        [resolve(packageJson.pi.extensions[0])],
        directory,
        directory,
      );
      expect(
        reloaded.extensions[0].tools.get("linkup_web_search")?.definition
          .exposure,
      ).toBe("deferred");
    },
  );

  it.each(packageJson.pi.extensions)("loads %s independently", async (path) => {
    const loaded = await discoverAndLoadExtensions(
      [resolve(path)],
      directory,
      directory,
    );
    expect(loaded.errors).toEqual([]);
    expect(loaded.extensions).toHaveLength(1);
    const entry = loaded.extensions[0];
    expect(entry.tools.size + entry.commands.size).toBe(1);
  });
});
