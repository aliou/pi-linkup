import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ensureLinkupReady } from "../../lib/init";
import { registerBalanceCommand } from "./command";
import { registerBalanceRenderer } from "./renderer";

export default async function (pi: ExtensionAPI) {
  const ready = await ensureLinkupReady(pi);
  if (!ready) return;
  registerBalanceRenderer(pi);
  registerBalanceCommand(pi);
}
