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
  toolExposure: Type.Record(Type.String(), exposureSchema),
});

export type LinkupConfig = Static<typeof linkupConfigSchema>;

export async function loadLinkupConfig() {
  const defaults: LinkupConfig = { toolExposure: {} };
  const loader = new ConfigLoader<Partial<LinkupConfig>, LinkupConfig>(
    "linkup",
    defaults,
    {
      scopes: ["global"],
      afterMerge: (config) =>
        Value.Check(linkupConfigSchema, config) ? config : defaults,
    },
  );
  await loader.load();
  return loader;
}

export async function getToolExposure(name: string): Promise<ToolExposure> {
  const loader = await loadLinkupConfig();
  return loader.getConfig().toolExposure[name] ?? "direct";
}
