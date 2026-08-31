import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getClient } from "../../client";
import type { ResearchSettings } from "../../lib/settings";
import type {
  LinkupResearchSourcedAnswer,
  LinkupResearchTask,
} from "../../types";
import { buildResearchResult, type ResearchResultDetails } from "./render";

/** customType of the follow-up message delivered when a task finishes. */
export const MESSAGE_TYPE_RESEARCH_RESULT = "linkup-research-result";

/** customType of the session entries used to reattach tasks on resume. */
export const ENTRY_TYPE_RESEARCH_TASK = "linkup-research-task";

export type TrackedTaskPhase =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export interface TrackedTaskSnapshot {
  id: string;
  query: string;
  submittedAt: number;
  phase: TrackedTaskPhase;
  lastStatus: string | undefined;
  elapsedSeconds: number;
  finished: boolean;
}

interface TrackedTask {
  id: string;
  query: string;
  submittedAt: number;
  /** How long this process has been waiting on the task (poll budget). */
  waitedMs: number;
  lastStatus: string | undefined;
  pollIntervalMs: number;
  finished: boolean;
  /** Set when polling stopped because the overall deadline was exceeded. */
  expired: boolean;
  result?: { text: string; details: ResearchResultDetails };
}

/** Minimal client surface the manager needs; lets tests inject a fake. */
export interface ResearchApi {
  getResearch(id: string, signal?: AbortSignal): Promise<LinkupResearchTask>;
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface ResearchTaskManagerOptions {
  client?: ResearchApi;
  getSettings?: () => Promise<ResearchSettings>;
  now?: () => number;
}

/**
 * Owns the lifetime of submitted research tasks so the agent's turn
 * doesn't have to: linkup_research submits and returns immediately,
 * and this manager polls asynchronously (with configured backoff and an
 * overall deadline), delivering the finished result as a follow-up
 * message when the task completes.
 */
export class ResearchTaskManager {
  private tasks = new Map<string, TrackedTask>();
  private settings: ResearchSettings;
  private readonly getSettings?: () => Promise<ResearchSettings>;
  private readonly client: ResearchApi;
  private readonly now: () => number;
  private stopped = false;

  constructor(
    private pi: Pick<ExtensionAPI, "sendMessage" | "appendEntry">,
    baseSettings: ResearchSettings,
    options: ResearchTaskManagerOptions = {},
  ) {
    this.settings = baseSettings;
    this.getSettings = options.getSettings;
    this.client = options.client ?? getClient();
    this.now = options.now ?? Date.now;
  }

  /** Settings can change at runtime via /linkup:settings saves. */
  private async refreshSettings() {
    if (this.getSettings) {
      this.settings = await this.getSettings();
    }
  }

  /** Register a freshly submitted task and start polling it in the background. */
  track(task: LinkupResearchTask, query: string): void {
    if (this.tasks.has(task.id)) return;
    const tracked: TrackedTask = {
      id: task.id,
      query,
      submittedAt: this.now(),
      waitedMs: 0,
      lastStatus: task.status,
      pollIntervalMs: this.settings.pollInitialMs,
      finished: false,
      expired: false,
    };
    this.tasks.set(task.id, tracked);
    Promise.resolve(
      this.pi.appendEntry(ENTRY_TYPE_RESEARCH_TASK, {
        phase: "submitted",
        id: task.id,
        query,
        submittedAt: tracked.submittedAt,
      }),
    ).catch(() => {
      // Session entry persistence is best-effort; polling still works.
    });
    void this.runPollLoop(tracked);
  }

  /** Snapshot for status listing / rendering. */
  list(): TrackedTaskSnapshot[] {
    return [...this.tasks.values()].map((task) => this.snapshot(task));
  }

  get(id: string): TrackedTaskSnapshot | undefined {
    const task = this.tasks.get(id);
    return task ? this.snapshot(task) : undefined;
  }

