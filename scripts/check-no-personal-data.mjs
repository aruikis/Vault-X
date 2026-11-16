// Guard: the shared Vault X source must never (re)gain the owner's
// personal collection/finance data. Run before committing a source
// sync: `bun run check:personal-data`. Exit 1 = do not commit.
import { existsSync, readFileSync, statSync } from "node:fs";

const PLACEHOLDERS = [
  "server/src/data/ownership.ts",
  "server/src/data/exportFinance.ts",
  "server/src/data/cardHistory.ts",
  "server/src/data/sealedHistory.ts",
  "server/src/data/villageAggroDeck.ts",
];
// Strings that only appear in the owner's real data files.
const MARKERS = [
  "Shiny export",
  "4419.58",
  "4854.7",
  "2026-10-25",
  "Bobby Zimuruski - Spray Cheese Kid",
];
const MAX_BYTES = 20000;

let failed = false;
for (const path of PLACEHOLDERS) {
  if (!existsSync(path)) {
    console.error(`FAIL ${path}: missing (fresh installs would not build)`);
    failed = true;
    continue;
  }
  const size = statSync(path).size;
  const text = readFileSync(path, "utf8");
  const hits = MARKERS.filter((m) => text.includes(m));
  if (size > MAX_BYTES || hits.length > 0) {
    console.error(
      `FAIL ${path}: ${size} bytes, markers: ${hits.join(", ") || "none"} — this looks like the owner's personal data, not the empty placeholder`,
    );
    failed = true;
  } else {
    console.log(`ok   ${path} (${size} bytes)`);
  }
}
if (existsSync("DATA-PLAN.md")) {
  console.error("FAIL DATA-PLAN.md: present — it is the owner's private development journal and must not ship");
  failed = true;
} else {
  console.log("ok   DATA-PLAN.md absent");
}
if (failed) process.exit(1);
console.log("check:personal-data passed — no personal collection data in the shared source");
