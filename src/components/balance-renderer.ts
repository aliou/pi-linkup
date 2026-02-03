import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import { LINKUP_PRICING } from "../types";

export function registerBalanceRenderer(pi: ExtensionAPI) {
  pi.registerMessageRenderer("linkup-balance", (message, _options, theme) => {
    const details = message.details as { balance: number };
    const balance = details.balance;

    // Build header line
    const header = [
      theme.fg("accent", "Linkup"),
      theme.fg("muted", " · "),
      theme.fg("muted", `${balance} credits`),
    ].join("");

    // Calculate remaining requests for each operation type
    const remaining = {
      standardSearch: Math.floor(balance / LINKUP_PRICING.standardSearch),
      deepSearch: Math.floor(balance / LINKUP_PRICING.deepSearch),
      fetchNoJs: Math.floor(balance / LINKUP_PRICING.fetchNoJs),
      fetchWithJs: Math.floor(balance / LINKUP_PRICING.fetchWithJs),
    };

    // Format number with locale string and ~ prefix
    const fmt = (num: number): string => `~${num.toLocaleString()}`;

    // Table rows with right-aligned numbers (padded to 7 chars)
    const row = (num: number, label: string) =>
      `${theme.fg("accent", fmt(num).padStart(7))}  ${theme.fg("dim", label)}`;

    const lines = [
      header,
      "",
      row(remaining.standardSearch, "standard searches"),
      row(remaining.deepSearch, "deep searches"),
      row(remaining.fetchNoJs, "fetches (no JS)"),
      row(remaining.fetchWithJs, "fetches (with JS)"),
    ].join("\n");

    const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
    box.addChild(new Text(lines, 0, 0));
    return box;
  });
}
