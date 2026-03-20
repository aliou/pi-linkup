import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function registerLinkupSettings(pi: ExtensionAPI): void {
  pi.registerCommand("linkup:settings", {
    description: "Linkup settings are no longer needed.",
    async handler(_args, ctx) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "Linkup no longer has package-level guidance settings. Enable or disable individual extensions instead.",
          "info",
        );
      }
    },
  });
}
