import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import {
  getClient,
  ResearchMode,
  type ResearchModeType,
  ResearchReasoningDepth,
  type ResearchReasoningDepthType,
} from "../../client";
import type { LinkupResearchSourcedAnswer } from "../../types";
import type { ResearchTaskManager } from "./manager";
import {
  buildResearchResult,
  type ResearchResultDetails,
  renderResearchResultContainer,
} from "./render";

const DEPTH_DURATION_HINT: Record<ResearchReasoningDepthType | "auto", string> =
  {
    S: "2-5 min",
    M: "3-7 min",
    L: "5-10 min",
    XL: "10-20 min",
    auto: "2-20 min (2-5 min at S, up to 20 min at XL)",
  };

const researchParameters = Type.Object({
  query: Type.String({
    description:
      "The research question, phrased in natural language. Both terse and detailed inputs are accepted; more precise input (angles to cover, entities to compare, facts to verify, expected structure) produces more predictable, thorough, and aligned output.",
  }),
  mode: Type.Optional(ResearchMode),
  reasoningDepth: Type.Optional(ResearchReasoningDepth),
  includeDomains: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Restrict the research to trusted domains (up to 100). Improves quality and reduces latency when authoritative sources are known.",
    }),
  ),
  excludeDomains: Type.Optional(
    Type.Array(Type.String(), {
      description: "Domains to exclude from the research.",
    }),
  ),
  fromDate: Type.Optional(
    Type.String({
      description:
        "ISO 8601 date (YYYY-MM-DD). Restrict to results on or after this date. Prefer this over embedding dates in the question.",
    }),
  ),
  toDate: Type.Optional(
    Type.String({
      description:
        "ISO 8601 date (YYYY-MM-DD). Restrict to results on or before this date.",
    }),
  ),
});

type ResearchParams = Static<typeof researchParameters>;

