import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { configLoader } from "../config";
import { getLinkupGuidance } from "../guidance";
import type { LinkupToolKey } from "../linkup-tools";

interface RegisterGuidanceOptions {
  getAvailableTools: () => Set<LinkupToolKey>;
}

/**
 * Register the system prompt hook to inject Linkup guidance when enabled.
 */
export function registerGuidance(
  pi: ExtensionAPI,
  options: RegisterGuidanceOptions,
) {
  pi.on("before_agent_start", async (event) => {
    const config = configLoader.getConfig();
    if (!config.systemPromptGuidance) return;

    const guidance = getLinkupGuidance(options.getAvailableTools());
    if (!guidance) return;

    return {
      systemPrompt: `${event.systemPrompt}\n${guidance}`,
    };
  });
}
