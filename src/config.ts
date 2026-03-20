import { ConfigLoader } from "@aliou/pi-utils-settings";

export type LinkupConfig = Record<string, never>;

export type ResolvedLinkupConfig = Record<string, never>;

const DEFAULTS: ResolvedLinkupConfig = {};

export const configLoader = new ConfigLoader<
  LinkupConfig,
  ResolvedLinkupConfig
>("pi-linkup", DEFAULTS);
