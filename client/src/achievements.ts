// Achievements (Anthony's request, Nov 2, 2026, modeled on the
// little badge icons beside his name on his Shiny profile): badge
// icons a collector earns, shown as a small row next to their name
// on their profile, with the full earned / not-yet-earned list one
// tap away.
//
// HONESTY RULE — the same one as the Trust Score: badges are earned
// from real collection and social data only. There is no manual
// granting anywhere in the app; evaluateBadges() is a pure function
// of measured inputs (item counts, completed sets, verified trades,
// Trust Score, confirmed connections, join date), so a badge shows
// as earned only when the data actually says so.

export type BadgeInputs = {
  /** Joined during the app's first wave (within 45 days of the
      registry's earliest member). */
  founder: boolean;
  /** Total items in the collection (cards + sealed + comics). */
  totalItems: number;
  /** Master sets completed (regular + cold foil + Epics scope). */
  setsCompleted: number;
  ownsEnchanted: boolean;
  ownsIconic: boolean;
  /** Sealed items owned. */
  sealedCount: number;
  /** Graded comics owned. */
  comicsCount: number;
  /** Trades both sides confirmed (verified events only). */
  confirmedTrades: number;
  trustScore: number;
  /** Connections both sides confirmed (verified only). */
  confirmedConnections: number;
};

export type Badge = {
  id: string;
  name: string;
  /** One line: how this badge is earned. */
  how: string;
  /** Simple stroke icon (24×24 viewBox paths). */
  paths: string[];
  earned: (i: BadgeInputs) => boolean;
  /** Short progress line for the not-yet-earned state, when the
      data supports one (e.g. "9,391 / 10,000 items"). */
  progress?: (i: BadgeInputs) => string | null;
};

const itemsProgress =
  (goal: number) =>
  (i: BadgeInputs): string | null =>
    `${Math.min(i.totalItems, goal).toLocaleString()} / ${goal.toLocaleString()} items`;

export const BADGES: Badge[] = [
  {
    id: "founder",
    name: "Founder",
    how: "Joined Vault X in its first wave",
    paths: ["M5 21V4h11l-2.5 4L16 12H5"],
    earned: (i) => i.founder,
  },
  {
    id: "first-steps",
    name: "First Steps",
    how: "Logged your first item",
    paths: [
      "M12 21v-7",
      "M12 14c0-3.8 2.8-5.7 6.5-5.7 0 3.8-2.8 5.7-6.5 5.7z",
      "M12 10C12 6.5 9.5 4.8 6 4.8c0 3.5 2.5 5.2 6 5.2z",
    ],
    earned: (i) => i.totalItems >= 1,
  },
  {
    id: "century",
    name: "Century Club",
    how: "100 items in your collection",
    paths: [
      "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z",
      "M8.5 14 7 21l5-2.6L17 21l-1.5-7",
    ],
    earned: (i) => i.totalItems >= 100,
    progress: itemsProgress(100),
  },
  {
    id: "thousand",
    name: "Thousand Club",
    how: "1,000 items in your collection",
    paths: [
      "M12 3l9 5-9 5-9-5 9-5z",
      "M3 13l9 5 9-5",
    ],
    earned: (i) => i.totalItems >= 1000,
    progress: itemsProgress(1000),
  },
  {
    id: "five-figures",
    name: "Five Figures",
    how: "10,000 items in your collection",
    paths: [
      "M4 17l-1.2-9L8 11l4-6.5L16 11l5.2-3L20 17H4z",
      "M4 20h16",
    ],
    earned: (i) => i.totalItems >= 10000,
    progress: itemsProgress(10000),
  },
  {
    id: "master-setter",
    name: "Master Setter",
    how: "Completed a master set",
    paths: [
      "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
      "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      "M12 12h.01",
    ],
    earned: (i) => i.setsCompleted >= 1,
  },
  {
    id: "completionist",
    name: "Completionist",
    how: "Completed 3 or more sets",
    paths: [
      "M7 4h10v4.5a5 5 0 0 1-10 0V4z",
      "M7 5H4.5a3.5 3.5 0 0 0 3.6 3.5",
      "M17 5h2.5a3.5 3.5 0 0 1-3.6 3.5",
      "M12 13.5V17",
      "M8.5 20.5h7",
      "M10 17h4l.6 3.5H9.4L10 17z",
    ],
    earned: (i) => i.setsCompleted >= 3,
    progress: (i) =>
      i.setsCompleted > 0
        ? `${i.setsCompleted} / 3 sets completed`
        : null,
  },
  {
    id: "enchanted",
    name: "Enchanted",
    how: "Own an Enchanted card",
    paths: [
      "M7 4h10l3.5 5.5L12 20 3.5 9.5 7 4z",
      "M3.5 9.5h17",
      "M9.5 9.5L12 20l2.5-10.5",
      "M7 4l2.5 5.5L12 4l2.5 5.5L17 4",
    ],
    earned: (i) => i.ownsEnchanted,
  },
  {
    id: "iconic",
    name: "Iconic",
    how: "Own an Iconic card",
    paths: [
      "M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6L12 3z",
      "M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z",
    ],
    earned: (i) => i.ownsIconic,
  },
  {
    id: "sealed-keeper",
    name: "Sealed Keeper",
    how: "Own 5 or more sealed items",
    paths: ["M12 3 4 7v10l8 4 8-4V7l-8-4z", "M4 7l8 4 8-4", "M12 11v10"],
    earned: (i) => i.sealedCount >= 5,
    progress: (i) =>
      i.sealedCount > 0 ? `${i.sealedCount} / 5 sealed items` : null,
  },
  {
    id: "slabbed",
    name: "Slabbed",
    how: "Own a graded comic",
    paths: [
      "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
      "M6 8h12",
      "M9.5 5.5h5",
    ],
    earned: (i) => i.comicsCount >= 1,
  },
  {
    id: "first-trade",
    name: "First Trade",
    how: "Completed a confirmed trade",
    paths: ["M4 7h12.5", "M13.5 4 16.5 7l-3 3", "M20 17H7.5", "M10.5 14l-3 3 3 3"],
    earned: (i) => i.confirmedTrades >= 1,
  },
  {
    id: "trusted-trader",
    name: "Trusted Trader",
    how: "Reach a Trust Score of 10",
    paths: [
      "M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z",
      "M9 11.5l2.2 2.2L15.5 9.5",
    ],
    earned: (i) => i.trustScore >= 10,
    progress: (i) =>
      i.trustScore > 0 ? `Trust Score ${i.trustScore} / 10` : null,
  },
  {
    id: "connected",
    name: "Connected",
    how: "5 or more confirmed connections",
    paths: [
      "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
      "M3.5 19.5c.5-3.2 2.7-5 5.5-5 1.4 0 2.7.5 3.7 1.3",
      "M16 4.5a3.5 3.5 0 0 1 0 6.5",
      "M17.5 14.9c1.7.7 2.8 2.3 3.1 4.6",
    ],
    earned: (i) => i.confirmedConnections >= 5,
    progress: (i) =>
      i.confirmedConnections > 0
        ? `${i.confirmedConnections} / 5 connections`
        : null,
  },
];

export type BadgeState = {
  badge: Badge;
  earned: boolean;
  progress: string | null;
};

export function evaluateBadges(inputs: BadgeInputs): BadgeState[] {
  return BADGES.map((badge) => {
    const earned = badge.earned(inputs);
    return {
      badge,
      earned,
      progress: !earned && badge.progress ? badge.progress(inputs) : null,
    };
  });
}
