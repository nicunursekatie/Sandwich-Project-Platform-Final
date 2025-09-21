/**
 * Migration to add scheduledEventDate field to event_requests table
 * This allows us to track the actual scheduled date separately from the requested date
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

async function addScheduledEventDateField() {
  console.log('Starting migration to add scheduledEventDate field...');

  const client = neon(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Add the new column
    console.log('Adding scheduledEventDate column...');
    await db.execute(sql`
      ALTER TABLE event_requests
      ADD COLUMN IF NOT EXISTS scheduled_event_date TIMESTAMP
    `);

    // For events with status 'scheduled' or 'completed', copy desiredEventDate to scheduledEventDate
    // This preserves existing data while allowing future events to have different scheduled dates
    console.log('Copying existing dates for scheduled/completed events...');
    const result = await db.execute(sql`
      UPDATE event_requests
      SET scheduled_event_date = desired_event_date
      WHERE status IN ('scheduled', 'completed')
        AND scheduled_event_date IS NULL
        AND desired_event_date IS NOT NULL
    `);

    console.log(`Updated ${result.rowCount} events with scheduled dates`);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration
addScheduledEventDateField()
  .then(() => {
    console.log('✅ Scheduled event date field added successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to add scheduled event date field:', error);
    process.exit(1);
  });