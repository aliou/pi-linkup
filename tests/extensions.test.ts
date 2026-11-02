import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../package.json";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pi-linkup-test-"));
  vi.stubEnv("LINKUP_API_KEY", "test-key");
});

afterEach(async () => {
  vi.unstubAllEnvs();
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
    ).toEqual(["linkup:balance"]);
  });

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
