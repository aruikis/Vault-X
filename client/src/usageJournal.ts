// Private usage journal — the client logger (Anthony, Nov 9,
// 2026, approved after Jarvis proposed it): the app quietly
// records how the signed-in user actually moves through it —
// screens in order, taps and actions, Back use, searches and
// whether they found anything, and how many steps common jobs
// take — so Jarvis can audit the trail daily and propose more
// intuitive flows from real friction evidence.
//
// PRIVACY, by construction: events carry navigation and
// action metadata ONLY. Nothing here ever reads an input's
// value (the one exception is the Search box's own query text,
// which the journal exists to study — Anthony asked for
// searches to be recorded), never a password or payment field,
// and never message text: tap logging takes a control's
// aria-label or tab text, never the content around it. The
// journal is the user's own — it is read back only through
// getUsageJournal, which can only ever return the journal of
// the collector who owns the app copy, and it appears nowhere
// social: the one in-app reader is the owner-only Admin view.
//
// LIGHTWEIGHT, by construction: events queue in memory and
// flush in ONE batched action call — at 25 queued events, on
// a 12-second timer, when the app backgrounds or closes — and
// every failure is swallowed, so logging can never slow the
// app down, block a tap, or surface an error.

import { api } from "./api";

export type JournalKind =
  | "screen"
  | "tap"
  | "action"
  | "back"
  | "search"
  | "job";

type JournalEvent = {
  sessionId: string;
  kind: JournalKind;
  label: string;
  detail?: Record<string, unknown> | null;
  at: string;
};

const SESSION_KEY = "vaultx-journal-session-v1";

function newSessionId(): string {
  try {
    const c = window.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // Fall through to the timestamp id.
  }
  return `s-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1e9,
  ).toString(36)}`;
}

/** One session per app open: the id lives in sessionStorage so
    a pull-to-refresh mid-task keeps the same trail, and a full
    close starts a fresh one. */
function readSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = newSessionId();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

const SESSION_ID = readSessionId();

const queue: JournalEvent[] = [];
let flushTimer: number | null = null;
let flushing = false;

const FLUSH_AT = 25;
const FLUSH_MS = 12_000;
const QUEUE_CAP = 300;

/** Sends the queued batch. Fire-and-forget: on failure the
    events that didn't land are dropped once the queue is far
    past the cap rather than retried forever — the journal is
    evidence, not accounting, and it must never grow teeth. */
export function flushJournal(): void {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, 100);
  void api
    .logUsageEvents({ events: batch })
    .catch(() => {
      // The server didn't take them: put them back at the
      // front unless the queue is already overflowing.
      if (queue.length < QUEUE_CAP) queue.unshift(...batch);
    })
    .finally(() => {
      flushing = false;
      if (queue.length >= FLUSH_AT) flushJournal();
      else if (queue.length > 0) scheduleFlush();
    });
}

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushJournal();
  }, FLUSH_MS);
}

/** The one entry point every instrumented surface uses. */
export function journalEvent(
  kind: JournalKind,
  label: string,
  detail?: Record<string, unknown> | null,
): void {
  const clean = label.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!clean) return;
  queue.push({
    sessionId: SESSION_ID,
    kind,
    label: clean,
    detail: detail ?? null,
    at: new Date().toISOString(),
  });
  if (queue.length > QUEUE_CAP) {
    queue.splice(0, queue.length - QUEUE_CAP);
  }
  if (queue.length >= FLUSH_AT) flushJournal();
  else scheduleFlush();
}

// ----- Screen trail -------------------------------------------------

let currentScreen: string | null = null;
let currentScreenAt = 0;

/** Records entering a screen. The previous screen's dwell is
    attached to ITS OWN event stream by the reader (gap to the
    next screen), so this stays a simple ordered trail; the
    quick-exit flag is computed where the trail is read. */
export function journalScreen(name: string): void {
  if (name === currentScreen) return;
  currentScreen = name;
  currentScreenAt = Date.now();
  journalEvent("screen", name);
}

export function currentJournalScreen(): string {
  return currentScreen ?? "unknown";
}

export function currentScreenDwellMs(): number {
  return currentScreenAt > 0 ? Date.now() - currentScreenAt : 0;
}

// ----- Jobs ---------------------------------------------------------
// A "job" is one common task end to end: opening a card and
// adding copies, opening Search and finding (or not finding)
// an item, one trade step. Steps are counted while the job is
// open; closing the job emits ONE job event carrying the step
// count, the duration, and whether it completed — the shape
// the daily audit reasons over.

type OpenJob = { startedAt: number; steps: number };

const openJobs = new Map<string, OpenJob>();

export function journalJobStart(job: string): void {
  if (!openJobs.has(job)) {
    openJobs.set(job, { startedAt: Date.now(), steps: 0 });
  }
}

export function journalJobStep(job: string): void {
  const open = openJobs.get(job);
  if (open) open.steps += 1;
}

export function journalJobEnd(job: string, completed: boolean): void {
  const open = openJobs.get(job);
  if (!open) return;
  openJobs.delete(job);
  journalEvent("job", job, {
    steps: open.steps,
    ms: Date.now() - open.startedAt,
    completed,
  });
}

export function journalJobOpen(job: string): boolean {
  return openJobs.has(job);
}

export function journalJobSteps(job: string): number {
  return openJobs.get(job)?.steps ?? 0;
}

// ----- Global listeners (installed once from the app root) ---------

let installed = false;

export function installJournalListeners(): void {
  if (installed) return;
  installed = true;
  // Back use: every popstate is the device Back or an in-app
  // control driving history.back() — either way it is a Back
  // step out of the screen that was showing.
  window.addEventListener("popstate", () => {
    journalEvent("back", currentJournalScreen(), {
      dwellMs: currentScreenDwellMs(),
    });
  });
  // Flush (and cloud-push) when the app leaves the foreground
  // or closes, so the trail never waits for the next open.
  const flushAndPush = () => {
    flushJournal();
    void api.syncUsageJournal({}).catch(() => {
      // Best-effort: the rows are stored server-side locally
      // and the next full sync pushes them.
    });
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAndPush();
  });
  window.addEventListener("pagehide", flushAndPush);
}
