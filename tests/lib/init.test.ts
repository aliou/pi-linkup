import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureLinkupReady } from "../../src/lib/init";

describe("init", () => {
  let originalApiKey: string | undefined;
  let directory: string;

  beforeEach(async () => {
    originalApiKey = process.env.LINKUP_API_KEY;
    directory = await mkdtemp(join(tmpdir(), "pi-linkup-test-"));
    vi.stubEnv("PI_CODING_AGENT_DIR", directory);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
    if (originalApiKey !== undefined) {
      process.env.LINKUP_API_KEY = originalApiKey;
    } else {
      delete process.env.LINKUP_API_KEY;
    }
  });

  describe("ensureLinkupReady", () => {
    it("returns false and binds session_start listener when API key is missing", async () => {
      delete process.env.LINKUP_API_KEY;

      const mockOn = vi.fn();
      const pi = { on: mockOn } as unknown as Parameters<
        typeof ensureLinkupReady
      >[0];

      const result = await ensureLinkupReady(pi);

      expect(result).toBe(false);
      expect(mockOn).toHaveBeenCalledWith(
        "session_start",
        expect.any(Function),
      );
    });

    it("listener calls ctx.ui.notify with correct text and warning level", async () => {
      delete process.env.LINKUP_API_KEY;

      const mockNotify = vi.fn();
      const mockOn = vi.fn();
      const pi = { on: mockOn } as unknown as Parameters<
        typeof ensureLinkupReady
      >[0];

      await ensureLinkupReady(pi);

      const listener = mockOn.mock.calls[0][1];
      const ctx = {
        hasUI: true,
        ui: { notify: mockNotify },
      };

      listener({}, ctx);

      expect(mockNotify).toHaveBeenCalledWith(
        "LINKUP_API_KEY not set and no proxy URL configured. Set a key or use /linkup:settings.",
        "warning",
      );
    });

    it("returns true when API key is present", async () => {
      process.env.LINKUP_API_KEY = "test-key";

      const pi = { on: vi.fn() } as unknown as Parameters<
        typeof ensureLinkupReady
      >[0];

      const result = await ensureLinkupReady(pi);

      expect(result).toBe(true);
    });

    it("does not bind listener when API key is present", async () => {
      process.env.LINKUP_API_KEY = "test-key";

      const mockOn = vi.fn();
      const pi = { on: mockOn } as unknown as Parameters<
        typeof ensureLinkupReady
      >[0];

      await ensureLinkupReady(pi);

      expect(mockOn).not.toHaveBeenCalled();
    });
  });
});
