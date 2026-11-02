import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JsonValue } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { type TSchema, Type } from "typebox";

export const STRUCTURED_MAX_BYTES = 1024 * 1024;

async function writePrivateOutput(content: string, filename: string) {
  const directory = await mkdtemp(join(tmpdir(), "pi-linkup-"));
  const path = join(directory, filename);
  await writeFile(path, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
  return path;
}

export async function previewContent(
  content: string,
  maxLines = DEFAULT_MAX_LINES,
  maxBytes = DEFAULT_MAX_BYTES,
) {
  let result = truncateHead(content, { maxLines, maxBytes });
  if (!result.truncated) {
    return { ...result, preview: result.content, tempFilePath: undefined };
  }

  const tempFilePath = await writePrivateOutput(content, "output.md");
  const notice = `\n\n[Output truncated. Full content: ${tempFilePath}]`;
  result = truncateHead(content, {
    maxLines: Math.max(1, maxLines - 3),
    maxBytes: Math.max(1, maxBytes - Buffer.byteLength(notice)),
  });
  return { ...result, preview: result.content + notice, tempFilePath };
}

export function structuredOutputSchema<T extends TSchema>(data: T) {
  return Type.Union(
    [
      Type.Intersect([data, Type.Object({ truncated: Type.Literal(false) })]),
      Type.Object({
        truncated: Type.Literal(true),
        fullOutputPath: Type.String({
          description:
            "Private JSON file containing the complete result when it exceeds 1 MiB. Read this file to recover the result.",
        }),
      }),
    ],
    {
      description:
        "Complete API data up to 1 MiB, independent of the model-facing preview. Larger results return truncated: true and a private JSON file path instead of inline data.",
    },
  );
}

export async function structuredContent<T extends Record<string, JsonValue>>(
  data: T,
) {
  const result = { ...data, truncated: false as const };
  const json = JSON.stringify(result);
  if (Buffer.byteLength(json) <= STRUCTURED_MAX_BYTES) return result;
  return {
    truncated: true as const,
    fullOutputPath: await writePrivateOutput(json, "output.json"),
  };
}
