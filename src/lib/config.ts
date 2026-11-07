import { ConfigLoader } from "@aliou/pi-utils-settings";
import type { ToolExposure } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { Value } from "typebox/value";

const exposureSchema = Type.Union([
  Type.Literal("direct"),
  Type.Literal("model-only"),
  Type.Literal("codemode"),
  Type.Literal("deferred"),
  Type.Literal("hidden"),
]);

export const TOOL_EXPOSURES = exposureSchema.anyOf.map(
  (schema) => schema.const,
) satisfies ToolExposure[];

export const linkupConfigSchema = Type.Object({
  toolExposure: Type.Optional(Type.Record(Type.String(), exposureSchema)),
  proxyUrl: Type.Optional(Type.String()),
});

export type LinkupConfig = Required<Static<typeof linkupConfigSchema>>;

export function validateProxyUrl(value: string): string | null {
  if (value.trim() === "") return null;
  const url = parseUrl(value);
  if (
    url !== null &&
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !value.includes("?") &&
    !value.includes("#")
  )
    return null;
  return "Use an absolute HTTP(S) API base URL without credentials, query, or fragment; leave empty for direct Linkup access.";
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export async function loadLinkupConfig() {
  const defaults: LinkupConfig = { toolExposure: {}, proxyUrl: "" };
  const loader = new ConfigLoader<Partial<LinkupConfig>, LinkupConfig>(
    "linkup",
    defaults,
    {
      scopes: ["global"],
      afterMerge: (config) => {
        if (!Value.Check(Type.String(), config.proxyUrl))
          throw new Error("proxyUrl must be a string.");
        const error = validateProxyUrl(config.proxyUrl);
        if (error !== null) throw new Error(error);
        return {
          ...(Value.Check(linkupConfigSchema, config) ? config : defaults),
          proxyUrl: config.proxyUrl.trim().replace(/\/+$/, ""),
        };
      },
    },
  );
  await loader.load();
  return loader;
}

export async function getToolExposure(name: string): Promise<ToolExposure> {
  const loader = await loadLinkupConfig();
  return loader.getConfig().toolExposure[name] ?? "direct";
}
