import {
  registerSettingsCommand,
  type SettingsSection,
} from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  configLoader,
  type LinkupConfig,
  type ResolvedLinkupConfig,
} from "../config";

export function registerLinkupSettings(pi: ExtensionAPI): void {
  registerSettingsCommand<LinkupConfig, ResolvedLinkupConfig>(pi, {
    commandName: "linkup:settings",
    commandDescription: "Configure Linkup extension settings",
    title: "Linkup Settings",
    configStore: configLoader,
    buildSections: (
      tabConfig: LinkupConfig | null,
      resolved: ResolvedLinkupConfig,
    ): SettingsSection[] => {
      return [
        {
          label: "System Prompt",
          items: [
            {
              id: "systemPromptGuidance",
              label: "Append search guidance",
              description:
                "Add Linkup usage guidance to the system prompt so the model knows when and how to use web search and fetch tools",
              currentValue:
                (tabConfig?.systemPromptGuidance ??
                resolved.systemPromptGuidance)
                  ? "enabled"
                  : "disabled",
              values: ["enabled", "disabled"],
            },
          ],
        },
      ];
    },
  });
}
