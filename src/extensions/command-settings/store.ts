import { createConfigStore, type Scope } from "@aliou/pi-utils-settings";
import { LinkupClient } from "../../client";
import { type LinkupConfig, loadLinkupConfig } from "../../lib/config";

export async function loadSettingsStore() {
  const loader = await loadLinkupConfig();
  return {
    ...createConfigStore(loader),
    async save(scope: Scope, config: Partial<LinkupConfig>) {
      if (!loader.hasScope(scope)) return loader.save(scope, config);
      const proxyUrl = config.proxyUrl?.trim().replace(/\/+$/, "") ?? "";
      if (proxyUrl && proxyUrl !== loader.getConfig().proxyUrl) {
        try {
          await new LinkupClient("", proxyUrl).getBalance(
            AbortSignal.timeout(10_000),
          );
        } catch (error) {
          throw new Error(
            `Proxy validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            { cause: error },
          );
        }
      }
      await loader.save(scope, { ...config, proxyUrl });
    },
  };
}
