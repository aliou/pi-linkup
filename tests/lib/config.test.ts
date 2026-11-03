import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClient } from "../../src/client";
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
    expect(await getToolExposure("linkup_web_search")).toBe("direct");
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
    expect(await getToolExposure("linkup_web_search")).toBe("deferred");
    expect(await getToolExposure("linkup_web_fetch")).toBe("hidden");
    expect(await getToolExposure("linkup_web_answer")).toBe("direct");
  });

  it.each([
    "{",
    JSON.stringify({ toolExposure: "hidden" }),
    JSON.stringify({ toolExposure: { linkup_web_search: "unsupported" } }),
    JSON.stringify({ toolExposure: { linkup_web_search: 42 } }),
    JSON.stringify({ toolExposure: null }),
  ])("falls back to direct for invalid config %s", async (content) => {
    await writeFile(join(directory, "extensions/linkup.json"), content);
    expect(await getToolExposure("linkup_web_search")).toBe("direct");
  });

  it("persists a normalized proxy URL without changing tool exposure", async () => {
    const store = await loadLinkupConfig();
    await store.save("global", {
      proxyUrl: " https://proxy.example.com/api/// ",
      toolExposure: { linkup_web_search: "deferred" },
    });
    expect((await loadLinkupConfig()).getConfig()).toEqual({
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
  ])("rejects an invalid configured proxy without sending a request: %s", async (proxyUrl) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("LINKUP_API_KEY", "test-key");
    await writeFile(
      join(directory, "extensions/linkup.json"),
      JSON.stringify({ proxyUrl }),
    );
    await expect(getClient()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "search",
    "fetch",
    "balance",
  ])("routes %s through a keyless proxy without forwarding the Linkup key", async (operation) => {
    const store = await loadLinkupConfig();
    await store.save("global", { proxyUrl: "https://proxy.example.com/api/" });
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
  });

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
    await expect((await getClient()).getBalance()).resolves.toEqual({
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
    await (await getClient()).getBalance();
  });

  it("does not offer or save project-local exposure settings", async () => {
    const store = await loadLinkupConfig();
    expect(store.getEnabledScopes()).toEqual(["global"]);
    await expect(
      store.save("local", { toolExposure: { linkup_web_search: "hidden" } }),
    ).rejects.toThrow();
  });
});
