import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  announceLinkupTool,
  ensureLinkupInitialized,
  setupLinkupExtension,
} from "../setup";
import { registerWebSearchTool } from "../tools/web-search";

export default async function (pi: ExtensionAPI) {
  const ready = await ensureLinkupInitialized(pi);
  if (!ready) return;

  setupLinkupExtension(pi);
  registerWebSearchTool(pi);
  announceLinkupTool(pi, "webSearch");
}
