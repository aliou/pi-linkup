import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ensureLinkupReady } from "../../lib/init";
import { webFetchTool } from "./tool";

export default async function (pi: ExtensionAPI) {
  const ready = await ensureLinkupReady(pi);
  if (!ready) return;
  pi.registerTool(webFetchTool);
}
