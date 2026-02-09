import { ConfigLoader } from "@aliou/pi-utils-settings";

/**
 * Raw config shape (what gets saved to disk).
 * All fields optional -- only overrides are stored.
 */
export interface LinkupConfig {
  systemPromptGuidance?: boolean;
}

/**
 * Resolved config (defaults merged in).
 */
export interface ResolvedLinkupConfig {
  systemPromptGuidance: boolean;
}

const DEFAULTS: ResolvedLinkupConfig = {
  systemPromptGuidance: false,
};

export const configLoader = new ConfigLoader<
  LinkupConfig,
  ResolvedLinkupConfig
>("pi-linkup", DEFAULTS);
