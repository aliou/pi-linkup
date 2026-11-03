import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToolExposure, loadLinkupConfig } from "../../src/lib/config";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pi-linkup-test-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", directory);
  await mkdir(join(directory, "extensions"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("tool exposure configuration", () => {
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

  it("does not offer or save project-local exposure settings", async () => {
    const store = await loadLinkupConfig();
    expect(store.getEnabledScopes()).toEqual(["global"]);
    await expect(
      store.save("local", { toolExposure: { linkup_web_search: "hidden" } }),
    ).rejects.toThrow();
  });
});
