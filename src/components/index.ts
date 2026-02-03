import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerBalanceRenderer } from "./balance-renderer";

export function registerRenderers(pi: ExtensionAPI) {
  registerBalanceRenderer(pi);
}
