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
const outArgIndex = process.argv.indexOf('--out');
const reportPath = path.resolve(
  repoRoot,
  outArgIndex >= 0 ? process.argv[outArgIndex + 1] : 'docs/route-inventory.md'
);
const checkMode = args.has('--check');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SOURCE_ROOTS = ['client/src', 'server', 'tests'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.venv', 'coverage']);
const SERVER_ROUTE_METHODS = ['use', 'get', 'post', 'put', 'patch', 'delete'];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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

  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
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
  const routePattern = /<Route\s+path=["']([^"']+)["']/g;
  let match;
  while ((match = routePattern.exec(text))) {
    addOccurrence(routes, match[1], {
      file: rel(appPath),
      line: lineNumberAt(text, match.index),
    });
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
  return occurrences
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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, occurrences]) => [route, occurrences.length, occurrencesSummary(occurrences)]);

  const apiRefRows = [...apiRefs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, occurrences]) => [route, occurrences.length, occurrencesSummary(occurrences)]);

  const appRouteRows = [...appRoutes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, occurrences]) => [route, occurrences.length, occurrencesSummary(occurrences)]);

  const mismatchRows = apiRequestMismatches.map((item) => [item.url, `${item.file}:${item.line}`]);
  const unmatchedRows = unmatched.map((route) => [route, occurrencesSummary(apiRefs.get(route) || [])]);

  return `# Route Inventory\n\nGenerated by \`npm run inventory:routes\`.\n\n## Summary\n\n- Client API references: **${apiRefs.size}** unique paths\n- Server API route/mount references: **${serverRoutes.size}** unique paths\n- Client app routes in \`App.tsx\`: **${appRoutes.size}** unique paths\n- Likely URL-first \`apiRequest\` calls: **${apiRequestMismatches.length}**\n- API references without a specific server mount prefix: **${unmatched.length}**\n\n## Likely URL-first apiRequest calls\n\nThese call sites appear to pass \`apiRequest(url, options)\`, but the current helper signature is \`apiRequest(method, url, body?, timeoutMs?)\`. Review these first because they can masquerade as routing bugs.\n\n${mismatchRows.length ? markdownTable(['API path', 'Location'], mismatchRows) : '_None found._'}\n\n## API references without a specific server mount prefix\n\nThis is heuristic. It intentionally ignores the broad \`/api\` catch-all because that would hide drift. Dynamic template strings may need manual review.\n\n${unmatchedRows.length ? markdownTable(['API path', 'First locations'], unmatchedRows) : '_None found._'}\n\n## Server API route and mount references\n\n${markdownTable(['Route or mount', 'Occurrences', 'Locations'], serverRouteRows)}\n\n## Client API references\n\n${markdownTable(['API path', 'Occurrences', 'First locations'], apiRefRows)}\n\n## Client app routes\n\n${markdownTable(['Route', 'Occurrences', 'Locations'], appRouteRows)}\n`;
}

const allFiles = readSourceFiles(SOURCE_ROOTS);
const clientFiles = allFiles.filter((file) => rel(file).startsWith('client/src/'));
const serverFiles = allFiles.filter((file) => rel(file).startsWith('server/'));

const apiRefs = extractClientApiReferences(clientFiles);
const apiRequestMismatches = extractApiRequestMismatches(clientFiles);
const serverRoutes = extractServerApiRoutes(serverFiles);
const appRoutes = extractClientAppRoutes();
const unmatched = likelyUnmatchedApiRefs(apiRefs, serverRoutes);
const report = buildReport({ apiRefs, apiRequestMismatches, serverRoutes, appRoutes, unmatched });

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const existing = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : null;

if (!checkMode) {
  fs.writeFileSync(reportPath, report);
  console.log(`Route inventory written to ${rel(reportPath)}`);
} else if (existing !== report) {
  console.error(`Route inventory is out of date. Run: npm run inventory:routes`);
  process.exit(1);
}

console.log(`Client API references: ${apiRefs.size}`);
console.log(`Server API routes/mounts: ${serverRoutes.size}`);
console.log(`Client app routes: ${appRoutes.size}`);
console.log(`Likely URL-first apiRequest calls: ${apiRequestMismatches.length}`);
console.log(`API references without specific server mount prefix: ${unmatched.length}`);
