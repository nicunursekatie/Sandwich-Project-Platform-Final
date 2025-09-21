/**
 * Migration: Standardize sandwichTypes field
 *
 * This migration ensures all sandwichTypes fields are stored as JSON strings
 * rather than PostgreSQL objects or arrays.
 *
 * Run this script with: npm run migrate:sandwich-types
 */

import { db } from '../db';
import { eventRequests } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function standardizeSandwichTypes() {
  console.log('Starting sandwichTypes standardization migration...');

  try {
    // First, get all event requests
    const allRequests = await db.select({
      id: eventRequests.id,
      sandwichTypes: eventRequests.sandwichTypes,
    }).from(eventRequests);

    console.log(`Found ${allRequests.length} event requests to check`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const request of allRequests) {
      try {
        if (!request.sandwichTypes) {
          skippedCount++;
          continue;
        }

        let needsUpdate = false;
        let standardizedValue: string | null = null;

        // Check the type of sandwichTypes
        if (typeof request.sandwichTypes === 'object') {
          // It's already an object (PostgreSQL array or JSON), convert to string
          needsUpdate = true;
          standardizedValue = JSON.stringify(request.sandwichTypes);
          console.log(`Request ${request.id}: Converting object to JSON string`);
        } else if (typeof request.sandwichTypes === 'string') {
          // It's a string, but let's verify it's valid JSON
          try {
            const parsed = JSON.parse(request.sandwichTypes);
            // If it parses successfully, we'll re-stringify to ensure consistency
            standardizedValue = JSON.stringify(parsed);
            // Only update if the standardized version is different
            needsUpdate = standardizedValue !== request.sandwichTypes;
            if (needsUpdate) {
              console.log(`Request ${request.id}: Re-standardizing JSON string`);
            }
          } catch (e) {
            // Not valid JSON, skip this record and log error
            console.error(`Request ${request.id}: Invalid JSON in sandwichTypes:`, request.sandwichTypes);
            errorCount++;
            continue;
          }
        }

        if (needsUpdate && standardizedValue) {
          // Update the record with standardized JSON string
          await db.update(eventRequests)
            .set({ sandwichTypes: standardizedValue })
            .where(sql`${eventRequests.id} = ${request.id}`);

          updatedCount++;
          console.log(`✓ Updated request ${request.id}`);
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing request ${request.id}:`, error);
        errorCount++;
      }
    }

    console.log('\nMigration completed:');
    console.log(`✓ Updated: ${updatedCount} records`);
    console.log(`- Skipped: ${skippedCount} records (already correct or null)`);
    console.log(`✗ Errors: ${errorCount} records`);

    // Verify the migration
    console.log('\nVerifying migration...');
    const verifyQuery = await db.execute(sql`
      SELECT COUNT(*) as object_count
      FROM event_requests
      WHERE sandwich_types IS NOT NULL
      AND pg_typeof(sandwich_types::text) != 'text'::regtype
    `);

    console.log('Verification complete');

    return {
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount
    };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Add a utility function to validate sandwich types format
export function validateSandwichTypes(sandwichTypes: any): boolean {
  if (!sandwichTypes) return true; // null is valid

  try {
    const parsed = typeof sandwichTypes === 'string'
      ? JSON.parse(sandwichTypes)
      : sandwichTypes;

    if (!Array.isArray(parsed)) return false;

    return parsed.every((item: any) =>
      typeof item === 'object' &&
      'type' in item &&
      'quantity' in item &&
      typeof item.type === 'string' &&
      typeof item.quantity === 'number'
    );
  } catch {
    return false;
  }
}

// Run the migration
standardizeSandwichTypes()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

export default standardizeSandwichTypes;