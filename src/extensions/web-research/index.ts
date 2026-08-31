import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ensureLinkupReady } from "../../lib/init";
import {
  getResearchSettings,
  setResearchToolsActive,
} from "../../lib/settings";
import { ResearchTaskManager } from "./manager";
import { registerResearchMessageRenderer } from "./renderer";
import { createWebResearchStatusTool, createWebResearchTool } from "./tool";

export default async function (pi: ExtensionAPI) {
  const ready = await ensureLinkupReady(pi);
  if (!ready) return;

  // Live settings getter: /linkup:settings saves refresh the loader's
  // in-memory config, and the poller picks up new values on its next
  // poll iteration.
  const settings = await getResearchSettings();

  const manager = new ResearchTaskManager(pi, settings, {
    getSettings: getResearchSettings,
  });

  // Tools are always registered; they stay out of the active set unless
  // the user opted in via /linkup:settings (research.enabled).
  pi.registerTool(createWebResearchTool(manager));
  pi.registerTool(createWebResearchStatusTool(manager));
  registerResearchMessageRenderer(pi);

  pi.on("session_start", async (_event, ctx) => {
    // Gate the tool set according to the (possibly updated) config.
    const current = await getResearchSettings();
    setResearchToolsActive(pi, current.enabled);

    // Reattach to tasks from earlier in this session lineage (resume /
    // fork). Linkup tasks are server-side persistent, so the manager
    // resumes polling and delivers late completions as follow-ups.
    const entries = (ctx.sessionManager.getEntries() ?? []) as Array<{
      type: string;
      data?: unknown;
    }>;
    manager.recoverFromEntries(entries);
  });

  pi.on("session_shutdown", () => {
    manager.stop();
  });
}
