import "server-only";
import { runDueSearches } from "./search-job";
import { processAutoReplies } from "./auto-reply-job";
import { publishScheduledArticles } from "./article-job";
import { pruneExpiredRecords } from "./retention-job";
import { CYCLE_LOCK, withJobLock } from "./lock";
import { expireDueTransactions } from "@/server/billing/transactions";

export type WorkerStatus = {
  enabled: boolean;
  running: boolean;
  /** Siklus yang dilewati karena instance lain sedang memegang kunci. */
  skippedByLock: number;
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
  skippedByLock: number;
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
      skippedByLock: 0,
      cycleCount: 0,
      lastCycleAt: null,
      lastDurationMs: null,
      lastError: null,
      lastSummary: null,
    };
  }
  return globalForWorker.carimarketWorker;
}

/**
 * Masa berlaku kunci siklus.
 *
 * Harus lebih panjang dari siklus terlama yang masuk akal, tetapi tetap
 * terbatas: proses yang mati di tengah siklus tidak sempat melepas kuncinya,
 * dan kunci tanpa kedaluwarsa akan menghentikan pekerjaan latar selamanya.
 */
const CYCLE_LOCK_TTL_MS = 10 * 60_000;

/**
 * Satu siklus pekerjaan latar.
 *
 * Dijaga dua lapis. `worker.running` mencegah siklus menumpuk di dalam satu
 * proses, sedangkan kunci database mencegah dua instance mengerjakan hal yang
 * sama — tanpa itu, menjalankan lebih dari satu proses berarti setiap
 * pencarian terjadwal dikerjakan dua kali dan kuota Meta terpakai dua kali.
 */
export async function runCycle() {
  const worker = state();
  if (worker.running) return { skipped: true, reason: "running" as const, summary: worker.lastSummary };
  worker.running = true;
  const startedAt = Date.now();
  try {
    const locked = await withJobLock(CYCLE_LOCK, CYCLE_LOCK_TTL_MS, async () => {
      const searchSummary = await runDueSearches();
      const replySummary = await processAutoReplies();
      const articleSummary = await publishScheduledArticles();
      const billingSummary = await expireDueTransactions();
      const retentionSummary = await pruneExpiredRecords();
      return { ...searchSummary, ...replySummary, ...articleSummary, ...billingSummary, ...retentionSummary };
    });

    if (!locked.acquired) {
      worker.skippedByLock += 1;
      return { skipped: true, reason: "locked" as const, summary: worker.lastSummary };
    }

    worker.lastSummary = locked.value;
    worker.lastError = null;
    return { skipped: false, reason: null, summary: worker.lastSummary };
  } catch (error) {
    worker.lastError = error instanceof Error ? error.message.slice(0, 200) : "WORKER_CYCLE_FAILED";
    return { skipped: false, reason: null, summary: worker.lastSummary };
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
    skippedByLock: worker.skippedByLock,
    cycleCount: worker.cycleCount,
    lastCycleAt: worker.lastCycleAt ? worker.lastCycleAt.toISOString() : null,
    lastDurationMs: worker.lastDurationMs,
    lastError: worker.lastError,
    lastSummary: worker.lastSummary,
  };
}
