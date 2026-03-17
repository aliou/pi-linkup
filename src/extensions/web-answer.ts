import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  announceLinkupTool,
  ensureLinkupInitialized,
  setupLinkupExtension,
} from "../setup";
import { registerWebAnswerTool } from "../tools/web-answer";

export default async function (pi: ExtensionAPI) {
  const ready = await ensureLinkupInitialized(pi);
  if (!ready) return;

  setupLinkupExtension(pi);
  registerWebAnswerTool(pi);
  announceLinkupTool(pi, "webAnswer");
}
