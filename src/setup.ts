import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerBalanceCommand } from "./commands/balance";
import { registerLinkupSettings } from "./commands/settings";
import { registerRenderers } from "./components";
import { configLoader } from "./config";
import { registerGuidance } from "./hooks";
import type { LinkupToolKey } from "./linkup-tools";

let initPromise: Promise<boolean> | null = null;
let setupBound = false;
let runtimeRegistered = false;
const availableTools = new Set<LinkupToolKey>();

function notifyMissingApiKeyOnce(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify(
        "LINKUP_API_KEY not set. Linkup extension disabled.",
        "warning",
      );
    }
  });
}

export async function ensureLinkupInitialized(
  pi: ExtensionAPI,
): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      const hasApiKey = !!process.env.LINKUP_API_KEY;
      if (!hasApiKey) {
        notifyMissingApiKeyOnce(pi);
        return false;
      }

      await configLoader.load();
      return true;
    })();
  }

  return initPromise;
}

function registerSharedRuntimeFeatures(pi: ExtensionAPI): void {
  if (runtimeRegistered) return;
  runtimeRegistered = true;

  registerBalanceCommand(pi);
  registerLinkupSettings(pi);
  registerRenderers(pi);
  registerGuidance(pi, {
    getAvailableTools: () => new Set(availableTools),
  });
}

export function setupLinkupExtension(pi: ExtensionAPI): void {
  if (setupBound) return;
  setupBound = true;

  pi.events.on("linkup:tool-registered", (data) => {
    if (!data || typeof data !== "object") return;
    const key = (data as { key?: LinkupToolKey }).key;
    if (!key) return;
    availableTools.add(key);
  });

  pi.on("session_start", () => {
    registerSharedRuntimeFeatures(pi);
  });
}

export function announceLinkupTool(pi: ExtensionAPI, key: LinkupToolKey): void {
  availableTools.add(key);
  pi.events.emit("linkup:tool-registered", { key });
}
