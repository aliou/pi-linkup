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

    describe("research", () => {
      it("POSTs to /research with defaults", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi.fn().mockReturnValue(
          createMockResponse({
            id: "01234-abcd-56789",
            type: "research",
            status: "pending",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            error: null,
            input: { q: "test query" },
            output: null,
          }),
        );
        global.fetch = mockFetch;

        await client.createResearch({ query: "test query" });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.linkup.so/v1/research",
          expect.objectContaining({ method: "POST" }),
        );

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body).toEqual({
          q: "test query",
          outputType: "sourcedAnswer",
        });
      });

      it("includes optional params when provided", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(
            createMockResponse({ id: "task-id", status: "pending" }),
          );
        global.fetch = mockFetch;

        await client.createResearch({
          query: "test query",
          mode: "investigate",
          reasoningDepth: "S",
          outputType: "sourcedAnswer",
          includeDomains: ["arxiv.org"],
          excludeDomains: ["wikipedia.org"],
          fromDate: "2025-01-01",
          toDate: "2025-12-31",
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body).toEqual({
          q: "test query",
          outputType: "sourcedAnswer",
          mode: "investigate",
          reasoningDepth: "S",
          includeDomains: ["arxiv.org"],
          excludeDomains: ["wikipedia.org"],
          fromDate: "2025-01-01",
          toDate: "2025-12-31",
        });
      });

      it("GETs /research/:id", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(
            createMockResponse({ id: "task-id", status: "completed" }),
          );
        global.fetch = mockFetch;

        await client.getResearch("task-id");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.linkup.so/v1/research/task-id",
          expect.objectContaining({ method: "GET" }),
        );
      });

      it("throws with error message on non-OK response", async () => {
        const client = new LinkupClient("test-key");
        const mockFetch = vi
          .fn()
          .mockReturnValue(
            createMockResponse({ error: { message: "API Error" } }, 400),
          );
        global.fetch = mockFetch;

        await expect(client.getResearch("task-id")).rejects.toThrow(
          "API Error",
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
