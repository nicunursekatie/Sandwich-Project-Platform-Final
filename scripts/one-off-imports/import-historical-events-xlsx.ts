/**
 * One-off historical events import from the master TSP tracking spreadsheet.
 *
 * Re-imports completed historical events from the user's xlsx file with
 * per-sheet column mappings (2022 groups, 2023 groups, Jan. 2023, 2024 Groups).
 *
 * Runs against the production Neon branch when NODE_ENV=production.
 * Dedupes against existing event_requests by (normalized org_name + event_date).
 *
 * Run: NODE_ENV=production tsx scripts/one-off-imports/import-historical-events-xlsx.ts
 */

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { neon } from '@neondatabase/serverless';

const XLSX_PATH = path.resolve(
  'attached_assets/NEW_VERSION_-_TSP_GROUP_TRACKING_SPREADSHEET_(2)_1779067312998.xlsx'
);

const url = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(url);

function toDate(v: any): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function cleanStr(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || /^-+$/.test(s) ? null : s;
}
function isSeparator(row: any[]): boolean {
  const joined = row.map((c) => String(c ?? '').trim()).join('');
  if (!joined) return true;
  if (/^-+$/.test(joined)) return true;
  const low = joined.toLowerCase();
  return low.includes('week of') || low.includes('total for week');
}
function normOrg(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface Candidate {
  year: number;
  rowIdx: number;
  sourceSheet: string;
  organizationName: string;
  eventDate: Date | null;
  email: string | null;
  contactName: string | null;
  phone: string | null;
  estimatedSandwiches: number | null;
  tspContact: string | null;
  eventAddress: string | null;
}

const parsers: Record<string, (rows: any[][]) => Candidate[]> = {
  '2022 groups': (rows) => {
    const out: Candidate[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (isSeparator(r)) continue;
      const group = cleanStr(r[1]);
      if (!group) continue;
      out.push({
        year: 2022, rowIdx: i, sourceSheet: '2022 groups',
        organizationName: group,
        eventDate: toDate(r[0]),
        email: cleanStr(r[5]),
        contactName: cleanStr(r[6]),
        phone: cleanStr(r[7]) || cleanStr(r[8]),
        estimatedSandwiches: null,
        tspContact: null,
        eventAddress: null,
      });
    }
    return out;
  },
  '2023 groups': (rows) => {
    const out: Candidate[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (isSeparator(r)) continue;
      const group = cleanStr(r[2]);
      if (!group) continue;
      const swNum = Number(r[3]);
      out.push({
        year: 2023, rowIdx: i, sourceSheet: '2023 groups',
        organizationName: group,
        eventDate: toDate(r[0]),
        email: cleanStr(r[8]),
        contactName: cleanStr(r[9]),
        phone: cleanStr(r[10]),
        estimatedSandwiches: Number.isFinite(swNum) && swNum > 0 ? Math.round(swNum) : null,
        tspContact: cleanStr(r[11]),
        eventAddress: null,
      });
    }
    return out;
  },
  'Jan. 2023': (rows) => {
    const out: Candidate[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (isSeparator(r)) continue;
      const group = cleanStr(r[1]);
      if (!group) continue;
      let date = toDate(r[0]);
      if (!date && typeof r[0] === 'string') {
        const m = (r[0] as string).match(/(\d{1,2})\/(\d{1,2})/);
        if (m) date = new Date(2023, +m[1] - 1, +m[2]);
      }
      let sw: number | null = null;
      const swRaw = r[5];
      if (typeof swRaw === 'number') sw = Math.round(swRaw);
      else if (typeof swRaw === 'string') {
        const m = swRaw.match(/\d+/);
        if (m) sw = +m[0];
      }
      const combo = cleanStr(r[2]) || '';
      const [contactName, tspContact] = combo.split('/').map((s) => s.trim());
      out.push({
        year: 2023, rowIdx: i, sourceSheet: 'Jan. 2023',
        organizationName: group,
        eventDate: date,
        email: cleanStr(r[3]),
        contactName: contactName || null,
        phone: cleanStr(r[4]),
        estimatedSandwiches: sw,
        tspContact: tspContact || null,
        eventAddress: cleanStr(r[6]),
      });
    }
    return out;
  },
  '2024 Groups': (rows) => {
    const out: Candidate[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (isSeparator(r)) continue;
      const group = cleanStr(r[3]);
      if (!group) continue;
      let sw: number | null = null;
      const swRaw = r[4];
      if (typeof swRaw === 'number') sw = Math.round(swRaw);
      else if (typeof swRaw === 'string') {
        const m = swRaw.match(/\d+/);
        if (m) sw = +m[0];
      }
      out.push({
        year: 2024, rowIdx: i, sourceSheet: '2024 Groups',
        organizationName: group,
        eventDate: toDate(r[0]),
        email: cleanStr(r[7]),
        contactName: cleanStr(r[8]),
        phone: cleanStr(r[9]),
        estimatedSandwiches: sw,
        tspContact: cleanStr(r[10]),
        eventAddress: cleanStr(r[11]),
      });
    }
    return out;
  },
};

async function main() {
  console.log('📖 Reading spreadsheet:', XLSX_PATH);
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: 'buffer' });

  const candidates: Candidate[] = [];
  for (const [sheetName, parser] of Object.entries(parsers)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) { console.warn('  ⚠️ Missing sheet:', sheetName); continue; }
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false, defval: '' });
    const items = parser(rows);
    const withDate = items.filter((i) => i.eventDate).length;
    console.log(`  ${sheetName}: ${items.length} candidates (${withDate} with date)`);
    candidates.push(...items);
  }

  // Fetch existing keys for 2022-2024
  console.log('\n🔍 Loading existing event_requests for 2022-2024...');
  const existingRows = (await sql`
    SELECT
      LOWER(REGEXP_REPLACE(COALESCE(organization_name,''), '[^a-z0-9]', '', 'gi')) AS org_key,
      TO_CHAR(COALESCE(scheduled_event_date::date, desired_event_date::date), 'YYYY-MM-DD') AS d
    FROM event_requests
    WHERE COALESCE(scheduled_event_date, desired_event_date) IS NOT NULL
      AND EXTRACT(YEAR FROM COALESCE(scheduled_event_date::date, desired_event_date::date)) BETWEEN 2022 AND 2024
  `) as Array<{ org_key: string; d: string }>;
  const existing = new Set(existingRows.map((r) => `${r.org_key}|${r.d}`));
  console.log(`  Loaded ${existing.size} existing keys`);

  // Filter
  const skipped = { noOrg: 0, badYear: 0, duplicate: 0, noDate: 0 };
  const toInsert: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const orgKey = normOrg(c.organizationName);
    if (!orgKey) { skipped.noOrg++; continue; }
    if (!c.eventDate) { skipped.noDate++; continue; }
    const y = c.eventDate.getUTCFullYear();
    if (y < 2022 || y > 2024) { skipped.badYear++; continue; }
    const dStr = c.eventDate.toISOString().slice(0, 10);
    const key = `${orgKey}|${dStr}`;
    if (existing.has(key) || seen.has(key)) { skipped.duplicate++; continue; }
    seen.add(key);
    toInsert.push(c);
  }

  console.log(`\n📋 Plan: insert ${toInsert.length} new rows`);
  console.log('  Skipped:', skipped);
  const byYear: Record<number, number> = {};
  for (const c of toInsert) {
    const y = c.eventDate!.getUTCFullYear();
    byYear[y] = (byYear[y] || 0) + 1;
  }
  console.log('  By year:', byYear);

  if (process.argv.includes('--dry-run')) {
    console.log('\n🟡 Dry run — not inserting.');
    return;
  }

  console.log('\n💾 Inserting...');
  let inserted = 0;
  for (let idx = 0; idx < toInsert.length; idx++) {
    const c = toInsert[idx];
    const dateStr = c.eventDate!.toISOString().slice(0, 10);
    const extId = `xlsx-historical-${c.year}-${c.sourceSheet.replace(/[^a-z0-9]/gi, '')}-r${c.rowIdx}-${dateStr}-${idx}`;
    const nameParts = (c.contactName || '').trim().split(/\s+/).filter(Boolean);
    const first = nameParts[0] || null;
    const last = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
    const notes: string[] = [];
    if (c.tspContact) notes.push(`TSP contact: ${c.tspContact}`);
    if (c.eventAddress) notes.push(`Address/details: ${c.eventAddress}`);
    notes.push(`Imported from spreadsheet sheet "${c.sourceSheet}" row ${c.rowIdx + 1}`);
    const planningNotes = notes.join('\n');

    try {
      await sql`
        INSERT INTO event_requests (
          organization_name, first_name, last_name, email, phone,
          desired_event_date, scheduled_event_date,
          estimated_sandwich_count, tsp_contact, event_address, planning_notes,
          status, external_id, previously_hosted,
          organization_exists, is_confirmed, added_to_official_sheet,
          is_dhl_van, version, show_on_volunteer_hub,
          manual_entry_source, created_at, updated_at
        ) VALUES (
          ${c.organizationName}, ${first}, ${last}, ${c.email}, ${c.phone},
          ${c.eventDate}, ${c.eventDate},
          ${c.estimatedSandwiches}, ${c.tspContact}, ${c.eventAddress}, ${planningNotes},
          'completed', ${extId}, 'no',
          FALSE, FALSE, FALSE,
          FALSE, 1, FALSE,
          'historical-xlsx-import', ${c.eventDate}, NOW()
        )
      `;
      inserted++;
      if (inserted % 50 === 0) console.log(`  ...${inserted}/${toInsert.length}`);
    } catch (e: any) {
      console.error(`  ❌ Row ${idx} (${c.organizationName} ${dateStr}):`, e?.message || e);
    }
  }
  console.log(`\n✅ Inserted ${inserted}/${toInsert.length} rows.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
