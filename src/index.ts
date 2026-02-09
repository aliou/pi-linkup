import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerBalanceCommand } from "./commands/balance";
import { registerLinkupSettings } from "./commands/settings";
import { registerRenderers } from "./components";
import { configLoader } from "./config";
import { registerGuidance } from "./hooks";
import { registerWebAnswerTool } from "./tools/web-answer";
import { registerWebFetchTool } from "./tools/web-fetch";
import { registerWebSearchTool } from "./tools/web-search";

export default async function (pi: ExtensionAPI) {
  const hasApiKey = !!process.env.LINKUP_API_KEY;

  if (!hasApiKey) {
    console.warn(
      "[linkup] Warning: LINKUP_API_KEY not set. Linkup extension will not load.",
    );

    pi.on("session_start", (_event, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "LINKUP_API_KEY not set. Linkup extension disabled.",
          "warning",
        );
      }
    });
    return;
  }

  // Load config
  await configLoader.load();

  // Register tools
  registerWebSearchTool(pi);
  registerWebAnswerTool(pi);
  registerWebFetchTool(pi);

  // Register commands
  registerBalanceCommand(pi);
  registerLinkupSettings(pi);

  // Register renderers
  registerRenderers(pi);

  // Register hooks
  registerGuidance(pi);
}
