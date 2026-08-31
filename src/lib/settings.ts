import { ConfigLoader, type ConfigStore } from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Extension settings, stored at ~/.pi/agent/extensions/pi-linkup.json
 * (global) and .pi/extensions/pi-linkup.json (project-local).
 */
export interface ResearchSettings {
  /** Include linkup_research / linkup_research_status in the active tool set. Off by default. */
  enabled: boolean;
  /** First poll interval after task submission (ms). */
  pollInitialMs: number;
  /** Maximum poll interval (ms), enforced during backoff. */
  pollMaxMs: number;
  /** Backoff multiplier applied after each poll. */
  pollBackoffMultiplier: number;
  /** Overall deadline for polling a task (ms). When exceeded, polling stops. */
  maxWaitMs: number;
  /** full: follow-up message carries the whole sourced answer. ping: only the task id, fetched on demand. */
  deliverResult: "full" | "ping";
}

export interface PiLinkupConfig {
  research?: Partial<ResearchSettings>;
}

export interface ResolvedPiLinkupConfig {
  research: ResearchSettings;
}

export const RESEARCH_SETTINGS_DEFAULTS: ResearchSettings = {
  enabled: false,
  pollInitialMs: 2000,
  pollMaxMs: 10000,
  pollBackoffMultiplier: 2,
  maxWaitMs: 20 * 60 * 1000,
  deliverResult: "full",
};

export const RESEARCH_TOOL_NAMES = [
  "linkup_research",
  "linkup_research_status",
] as const;

/** Display values used by the settings UI for maxWaitMs. */
export const MAX_WAIT_CHOICES: Array<{ label: string; ms: number }> = [
  { label: "10 min", ms: 10 * 60 * 1000 },
  { label: "20 min", ms: 20 * 60 * 1000 },
  { label: "30 min", ms: 30 * 60 * 1000 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Clamp user-provided values into safe ranges (never faster than 1 req/s). */
export function sanitizeResearchSettings(
  raw: Partial<ResearchSettings>,
): ResearchSettings {
  const merged = { ...RESEARCH_SETTINGS_DEFAULTS, ...raw };
  const pollInitialMs = clamp(
    Math.round(merged.pollInitialMs) ||
      RESEARCH_SETTINGS_DEFAULTS.pollInitialMs,
    1000,
    60000,
  );
  const pollMaxMs = clamp(
    Math.round(merged.pollMaxMs) || RESEARCH_SETTINGS_DEFAULTS.pollMaxMs,
    pollInitialMs,
    120000,
  );
  const pollBackoffMultiplier = clamp(
    merged.pollBackoffMultiplier > 0
      ? merged.pollBackoffMultiplier
      : RESEARCH_SETTINGS_DEFAULTS.pollBackoffMultiplier,
    1,
    5,
  );
  const maxWaitMs = clamp(
    Math.round(merged.maxWaitMs) || RESEARCH_SETTINGS_DEFAULTS.maxWaitMs,
    pollMaxMs,
    2 * 60 * 60 * 1000,
  );
  const deliverResult = merged.deliverResult === "ping" ? "ping" : "full";

  return {
    enabled: !!merged.enabled,
    pollInitialMs,
    pollMaxMs,
    pollBackoffMultiplier,
    maxWaitMs,
    deliverResult,
  };
}

const settingsLoaderKey = "__piLinkupSettingsLoader";

type SettingsLoader = ConfigLoader<PiLinkupConfig, ResolvedPiLinkupConfig>;

interface SharedLoader {
  promise?: Promise<SettingsLoader>;
}

function sharedOnce(): Promise<SettingsLoader> {
  // Tee up a single loader even when multiple extension entry points
  // import this module from separate module instances.
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  const shared = (g[settingsLoaderKey] as SharedLoader | undefined) ?? {};
  g[settingsLoaderKey] = shared;
  shared.promise ??= createSettingsLoader();
  return shared.promise;
}

async function createSettingsLoader(): Promise<SettingsLoader> {
  const loader = new ConfigLoader<PiLinkupConfig, ResolvedPiLinkupConfig>(
    "pi-linkup",
    { research: { ...RESEARCH_SETTINGS_DEFAULTS } },
    {
      afterMerge: (resolved) => {
        resolved.research = sanitizeResearchSettings(resolved.research ?? {});
        return resolved;
      },
    },
  );
  await loader.load();
  return loader;
}

/** In-memory config, refreshed after settings saves; does not re-read disk. */
export async function getSettingsStore(): Promise<
  ConfigStore<PiLinkupConfig, ResolvedPiLinkupConfig>
> {
  return sharedOnce();
}

export async function getResearchSettings(): Promise<ResearchSettings> {
  const loader = await sharedOnce();
  return loader.getConfig().research;
}

/** Test helper: drop the shared loader so a fresh one gets created. */
export function __resetSettingsLoaderForTests(): void {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  delete g[settingsLoaderKey];
}

/**
 * Add or remove the research tools from the active set at runtime.
 * The tools stay registered either way (registered-but-inactive), so this
 * can toggle them mid-session without an extension reload.
 */
export function setResearchToolsActive(
  pi: ExtensionAPI,
  enabled: boolean,
): void {
  const active = pi.getActiveTools();
  const hasAny = RESEARCH_TOOL_NAMES.some((name) => active.includes(name));
  if (enabled && !hasAny) {
    pi.setActiveTools([...new Set([...active, ...RESEARCH_TOOL_NAMES])]);
  } else if (!enabled && hasAny) {
    pi.setActiveTools(
      active.filter(
        (name) => !(RESEARCH_TOOL_NAMES as readonly string[]).includes(name),
      ),
    );
  }
}
