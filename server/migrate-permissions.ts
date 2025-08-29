import { storage } from "./storage-wrapper";

// Permission mapping from old to new format
const PERMISSION_MAPPING: Record<string, string> = {
  // Host management
  "access_hosts": "HOSTS_VIEW",
  "manage_hosts": "HOSTS_EDIT", 
  "view_hosts": "HOSTS_VIEW",
  "add_hosts": "HOSTS_ADD",
  "edit_hosts": "HOSTS_EDIT",
  "delete_hosts": "HOSTS_DELETE",

  // Recipient management  
  "access_recipients": "RECIPIENTS_VIEW",
  "manage_recipients": "RECIPIENTS_EDIT",
  "view_recipients": "RECIPIENTS_VIEW", 
  "add_recipients": "RECIPIENTS_ADD",
  "edit_recipients": "RECIPIENTS_EDIT",
  "delete_recipients": "RECIPIENTS_DELETE",

  // Driver management
  "access_drivers": "DRIVERS_VIEW", 
  "manage_drivers": "DRIVERS_EDIT",
  "view_drivers": "DRIVERS_VIEW",
  "add_drivers": "DRIVERS_ADD",
  "edit_drivers": "DRIVERS_EDIT",
  "delete_drivers": "DRIVERS_DELETE",

  // User management
  "manage_users": "USERS_EDIT",
  "view_users": "USERS_VIEW",

  // Collections  
  "access_collections": "COLLECTIONS_VIEW",
  "manage_collections": "COLLECTIONS_EDIT",
  "create_collections": "COLLECTIONS_ADD",
  "edit_all_collections": "COLLECTIONS_EDIT", 
  "delete_all_collections": "COLLECTIONS_DELETE",
  "use_collection_walkthrough": "COLLECTIONS_WALKTHROUGH",

  // Projects
  "access_projects": "PROJECTS_VIEW",
  "manage_projects": "PROJECTS_EDIT",
  "create_projects": "PROJECTS_ADD",
  "edit_all_projects": "PROJECTS_EDIT",
  "delete_all_projects": "PROJECTS_DELETE",

  // Distributions (donation tracking)
  "access_donation_tracking": "DISTRIBUTIONS_VIEW",
  "manage_donation_tracking": "DISTRIBUTIONS_EDIT",
  "view_donation_tracking": "DISTRIBUTIONS_VIEW", 
  "add_donation_tracking": "DISTRIBUTIONS_ADD",
  "edit_donation_tracking": "DISTRIBUTIONS_EDIT",
  "delete_donation_tracking": "DISTRIBUTIONS_DELETE",

  // Event requests
  "access_event_requests": "EVENT_REQUESTS_VIEW",
  "manage_event_requests": "EVENT_REQUESTS_EDIT",
  "view_event_requests": "EVENT_REQUESTS_VIEW",
  "add_event_requests": "EVENT_REQUESTS_ADD", 
  "edit_event_requests": "EVENT_REQUESTS_EDIT",
  "delete_event_requests": "EVENT_REQUESTS_DELETE",
  "assign_event_requests": "EVENT_REQUESTS_EDIT",

  // Messages  
  "access_messages": "MESSAGES_VIEW",
  "send_messages": "MESSAGES_SEND",
  "moderate_messages": "MESSAGES_MODERATE",
  "direct_messages": "CHAT_DIRECT",
  "group_messages": "CHAT_GROUP",

  // Work logs
  "access_work_logs": "WORK_LOGS_VIEW",
  "create_work_logs": "WORK_LOGS_ADD",
  "view_all_work_logs": "WORK_LOGS_VIEW_ALL",
  "edit_all_work_logs": "WORK_LOGS_EDIT", 
  "delete_all_work_logs": "WORK_LOGS_DELETE",

  // Suggestions
  "access_suggestions": "SUGGESTIONS_VIEW",
  "manage_suggestions": "SUGGESTIONS_MANAGE",
  "create_suggestions": "SUGGESTIONS_ADD",
  "edit_all_suggestions": "SUGGESTIONS_EDIT",
  "delete_all_suggestions": "SUGGESTIONS_DELETE",

  // Chat permissions
  "access_chat": "CHAT_GENERAL",
  "general_chat": "CHAT_GENERAL",
  "committee_chat": "CHAT_COMMITTEE",
  "host_chat": "CHAT_HOST", 
  "driver_chat": "CHAT_DRIVER",
  "recipient_chat": "CHAT_RECIPIENT",
  "core_team_chat": "CHAT_CORE_TEAM",

  // Kudos
  "send_kudos": "KUDOS_SEND",
  "receive_kudos": "KUDOS_RECEIVE", 
  "view_kudos": "KUDOS_VIEW",
  "manage_all_kudos": "KUDOS_MANAGE",

  // Analytics and other features
  "access_analytics": "ANALYTICS_VIEW",
  "access_meetings": "MEETINGS_VIEW", 
  "manage_meetings": "MEETINGS_MANAGE",
  "access_toolkit": "TOOLKIT_ACCESS",
  "view_organizations_catalog": "ORGANIZATIONS_VIEW",
  "export_data": "DATA_EXPORT",
  "import_data": "DATA_IMPORT",
  "edit_data": "DATA_EXPORT",

  // Documents
  "view_documents": "DOCUMENTS_VIEW",
  "manage_documents": "DOCUMENTS_MANAGE",
  "access_documents": "DOCUMENTS_VIEW",

  // Admin
  "admin_access": "ADMIN_ACCESS",
  "manage_announcements": "MANAGE_ANNOUNCEMENTS"
};

export async function migrateUserPermissions() {
  console.log("🔄 Starting permission migration...");
  
  try {
    // Get all users
    const users = await storage.getAllUsers();
    console.log(`Found ${users.length} users to migrate`);

    let migratedCount = 0;
    let unchangedCount = 0;

    for (const user of users) {
      if (!user.permissions || user.permissions.length === 0) {
        console.log(`⏭️  Skipping ${user.email} - no permissions`);
        unchangedCount++;
        continue;
      }

      // Map old permissions to new ones
      const newPermissions = user.permissions
        .map((oldPerm: string) => {
          const newPerm = PERMISSION_MAPPING[oldPerm.toLowerCase()];
          if (newPerm) {
            console.log(`  📝 ${oldPerm} → ${newPerm}`);
            return newPerm;
          } else {
            // Keep permission as-is if already in new format or unrecognized
            console.log(`  ⚠️  Unknown permission: ${oldPerm} (keeping as-is)`);
            return oldPerm;
          }
        })
        // Remove duplicates
        .filter((perm: string, index: number, array: string[]) => array.indexOf(perm) === index);

      // Check if anything changed
      const hasChanges = JSON.stringify(user.permissions.sort()) !== JSON.stringify(newPermissions.sort());

      if (hasChanges) {
        console.log(`🔄 Migrating ${user.email}:`);
        console.log(`   Old: ${user.permissions.join(', ')}`);
        console.log(`   New: ${newPermissions.join(', ')}`);
        
        await storage.updateUser(user.id, { permissions: newPermissions });
        migratedCount++;
      } else {
        console.log(`✅ ${user.email} - no migration needed`);
        unchangedCount++;
      }
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`   ✅ ${migratedCount} users migrated`);
    console.log(`   ➡️  ${unchangedCount} users unchanged`);

    return { success: true, migrated: migratedCount, unchanged: unchangedCount };
  } catch (error) {
    console.error("❌ Permission migration failed:", error);
    throw error;
  }
}

// Export the migration function for use in routes