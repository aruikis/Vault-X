// Forums (Anthony, Nov 4, 2026 — Direction A, "Latest-first
// hybrid", from the forums-layout-mockups artifact he
// approved; opened LIVE the same day at his direction — no
// Coming Soon overlay; the Marketplace gate is separate and
// untouched).
//
// The home is the LATEST activity feed across all categories
// (newest activity first), with the category chip rail one
// tap away, at most one dismissible banner, and up to two
// pinned threads featured at the top. Thread rows are
// compact: title, author with role chip + verified check,
// category chip, reply count, last activity, and a clear
// read/unread state. No view counts exist — by his design.
// The thread view is flat: avatar + name + role chip +
// verified check on the header line and the trade trust
// strip ("N confirmed trades") on every post.
//
// Roles are forum-scoped (Owner inherent; Admin/Moderator
// granted only by the owner) and hang off the verified
// badge: the server computes every role shown here and
// refuses moderation from anyone not currently verified —
// nothing about roles is asserted client-side.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { VerifiedBadge } from "./verified";
import { VxSelect } from "./vxSelect";
import { hapticConfirm, hapticTick } from "./haptics";
import { readNavState, replaceNavState } from "./historyNav";
import { LetterAvatar } from "./letterAvatar";
import { useT } from "./i18n";

export const FORUM_CATEGORIES: { key: string; label: string; dot: string }[] = [
  { key: "announcements", label: "Announcements", dot: "#fb7185" },
  { key: "general", label: "General Talk", dot: "#38bdf8" },
  { key: "showoffs", label: "Show-offs", dot: "#a78bfa" },
  { key: "decktalk", label: "Deck Talk", dot: "#2dd4bf" },
  { key: "grading", label: "Grading & Pricing", dot: "#fbbf24" },
  { key: "trading", label: "Trading Corner", dot: "#4ade80" },
  { key: "help", label: "Help & Rules", dot: "#fb923c" },
];

const categoryOf = (key: string) =>
  FORUM_CATEGORIES.find((c) => c.key === key) ?? FORUM_CATEGORIES[1]!;

type ThreadView = ApiResponse<typeof api, "getForumHome">["threads"][number];

