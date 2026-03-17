import { describe, expect, it } from "vitest";
import { LINKUP_TOOL_NAMES, type LinkupToolKey } from "../src/linkup-tools";
import {
  createLinkupHarness,
  createLinkupPackageSettings,
} from "./utils/pi-linkup-harness";

const ALL_TOOLS: LinkupToolKey[] = ["webSearch", "webAnswer", "webFetch"];

const TOOL_EXTENSION_PATHS: Record<LinkupToolKey, string> = {
  webSearch: "src/extensions/web-search.ts",
  webAnswer: "src/extensions/web-answer.ts",
  webFetch: "src/extensions/web-fetch.ts",
};

const TOOL_GUIDANCE_LINES: Record<LinkupToolKey, string> = {
  webSearch: "Find information across sources: `linkup_web_search`",
  webAnswer: "Get a direct answer with sources: `linkup_web_answer`",
  webFetch: "Read content from a known URL: `linkup_web_fetch`",
};

function getAllCombinations<T>(items: T[]): T[][] {
  const combinations: T[][] = [];
  for (let mask = 0; mask < 1 << items.length; mask++) {
    const subset = items.filter((_, index) => (mask & (1 << index)) !== 0);
    combinations.push(subset);
  }
  return combinations;
}

function buildExtensionSelection(enabledTools: LinkupToolKey[]): string[] {
  const enabled = new Set(enabledTools);
  return ALL_TOOLS.map(
    (tool) => `${enabled.has(tool) ? "+" : "-"}${TOOL_EXTENSION_PATHS[tool]}`,
  );
}

function formatCaseName(enabledTools: LinkupToolKey[]): string {
  return enabledTools.length === 0 ? "none enabled" : enabledTools.join(", ");
}

describe("pi-linkup harness", () => {
  for (const enabledTools of getAllCombinations(ALL_TOOLS)) {
    it(`loads correct extensions, commands, tools, and guidance for ${formatCaseName(enabledTools)}`, async () => {
      const harness = await createLinkupHarness({
        projectSettings: createLinkupPackageSettings({
          extensions: buildExtensionSelection(enabledTools),
        }),
      });

      const extensionPaths = harness.getExtensionPaths();
      expect(extensionPaths).toHaveLength(enabledTools.length);
      for (const tool of enabledTools) {
        expect(extensionPaths).toContainEqual(
          expect.stringContaining(TOOL_EXTENSION_PATHS[tool]),
        );
      }

      const expectedCommands =
        enabledTools.length === 0 ? [] : ["linkup:balance", "linkup:settings"];
      expect(harness.getCommands()).toEqual(expectedCommands);

      const expectedActiveTools = enabledTools
        .map((tool) => LINKUP_TOOL_NAMES[tool])
        .sort();
      expect(harness.getActiveTools()).toEqual(expectedActiveTools);

      const fullPrompt = await harness.getFullSystemPrompt();
      if (enabledTools.length === 0) {
        expect(fullPrompt).not.toContain("## Linkup");
      } else {
        expect(fullPrompt).toContain("## Linkup");
      }

      for (const tool of ALL_TOOLS) {
        const guidanceLine = TOOL_GUIDANCE_LINES[tool];
        if (enabledTools.includes(tool)) {
          expect(fullPrompt).toContain(guidanceLine);
        } else {
          expect(fullPrompt).not.toContain(guidanceLine);
        }
      }
    });
  }

  it("skips initialization when LINKUP_API_KEY is missing", async () => {
    delete process.env.LINKUP_API_KEY;

    const harness = await createLinkupHarness({
      projectSettings: createLinkupPackageSettings({
        extensions: buildExtensionSelection(ALL_TOOLS),
      }),
    });

    expect(harness.getExtensionPaths()).toEqual([
      expect.stringContaining(TOOL_EXTENSION_PATHS.webAnswer),
      expect.stringContaining(TOOL_EXTENSION_PATHS.webFetch),
      expect.stringContaining(TOOL_EXTENSION_PATHS.webSearch),
    ]);
    expect(harness.getCommands()).toEqual([]);
    expect(harness.getActiveTools()).toEqual([]);

    const fullPrompt = await harness.getFullSystemPrompt();
    expect(fullPrompt).not.toContain("## Linkup");
  });
});
