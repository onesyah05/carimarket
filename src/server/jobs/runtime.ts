import "server-only";
import { runDueSearches } from "./search-job";
import { processAutoReplies } from "./auto-reply-job";
import { publishScheduledArticles } from "./article-job";
import { expireDueTransactions } from "@/server/billing/transactions";

export type WorkerStatus = {
  enabled: boolean;
  running: boolean;
  cycleCount: number;
  lastCycleAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastSummary: Record<string, number> | null;
};

type WorkerState = {
  enabled: boolean;
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
  cycleCount: number;
  lastCycleAt: Date | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastSummary: Record<string, number> | null;
};

const globalForWorker = globalThis as unknown as { carimarketWorker?: WorkerState };

function state(): WorkerState {
  if (!globalForWorker.carimarketWorker) {
    globalForWorker.carimarketWorker = {
      enabled: false,
      timer: null,
      running: false,
      cycleCount: 0,
      lastCycleAt: null,
      lastDurationMs: null,
      lastError: null,
      lastSummary: null,
    };
  }
  return globalForWorker.carimarketWorker;
}

export async function runCycle() {
  const worker = state();
  if (worker.running) return { skipped: true, summary: worker.lastSummary };
  worker.running = true;
  const startedAt = Date.now();
  try {
    const searchSummary = await runDueSearches();
    const replySummary = await processAutoReplies();
    const articleSummary = await publishScheduledArticles();
    const billingSummary = await expireDueTransactions();
    worker.lastSummary = { ...searchSummary, ...replySummary, ...articleSummary, ...billingSummary };
    worker.lastError = null;
    return { skipped: false, summary: worker.lastSummary };
  } catch (error) {
    worker.lastError = error instanceof Error ? error.message.slice(0, 200) : "WORKER_CYCLE_FAILED";
    return { skipped: false, summary: worker.lastSummary };
  } finally {
    worker.running = false;
    worker.cycleCount += 1;
    worker.lastCycleAt = new Date();
    worker.lastDurationMs = Date.now() - startedAt;
  }
}

export function startWorker() {
  const worker = state();
  if (worker.enabled) return;
  if (process.env.WORKER_ENABLED === "false") return;
  if (!process.env.DATABASE_URL) return;

  const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);
  worker.enabled = true;
  const firstRun = setTimeout(() => { void runCycle(); }, 10_000);
  firstRun.unref?.();
  worker.timer = setInterval(() => { void runCycle(); }, Math.max(15_000, intervalMs));
  worker.timer.unref?.();
}

export function getWorkerStatus(): WorkerStatus {
  const worker = state();
  return {
    enabled: worker.enabled,
    running: worker.running,
    cycleCount: worker.cycleCount,
    lastCycleAt: worker.lastCycleAt ? worker.lastCycleAt.toISOString() : null,
    lastDurationMs: worker.lastDurationMs,
    lastError: worker.lastError,
    lastSummary: worker.lastSummary,
  };
}
