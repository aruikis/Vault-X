import type { OwnershipEntry } from "./catalogTypes";

// Fresh-install seed — INTENTIONALLY EMPTY.
//
// Vault X installs shared with other collectors must start with an
// empty collection: nothing from anyone's collection is bundled with
// the app. (This file previously carried the original owner's
// Nov 1, 2026 collection export; that was removed in v1.127.0 —
// see AGENTS.md, "Privacy: personal data files".)
//
// seedBinder reads this map when a brand-new copy of the app first
// loads. An empty map means every binder pocket starts unowned and
// each collector builds their own collection from scratch. The only
// way to see another collector's collection is to friend them
// inside the app.
export const ownership: Record<string, OwnershipEntry> = {};
