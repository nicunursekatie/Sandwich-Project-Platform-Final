import { db } from './db';
import {
  hosts,
  sandwichCollections,
  projects,
  messages,
  weeklyReports,
  meetingMinutes,
  driveLinks,
  agendaItems,
  meetings,
  driverAgreements,
  recipients,
} from '@shared/schema';
import { eq, count, sql } from 'drizzle-orm';
import { ensureSessionsTable } from './session-migrate';
import { createServiceLogger } from './utils/logger.js';
import { logger } from './utils/production-safe-logger';

const dbLogger = createServiceLogger('database');

export async function initializeDatabase() {
  try {
    dbLogger.info('Checking database initialization...');
    dbLogger.debug('DATABASE_URL exists', {
      exists: !!process.env.DATABASE_URL,
    });
    dbLogger.debug('DATABASE_URL preview', {
      preview: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.substring(0, 20) + '...'
        : 'not set',
    });

    // Ensure sessions table exists for PostgreSQL session storage
    // This resolves the "MemoryStore is not designed for a production environment" warning
    // by using persistent PostgreSQL storage for sessions instead of memory
    await ensureSessionsTable();

    // Check each table independently and seed if empty
    const [hostsCount] = await db.select({ count: count() }).from(hosts);
    const [projectsCount] = await db.select({ count: count() }).from(projects);
    const [messagesCount] = await db.select({ count: count() }).from(messages);
    const [collectionsCount] = await db
      .select({ count: count() })
      .from(sandwichCollections);
    const [recipientsCount] = await db
      .select({ count: count() })
      .from(recipients);

    logger.log(
      'Table counts - Hosts:',
      hostsCount.count,
      'Projects:',
      projectsCount.count,
      'Messages:',
      messagesCount.count,
      'Collections:',
      collectionsCount.count,
      'Recipients:',
      recipientsCount.count
    );

    // No seeding - all data should be added manually or via import
    logger.log('Database ready - no sample data seeded');

    logger.log('Database initialization complete');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    // Don't throw - allow app to continue with fallback storage
  }
}
