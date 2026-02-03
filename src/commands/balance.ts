import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getClient } from "../client";

export function registerBalanceCommand(pi: ExtensionAPI) {
  pi.registerCommand("linkup:balance", {
    description: "Display remaining Linkup API credits",
    async handler(_args, ctx) {
      const client = getClient();

      try {
        const response = await client.getBalance();
        pi.sendMessage({
          customType: "linkup-balance",
          content: `Linkup Balance: ${response.balance.toFixed(2)} credits`,
          display: true,
          details: { balance: response.balance },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        ctx.ui.notify(`Error: ${message}`, "error");
      }
    },
  });
}