  /**
   * Fetch the current task state directly from the API and update
   * local bookkeeping. Server-side tasks are persistent, so this works
   * for any task id, including tasks submitted in a previous session.
   */
  async check(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ snapshot: TrackedTaskSnapshot; remote: LinkupResearchTask }> {
    const task = this.tasks.get(id);
    const remote = await this.client.getResearch(id, signal);
    if (task) {
      task.lastStatus = remote.status;
      if (
        !task.finished &&
        (remote.status === "completed" || remote.status === "failed")
      ) {
        // The poller may not have delivered this yet; the status tool
        // returns the result inline, so mark finished without a
        // follow-up message to avoid duplicate deliverables.
        task.finished = true;
        if (remote.status === "completed") {
          task.result = await this.formatResult(task, remote);
        }
        this.appendFinishedEntry(task, remote.status);
      }
    }
    return { snapshot: this.snapshotById(id, remote), remote };
  }

  /**
   * Reattach to tasks found in session entries (survives session
   * resume/fork: Linkup tasks are server-side persistent).
   */
  recoverFromEntries(entries: Array<{ type: string; data?: unknown }>): void {
    const recovered = new Map<
      string,
      { phase?: string; id: string; query?: string; submittedAt?: number }
    >();
    for (const entry of entries) {
      if (entry.type !== "custom") continue;
      const data = entry.data as
        | { phase?: string; id?: string; query?: string; submittedAt?: number }
        | undefined;
      if (!data || typeof data.id !== "string") continue;
      // Entries are ordered; the last entry per id wins ("finished" beats "submitted").
      recovered.set(data.id, data as never);
    }
    for (const data of recovered.values()) {
      if (this.tasks.has(data.id)) continue;
      if (data.phase === "finished") continue;
      this.tasks.set(data.id, {
        id: data.id,
        query: data.query ?? "(recovered task)",
        submittedAt:
          typeof data.submittedAt === "number" ? data.submittedAt : this.now(),
        // The deadline bounds how long *this process* waits, so a task
        // recovered from a previous session gets a fresh budget instead of
        // instantly tripping the deadline (it may already be completed
        // server-side and needs at least one poll to deliver it).
        waitedMs: 0,
        lastStatus: "pending",
        pollIntervalMs: this.settings.pollInitialMs,
        finished: false,
        expired: false,
      });
      void this.runPollLoop(this.tasks.get(data.id) as TrackedTask);
    }
  }

  /** Stop all polling (session shutdown). */
  stop(): void {
    this.stopped = true;
  }

  private snapshot(task: TrackedTask): TrackedTaskSnapshot {
    return {
      id: task.id,
      query: task.query,
      submittedAt: task.submittedAt,
      phase: this.phaseOf(task),
      lastStatus: task.lastStatus,
      elapsedSeconds: Math.max(
        0,
        Math.round((this.now() - task.submittedAt) / 1000),
      ),
      finished: task.finished,
    };
  }

  private snapshotById(
    id: string,
    remote: LinkupResearchTask,
  ): TrackedTaskSnapshot {
    const task = this.tasks.get(id);
    if (task) return this.snapshot(task);
    const createdAt = Date.parse(remote.createdAt);
    // Unknown to this session: derive the phase from the remote status.
    const phase: TrackedTaskPhase =
      remote.status === "completed"
        ? "completed"
        : remote.status === "failed"
          ? "failed"
          : remote.status === "processing"
            ? "processing"
            : "pending";
    return {
      id,
      query: remote.input?.q ?? "(unknown task)",
      submittedAt: createdAt || Date.now(),
      phase,
      lastStatus: remote.status,
      elapsedSeconds: Number.isNaN(createdAt)
        ? -1
        : Math.max(0, Math.round((Date.now() - createdAt) / 1000)),
      finished: remote.status === "completed" || remote.status === "failed",
    };
  }

  private phaseOf(task: TrackedTask): TrackedTaskPhase {
    if (task.finished) {
      return task.expired ? "expired" : task.result ? "completed" : "failed";
    }
    // Not finished: mirror the last known remote status. Terminal statuses
    // here are transient (submission returned them, or bookkeeping between
    // observing the status and flagging the task finished).
    switch (task.lastStatus) {
      case "completed":
        return "completed";
      case "failed":
        return "failed";
      case "processing":
        return "processing";
      default:
        return "pending";
    }
  }

