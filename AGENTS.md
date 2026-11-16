# Building this web artifact

This directory is a web artifact — a TypeScript space: a React client in
`client/`, server actions in `server/src/actions.ts`, the schema in
`server/src/schema.ts`, and Drizzle SQL migrations in `drizzle/` (see
`space.json` for its runtime and slug).

Build, audit, and ship it only through the web-artifact tools your builder
instructions describe. Do not hand-edit the built bundle under
`~/workspace/ts-spaces/<slug>/.space-build/`, and do not `bun run build`:
neither publishes the artifact.

If you are not the builder subagent (for example, the main assistant landed
here), do not build from this directory. List the existing artifacts and
request a change by describing the edit — that spawns a builder to do the
work.

## This artifact's data

This artifact's data lives in `~/workspace/ts-spaces/<slug>/app.db`, managed by
the app. If you are the main agent, follow your own Artifacts instructions for
reading and changing a web artifact's records. Do not run sqlite or scripts
against `~/workspace/ts-spaces/<slug>/app.db`.

## Privacy: personal data files — NEVER sync the live app's copies

The owner's rule for sharing Vault X, in his own words:

> "If we share Vault X, I want it to be a fresh install. Nothing from
> anyone's collection should be in there. It should be fresh and they
> should create their own collection. The only way they should be able
> to see my collection is if they friended me."

The following files in THIS repo are intentionally EMPTY placeholders
(emptied in v1.127.0). The live app's copies hold the owner's personal
collection data and must NEVER be copied into this repo:

- `server/src/data/ownership.ts` (collection ownership seed)
- `server/src/data/exportFinance.ts` (sealed items, finance totals, history seed)
- `server/src/data/cardHistory.ts` (per-card price history seed)
- `server/src/data/sealedHistory.ts` (sealed price history seed)
- `server/src/data/villageAggroDeck.ts` (the owner's personal deck list)
- `DATA-PLAN.md` (the owner's development journal — removed from this
  repo in v1.127.0; do not re-add it)

When doing a "full source sync" from the live app
(`~/workspace/ts-spaces/lorcana-binder`) into this repo:

1. Copy the source as usual, then RESTORE the placeholders before
   committing:
   `git checkout HEAD -- server/src/data/ownership.ts server/src/data/exportFinance.ts server/src/data/cardHistory.ts server/src/data/sealedHistory.ts server/src/data/villageAggroDeck.ts`
   and delete `DATA-PLAN.md` again if the copy brought it back.
2. Run `bun run check:personal-data` — it must pass before you commit
   or push. It fails if any placeholder grew back into personal data.
3. The public card catalog files (`catalog.ts`, `catalogExtras.ts`,
   `catalogPrices.ts`, and the other market-price snapshots) are
   public data and DO sync as usual.
