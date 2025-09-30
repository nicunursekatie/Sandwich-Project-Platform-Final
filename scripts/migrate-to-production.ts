import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema';

const BATCH_SIZE = 1000;

async function migrateData() {
  console.log('🚀 Starting data migration from development to production...\n');

  // Safety checks
  if (!process.env.PRODUCTION_DATABASE_URL || !process.env.DATABASE_URL) {
    throw new Error('Both PRODUCTION_DATABASE_URL and DATABASE_URL must be set');
  }

  if (process.env.PRODUCTION_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error('⚠️  PRODUCTION_DATABASE_URL and DATABASE_URL are the same! Migration aborted for safety.');
  }

  const devSql = neon(process.env.DATABASE_URL);
  const prodSql = neon(process.env.PRODUCTION_DATABASE_URL);

  const devDb = drizzle(devSql, { schema });
  const prodDb = drizzle(prodSql, { schema });

  console.log('✅ Safety check passed: Databases are different\n');
  console.log('⚠️  NOTE: Disable external notifications during migration to prevent duplicate SMS/emails\n');

  try {
    // Parent tables (no FK dependencies)
    await migrateTable(devDb, prodDb, schema.sessions, 'sessions');
    await migrateTable(devDb, prodDb, schema.users, 'users');
    await migrateTable(devDb, prodDb, schema.organizations, 'organizations');
    await migrateTable(devDb, prodDb, schema.committees, 'committees');
    await migrateTable(devDb, prodDb, schema.driveLinks, 'drive_links');

    // First-level children (depend on users/organizations)
    await migrateTable(devDb, prodDb, schema.auditLogs, 'audit_logs');
    await migrateTable(devDb, prodDb, schema.userActivityLogs, 'user_activity_logs');
    await migrateTable(devDb, prodDb, schema.chatMessages, 'chat_messages');
    await migrateTable(devDb, prodDb, schema.volunteers, 'volunteers');
    await migrateTable(devDb, prodDb, schema.drivers, 'drivers');
    await migrateTable(devDb, prodDb, schema.hosts, 'hosts');
    await migrateTable(devDb, prodDb, schema.recipients, 'recipients');
    await migrateTable(devDb, prodDb, schema.projects, 'projects');
    await migrateTable(devDb, prodDb, schema.conversations, 'conversations');
    await migrateTable(devDb, prodDb, schema.announcements, 'announcements');
    await migrateTable(devDb, prodDb, schema.weeklyReports, 'weekly_reports');
    await migrateTable(devDb, prodDb, schema.sandwichCollections, 'sandwich_collections');
    await migrateTable(devDb, prodDb, schema.sandwichDistributions, 'sandwich_distributions');
    await migrateTable(devDb, prodDb, schema.meetings, 'meetings');
    await migrateTable(devDb, prodDb, schema.eventRequests, 'event_requests');
    await migrateTable(devDb, prodDb, schema.importedExternalIds, 'imported_external_ids');
    await migrateTable(devDb, prodDb, schema.notifications, 'notifications');
    await migrateTable(devDb, prodDb, schema.wishlistSuggestions, 'wishlist_suggestions');
    await migrateTable(devDb, prodDb, schema.workLogs, 'work_logs');
    await migrateTable(devDb, prodDb, schema.suggestions, 'suggestions');
    await migrateTable(devDb, prodDb, schema.documents, 'documents');
    await migrateTable(devDb, prodDb, schema.confidentialDocuments, 'confidential_documents');
    await migrateTable(devDb, prodDb, schema.hostedFiles, 'hosted_files');
    await migrateTable(devDb, prodDb, schema.contacts, 'contacts');
    await migrateTable(devDb, prodDb, schema.googleSheets, 'google_sheets');
    await migrateTable(devDb, prodDb, schema.streamUsers, 'stream_users');
    await migrateTable(devDb, prodDb, schema.streamChannels, 'stream_channels');
    await migrateTable(devDb, prodDb, schema.notificationPreferences, 'notification_preferences');
    await migrateTable(devDb, prodDb, schema.notificationRules, 'notification_rules');
    await migrateTable(devDb, prodDb, schema.committeeMemberships, 'committee_memberships');

    // Second-level children (depend on first-level)
    await migrateTable(devDb, prodDb, schema.chatMessageLikes, 'chat_message_likes');
    await migrateTable(devDb, prodDb, schema.chatMessageReads, 'chat_message_reads');
    await migrateTable(devDb, prodDb, schema.hostContacts, 'host_contacts');
    await migrateTable(devDb, prodDb, schema.recipientTspContacts, 'recipient_tsp_contacts');
    await migrateTable(devDb, prodDb, schema.driverAgreements, 'driver_agreements');
    await migrateTable(devDb, prodDb, schema.projectTasks, 'project_tasks');
    await migrateTable(devDb, prodDb, schema.archivedProjects, 'archived_projects');
    await migrateTable(devDb, prodDb, schema.projectComments, 'project_comments');
    await migrateTable(devDb, prodDb, schema.taskCompletions, 'task_completions');
    await migrateTable(devDb, prodDb, schema.projectAssignments, 'project_assignments');
    await migrateTable(devDb, prodDb, schema.projectDocuments, 'project_documents');
    await migrateTable(devDb, prodDb, schema.conversationParticipants, 'conversation_participants');
    await migrateTable(devDb, prodDb, schema.messages, 'messages');
    await migrateTable(devDb, prodDb, schema.emailMessages, 'email_messages');
    await migrateTable(devDb, prodDb, schema.emailDrafts, 'email_drafts');
    await migrateTable(devDb, prodDb, schema.kudosTracking, 'kudos_tracking');
    await migrateTable(devDb, prodDb, schema.meetingMinutes, 'meeting_minutes');
    await migrateTable(devDb, prodDb, schema.agendaItems, 'agenda_items');
    await migrateTable(devDb, prodDb, schema.compiledAgendas, 'compiled_agendas');
    await migrateTable(devDb, prodDb, schema.agendaSections, 'agenda_sections');
    await migrateTable(devDb, prodDb, schema.meetingNotes, 'meeting_notes');
    await migrateTable(devDb, prodDb, schema.eventVolunteers, 'event_volunteers');
    await migrateTable(devDb, prodDb, schema.eventReminders, 'event_reminders');
    await migrateTable(devDb, prodDb, schema.documentPermissions, 'document_permissions');
    await migrateTable(devDb, prodDb, schema.documentAccessLogs, 'document_access_logs');
    await migrateTable(devDb, prodDb, schema.streamMessages, 'stream_messages');
    await migrateTable(devDb, prodDb, schema.streamThreads, 'stream_threads');
    await migrateTable(devDb, prodDb, schema.suggestionResponses, 'suggestion_responses');
    await migrateTable(devDb, prodDb, schema.notificationHistory, 'notification_history');
    await migrateTable(devDb, prodDb, schema.userNotificationPatterns, 'user_notification_patterns');
    await migrateTable(devDb, prodDb, schema.notificationAnalytics, 'notification_analytics');
    await migrateTable(devDb, prodDb, schema.notificationABTests, 'notification_ab_tests');

    // Third-level children
    await migrateTable(devDb, prodDb, schema.messageRecipients, 'message_recipients');
    await migrateTable(devDb, prodDb, schema.messageLikes, 'message_likes');

    // Reset sequences for serial columns
    console.log('\n🔄 Resetting sequences...');
    await resetSequences(prodDb);

    console.log('\n✨ Migration completed successfully!');
    console.log('🎉 Production database now has all data from development\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function migrateTable(devDb: any, prodDb: any, table: any, tableName: string) {
  console.log(`📦 Migrating ${tableName}...`);
  
  try {
    const data = await devDb.select().from(table);
    
    if (data.length === 0) {
      console.log(`   ⏭️  Skipped ${tableName} (no data)`);
      return;
    }

    // Insert in batches
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      await prodDb.insert(table).values(batch).onConflictDoNothing();
    }

    // Verify count
    const prodData = await prodDb.select().from(table);
    const devCount = data.length;
    const prodCount = prodData.length;

    if (devCount === prodCount) {
      console.log(`   ✅ Migrated ${prodCount} rows`);
    } else {
      console.log(`   ⚠️  Warning: Dev has ${devCount} rows, prod has ${prodCount} rows`);
    }
  } catch (error) {
    console.error(`   ❌ Failed to migrate ${tableName}:`, error);
    throw error;
  }
}

async function resetSequences(db: any) {
  // Reset all sequences for serial columns
  const sequences = [
    { table: 'audit_logs', column: 'id' },
    { table: 'user_activity_logs', column: 'id' },
    { table: 'chat_messages', column: 'id' },
    { table: 'chat_message_likes', column: 'id' },
    { table: 'chat_message_reads', column: 'id' },
    { table: 'projects', column: 'id' },
    { table: 'archived_projects', column: 'id' },
    { table: 'project_tasks', column: 'id' },
    { table: 'project_comments', column: 'id' },
    { table: 'task_completions', column: 'id' },
    { table: 'project_assignments', column: 'id' },
    { table: 'committees', column: 'id' },
    { table: 'committee_memberships', column: 'id' },
    { table: 'announcements', column: 'id' },
    { table: 'conversations', column: 'id' },
    { table: 'conversation_participants', column: 'id' },
    { table: 'messages', column: 'id' },
    { table: 'message_recipients', column: 'id' },
    { table: 'kudos_tracking', column: 'id' },
    { table: 'message_likes', column: 'id' },
    { table: 'email_messages', column: 'id' },
    { table: 'email_drafts', column: 'id' },
    { table: 'weekly_reports', column: 'id' },
    { table: 'sandwich_distributions', column: 'id' },
    { table: 'sandwich_collections', column: 'id' },
    { table: 'meeting_minutes', column: 'id' },
    { table: 'drive_links', column: 'id' },
    { table: 'agenda_items', column: 'id' },
    { table: 'meetings', column: 'id' },
    { table: 'compiled_agendas', column: 'id' },
    { table: 'agenda_sections', column: 'id' },
    { table: 'drivers', column: 'id' },
    { table: 'volunteers', column: 'id' },
    { table: 'driver_agreements', column: 'id' },
    { table: 'hosts', column: 'id' },
    { table: 'host_contacts', column: 'id' },
    { table: 'recipients', column: 'id' },
    { table: 'recipient_tsp_contacts', column: 'id' },
    { table: 'project_documents', column: 'id' },
    { table: 'documents', column: 'id' },
    { table: 'document_permissions', column: 'id' },
    { table: 'document_access_logs', column: 'id' },
    { table: 'confidential_documents', column: 'id' },
    { table: 'hosted_files', column: 'id' },
    { table: 'contacts', column: 'id' },
    { table: 'notifications', column: 'id' },
    { table: 'wishlist_suggestions', column: 'id' },
    { table: 'event_requests', column: 'id' },
    { table: 'organizations', column: 'id' },
    { table: 'imported_external_ids', column: 'id' },
    { table: 'event_volunteers', column: 'id' },
    { table: 'event_reminders', column: 'id' },
    { table: 'google_sheets', column: 'id' },
    { table: 'stream_users', column: 'id' },
    { table: 'stream_channels', column: 'id' },
    { table: 'stream_messages', column: 'id' },
    { table: 'stream_threads', column: 'id' },
    { table: 'work_logs', column: 'id' },
    { table: 'suggestions', column: 'id' },
    { table: 'suggestion_responses', column: 'id' },
    { table: 'meeting_notes', column: 'id' },
    { table: 'notification_preferences', column: 'id' },
    { table: 'notification_history', column: 'id' },
    { table: 'notification_rules', column: 'id' },
    { table: 'user_notification_patterns', column: 'id' },
    { table: 'notification_analytics', column: 'id' },
    { table: 'notification_ab_tests', column: 'id' },
  ];

  for (const { table, column } of sequences) {
    try {
      await db.execute(
        sql.raw(`SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE((SELECT MAX(${column}) FROM ${table}), 1), true)`)
      );
      console.log(`   ✅ Reset sequence for ${table}.${column}`);
    } catch (error) {
      console.log(`   ⏭️  Skipped ${table}.${column} (table might be empty or not exist)`);
    }
  }
}

migrateData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