export function createWebResearchTool(manager: ResearchTaskManager) {
  return {
    name: "linkup_research",
    label: "Linkup Research",
    description:
      "Submit an autonomous deep research task to the Linkup /research API and return immediately (~1s) with the task id. The task runs server-side for 2-20 minutes; the completed, sourced answer is delivered later as a follow-up linkup-research-result message. Use for questions a single search query cannot resolve: verified answers to precise questions, focused investigations of a defined subject, or broad multi-angle reports. Costs $0.25-$2.50 per call.",
    promptSnippet:
      "Submit deep, multi-source research for questions single searches cannot resolve (async: results arrive later as a follow-up message).",
    promptGuidelines: [
      "Use linkup_research only for questions that linkup_web_search or linkup_web_answer cannot resolve: multi-source synthesis, comparative analysis, or broad multi-angle reports.",
      "linkup_research is expensive ($0.25-$2.50) and slow (2-20 minutes); prefer linkup_web_search or linkup_web_answer for quick lookups.",
      "linkup_research is asynchronous: it returns immediately with a task id, and the sourced answer arrives later as a follow-up linkup-research-result message. After submitting, tell the user the research is running and continue with other work - do not wait for, sleep on, or poll the result. Use linkup_research_status only when the user explicitly asks for progress.",
      "Set mode explicitly on linkup_research for predictable latency, cost, and output shape: answer for definitive questions, investigate for deep-dives on a single subject, research for broad multi-entity reports.",
      "Write detailed research briefs for linkup_research: angles to cover, entities to compare, facts to verify, and the expected output structure.",
      "Use reasoningDepth S or M for routine questions; reserve L (default) and XL for high-stakes deliverables.",
    ],
    parameters: researchParameters,

    async execute(
      _toolCallId: string,
      params: ResearchParams,
      signal: AbortSignal | undefined,
    ) {
      const client = getClient();

      const task = await client.createResearch({
        query: params.query,
        mode: params.mode as ResearchModeType | undefined,
        reasoningDepth: params.reasoningDepth as
          | ResearchReasoningDepthType
          | undefined,
        outputType: "sourcedAnswer",
        includeDomains: params.includeDomains,
        excludeDomains: params.excludeDomains,
        fromDate: params.fromDate,
        toDate: params.toDate,
        signal,
      });

      // Hand the task to the background poller, then return immediately.
      manager.track(task, params.query);

      const durationHint =
        DEPTH_DURATION_HINT[params.reasoningDepth ?? "auto"] ??
        DEPTH_DURATION_HINT.auto;

      const text = [
        `Research task submitted: ${task.id}`,
        `Status: ${task.status} (running server-side)`,
        `Query: ${params.query}`,
        `Expected duration: ~${durationHint} (reasoningDepth ${params.reasoningDepth ?? "auto"})`,
        "",
        "The completed answer will be delivered as a follow-up message when the task finishes. Do NOT wait for the result: tell the user the research is running and continue with other work. Use linkup_research_status (taskId: " +
          `"${task.id}") only if the user explicitly asks for progress.`,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        details: {
          taskId: task.id,
          query: params.query,
          mode: params.mode,
          reasoningDepth: params.reasoningDepth ?? "auto",
          status: task.status,
          expectedDuration: durationHint,
        } satisfies SubmitDetails,
      };
    },

    renderCall(args: ResearchParams, theme: Theme) {
      const optionArgs = [];
      if (args.mode) {
        optionArgs.push({ label: "mode", value: args.mode });
      }
      if (args.reasoningDepth) {
        optionArgs.push({ label: "depth", value: args.reasoningDepth });
      }

      return new ToolCallHeader(
        {
          toolName: "Linkup: Research",
          mainArg: `"${args.query}"`,
          showColon: true,
          optionArgs,
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<SubmitDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { expanded } = options;
      const details = result.details;
      const container = new Container();

      if (details?.taskId) {
        let text = theme.fg(
          "success",
          `Research task submitted${details.status ? ` (${details.status})` : ""}`,
        );
        text += `\n  ${theme.fg("accent", details.taskId)}`;
        if (details.expectedDuration) {
          text += theme.fg("dim", ` - ${details.expectedDuration}`);
        }
        if (expanded) {
          if (details.query) {
            text += `\n  ${theme.fg("muted", details.query)}`;
          }
          text += `\n  ${theme.fg("dim", "results arrive as a follow-up message on completion")}`;
        }
        container.addChild(new Text(text, 0, 0));
      } else {
        const textBlock = result.content.find((c) => c.type === "text");
        const errorMsg =
          (textBlock?.type === "text" && textBlock.text) ||
          "Failed to submit research task";
        container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      }

      return container;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
  } as any;
}

interface SubmitDetails {
  taskId: string;
  query: string;
  mode?: string;
  reasoningDepth: string;
  status?: string;
  expectedDuration?: string;
}

const statusParameters = Type.Object({
  taskId: Type.Optional(
    Type.String({
      description:
        "The research task id to check (e.g. from the linkup_research submit result or a follow-up message). Without a taskId, lists all research tasks known to this session.",
    }),
  ),
});

type StatusParams = Static<typeof statusParameters>;

export function createWebResearchStatusTool(manager: ResearchTaskManager) {
  return {
    name: "linkup_research_status",
    label: "Linkup Research Status",
    description:
      "Check the status of a Linkup research task. With taskId: fetches the current state from the server (works for any task, including past sessions) and returns the completed sourced answer if available. Without taskId: lists all research tasks known to this session with their status and elapsed time.",
    promptSnippet:
      "Check status of, or fetch the result of, submitted linkup_research tasks on demand.",
    promptGuidelines: [
      "Use linkup_research_status when the user asks about the progress of a research task, or when you need the result of a task whose follow-up carried only a task id.",
    ],
    parameters: statusParameters,

    async execute(
      _toolCallId: string,
      params: StatusParams,
      signal: AbortSignal | undefined,
    ) {
      if (!params.taskId) {
        const tasks = manager.list();
        if (tasks.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No research tasks known to this session. Pass a taskId to check a task submitted in a previous session (Linkup tasks are persistent server-side).",
              },
            ],
            details: { tasks: [] } satisfies StatusDetails,
          };
        }
        const lines = tasks.map(
          (task) =>
            `- ${task.id} [${task.phase}${task.lastStatus && task.lastStatus !== task.phase ? `/${task.lastStatus}` : ""}, ${task.elapsedSeconds}s] "${task.query}"`,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Research tasks:\n${lines.join("\n")}`,
            },
          ],
          details: { tasks } satisfies StatusDetails,
        };
      }

      const { snapshot, remote } = await manager.check(params.taskId, signal);

      if (remote.status === "failed") {
        throw new Error(
          remote.error ||
            `Research task ${params.taskId} failed without an error message`,
        );
      }

      if (remote.status === "completed") {
        const output = remote.output;
        if (!output || typeof output !== "object" || !("answer" in output)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Research task ${params.taskId} completed, but returned no output.\n\n${JSON.stringify(remote.output, null, 2)}`,
              },
            ],
            details: {
              taskId: params.taskId,
              snapshot,
            } satisfies StatusDetails,
          };
        }
        const created = Date.parse(remote.createdAt);
        const updated = Date.parse(remote.updatedAt ?? "");
        const completionSeconds =
          !Number.isNaN(created) && !Number.isNaN(updated) && updated >= created
            ? Math.round((updated - created) / 1000)
            : snapshot.elapsedSeconds;
        const formatted = await buildResearchResult(
          snapshot.query,
          params.taskId,
          completionSeconds,
          output as LinkupResearchSourcedAnswer,
        );

        return {
          content: [{ type: "text" as const, text: formatted.text }],
          details: {
            taskId: params.taskId,
            snapshot,
            completed: true,
            result: formatted.details,
          } satisfies StatusDetails,
        };
      }

      const elapsed =
        snapshot.elapsedSeconds >= 0
          ? `${snapshot.elapsedSeconds}s`
          : "unknown";
      return {
        content: [
          {
            type: "text" as const,
            text: `Research task ${params.taskId} (${snapshot.query}) is ${remote.status} (${elapsed} elapsed). The result will be delivered as a follow-up message when it completes.`,
          },
        ],
        details: {
          taskId: params.taskId,
          snapshot,
        } satisfies StatusDetails,
      };
    },

    renderCall(args: StatusParams, theme: Theme) {
      return new ToolCallHeader(
        {
          toolName: "Linkup: Research Status",
          mainArg: args.taskId ? `"${args.taskId}"` : "(all tasks)",
          showColon: true,
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<StatusDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { expanded } = options;
      const details = result.details;
      const container = new Container();
      const textBlock = result.content.find((c) => c.type === "text");
      const text = (textBlock?.type === "text" && textBlock.text) || "";

      if (details?.completed && details.result) {
        return renderResearchResultContainer(
          details.result,
          { expanded },
          theme,
        );
      }

      container.addChild(
        new Markdown(text, 0, 0, getMarkdownTheme(), {
          color: (t: string) => theme.fg("toolOutput", t),
        }),
      );
      return container;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
  } as any;
}

interface StatusDetails {
  taskId?: string;
  tasks?: Array<{
    id: string;
    query: string;
    phase: string;
    elapsedSeconds: number;
  }>;
  snapshot?: {
    id: string;
    query: string;
    phase: string;
    elapsedSeconds: number;
  };
  completed?: boolean;
  result?: ResearchResultDetails;
}