function fmtWhen(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RoleChip({ role }: { role: "owner" | "admin" | "moderator" | null }) {
  if (!role) return null;
  const label =
    role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Moderator";
  const cls =
    role === "owner"
      ? "bg-[var(--gold)] text-white"
      : role === "admin"
        ? "bg-[var(--accent)] text-[var(--on-accent)]"
        : "border border-[var(--accent)]/60 text-[var(--gold-soft)]";
  return (
    <span
      className={`rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

function Avatar({ username, unread }: { username: string; unread?: boolean }) {
  const initial = (username.replace(/^@/, "").charAt(0) || "?").toUpperCase();
  return (
    <span className="relative mt-0.5 shrink-0">
      <LetterAvatar initial={initial} className="h-10 w-10 text-sm" />
      {unread ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--gold)] shadow-[0_0_6px_rgba(150,120,255,0.8)]"
        />
      ) : null}
    </span>
  );
}

function ThreadRow({
  thread,
  onOpen,
}: {
  thread: ThreadView;
  onOpen: (id: number) => void;
}) {
  const cat = categoryOf(thread.category);
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          hapticTick();
          onOpen(thread.id);
        }}
        aria-label={`${thread.unread ? "Unread: " : ""}${thread.title} — ${cat.label}, ${thread.replyCount} replies, last activity ${fmtWhen(thread.lastActivityAt)}`}
        className="flex w-full items-start gap-3 px-3 py-3 text-left transition active:scale-[0.99]"
      >
        <Avatar username={thread.authorUsername} unread={thread.unread} />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-sm leading-snug text-[var(--text)] ${thread.unread ? "font-bold" : "font-semibold"}`}
          >
            {thread.pinned ? "📌 " : ""}
            {thread.title}
            {thread.locked ? " 🔒" : ""}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--dim)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: cat.dot }}
              />
              {cat.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--dim)]">
              @{thread.authorUsername}
              <VerifiedBadge
                collectorCode={thread.authorCode}
                username={thread.authorUsername}
                className="h-3.5 w-3.5"
              />
            </span>
            <RoleChip role={thread.authorRole} />
          </span>
          <span className="mt-1 block text-[11px] tabular-nums text-[var(--dim)]">
            {thread.replyCount}{" "}
            {thread.replyCount === 1 ? "reply" : "replies"} · last by @
            {thread.lastPostBy ?? thread.authorUsername} ·{" "}
            {fmtWhen(thread.lastActivityAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

const BANNER_KEY = "vaultx-forum-banner-dismissed-v1";

export function ForumsPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"latest" | "new" | "top">("latest");
  const [search, setSearch] = useState("");
  const [asTestFriend, setAsTestFriend] = useState(false);
  const [bannerGone, setBannerGone] = useState(() => {
    try {
      return window.localStorage.getItem(BANNER_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [openThreadId, setOpenThreadId] = useState<number | null>(() => {
    try {
      const st = window.history.state as { lorcanaForumThread?: unknown } | null;
      return typeof st?.lorcanaForumThread === "number"
        ? st.lorcanaForumThread
        : null;
    } catch {
      return null;
    }
  });
  const [composing, setComposing] = useState(false);

  const home = useQuery({
    queryKey: ["forumHome", category, sort, search, asTestFriend],
    queryFn: () =>
      api.getForumHome({ category, sort, search, asTestFriend }),
    enabled: openThreadId == null && !composing,
  });

  useEffect(() => {
    const onPop = () => {
      try {
        const st = window.history.state as {
          lorcanaForumThread?: unknown;
        } | null;
        setOpenThreadId(
          typeof st?.lorcanaForumThread === "number"
            ? st.lorcanaForumThread
            : null,
        );
        if (st?.lorcanaForumThread == null) setComposing(false);
      } catch {
        setOpenThreadId(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openThread = (id: number) => {
    // Three-back rule (Anthony, Nov 4, 2026): the thread page is
    // main-flow navigation — replace the single app entry, never
    // push. The device Back exits the app; the in-page back
    // (closeThread) returns to the board in place.
    replaceNavState({ ...(readNavState() ?? {}), lorcanaForumThread: id });
    setOpenThreadId(id);
  };
  const closeThread = () => {
    const cur = readNavState();
    if (cur?.lorcanaForumThread != null) {
      const next = { ...cur };
      delete next.lorcanaForumThread;
      replaceNavState(next);
    }
    setOpenThreadId(null);
  };

  const invalidateHome = () =>
    void queryClient.invalidateQueries({ queryKey: ["forumHome"] });

  if (composing) {
    return (
      <ForumComposer
        asTestFriend={asTestFriend}
        onCancel={() => setComposing(false)}
        onCreated={(id) => {
          setComposing(false);
          invalidateHome();
          openThread(id);
        }}
      />
    );
  }
  if (openThreadId != null) {
    return (
      <ForumThreadPage
        threadId={openThreadId}
        asTestFriend={asTestFriend}
        onBack={closeThread}
        onChanged={invalidateHome}
      />
    );
  }

  const threads = home.data?.threads ?? [];
  const pinned = home.data?.pinned ?? [];
  return (
    <section aria-label="Forums" className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-album text-xl text-[var(--text)]">{t("forum.title")}</h2>
        <button
          type="button"
          onClick={() => {
            hapticTick();
            setComposing(true);
          }}
          className="rounded-full bg-[var(--gold)] px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(110,92,245,0.35)] transition active:scale-[0.97]"
        >
          + {t("forum.newThread")}
        </button>
      </div>
      <div className="mt-2.5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("forum.search")}
          aria-label="Search forums"
          className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
        />
      </div>

      {!bannerGone ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
          <span aria-hidden="true" className="text-base">
            ✨
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[var(--text)]">
            <strong>Welcome to the Vault X forums.</strong> Be kind,
            trade fair — and remember a verified check means an
            identity was confirmed by a completed trade, never
            &ldquo;safe to pay&rdquo;. The in-person QR handshake is
            still the safety step.
          </p>
          <button
            type="button"
            aria-label="Dismiss the forums welcome banner"
            onClick={() => {
              hapticTick();
              setBannerGone(true);
              try {
                window.localStorage.setItem(BANNER_KEY, "1");
              } catch {
                // Dismissal just won't persist.
              }
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-[var(--dim)]"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div
        className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by category"
      >
        {[{ key: "all", label: "All", dot: "var(--accent)" }, ...FORUM_CATEGORIES].map(
          (c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={category === c.key}
              onClick={() => {
                hapticTick();
                setCategory(c.key);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                category === c.key
                  ? "border-[var(--accent)] bg-[var(--accent)]/25 text-[var(--text)] shadow-[0_0_10px_rgba(129,140,248,0.25)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: c.dot }}
              />
              {c.label}
            </button>
          ),
        )}
      </div>

      <div
        className="mt-1 flex items-center gap-1.5"
        role="group"
        aria-label="Sort threads"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
          Sort
        </span>
        {(
          [
            ["latest", t("forum.latest")],
            ["new", t("forum.new")],
            ["top", t("forum.topWeek")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={sort === key}
            onClick={() => {
              hapticTick();
              setSort(key);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              sort === key
                ? "bg-[var(--gold)] text-white"
                : "text-[var(--dim)]"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[var(--dim)]">
            <input
              type="checkbox"
              checked={asTestFriend}
              onChange={(e) => setAsTestFriend(e.target.checked)}
              aria-label="Browse and post as Jarvis, the built-in test friend"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            As Jarvis (test)
          </label>
        </span>
      </div>

      {home.isPending ? (
        <p className="mt-6 text-sm text-[var(--dim)]">Loading the forums…</p>
      ) : home.isError ? (
        <p className="mt-6 text-sm text-red-400">
          The forums couldn&rsquo;t be loaded just now — try again in a
          moment.
        </p>
      ) : (
        <>
          {pinned.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
                📌 Featured · pinned by mods
              </p>
              <ul className="mt-1.5 divide-y divide-[var(--border)] rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)]">
                {pinned.map((t) => (
                  <ThreadRow key={t.id} thread={t} onOpen={openThread} />
                ))}
              </ul>
            </div>
          ) : null}
          {threads.length === 0 && pinned.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
              <p className="text-base font-semibold text-[var(--text)]">
                {search
                  ? "Nothing matches that search"
                  : t("forum.noThreads")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                {search
                  ? "Try a different title or author."
                  : "Pick a category, say what's on your mind, and the feed starts here."}
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              {threads.map((t) => (
                <ThreadRow key={t.id} thread={t} onOpen={openThread} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function ForumComposer({
  asTestFriend,
  onCancel,
  onCreated,
}: {
  asTestFriend: boolean;
  onCancel: () => void;
  onCreated: (threadId: number) => void;
}) {
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api.createForumThread({
        category,
        title: title.trim(),
        body: body.trim(),
        asTestFriend,
      }),
    onSuccess: (res) => {
      if (res.ok && res.threadId != null) {
        hapticConfirm();
        onCreated(res.threadId);
      }
    },
  });
  const error =
    create.data && !create.data.ok
      ? create.data.error
      : create.isError
        ? "That didn't post — try again."
        : null;
  return (
    <section aria-label="Start a new thread" className="mt-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            hapticTick();
            onCancel();
          }}
          aria-label="Back to the forums"
          className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--text)]"
        >
          ← Forums
        </button>
        <h2 className="font-album text-xl text-[var(--text)]">New thread</h2>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="forum-category"
            className="block text-sm font-semibold text-[var(--text)]"
          >
            Category
          </label>
          <VxSelect
            id="forum-category"
            className="mt-1.5 w-full"
            value={category}
            onChange={setCategory}
            options={FORUM_CATEGORIES.map((c) => ({
              value: c.key,
              label: c.label,
            }))}
            ariaLabel="Thread category"
          />
        </div>
        <div>
          <label
            htmlFor="forum-title"
            className="block text-sm font-semibold text-[var(--text)]"
          >
            Title
          </label>
          <input
            id="forum-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="What's this thread about?"
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-base text-[var(--text)] placeholder:text-[var(--dim)]"
          />
        </div>
        <div>
          <label
            htmlFor="forum-body"
            className="block text-sm font-semibold text-[var(--text)]"
          >
            First post
          </label>
          <textarea
            id="forum-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={6}
            placeholder="Say it the way you'd say it at the shop…"
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-base text-[var(--text)] placeholder:text-[var(--dim)]"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={
            !title.trim() || !body.trim() || create.isPending
          }
          onClick={() => create.mutate()}
          className="w-full rounded-full bg-[var(--gold)] px-4 py-3 text-base font-bold text-white shadow-[0_5px_14px_rgba(110,92,245,0.4)] transition active:scale-[0.98] disabled:opacity-50"
        >
          {create.isPending ? "Posting…" : "Post thread"}
        </button>
      </div>
    </section>
  );
}

function ForumThreadPage({
  threadId,
  asTestFriend,
  onBack,
  onChanged,
}: {
  threadId: number;
  asTestFriend: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const tr = useT();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const thread = useQuery({
    queryKey: ["forumThread", threadId, asTestFriend],
    queryFn: () => api.getForumThread({ threadId, asTestFriend }),
  });
  const reply = useMutation({
    mutationFn: () =>
      api.createForumPost({
        threadId,
        body: draft.trim(),
        asTestFriend,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        setDraft("");
        void queryClient.invalidateQueries({
          queryKey: ["forumThread", threadId],
        });
        onChanged();
      }
    },
  });
  const moderate = useMutation({
    mutationFn: (action: "pin" | "unpin" | "lock" | "unlock") =>
      api.moderateForumThread({ threadId, action, asTestFriend }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        void queryClient.invalidateQueries({
          queryKey: ["forumThread", threadId],
        });
        onChanged();
      }
    },
  });
  const removePost = useMutation({
    mutationFn: (postId: number) =>
      api.deleteForumPost({ postId, asTestFriend }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        void queryClient.invalidateQueries({
          queryKey: ["forumThread", threadId],
        });
        onChanged();
      }
    },
  });
  const t = thread.data?.thread ?? null;
  const myRole = thread.data?.myRole ?? null;
  const canModerate = myRole != null;
  const canLock = myRole === "owner" || myRole === "admin";
  const actionError =
    moderate.data && !moderate.data.ok
      ? moderate.data.error
      : removePost.data && !removePost.data.ok
        ? removePost.data.error
        : reply.data && !reply.data.ok
          ? reply.data.error
          : null;
  const cat = t ? categoryOf(t.category) : null;
  return (
    <section aria-label="Forum thread" className="mt-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            hapticTick();
            onBack();
          }}
          aria-label="Back to the forums"
          className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--text)]"
        >
          ← Forums
        </button>
        {cat ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--dim)]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: cat.dot }}
            />
            {cat.label}
          </span>
        ) : null}
      </div>
      {thread.isPending ? (
        <p className="mt-6 text-sm text-[var(--dim)]">Loading the thread…</p>
      ) : !t ? (
        <p className="mt-6 text-sm text-[var(--dim)]">
          That thread is gone.
        </p>
      ) : (
        <>
          <h2 className="font-album mt-3 text-xl leading-snug text-[var(--text)]">
            {t.title}
          </h2>
          {canModerate ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={moderate.isPending}
                onClick={() =>
                  moderate.mutate(t.pinned ? "unpin" : "pin")
                }
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--text)] disabled:opacity-50"
              >
                {t.pinned ? "Unpin" : "Pin (max 2)"}
              </button>
              {canLock ? (
                <button
                  type="button"
                  disabled={moderate.isPending}
                  onClick={() =>
                    moderate.mutate(t.locked ? "unlock" : "lock")
                  }
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--text)] disabled:opacity-50"
                >
                  {t.locked ? "Unlock" : "Lock"}
                </button>
              ) : null}
            </div>
          ) : null}
          {actionError ? (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {actionError}
            </p>
          ) : null}
          <ul className="mt-3 space-y-2.5">
            {(thread.data?.posts ?? []).map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar username={p.authorUsername} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
                      @{p.authorUsername}
                      <VerifiedBadge
                        collectorCode={p.authorCode}
                        username={p.authorUsername}
                        className="h-4 w-4"
                      />
                      <RoleChip role={p.authorRole} />
                    </p>
                    <p className="text-[11px] tabular-nums text-[var(--dim)]">
                      {p.confirmedTrades}{" "}
                      {p.confirmedTrades === 1
                        ? "confirmed trade"
                        : "confirmed trades"}{" "}
                      · {fmtWhen(p.createdAt)}
                    </p>
                  </div>
                  {p.mine || canLock ? (
                    <button
                      type="button"
                      disabled={removePost.isPending}
                      onClick={() => removePost.mutate(p.id)}
                      aria-label={`Remove this post by ${p.authorUsername}`}
                      className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-[var(--dim)] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--text)]">
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
          {t.locked ? (
            <p className="mt-3 rounded-xl bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--dim)]">
              🔒 This thread is locked — no new replies
              {canLock ? " for anyone but owner/admin" : ""}.
            </p>
          ) : (
            <div className="mt-4">
              <label
                htmlFor="forum-reply"
                className="block text-sm font-semibold text-[var(--text)]"
              >
                {tr("forum.reply")}
              </label>
              <textarea
                id="forum-reply"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="Add your voice…"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-base text-[var(--text)] placeholder:text-[var(--dim)]"
              />
              <button
                type="button"
                disabled={!draft.trim() || reply.isPending}
                onClick={() => reply.mutate()}
                className="mt-2 w-full rounded-full bg-[var(--gold)] px-4 py-3 text-base font-bold text-white shadow-[0_5px_14px_rgba(110,92,245,0.4)] transition active:scale-[0.98] disabled:opacity-50"
              >
                {reply.isPending ? "Posting…" : tr("forum.postReply")}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
