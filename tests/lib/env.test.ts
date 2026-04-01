import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLinkupApiKey, hasLinkupApiKey } from "../../src/lib/env";

describe("env", () => {
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

  describe("hasLinkupApiKey", () => {
    it("returns false when env var is unset", () => {
      delete process.env.LINKUP_API_KEY;
      expect(hasLinkupApiKey()).toBe(false);
    });

    it("returns false when env var is empty string", () => {
      process.env.LINKUP_API_KEY = "";
      expect(hasLinkupApiKey()).toBe(false);
    });

    it("returns true when env var is set", () => {
      process.env.LINKUP_API_KEY = "test-key";
      expect(hasLinkupApiKey()).toBe(true);
    });
  });

  describe("getLinkupApiKey", () => {
    it("returns the key when set", () => {
      process.env.LINKUP_API_KEY = "test-key";
      expect(getLinkupApiKey()).toBe("test-key");
    });

    it("throws when env var is not set", () => {
      delete process.env.LINKUP_API_KEY;
      expect(() => getLinkupApiKey()).toThrow(
        "LINKUP_API_KEY environment variable is not set",
      );
    });
  });
});
