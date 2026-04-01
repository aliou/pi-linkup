import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureLinkupReady } from "../../src/lib/init";

describe("init", () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.LINKUP_API_KEY;
  });

  afterEach(() => {
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
        "LINKUP_API_KEY not set. Linkup extension disabled.",
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
