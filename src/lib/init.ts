import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadLinkupConfig } from "./config";
import { hasLinkupApiKey } from "./env";

export async function ensureLinkupReady(pi: ExtensionAPI): Promise<boolean> {
  const config = await loadLinkupConfig();
  if (!hasLinkupApiKey() && !config.getConfig().proxyUrl) {
    pi.on("session_start", (_event, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "LINKUP_API_KEY not set and no proxy URL configured. Set a key or use /linkup:settings.",
          "warning",
        );
      }
    });
    return false;
  }

  return true;
}