  private async runPollLoop(task: TrackedTask) {
    while (!this.stopped && !task.finished) {
      // Refreshed every iteration so /linkup:settings saves (cadence,
      // deadline, delivery mode) apply to in-flight tasks too.
      await this.refreshSettings();
      try {
        await sleep(task.pollIntervalMs);
      } catch {
        return;
      }
      task.waitedMs += task.pollIntervalMs;
      if (this.stopped || task.finished) return;
      task.pollIntervalMs = Math.min(
        Math.round(task.pollIntervalMs * this.settings.pollBackoffMultiplier),
        this.settings.pollMaxMs,
      );

      let remote: LinkupResearchTask;
      try {
        remote = await this.client.getResearch(task.id);
      } catch {
        // Transient poll error (network, rate limit): keep retrying
        // until the overall deadline or session end.
        if (task.waitedMs >= this.settings.maxWaitMs) {
          await this.expire(task);
          return;
        }
        continue;
      }
      if (this.stopped || task.finished) return;

      task.lastStatus = remote.status;
      switch (remote.status) {
        case "completed": {
          task.finished = true;
          task.result = await this.formatResult(task, remote);
          this.appendFinishedEntry(task, "completed");
          await this.deliverResult(task);
          return;
        }
        case "failed": {
          task.finished = true;
          this.appendFinishedEntry(task, "failed");
          await this.deliverMessage(
            `Linkup research task ${task.id} (query: "${task.query}") failed: ${remote.error || "no error message"}. You can retry with linkup_research if the failure looks transient.`,
          );
          return;
        }
        default:
          break;
      }

      // Checked after polling (not before): a task that crosses the budget
      // still gets one last status check before being declared expired.
      if (task.waitedMs >= this.settings.maxWaitMs) {
        await this.expire(task);
        return;
      }
    }
  }

  /** Stop polling a task whose overall deadline ran out. */
  private async expire(task: TrackedTask) {
    task.expired = true;
    task.finished = true;
    this.appendFinishedEntry(task, "expired");
    await this.deliverMessage(
      `Linkup research task ${task.id} (query: "${task.query}") did not complete within the configured ${Math.round(this.settings.maxWaitMs / 60000)} min polling deadline. Polling stopped; the task may still finish server-side. Check it later with linkup_research_status (taskId: "${task.id}").`,
    );
  }

  private async formatResult(
    task: TrackedTask,
    remote: LinkupResearchTask,
  ): Promise<{ text: string; details: ResearchResultDetails } | undefined> {
    const output = remote.output as LinkupResearchSourcedAnswer | undefined;
    if (!output || typeof output !== "object" || !("answer" in output)) {
      return undefined;
    }
    return buildResearchResult(
      task.query,
      task.id,
      Math.round((this.now() - task.submittedAt) / 1000),
      output,
    );
  }

  private async deliverResult(task: TrackedTask) {
    if (!task.result) {
      await this.deliverMessage(
        `Linkup research task ${task.id} (query: "${task.query}") completed, but returned no usable output. Check the raw output with linkup_research_status (taskId: "${task.id}").`,
      );
      return;
    }
    if (this.settings.deliverResult === "ping") {
      await this.deliverMessage(
        `Linkup research task ${task.id} (query: "${task.query}") completed in ${task.result.details.elapsedSeconds}s. Retrieve the full sourced result with linkup_research_status (taskId: "${task.id}").`,
      );
      return;
    }
    await this.deliverMessage(
      `The background linkup_research task for "${task.query}" has completed (${task.result.details.elapsedSeconds}s, id ${task.id}). Present the sourced answer below to the user:\n\n${task.result.text}`,
      task.result.details,
    );
  }

  private deliverMessage(content: string, details?: ResearchResultDetails) {
    this.pi.sendMessage(
      {
        customType: MESSAGE_TYPE_RESEARCH_RESULT,
        content,
        display: true,
        ...(details ? { details } : {}),
      },
      { triggerTurn: true, deliverAs: "followUp" },
    );
  }

  private appendFinishedEntry(task: TrackedTask, status: string) {
    Promise.resolve(
      this.pi.appendEntry(ENTRY_TYPE_RESEARCH_TASK, {
        phase: "finished",
        id: task.id,
        status,
      }),
    ).catch(() => {
      // Best-effort persistence.
    });
  }
}
