#!/usr/bin/env tsx

/**
 * Combined script to:
 * 1. Initialize the "submit_collection_log" challenge in the database
 * 2. Mark it as completed for users who have already been submitting collection logs
 */

import { db } from '../db';
import { users, onboardingChallenges, onboardingProgress } from '@shared/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { onboardingService } from '../services/onboarding-service';

const TARGET_USERS = [
  { name: 'jen cohen', email: 'jenmcohen@gmail.com' },
  { name: 'kristina mccarthney', email: 'kristinamday@yahoo.com' },
  { name: 'laura baldwin', email: 'lzauderer@yahoo.com' },
  { name: 'marcy louza', email: 'mdlouza@gmail.com' },
  { name: 'nancy miller', email: 'atlantamillers@comcast.net' },
  { name: 'veronica pennington', email: null },
  { name: 'vicki tropauer', email: 'vickib@aol.com' },
];

async function main() {
  try {
    logger.log('=================================');
    logger.log('Step 1: Initializing default challenges...');
    logger.log('=================================\n');

    // Initialize all default challenges (including the new one)
    await onboardingService.initializeDefaultChallenges();

    logger.log('✅ Default challenges initialized\n');

    // Small delay to ensure database writes are complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.log('=================================');
    logger.log('Step 2: Finding the collection log challenge...');
    logger.log('=================================\n');

    // Find the submit_collection_log challenge
    const challenge = await db
      .select()
      .from(onboardingChallenges)
      .where(eq(onboardingChallenges.actionKey, 'submit_collection_log'))
      .limit(1);

    if (challenge.length === 0) {
      logger.error('❌ Challenge "submit_collection_log" not found after initialization!');
      process.exit(1);
    }

    const challengeId = challenge[0].id;
    logger.log(`✅ Found challenge: ${challenge[0].title} (ID: ${challengeId})\n`);

    logger.log('=================================');
    logger.log('Step 3: Marking challenge complete for existing users...');
    logger.log('=================================\n');

    let completedCount = 0;
    let alreadyCompletedCount = 0;
    let notFoundCount = 0;

    // Find and update each user
    for (const targetUser of TARGET_USERS) {
      logger.log(`Processing: ${targetUser.name}...`);

      // Build search conditions - search by name parts and email
      const nameParts = targetUser.name.toLowerCase().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      let userRecords;
      if (targetUser.email) {
        // Search by email first, then by name
        userRecords = await db
          .select()
          .from(users)
          .where(
            or(
              eq(sql`LOWER(${users.email})`, targetUser.email.toLowerCase()),
              and(
                like(sql`LOWER(${users.firstName})`, `%${firstName}%`),
                like(sql`LOWER(${users.lastName})`, `%${lastName}%`)
              )
            )
          )
          .limit(1);
      } else {
        // Search by name only
        userRecords = await db
          .select()
          .from(users)
          .where(
            and(
              like(sql`LOWER(${users.firstName})`, `%${firstName}%`),
              like(sql`LOWER(${users.lastName})`, `%${lastName}%`)
            )
          )
          .limit(1);
      }

      if (userRecords.length === 0) {
        logger.warn(`  ⚠️  User not found: ${targetUser.name} (${targetUser.email || 'no email'})`);
        notFoundCount++;
        continue;
      }

      const user = userRecords[0];
      logger.log(`  Found user: ${user.firstName} ${user.lastName} (${user.email}) - ID: ${user.id}`);

      // Check if already completed
      const existing = await db
        .select()
        .from(onboardingProgress)
        .where(
          and(
            eq(onboardingProgress.userId, user.id),
            eq(onboardingProgress.challengeId, challengeId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        logger.log(`  ℹ️  Already completed this challenge`);
        alreadyCompletedCount++;
        continue;
      }

      // Mark as completed
      await db.insert(onboardingProgress).values({
        userId: user.id,
        challengeId: challengeId,
        metadata: {
          source: 'manual_migration',
          reason: 'User already submitted collection logs before challenge was added',
          markedAt: new Date().toISOString(),
        },
      });

      logger.log(`  ✅ Marked as completed (+${challenge[0].points} points)`);
      completedCount++;
    }

    logger.log('\n=================================');
    logger.log('SUMMARY');
    logger.log('=================================');
    logger.log(`Total users processed: ${TARGET_USERS.length}`);
    logger.log(`✅ Newly completed: ${completedCount}`);
    logger.log(`ℹ️  Already completed: ${alreadyCompletedCount}`);
    logger.log(`⚠️  Not found: ${notFoundCount}`);
    logger.log('=================================\n');

    logger.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

main();
