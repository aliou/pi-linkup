import {
  registerSettingsCommand,
  SettingsDetailEditor,
} from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Value } from "typebox/value";
import {
  linkupConfigSchema,
  TOOL_EXPOSURES,
  validateProxyUrl,
} from "../../lib/config";
import { loadSettingsStore } from "./store";

export async function registerLinkupSettings(pi: ExtensionAPI) {
  const configStore = await loadSettingsStore();
  registerSettingsCommand(pi, {
    commandName: "linkup:settings",
    title: "Linkup Settings",
    configStore,
    buildSections: (config, resolved, ctx) => {
      const current = {
        ...resolved,
        ...(Value.Check(linkupConfigSchema, config) ? config : {}),
      };
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
        {
          label: "Connection",
          items: [
            {
              id: "proxyUrl",
              label: "API proxy URL",
              description:
                "API base URL including its path prefix. Changed URLs are checked against credits/balance before saving. Leave empty for direct access. LINKUP_API_KEY is not forwarded. Reload after saving.",
              currentValue: current.proxyUrl || "Direct Linkup",
              submenu: (_value, done, submenuCtx) =>
                new SettingsDetailEditor({
                  title: "API proxy URL",
                  theme: ctx.theme,
                  hideHint: submenuCtx.hideHint,
                  fields: [
                    {
                      id: "proxyUrl",
                      label: "URL",
                      type: "text",
                      getValue: () => current.proxyUrl,
                      setValue: (value) => {
                        current.proxyUrl = value.trim().replace(/\/+$/, "");
                        ctx.setDraft(current);
                      },
                      validate: validateProxyUrl,
                      emptyValueText: "Direct Linkup",
                    },
                  ],
                  onDone: done,
                  getDoneSummary: () => current.proxyUrl || "Direct Linkup",
                }),
            },
          ],
        },
      ];
    },
  });
}
