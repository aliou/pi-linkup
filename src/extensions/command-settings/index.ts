import { registerSettingsCommand } from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  getSettingsStore,
  MAX_WAIT_CHOICES,
  type PiLinkupConfig,
  type ResearchSettings,
  type ResolvedPiLinkupConfig,
  setResearchToolsActive,
} from "../../lib/settings";

const POLL_INITIAL_CHOICES = [1000, 2000, 4000];
const POLL_MAX_CHOICES = [5000, 10000, 30000];
const BACKOFF_CHOICES = [1.5, 2, 3];

const maxWaitLabel = (ms: number) =>
  MAX_WAIT_CHOICES.find((c) => c.ms === ms)?.label ??
  `${Math.round(ms / 60000)} min`;

/**
 * Registers /linkup:settings - scope-tabbed settings UI backed by
 * ~/.pi/agent/extensions/pi-linkup.json (+ .pi/extensions/pi-linkup.json).
 */
export default async function (pi: ExtensionAPI) {
  const configStore = await getSettingsStore();

  registerSettingsCommand<PiLinkupConfig, ResolvedPiLinkupConfig>(pi, {
    commandName: "linkup:settings",
    title: "Linkup Settings",
    configStore,
    buildSections: (tabConfig, resolved) => {
      const research: ResearchSettings =
        tabConfig?.research && Object.keys(tabConfig.research).length > 0
          ? { ...resolved.research, ...tabConfig.research }
          : resolved.research;

      return [
        {
          label: "Research",
          items: [
            {
              id: "research.enabled",
              label: "linkup_research handoff tools",
              currentValue: research.enabled ? "on" : "off",
              values: ["on", "off"],
              description:
                "Opt in (default: off) to the linkup_research / linkup_research_status tools (autonomous deep research, $0.25-$2.50 per task). Off keeps the tools registered but inactive.",
            },
            {
              id: "research.deliverResult",
              label: "Result delivery",
              currentValue: research.deliverResult,
              values: ["full", "ping"],
              description:
                "How completed research is delivered: full = the follow-up message carries the whole sourced answer; ping = only the task id, fetch results with linkup_research_status.",
            },
            {
              id: "research.pollInitialMs",
              label: "Poll initial interval",
              currentValue: `${research.pollInitialMs}`,
              values: POLL_INITIAL_CHOICES.map((ms) => `${ms}`),
              description:
                "First poll interval for a submitted task (ms). The poller never polls faster than once per second.",
            },
            {
              id: "research.pollMaxMs",
              label: "Poll max interval",
              currentValue: `${research.pollMaxMs}`,
              values: POLL_MAX_CHOICES.map((ms) => `${ms}`),
              description: "Maximum poll interval reached via backoff (ms).",
            },
            {
              id: "research.pollBackoffMultiplier",
              label: "Poll backoff multiplier",
              currentValue: `${research.pollBackoffMultiplier}`,
              values: BACKOFF_CHOICES.map((m) => `${m}`),
              description:
                "Multiplier applied to the poll interval after each poll.",
            },
            {
              id: "research.maxWaitMs",
              label: "Poll deadline",
              currentValue: maxWaitLabel(research.maxWaitMs),
              values: MAX_WAIT_CHOICES.map((c) => c.label),
              description:
                "Overall deadline for background polling of a task. Past the deadline polling stops (the task may still finish server-side; check with linkup_research_status).",
            },
          ],
        },
      ];
    },
    onSettingChange: (id, newValue, config) => {
      const updated = structuredClone(config);
      switch (id) {
        case "research.enabled":
          updated.research = {
            ...updated.research,
            enabled: newValue === "on",
          };
          return updated;
        case "research.deliverResult":
          updated.research = {
            ...updated.research,
            deliverResult: newValue === "ping" ? "ping" : "full",
          };
          return updated;
        case "research.pollInitialMs":
          updated.research = {
            ...updated.research,
            pollInitialMs: Number.parseInt(newValue, 10),
          };
          return updated;
        case "research.pollMaxMs":
          updated.research = {
            ...updated.research,
            pollMaxMs: Number.parseInt(newValue, 10),
          };
          return updated;
        case "research.pollBackoffMultiplier":
          updated.research = {
            ...updated.research,
            pollBackoffMultiplier: Number.parseFloat(newValue),
          };
          return updated;
        case "research.maxWaitMs": {
          const choice = MAX_WAIT_CHOICES.find((c) => c.label === newValue);
          if (choice) {
            updated.research = {
              ...updated.research,
              maxWaitMs: choice.ms,
            };
            return updated;
          }
          return null;
        }
        default:
          return null;
      }
    },
    onSave: async () => {
      const research = (await configStore.getConfig()).research;
      setResearchToolsActive(pi, research.enabled);
    },
  });
}
