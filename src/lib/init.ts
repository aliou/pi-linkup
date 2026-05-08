import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hasLinkupApiKey } from "./env";

export async function ensureLinkupReady(pi: ExtensionAPI): Promise<boolean> {
  if (!hasLinkupApiKey()) {
    pi.on("session_start", (_event, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "LINKUP_API_KEY not set. Linkup extension disabled.",
          "warning",
        );
      }
    });
    return false;
  }

  return true;
}
