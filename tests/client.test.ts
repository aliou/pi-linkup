import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LinkupClient, SearchDepth } from "../src/client";

describe("client", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("SearchDepth", () => {
    it("is a StringEnum with correct values", () => {
      expect(SearchDepth).toBeDefined();
    });
  });

  describe("LinkupClient", () => {
    const createMockResponse = (body: unknown, status = 200) => {
      return Promise.resolve({
        ok: status === 200,
        status,
        statusText: status === 200 ? "OK" : "Error",
        json: () => Promise.resolve(body),
      } as Response);
    };

    describe("search", () => {
      it("POSTs to /search with correct body", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi.fn().mockReturnValue(
          createMockResponse({
            results: [{ name: "Test", url: "https://test.com" }],
          }),
        );
        global.fetch = mockFetch;

        await client.search({
          query: "test query",
          depth: "standard",
          outputType: "searchResults",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.linkup.so/v1/search",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer test-key",
              "Content-Type": "application/json",
            }),
          }),
        );

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body).toEqual({
          q: "test query",
          depth: "standard",
          outputType: "searchResults",
        });
      });

      it("includes maxResults when provided", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi.fn().mockReturnValue(
          createMockResponse({
            results: [{ name: "Test", url: "https://test.com" }],
          }),
        );
        global.fetch = mockFetch;

        await client.search({
          query: "test",
          depth: "fast",
          outputType: "searchResults",
          maxResults: 5,
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.maxResults).toBe(5);
      });

      it.each([
        { fromDate: "1970-01-01" },
        { toDate: "1969-12-31" },
        { fromDate: "2026-02-01", toDate: "2026-01-01" },
        { fromDate: "2026-01-01", toDate: "2026-01-01" },
      ])("rejects invalid date ranges %j before making a request", async (filters) => {
        await expect(
          new LinkupClient("test-key").search({
            query: "acme",
            depth: "standard",
            outputType: "searchResults",
            ...filters,
          }),
        ).rejects.toThrow();
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("throws with error message on non-OK response", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(
            createMockResponse({ error: { message: "API Error" } }, 400),
          );
        global.fetch = mockFetch;

        await expect(
          client.search({
            query: "test",
            depth: "standard",
            outputType: "searchResults",
          }),
        ).rejects.toThrow("API Error");
      });
    });

    describe("fetch", () => {
      it("POSTs to /fetch with correct body", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(createMockResponse({ markdown: "# Test" }));
        global.fetch = mockFetch;

        await client.fetch({
          url: "https://test.com",
          renderJs: false,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.linkup.so/v1/fetch",
          expect.objectContaining({
            method: "POST",
          }),
        );

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body).toEqual({
          url: "https://test.com",
          renderJs: false,
        });
      });

      it("forwards Pro extraction options and retains typed data", async () => {
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };
        const mockFetch = vi
          .fn()
          .mockReturnValue(
            createMockResponse({ markdown: "Acme", data: { name: "Acme" } }),
          );
        global.fetch = mockFetch;
        const result = await new LinkupClient("test-key").fetch({
          url: "https://example.com",
          mode: "pro",
          renderJs: false,
          schema,
          instructions: "Extract the company name",
        });
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
          url: "https://example.com",
          mode: "pro",
          renderJs: false,
          schema,
          instructions: "Extract the company name",
        });
        expect(result.data).toEqual({ name: "Acme" });
      });

      it.each([
        "",
        "Extract names",
      ])("rejects instructions without a schema: %j", async (instructions) => {
        await expect(
          new LinkupClient("test-key").fetch({
            url: "https://example.com",
            instructions,
          }),
        ).rejects.toThrow("requires 'schema'");
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("rejects instructions longer than the extraction limit", async () => {
        await expect(
          new LinkupClient("test-key").fetch({
            url: "https://example.com",
            schema: { type: "object" },
            instructions: "x".repeat(4001),
          }),
        ).rejects.toThrow("4000");
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("rejects a non-object extraction schema", async () => {
        await expect(
          new LinkupClient("test-key").fetch({
            url: "https://example.com",
            schema: { type: "array" },
          }),
        ).rejects.toThrow("type 'object'");
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("preserves HTTP context for non-JSON errors", async () => {
        global.fetch = vi.fn(
          async () =>
            new Response("upstream unavailable", {
              status: 502,
              statusText: "Bad Gateway",
            }),
        );
        await expect(
          new LinkupClient("test-key").fetch({ url: "https://example.com" }),
        ).rejects.toThrow("HTTP 502: Bad Gateway");
      });

      it("defaults renderJs to true", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(createMockResponse({ markdown: "# Test" }));
        global.fetch = mockFetch;

        await client.fetch({
          url: "https://test.com",
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.renderJs).toBe(true);
      });
    });

    describe("getBalance", () => {
      it("GETs /credits/balance", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(createMockResponse({ balance: 100.5 }));
        global.fetch = mockFetch;

        await client.getBalance();

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.linkup.so/v1/credits/balance",
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining({
              Authorization: "Bearer test-key",
            }),
          }),
        );
      });
    });

    describe("User-Agent header", () => {
      it("includes pi-linkup/ version", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(createMockResponse({ balance: 100 }));
        global.fetch = mockFetch;

        await client.getBalance();

        const headers = mockFetch.mock.calls[0][1].headers;
        expect(headers["User-Agent"]).toContain("pi-linkup/");
      });
    });
  });
});
