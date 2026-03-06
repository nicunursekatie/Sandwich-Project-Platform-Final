/**
 * One-time migration script: Move private school break items
 * from yearly_calendar_items to tracked_calendar_items.
 *
 * Run via: npx tsx server/scripts/migrate-school-breaks.ts
 */

import { db } from '../db';
import { eq, or, ilike } from 'drizzle-orm';
import { yearlyCalendarItems, trackedCalendarItems } from '@shared/schema';

async function migrate() {
  console.log('Searching for school break items in yearly_calendar_items...\n');

  // Find all yearly calendar items that look like school breaks
  const breakItems = await db
    .select()
    .from(yearlyCalendarItems)
    .where(
      or(
        ilike(yearlyCalendarItems.title, '%spring break%'),
        ilike(yearlyCalendarItems.title, '%winter break%'),
        ilike(yearlyCalendarItems.title, '%summer break%'),
        ilike(yearlyCalendarItems.title, '%february break%'),
        ilike(yearlyCalendarItems.title, '%christmas break%'),
        ilike(yearlyCalendarItems.title, '%holiday break%'),
        ilike(yearlyCalendarItems.title, '%school break%'),
        ilike(yearlyCalendarItems.title, '%school vacation%')
      )
    );

  if (breakItems.length === 0) {
    console.log('No school break items found in yearly_calendar_items.');
    return;
  }

  console.log(`Found ${breakItems.length} school break items:\n`);
  for (const item of breakItems) {
    console.log(`  [ID ${item.id}] "${item.title}" - month=${item.month}, year=${item.year}, startDate=${item.startDate}, endDate=${item.endDate}`);
  }

  console.log('\nMigrating to tracked_calendar_items...\n');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of breakItems) {
    try {
      // Derive dates if start_date/end_date are missing
      let startDate = item.startDate;
      let endDate = item.endDate;

      if (!startDate) {
        // Default to the 1st of the item's month
        startDate = `${item.year}-${String(item.month).padStart(2, '0')}-01`;
        console.log(`  NOTE: "${item.title}" has no start_date, using ${startDate}`);
      }
      if (!endDate) {
        // Default to same as startDate
        endDate = startDate;
        console.log(`  NOTE: "${item.title}" has no end_date, using ${endDate}`);
      }

      const externalId = `private_school_break_yc_${item.id}`;

      // Check if already migrated
      const existing = await db
        .select({ id: trackedCalendarItems.id })
        .from(trackedCalendarItems)
        .where(eq(trackedCalendarItems.externalId, externalId))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  SKIP: "${item.title}" already exists in tracked_calendar_items`);
        skipped++;
        continue;
      }

      // Extract school name from title (e.g. "Gann Academy Spring Break" -> "Gann Academy")
      const schoolName = item.title
        .replace(/\s*(spring|winter|summer|february|christmas|holiday|school)\s*(break|vacation)\s*/gi, '')
        .trim();

      // Insert into tracked_calendar_items
      await db.insert(trackedCalendarItems).values({
        externalId,
        category: 'school_breaks',
        title: item.title,
        startDate,
        endDate,
        notes: item.description || null,
        metadata: {
          type: 'school_break',
          districts: schoolName ? [schoolName] : [],
          source: 'migrated_from_yearly_calendar',
          originalYearlyCalendarId: item.id,
        },
        createdAt: item.createdAt || new Date(),
        updatedAt: new Date(),
      });

      // Delete from yearly_calendar_items
      await db
        .delete(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.id, item.id));

      console.log(`  OK: "${item.title}" (${startDate} to ${endDate}) -> tracked_calendar_items`);
      migrated++;
    } catch (err) {
      console.error(`  ERROR migrating "${item.title}" (ID ${item.id}):`, err);
      errors++;
    }
  }

  console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
