import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  ExtensionRunner,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

export interface LinkupHarnessOptions {
  projectSettings?: Record<string, unknown>;
  cwd?: string;
  agentDir?: string;
}

export interface LinkupHarness {
  cwd: string;
  agentDir: string;
  getCommands(): string[];
  getExtensionPaths(): string[];
  getActiveTools(): string[];
  getBaseSystemPrompt(): string;
  getFullSystemPrompt(prompt?: string): Promise<string>;
}

export async function createLinkupHarness(
  options: LinkupHarnessOptions = {},
): Promise<LinkupHarness> {
  const cwd = options.cwd ?? mkdtempSync(join(tmpdir(), "pi-linkup-test-cwd-"));
  const agentDir =
    options.agentDir ?? mkdtempSync(join(tmpdir(), "pi-linkup-test-agent-"));

  mkdirSync(join(cwd, ".pi"), { recursive: true });
  writeFileSync(
    join(cwd, ".pi", "settings.json"),
    JSON.stringify(options.projectSettings ?? {}, null, 2),
    "utf8",
  );

  const sessionManager = SessionManager.inMemory(cwd);
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
  });
  await resourceLoader.reload();

  const { session, extensionsResult } = await createAgentSession({
    cwd,
    agentDir,
    sessionManager,
    resourceLoader,
  });

  await session.bindExtensions({});

  const runner = new ExtensionRunner(
    extensionsResult.extensions,
    extensionsResult.runtime,
    cwd,
    session.sessionManager,
    {} as never,
  );

  const getCommands = () => {
    const commands = new Set<string>();
    for (const ext of extensionsResult.extensions) {
      for (const name of ext.commands.keys()) {
        commands.add(name);
      }
    }
    return Array.from(commands).sort();
  };

  const getExtensionPaths = () =>
    extensionsResult.extensions.map((ext) => ext.path).sort();

  const getActiveTools = () =>
    session
      .getActiveToolNames()
      .filter((name) => name.startsWith("linkup_"))
      .sort();

  const getBaseSystemPrompt = () => session.systemPrompt;

  const getFullSystemPrompt = async (prompt = "test prompt") => {
    const result = await runner.emitBeforeAgentStart(
      prompt,
      undefined,
      session.systemPrompt,
    );
    return result?.systemPrompt ?? session.systemPrompt;
  };

  return {
    cwd,
    agentDir,
    getCommands,
    getExtensionPaths,
    getActiveTools,
    getBaseSystemPrompt,
    getFullSystemPrompt,
  };
}

export function createLinkupPackageSettings(overrides?: {
  extensions?: string[];
}): Record<string, unknown> {
  return {
    packages: [
      {
        source: process.cwd(),
        ...(overrides?.extensions ? { extensions: overrides.extensions } : {}),
      },
    ],
  };
}
