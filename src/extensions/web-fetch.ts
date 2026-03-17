import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  announceLinkupTool,
  ensureLinkupInitialized,
  setupLinkupExtension,
} from "../setup";
import { registerWebFetchTool } from "../tools/web-fetch";

export default async function (pi: ExtensionAPI) {
  const ready = await ensureLinkupInitialized(pi);
  if (!ready) return;

  setupLinkupExtension(pi);
  registerWebFetchTool(pi);
  announceLinkupTool(pi, "webFetch");
}
