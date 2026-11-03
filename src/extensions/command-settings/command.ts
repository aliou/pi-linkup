import { registerSettingsCommand } from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Value } from "typebox/value";
import {
  linkupConfigSchema,
  loadLinkupConfig,
  TOOL_EXPOSURES,
} from "../../lib/config";

export async function registerLinkupSettings(pi: ExtensionAPI) {
  const configStore = await loadLinkupConfig();
  registerSettingsCommand(pi, {
    commandName: "linkup:settings",
    title: "Linkup Settings",
    configStore,
    buildSections: (config, resolved) => {
      const current = Value.Check(linkupConfigSchema, config)
        ? config
        : resolved;
      return [
        {
          label: "Tool exposure",
          items: [
            "linkup_web_search",
            "linkup_web_answer",
            "linkup_web_fetch",
          ].map((name) => ({
            id: `toolExposure.${name}`,
            label: name,
            description:
              "Applies after /reload or restarting Pi. Deferred needs tool_search or codemode; codemode needs codemode. Hidden tools are unreachable.",
            currentValue: current.toolExposure[name] ?? "direct",
            values: [...TOOL_EXPOSURES],
          })),
        },
      ];
    },
  });
}
