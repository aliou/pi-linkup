import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClient } from "../../src/client";
import { loadSettingsStore } from "../../src/extensions/command-settings/store";
import { getToolExposure, loadLinkupConfig } from "../../src/lib/config";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pi-linkup-test-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", directory);
  await mkdir(join(directory, "extensions"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("Linkup configuration", () => {
  it("defaults to direct without creating a config file", async () => {
    const exposure = await getToolExposure("linkup_web_search");
    expect(exposure).toBe("direct");
    await expect(
      readFile(join(directory, "extensions/linkup.json")),
    ).rejects.toThrow();
  });

  it("persists independent tool settings and loads them in a fresh store", async () => {
    const store = await loadLinkupConfig();
    await store.save("global", {
      toolExposure: {
        linkup_web_search: "deferred",
        linkup_web_fetch: "hidden",
      },
    });
    const search = await getToolExposure("linkup_web_search");
    const fetchExposure = await getToolExposure("linkup_web_fetch");
    const answer = await getToolExposure("linkup_web_answer");
    expect(search).toBe("deferred");
    expect(fetchExposure).toBe("hidden");
    expect(answer).toBe("direct");
  });

  it.each([
    "{",
    JSON.stringify({ toolExposure: "hidden" }),
    JSON.stringify({ toolExposure: { linkup_web_search: "unsupported" } }),
    JSON.stringify({ toolExposure: { linkup_web_search: 42 } }),
    JSON.stringify({ toolExposure: null }),
  ])("falls back to direct for invalid config %s", async (content) => {
    await writeFile(join(directory, "extensions/linkup.json"), content);
    const exposure = await getToolExposure("linkup_web_search");
    expect(exposure).toBe("direct");
  });

  it("persists a normalized proxy URL without changing tool exposure", async () => {
    const store = await loadLinkupConfig();
    await store.save("global", {
      proxyUrl: " https://proxy.example.com/api/// ",
      toolExposure: { linkup_web_search: "deferred" },
    });
    const loaded = await loadLinkupConfig();
    expect(loaded.getConfig()).toEqual({
      proxyUrl: "https://proxy.example.com/api",
      toolExposure: { linkup_web_search: "deferred" },
    });
  });

  it.each([
    "relative",
    "ftp://proxy.example.com",
    "https://user@proxy.example.com",
    "https://proxy.example.com?query=1",
    "https://proxy.example.com?",
    "https://proxy.example.com#",
    "https://proxy.example.com#fragment",
    42,
    null,
  ])(
    "rejects an invalid configured proxy without sending a request: %s",
    async (proxyUrl) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      vi.stubEnv("LINKUP_API_KEY", "test-key");
      await writeFile(
        join(directory, "extensions/linkup.json"),
        JSON.stringify({ proxyUrl }),
      );
      await expect(getClient()).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(["search", "fetch", "balance"])(
    "routes %s through a keyless proxy without forwarding the Linkup key",
    async (operation) => {
      const store = await loadLinkupConfig();
      await store.save("global", {
        proxyUrl: "https://proxy.example.com/api/",
      });
      vi.stubEnv("LINKUP_API_KEY", "test-key");
      const fetch = vi.fn<typeof global.fetch>(async (_url, options) => {
        expect(new Headers(options?.headers).has("authorization")).toBe(false);
        return Response.json(
          operation === "search"
            ? { results: [] }
            : operation === "fetch"
              ? { markdown: "Acme" }
              : { balance: 10 },
        );
      });
      vi.stubGlobal("fetch", fetch);
      const client = await getClient();
      if (operation === "search")
        await client.search({
          query: "acme",
          depth: "standard",
          outputType: "searchResults",
        });
      else if (operation === "fetch")
        await client.fetch({ url: "https://example.com" });
      else await client.getBalance();
      const path = operation === "balance" ? "credits/balance" : operation;
      expect(fetch.mock.calls[0][0]).toBe(
        `https://proxy.example.com/api/${path}`,
      );
    },
  );

  it("keeps proxy routing when an exposure override is invalid", async () => {
    await writeFile(
      join(directory, "extensions/linkup.json"),
      JSON.stringify({
        proxyUrl: "https://proxy.example.com/api",
        toolExposure: { linkup_web_search: "unsupported" },
      }),
    );
    const store = await loadLinkupConfig();
    expect(store.getConfig()).toEqual({
      proxyUrl: "https://proxy.example.com/api",
      toolExposure: {},
    });
  });

  it("uses a configured proxy without an API key", async () => {
    vi.stubEnv("LINKUP_API_KEY", "");
    const store = await loadLinkupConfig();
    await store.save("global", { proxyUrl: "http://localhost:8080/api" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ balance: 10 })),
    );
    const client = await getClient();
    await expect(client.getBalance()).resolves.toEqual({
      balance: 10,
    });
  });

  it("keeps direct access authenticated and requires its API key", async () => {
    vi.stubEnv("LINKUP_API_KEY", "");
    await expect(getClient()).rejects.toThrow("LINKUP_API_KEY");
    vi.stubEnv("LINKUP_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof global.fetch>(async (url, options) => {
        expect(url).toBe("https://api.linkup.so/v1/credits/balance");
        expect(new Headers(options?.headers).get("authorization")).toBe(
          "Bearer test-key",
        );
        return Response.json({ balance: 10 });
      }),
    );
    const client = await getClient();
    await client.getBalance();
  });

  it.each([0, 10])(
    "validates a changed proxy with balance %i before persisting",
    async (balance) => {
      const store = await loadSettingsStore();
      const fetch = vi.fn<typeof global.fetch>(async (url, options) => {
        expect(url).toBe("https://proxy.example.com/api/credits/balance");
        expect(options?.method).toBe("GET");
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        expect(new Headers(options?.headers).has("authorization")).toBe(false);
        await expect(
          readFile(join(directory, "extensions/linkup.json")),
        ).rejects.toThrow();
        return Response.json({ balance });
      });
      vi.stubGlobal("fetch", fetch);
      await store.save("global", {
        proxyUrl: "https://proxy.example.com/api/",
      });
      expect(store.getConfig().proxyUrl).toBe("https://proxy.example.com/api");
      const persisted = await readFile(
        join(directory, "extensions/linkup.json"),
        "utf8",
      );
      expect(JSON.parse(persisted).proxyUrl).toBe(
        "https://proxy.example.com/api",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    () =>
      Response.json({ error: { message: "Unauthorized" } }, { status: 401 }),
    () => new Response("gateway unavailable", { status: 502 }),
    () => Response.json({ unexpected: true }),
    () => new Response("<html>not an API</html>"),
    () => {
      throw new TypeError("Connection refused");
    },
    () => {
      throw new DOMException("Deadline exceeded", "TimeoutError");
    },
  ])(
    "keeps existing settings intact when the proxy probe fails",
    async (response) => {
      const previous = {
        proxyUrl: "https://old-proxy.example.com/api",
        toolExposure: { linkup_web_search: "deferred" as const },
      };
      const loader = await loadLinkupConfig();
      await loader.save("global", previous);
      const before = await readFile(
        join(directory, "extensions/linkup.json"),
        "utf8",
      );
      const store = await loadSettingsStore();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response()),
      );
      await expect(
        store.save("global", {
          proxyUrl: "https://proxy.example.com/api",
          toolExposure: { linkup_web_search: "hidden" },
        }),
      ).rejects.toThrow("Proxy validation failed");
      const after = await readFile(
        join(directory, "extensions/linkup.json"),
        "utf8",
      );
      expect(after).toBe(before);
      expect(store.getConfig()).toEqual(previous);
    },
  );

  it("retries a failed validation without losing the stored configuration", async () => {
    const store = await loadSettingsStore();
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Connection refused"))
      .mockResolvedValueOnce(Response.json({ balance: 10 }));
    vi.stubGlobal("fetch", fetch);
    const config = { proxyUrl: "https://proxy.example.com/api" };
    await expect(store.save("global", config)).rejects.toThrow(
      "Proxy validation failed",
    );
    expect(store.getConfig().proxyUrl).toBe("");
    await store.save("global", config);
    expect(store.getConfig().proxyUrl).toBe(config.proxyUrl);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("skips probes for unchanged or cleared URLs and exposure-only edits", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const loader = await loadLinkupConfig();
    await loader.save("global", { proxyUrl: "https://proxy.example.com/api" });
    const store = await loadSettingsStore();
    await store.save("global", {
      proxyUrl: " https://proxy.example.com/api/// ",
      toolExposure: { linkup_web_search: "deferred" },
    });
    await store.save("global", { proxyUrl: "" });
    await store.save("global", {
      toolExposure: { linkup_web_search: "hidden" },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(store.getConfig().proxyUrl).toBe("");
  });

  it("does not probe invalid URLs or unsupported scopes", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const store = await loadSettingsStore();
    await expect(
      store.save("global", { proxyUrl: "ftp://proxy.example.com" }),
    ).rejects.toThrow("Proxy validation failed");
    await expect(
      store.save("local", { proxyUrl: "https://proxy.example.com/api" }),
    ).rejects.toThrow("not enabled");
    expect(fetch).not.toHaveBeenCalled();
    expect(store.getConfig()).toEqual({ proxyUrl: "", toolExposure: {} });
  });

  it("does not offer or save project-local exposure settings", async () => {
    const store = await loadLinkupConfig();
    expect(store.getEnabledScopes()).toEqual(["global"]);
    await expect(
      store.save("local", { toolExposure: { linkup_web_search: "hidden" } }),
    ).rejects.toThrow();
  });
});
