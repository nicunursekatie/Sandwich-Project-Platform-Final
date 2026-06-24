#!/usr/bin/env node

/**
 * Route Inventory
 *
 * Phase 1 architecture audit helper. It inventories client API references,
 * server API mount points, client application routes, and likely apiRequest
 * signature mismatches. It writes a Markdown report by default so route drift
 * can be reviewed before making behavioral changes.
 *
 * Usage:
 *   node scripts/route-inventory.js
 *   node scripts/route-inventory.js --check
 *   node scripts/route-inventory.js --out docs/route-inventory.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');

const outArgIndex = process.argv.indexOf('--out');
let outArg = 'docs/route-inventory.md';
if (outArgIndex >= 0) {
  const value = process.argv[outArgIndex + 1];
  if (!value || value.startsWith('--')) {
    console.error('Error: --out requires a file path, e.g. --out docs/route-inventory.md');
    process.exit(1);
  }
  outArg = value;
}
const reportPath = path.resolve(repoRoot, outArg);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SOURCE_ROOTS = ['client/src', 'server', 'tests'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.venv', 'coverage']);
const SERVER_ROUTE_METHODS = ['use', 'get', 'post', 'put', 'patch', 'delete'];

// Deterministic, locale-independent string ordering. localeCompare depends on
// the runtime's ICU/collation data, which differs across machines (e.g. a dev
// box vs. CI), so using it for sort order makes the generated report — and thus
// `--check` — flaky. Compare by UTF-16 code unit instead.
function byString(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  // Sort entries so traversal order is stable across OS/filesystems; otherwise
  // readdirSync ordering can make the generated report (and --check) flaky.
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => byString(a.name, b.name));
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function rel(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/');
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function normalizeDynamicPath(route) {
  return route
    .replace(/\/:[A-Za-z0-9_]+/g, '/:param')
    .replace(/\$\{[^}]+\}/g, ':dynamic')
    .replace(/\?.*$/, '')
    .replace(/\/$/, '') || '/';
}

function addOccurrence(map, key, occurrence) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(occurrence);
}

function readSourceFiles(rootNames) {
  return rootNames.flatMap((rootName) => walk(path.join(repoRoot, rootName)));
}

function extractClientApiReferences(files) {
  const references = new Map();
  const patterns = [
    /['"`]((?:\/api\/)[^'"`\s)]+)['"`]/g,
  ];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text))) {
        addOccurrence(references, match[1], {
          file: rel(file),
          line: lineNumberAt(text, match.index),
        });
      }
    }
  }
  return references;
}

function extractApiRequestMismatches(files) {
  const findings = [];
  const urlFirstPattern = /apiRequest\s*\(\s*([`'"]\/api\/[^`'"]+[`'"])\s*,/g;

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = urlFirstPattern.exec(text))) {
      findings.push({
        url: match[1].slice(1, -1),
        file: rel(file),
        line: lineNumberAt(text, match.index),
      });
    }
  }

  return findings.sort((a, b) => byString(a.file, b.file) || a.line - b.line);
}

function extractServerApiRoutes(files) {
  const routes = new Map();
  const methodPattern = new RegExp(
    `(?:app|router|[A-Za-z0-9_]+Router)\\.(${SERVER_ROUTE_METHODS.join('|')})\\s*\\(\\s*['\"](\\/api[^'\"]*)['\"]`,
    'g'
  );

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = methodPattern.exec(text))) {
      addOccurrence(routes, match[2], {
        method: match[1].toUpperCase(),
        file: rel(file),
        line: lineNumberAt(text, match.index),
      });
    }
  }
  return routes;
}

function extractClientAppRoutes() {
  const appPath = path.join(repoRoot, 'client/src/App.tsx');
  if (!fs.existsSync(appPath)) return new Map();
  const text = fs.readFileSync(appPath, 'utf8');
  const routes = new Map();

  // Tokenize <Route ...>, self-closing <Route .../>, and </Route> in document
  // order, tracking a stack of `nest` prefixes. wouter's `<Route path="/m" nest>`
  // wraps child routes, so nested paths must be recorded with their parent prefix
  // (e.g. /m/collections) rather than as bare top-level paths that collide with
  // the desktop routes of the same name.
  const tokenPattern = /<Route\b([^>]*?)(\/?)>|<\/Route>/g;
  const prefixStack = [];
  let match;
  while ((match = tokenPattern.exec(text))) {
    if (match[0] === '</Route>') {
      prefixStack.pop();
      continue;
    }
    const attrs = match[1] || '';
    const selfClosing = match[2] === '/';
    const pathMatch = attrs.match(/path=["']([^"']+)["']/);
    const prefix = prefixStack.join('');
    if (pathMatch) {
      let fullPath = `${prefix}${pathMatch[1]}`.replace(/\/{2,}/g, '/');
      if (fullPath.length > 1) fullPath = fullPath.replace(/\/+$/, '');
      addOccurrence(routes, fullPath, {
        file: rel(appPath),
        line: lineNumberAt(text, match.index),
      });
    }
    if (!selfClosing) {
      // Only `nest` routes contribute a URL prefix to their children; every other
      // open route pushes '' purely to stay balanced with its closing </Route>.
      const isNest = /\bnest\b/.test(attrs);
      prefixStack.push(isNest && pathMatch ? pathMatch[1].replace(/\/+$/, '') : '');
    }
  }
  return routes;
}

function mountedPrefixMatches(apiRef, serverRoutes) {
  const refBase = normalizeDynamicPath(apiRef);
  for (const serverRoute of serverRoutes.keys()) {
    const route = normalizeDynamicPath(serverRoute.replace(/\*$/, ''));
    if (route === '/api') continue; // too broad to prove a match
    if (refBase === route || refBase.startsWith(`${route}/`)) return true;
  }
  return false;
}

function likelyUnmatchedApiRefs(apiRefs, serverRoutes) {
  return [...apiRefs.keys()]
    .filter((apiRef) => !mountedPrefixMatches(apiRef, serverRoutes))
    .sort();
}

function occurrencesSummary(occurrences, limit = 4) {
  // Sort by file/line so the "first locations" shown are deterministic and don't
  // depend on filesystem walk order (keeps --check stable across machines).
  return [...occurrences]
    .sort((a, b) => byString(a.file, b.file) || a.line - b.line)
    .slice(0, limit)
    .map((occ) => `${occ.file}:${occ.line}`)
    .join('<br>');
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return [header, separator, body].filter(Boolean).join('\n');
}

function buildReport({ apiRefs, apiRequestMismatches, serverRoutes, appRoutes, unmatched }) {
  const serverRouteRows = [...serverRoutes.entries()]
    .sort(([a], [b]) => byString(a, b))
    .map(([route, occurrences]) => [route, occurrences.length, occurrencesSummary(occurrences)]);

  const apiRefRows = [...apiRefs.entries()]
    .sort(([a], [b]) => byString(a, b))
    .map(([route, occurrences]) => [route, occurrences.length, occurrencesSummary(occurrences)]);

  const appRouteRows = [...appRoutes.entries()]
    .sort(([a], [b]) => byString(a, b))
    .map(([route, occurrences]) => [route, occurrences.length, occurrencesSummary(occurrences)]);

  const mismatchRows = apiRequestMismatches.map((item) => [item.url, `${item.file}:${item.line}`]);
  const unmatchedRows = unmatched.map((route) => [route, occurrencesSummary(apiRefs.get(route) || [])]);

  return `# Route Inventory\n\nGenerated by \`npm run inventory:routes\`.\n\n## Summary\n\n- Client API references: **${apiRefs.size}** unique paths\n- Server API route/mount references: **${serverRoutes.size}** unique paths\n- Client app routes in \`App.tsx\`: **${appRoutes.size}** unique paths\n- Likely URL-first \`apiRequest\` calls: **${apiRequestMismatches.length}**\n- API references without a specific server mount prefix: **${unmatched.length}**\n\n## Likely URL-first apiRequest calls\n\nThese call sites appear to pass \`apiRequest(url, options)\`, but the current helper signature is \`apiRequest(method, url, body?, timeoutMs?)\`. Review these first because they can masquerade as routing bugs.\n\n${mismatchRows.length ? markdownTable(['API path', 'Location'], mismatchRows) : '_None found._'}\n\n## API references without a specific server mount prefix\n\nThis is heuristic. It intentionally ignores the broad \`/api\` catch-all because that would hide drift. Dynamic template strings may need manual review.\n\n${unmatchedRows.length ? markdownTable(['API path', 'First locations'], unmatchedRows) : '_None found._'}\n\n## Server API route and mount references\n\n${markdownTable(['Route or mount', 'Occurrences', 'Locations'], serverRouteRows)}\n\n## Client API references\n\n${markdownTable(['API path', 'Occurrences', 'First locations'], apiRefRows)}\n\n## Client app routes\n\n${markdownTable(['Route', 'Occurrences', 'Locations'], appRouteRows)}\n`;
}

const allFiles = readSourceFiles(SOURCE_ROOTS);
const serverFiles = allFiles.filter((file) => rel(file).startsWith('server/'));
// Client API references / apiRequest mismatches are collected from client code
// AND tests, so /api/... usages in integration tests are part of the inventory.
const clientApiScanFiles = allFiles.filter(
  (file) => rel(file).startsWith('client/src/') || rel(file).startsWith('tests/')
);

const apiRefs = extractClientApiReferences(clientApiScanFiles);
const apiRequestMismatches = extractApiRequestMismatches(clientApiScanFiles);
const serverRoutes = extractServerApiRoutes(serverFiles);
const appRoutes = extractClientAppRoutes();
const unmatched = likelyUnmatchedApiRefs(apiRefs, serverRoutes);
const report = buildReport({ apiRefs, apiRequestMismatches, serverRoutes, appRoutes, unmatched });

const existing = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : null;
// Normalize line endings before comparing so a CRLF checkout (Windows /
// core.autocrlf) doesn't fail --check when the route data is unchanged.
const existingNormalized = existing === null ? null : existing.replace(/\r\n/g, '\n');

// For --check, ignore the `:line` suffixes in location cells. Unrelated edits
// constantly shift line numbers (and the repo gets frequent auto-commits that
// don't regenerate this doc), so gating on exact line numbers makes CI red on
// cosmetic churn. Genuine route drift — a new/removed/renamed API path or mount —
// changes the route set itself and still fails the check.
function checkSignature(text) {
  return text === null ? null : text.replace(/:\d+/g, ':L');
}

if (!checkMode) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  console.log(`Route inventory written to ${rel(reportPath)}`);
} else if (checkSignature(existingNormalized) !== checkSignature(report)) {
  console.error(`Route inventory is out of date. Run: npm run inventory:routes`);
  process.exit(1);
}

console.log(`Client API references: ${apiRefs.size}`);
console.log(`Server API routes/mounts: ${serverRoutes.size}`);
console.log(`Client app routes: ${appRoutes.size}`);
console.log(`Likely URL-first apiRequest calls: ${apiRequestMismatches.length}`);
console.log(`API references without specific server mount prefix: ${unmatched.length}`);
