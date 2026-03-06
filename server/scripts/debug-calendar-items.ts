/**
 * Debug script: List all items in both calendar tables
 * using the SAME database connection the app uses.
 *
 * Run via: npx tsx server/scripts/debug-calendar-items.ts
 */

import { db } from '../db';
import { yearlyCalendarItems, trackedCalendarItems } from '@shared/schema';
import { desc, ilike, or } from 'drizzle-orm';
import { getDatabaseUrl, getDatabaseBranch, isProduction } from '../db-url';

async function debug() {
  console.log('=== DATABASE CONNECTION INFO ===');
  console.log(`  Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`  Branch: ${getDatabaseBranch()}`);
  const url = getDatabaseUrl();
  if (url) {
    // Show just the host portion, not credentials
    try {
      const parsed = new URL(url);
      console.log(`  Host: ${parsed.hostname}`);
      console.log(`  Database: ${parsed.pathname.slice(1)}`);
    } catch {
      console.log(`  URL prefix: ${url.substring(0, 30)}...`);
    }
  }
  console.log('');

  // Query yearly_calendar_items
  console.log('=== YEARLY_CALENDAR_ITEMS (all items) ===');
  const yearlyItems = await db
    .select({
      id: yearlyCalendarItems.id,
      title: yearlyCalendarItems.title,
      month: yearlyCalendarItems.month,
      year: yearlyCalendarItems.year,
      category: yearlyCalendarItems.category,
      startDate: yearlyCalendarItems.startDate,
      endDate: yearlyCalendarItems.endDate,
      createdBy: yearlyCalendarItems.createdByName,
      createdAt: yearlyCalendarItems.createdAt,
    })
    .from(yearlyCalendarItems)
    .orderBy(desc(yearlyCalendarItems.createdAt));

  if (yearlyItems.length === 0) {
    console.log('  (empty - no items found)');
  } else {
    console.log(`  Total: ${yearlyItems.length} items\n`);
    for (const item of yearlyItems) {
      console.log(`  [ID ${item.id}] "${item.title}" | month=${item.month} year=${item.year} | cat=${item.category} | dates=${item.startDate || 'null'} to ${item.endDate || 'null'} | by ${item.createdBy} | ${item.createdAt}`);
    }
  }

  console.log('');

  // Query tracked_calendar_items
  console.log('=== TRACKED_CALENDAR_ITEMS (all items) ===');
  const trackedItems = await db
    .select({
      id: trackedCalendarItems.id,
      externalId: trackedCalendarItems.externalId,
      category: trackedCalendarItems.category,
      title: trackedCalendarItems.title,
      startDate: trackedCalendarItems.startDate,
      endDate: trackedCalendarItems.endDate,
      notes: trackedCalendarItems.notes,
      createdAt: trackedCalendarItems.createdAt,
    })
    .from(trackedCalendarItems)
    .orderBy(desc(trackedCalendarItems.createdAt));

  if (trackedItems.length === 0) {
    console.log('  (empty - no items found)');
  } else {
    console.log(`  Total: ${trackedItems.length} items\n`);
    for (const item of trackedItems) {
      console.log(`  [ID ${item.id}] "${item.title}" | cat=${item.category} | dates=${item.startDate} to ${item.endDate} | ext=${item.externalId || 'null'} | ${item.createdAt}`);
    }
  }

  // Specifically look for break-related items in both tables
  console.log('\n=== BREAK-RELATED ITEMS (either table) ===');

  const yearlyBreaks = await db
    .select({
      id: yearlyCalendarItems.id,
      title: yearlyCalendarItems.title,
      month: yearlyCalendarItems.month,
      year: yearlyCalendarItems.year,
    })
    .from(yearlyCalendarItems)
    .where(
      or(
        ilike(yearlyCalendarItems.title, '%break%'),
        ilike(yearlyCalendarItems.title, '%vacation%'),
        ilike(yearlyCalendarItems.title, '%school%')
      )
    );

  const trackedBreaks = await db
    .select({
      id: trackedCalendarItems.id,
      title: trackedCalendarItems.title,
      category: trackedCalendarItems.category,
      startDate: trackedCalendarItems.startDate,
      endDate: trackedCalendarItems.endDate,
    })
    .from(trackedCalendarItems)
    .where(
      or(
        ilike(trackedCalendarItems.title, '%break%'),
        ilike(trackedCalendarItems.title, '%vacation%'),
        ilike(trackedCalendarItems.title, '%school%')
      )
    );

  console.log(`  yearly_calendar_items with break/vacation/school: ${yearlyBreaks.length}`);
  for (const item of yearlyBreaks) {
    console.log(`    [yearly ID ${item.id}] "${item.title}" month=${item.month} year=${item.year}`);
  }

  console.log(`  tracked_calendar_items with break/vacation/school: ${trackedBreaks.length}`);
  for (const item of trackedBreaks) {
    console.log(`    [tracked ID ${item.id}] "${item.title}" cat=${item.category} ${item.startDate} to ${item.endDate}`);
  }
}

debug().then(() => {
  console.log('\nDone.');
  process.exit(0);
}).catch((err) => {
  console.error('Debug script failed:', err);
  process.exit(1);
});
