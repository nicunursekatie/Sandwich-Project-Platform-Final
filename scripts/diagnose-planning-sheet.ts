/**
 * Read-only diagnostic for planning-sheet row placement.
 *
 * Answers one question: when the app pushes an event, why does the new row
 * land where it lands? It reads the sheet exactly the way the push code does
 * and reports what it sees — nothing is written.
 *
 * Two ways to run it:
 *
 *   npx tsx scripts/diagnose-planning-sheet.ts sheet-read.json
 *     Analyzes a saved response from GET /api/planning-sheet-proposals/sheet/read.
 *
 *   npx tsx scripts/diagnose-planning-sheet.ts --live
 *     Reads the live sheet. Needs GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
 *     and PLANNING_SHEET_ID in .env.local (this script loads that file itself).
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/** Minimal .env.local reader — the app gets its config from Replit Secrets, so there's no dotenv here. */
function loadEnvLocal(): void {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

loadEnvLocal();

// The service module opens a database connection at load time and refuses to
// initialize without a well-formed URL. This diagnostic never queries the
// database, so a placeholder is enough to get the module loaded.
const PLACEHOLDER_DB = 'postgresql://placeholder:placeholder@placeholder.invalid/placeholder';
if (!process.env.DEV_DATABASE_URL?.startsWith('postgres')) {
  process.env.DEV_DATABASE_URL = PLACEHOLDER_DB;
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres')) {
  process.env.DATABASE_URL = PLACEHOLDER_DB;
}

const {
  computeSheetPlacement,
  parsePlanningSheetDate,
  getPlanningSheetService,
} = await import('../server/planning-sheet-sync-service');

type Row = { rowIndex: number; date: string; groupName: string; eventStartTime: string; pickUpTime: string };

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npx tsx scripts/diagnose-planning-sheet.ts <sheet-read.json | --live>');
  process.exit(1);
}

let rows: Row[];
let worksheetName = process.env.PLANNING_SHEET_WORKSHEET_NAME || '2026 Groups';

if (arg === '--live') {
  const service = getPlanningSheetService();
  if (!service) {
    console.error(
      'Live mode needs PLANNING_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env.local.'
    );
    process.exit(1);
  }
  rows = (await service.readPlanningSheet()) as unknown as Row[];
} else {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), arg), 'utf8'));
  rows = (Array.isArray(parsed) ? parsed : parsed.rows) as Row[];
  if (!Array.isArray(rows)) {
    console.error(`Could not find a "rows" array in ${arg}.`);
    process.exit(1);
  }
}

const yearHint = worksheetName.match(/(20\d{2})/)
  ? parseInt(worksheetName.match(/(20\d{2})/)![1], 10)
  : undefined;

console.log(`\nWorksheet: "${worksheetName}"   year taken from the tab name: ${yearHint ?? 'none'}`);
console.log(`Rows returned by the sheet API: ${rows.length} (last is sheet row ${rows[rows.length - 1]?.rowIndex})`);

// --- How the date column reads back -----------------------------------------
const blank: Row[] = [];
const unreadable: Row[] = [];
const dated: { row: Row; date: Date; withHint: Date }[] = [];

for (const row of rows) {
  const raw = (row.date || '').trim();
  if (!raw) {
    blank.push(row);
    continue;
  }
  // Classify on the hinted result, because that is what placement actually
  // uses. A year-less cell like "10/20" is meant to fail without the hint, so
  // judging it on that would report a perfectly good row as unreadable.
  const withHint = parsePlanningSheetDate(raw, yearHint);
  if (!withHint) {
    unreadable.push(row);
    continue;
  }
  dated.push({ row, date: parsePlanningSheetDate(raw) ?? withHint, withHint });
}

console.log(`\n--- Date column ---`);
console.log(`  readable dates: ${dated.length}`);
console.log(`  blank cells:    ${blank.length}`);
console.log(`  unreadable:     ${unreadable.length}`);

if (unreadable.length) {
  console.log(`\n  Cells with text that is not a readable date:`);
  for (const row of unreadable.slice(0, 20)) {
    console.log(`    row ${row.rowIndex}: "${row.date}"   (${row.groupName})`);
  }
  if (unreadable.length > 20) console.log(`    ...and ${unreadable.length - 20} more`);
}

// --- Which years the sheet thinks it contains --------------------------------
// A pile of rows in an unexpected year is the tell-tale sign of date cells that
// omit the year: the parser silently resolves those to 2001.
const byYear = new Map<number, number>();
for (const d of dated) byYear.set(d.date.getFullYear(), (byYear.get(d.date.getFullYear()) || 0) + 1);

console.log(`\n--- Years these dates land in (as the push code reads them) ---`);
for (const [year, count] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
  const flag = yearHint && Math.abs(year - yearHint) > 5 ? '   <-- unexpected' : '';
  console.log(`  ${year}: ${count} row(s)${flag}`);
}

// --- Order ------------------------------------------------------------------
const outOfOrder: { row: Row; previous: Row }[] = [];
for (let i = 1; i < dated.length; i++) {
  if (dated[i].withHint.getTime() < dated[i - 1].withHint.getTime()) {
    outOfOrder.push({ row: dated[i].row, previous: dated[i - 1].row });
  }
}
console.log(`\n--- Order ---`);
console.log(
  outOfOrder.length === 0
    ? '  Dated rows run in ascending order.'
    : `  ${outOfOrder.length} row(s) are dated earlier than the row above them:`
);
for (const item of outOfOrder.slice(0, 10)) {
  console.log(`    row ${item.row.rowIndex} ("${item.row.date}") comes after row ${item.previous.rowIndex} ("${item.previous.date}")`);
}

const show = (label: string, list: typeof dated) => {
  console.log(`\n  ${label}`);
  for (const d of list) {
    console.log(`    row ${d.row.rowIndex}: "${d.row.date}" -> ${d.withHint.toDateString()}   ${d.row.groupName}`);
  }
};
show('First 10 dated rows:', dated.slice(0, 10));
show('Last 10 dated rows:', dated.slice(-10));

// --- Where a push would actually put things ---------------------------------
console.log(`\n--- Where a new event would be placed ---`);
const today = new Date();
for (const daysOut of [0, 14, 30, 60, 90, 180]) {
  const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysOut);

  const current = computeSheetPlacement(rows as never, target); // today's behavior, no year hint
  const hinted = computeSheetPlacement(rows as never, target, { fallbackYear: yearHint });

  const describe = (p: { insertBeforeRow: number | null }) =>
    p.insertBeforeRow === null ? 'appended to the bottom' : `row ${p.insertBeforeRow}`;

  const changed = current.insertBeforeRow !== hinted.insertBeforeRow;
  console.log(
    `  event on ${target.toDateString()}: ${describe(current)}${
      changed ? `   -> with the sheet-year fix: ${describe(hinted)}` : ''
    }`
  );
}

console.log('');
