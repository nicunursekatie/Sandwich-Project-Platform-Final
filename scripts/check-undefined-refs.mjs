#!/usr/bin/env node
/**
 * Undefined-reference gate.
 *
 * Catches the bug class that took down event-requests in production: an
 * identifier used but never imported/defined. The Vite build does NOT typecheck,
 * so these ship silently and throw `ReferenceError` at runtime (often tripping an
 * ErrorBoundary). `tsc` *does* flag them, but its output is buried under ~1500
 * pre-existing, non-fatal type errors.
 *
 * This gate runs `tsc --noEmit`, keeps only the runtime-fatal "name doesn't
 * exist" diagnostics in shipped client code, and fails when a NEW one appears
 * (anything not already recorded in the committed baseline). It deliberately
 * does NOT try to fix the pre-existing type-error noise.
 *
 * Usage:
 *   node scripts/check-undefined-refs.mjs            # check (CI)
 *   node scripts/check-undefined-refs.mjs --update    # rewrite the baseline
 *
 * Drive the baseline toward empty by fixing the listed offenders, then
 * re-running with --update.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(__dirname, 'undefined-refs-baseline.json');

// Runtime-fatal "this name/binding doesn't exist" diagnostics:
//   TS2304 Cannot find name 'X'
//   TS2552 Cannot find name 'X'. Did you mean 'Y'?
//   TS2305 Module has no exported member 'X'
//   TS2724 has no exported member named 'X'
const FATAL_CODES = new Set(['TS2304', 'TS2552', 'TS2305', 'TS2724']);

// Only shipped client code crashes users; skip tests.
const isShippedClient = (p) =>
  p.startsWith('client/src/') && !/\.(test|spec)\.|\/__tests__\/|\/test\//.test(p);

function collect() {
  let out = '';
  try {
    out = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // tsc exits non-zero whenever there are any errors (expected); diagnostics
    // are on stdout.
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  const re = /^(.+?\.tsx?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;
  const found = new Map(); // key -> {file, code, message}
  for (const line of out.split('\n')) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const [, file, , , code, message] = m;
    const rel = file.replaceAll(path.sep, '/');
    if (!FATAL_CODES.has(code) || !isShippedClient(rel)) continue;
    // Key without line/column so the baseline survives unrelated edits.
    found.set(`${rel} :: ${code} :: ${message}`, { file: rel, code, message });
  }
  return [...found.keys()].sort();
}

const current = collect();

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`✅ Wrote baseline with ${current.length} known offender(s) → ${path.relative(process.cwd(), BASELINE)}`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : [];
const baselineSet = new Set(baseline);
const introduced = current.filter((k) => !baselineSet.has(k));

if (introduced.length > 0) {
  console.error('\n❌ New undefined-reference error(s) — these throw at runtime (the Vite build does not catch them):\n');
  for (const k of introduced) console.error(`   ${k}`);
  console.error(
    '\nFix the missing import / undefined identifier. If this is intentional and ' +
      'truly safe, run `npm run check:undefined-refs -- --update` to re-baseline.\n'
  );
  process.exit(1);
}

const fixed = baseline.filter((k) => !current.includes(k));
console.log(`✅ No new undefined-reference errors (${current.length} known, baseline ${baseline.length}).`);
if (fixed.length > 0) {
  console.log(`👍 ${fixed.length} baseline offender(s) now fixed — run with --update to shrink the baseline.`);
}
process.exit(0);
