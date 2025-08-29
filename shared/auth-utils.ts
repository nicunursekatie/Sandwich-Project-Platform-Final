export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  COMMITTEE_MEMBER: "committee_member",
  CORE_TEAM: "core_team",
  HOST: "host",
  DRIVER: "driver",
  VOLUNTEER: "volunteer",
  RECIPIENT: "recipient",
  VIEWER: "viewer",
  WORK_LOGGER: "work_logger",
  DEMO_USER: "demo_user",
} as const;

// Clean Resource-Action Permission System
export const PERMISSIONS = {
  // ADMINISTRATIVE PERMISSIONS
  ADMIN_ACCESS: "ADMIN_ACCESS",
  MANAGE_ANNOUNCEMENTS: "MANAGE_ANNOUNCEMENTS",

  // HOSTS - Host location management  
  HOSTS_VIEW: "HOSTS_VIEW",
  HOSTS_ADD: "HOSTS_ADD", 
  HOSTS_EDIT: "HOSTS_EDIT",
  HOSTS_DELETE: "HOSTS_DELETE",

  // RECIPIENTS - Recipient organization management
  RECIPIENTS_VIEW: "RECIPIENTS_VIEW",
  RECIPIENTS_ADD: "RECIPIENTS_ADD",
  RECIPIENTS_EDIT: "RECIPIENTS_EDIT", 
  RECIPIENTS_DELETE: "RECIPIENTS_DELETE",

  // DRIVERS - Driver management
  DRIVERS_VIEW: "DRIVERS_VIEW",
  DRIVERS_ADD: "DRIVERS_ADD",
  DRIVERS_EDIT: "DRIVERS_EDIT",
  DRIVERS_DELETE: "DRIVERS_DELETE",

  // USERS - User account management
  USERS_VIEW: "USERS_VIEW",
  USERS_ADD: "USERS_ADD", 
  USERS_EDIT: "USERS_EDIT",
  USERS_DELETE: "USERS_DELETE",

  // COLLECTIONS - Sandwich collection data
  COLLECTIONS_VIEW: "COLLECTIONS_VIEW",
  COLLECTIONS_ADD: "COLLECTIONS_ADD",
  COLLECTIONS_EDIT: "COLLECTIONS_EDIT", 
  COLLECTIONS_DELETE: "COLLECTIONS_DELETE",
  COLLECTIONS_WALKTHROUGH: "COLLECTIONS_WALKTHROUGH", // Simplified entry form

  // PROJECTS - Project management
  PROJECTS_VIEW: "PROJECTS_VIEW",
  PROJECTS_ADD: "PROJECTS_ADD",
  PROJECTS_EDIT: "PROJECTS_EDIT",
  PROJECTS_DELETE: "PROJECTS_DELETE",

  // DISTRIBUTIONS - Sandwich distribution tracking 
  DISTRIBUTIONS_VIEW: "DISTRIBUTIONS_VIEW", 
  DISTRIBUTIONS_ADD: "DISTRIBUTIONS_ADD",
  DISTRIBUTIONS_EDIT: "DISTRIBUTIONS_EDIT",
  DISTRIBUTIONS_DELETE: "DISTRIBUTIONS_DELETE",

  // EVENT_REQUESTS - Event planning and requests
  EVENT_REQUESTS_VIEW: "EVENT_REQUESTS_VIEW",
  EVENT_REQUESTS_ADD: "EVENT_REQUESTS_ADD", 
  EVENT_REQUESTS_EDIT: "EVENT_REQUESTS_EDIT",
  EVENT_REQUESTS_DELETE: "EVENT_REQUESTS_DELETE",
  EVENT_REQUESTS_SYNC: "EVENT_REQUESTS_SYNC", // Google Sheets sync

  // MESSAGES - Messaging system
  MESSAGES_VIEW: "MESSAGES_VIEW",
  MESSAGES_SEND: "MESSAGES_SEND",
  MESSAGES_EDIT: "MESSAGES_EDIT",
  MESSAGES_DELETE: "MESSAGES_DELETE",
  MESSAGES_MODERATE: "MESSAGES_MODERATE",

  // WORK_LOGS - Work time logging
  WORK_LOGS_VIEW: "WORK_LOGS_VIEW",
  WORK_LOGS_ADD: "WORK_LOGS_ADD", 
  WORK_LOGS_EDIT: "WORK_LOGS_EDIT",
  WORK_LOGS_DELETE: "WORK_LOGS_DELETE",
  WORK_LOGS_VIEW_ALL: "WORK_LOGS_VIEW_ALL", // See all users' logs

  // SUGGESTIONS - Suggestion system  
  SUGGESTIONS_VIEW: "SUGGESTIONS_VIEW",
  SUGGESTIONS_ADD: "SUGGESTIONS_ADD",
  SUGGESTIONS_EDIT: "SUGGESTIONS_EDIT", 
  SUGGESTIONS_DELETE: "SUGGESTIONS_DELETE",
  SUGGESTIONS_MANAGE: "SUGGESTIONS_MANAGE", // Respond to suggestions

  // CHAT - Chat room access
  CHAT_GENERAL: "CHAT_GENERAL",
  CHAT_COMMITTEE: "CHAT_COMMITTEE", 
  CHAT_HOST: "CHAT_HOST",
  CHAT_DRIVER: "CHAT_DRIVER",
  CHAT_RECIPIENT: "CHAT_RECIPIENT",
  CHAT_CORE_TEAM: "CHAT_CORE_TEAM",
  CHAT_DIRECT: "CHAT_DIRECT",
  CHAT_GROUP: "CHAT_GROUP",

  // KUDOS - Kudos system
  KUDOS_SEND: "KUDOS_SEND",
  KUDOS_RECEIVE: "KUDOS_RECEIVE",
  KUDOS_VIEW: "KUDOS_VIEW",
  KUDOS_MANAGE: "KUDOS_MANAGE", // Admin management

  // ANALYTICS - Dashboard analytics
  ANALYTICS_VIEW: "ANALYTICS_VIEW",

  // MEETINGS - Meeting management
  MEETINGS_VIEW: "MEETINGS_VIEW",
  MEETINGS_MANAGE: "MEETINGS_MANAGE",

  // DOCUMENTS - Document management
  DOCUMENTS_VIEW: "DOCUMENTS_VIEW", 
  DOCUMENTS_MANAGE: "DOCUMENTS_MANAGE",

  // DATA - Data import/export
  DATA_EXPORT: "DATA_EXPORT",
  DATA_IMPORT: "DATA_IMPORT",

  // ORGANIZATIONS - Organizations catalog  
  ORGANIZATIONS_VIEW: "ORGANIZATIONS_VIEW",

  // TOOLKIT - General toolkit access
  TOOLKIT_ACCESS: "TOOLKIT_ACCESS",

  // Legacy support for backwards compatibility
  ACCESS_HOSTS: "HOSTS_VIEW", // Legacy
  ACCESS_RECIPIENTS: "RECIPIENTS_VIEW", // Legacy
  ACCESS_DRIVERS: "DRIVERS_VIEW", // Legacy
  ACCESS_COLLECTIONS: "COLLECTIONS_VIEW", // Legacy
  ACCESS_CHAT: "CHAT_GENERAL", // Legacy
  ACCESS_MESSAGES: "MESSAGES_VIEW", // Legacy
  ACCESS_PROJECTS: "PROJECTS_VIEW", // Legacy
  ACCESS_ANALYTICS: "ANALYTICS_VIEW", // Legacy
  ACCESS_MEETINGS: "MEETINGS_VIEW", // Legacy
  ACCESS_SUGGESTIONS: "SUGGESTIONS_VIEW", // Legacy
  ACCESS_WORK_LOGS: "WORK_LOGS_VIEW", // Legacy
  ACCESS_TOOLKIT: "TOOLKIT_ACCESS", // Legacy
  MANAGE_USERS: "USERS_EDIT", // Legacy
  MANAGE_HOSTS: "HOSTS_EDIT", // Legacy
  MANAGE_RECIPIENTS: "RECIPIENTS_EDIT", // Legacy
  MANAGE_DRIVERS: "DRIVERS_EDIT", // Legacy
  MANAGE_COLLECTIONS: "COLLECTIONS_EDIT", // Legacy
  CREATE_COLLECTIONS: "COLLECTIONS_ADD", // Legacy
  EDIT_ALL_COLLECTIONS: "COLLECTIONS_EDIT", // Legacy
  DELETE_ALL_COLLECTIONS: "COLLECTIONS_DELETE", // Legacy
  USE_COLLECTION_WALKTHROUGH: "COLLECTIONS_WALKTHROUGH", // Legacy
  CREATE_PROJECTS: "PROJECTS_ADD", // Legacy
  EDIT_ALL_PROJECTS: "PROJECTS_EDIT", // Legacy
  DELETE_ALL_PROJECTS: "PROJECTS_DELETE", // Legacy
  CREATE_SUGGESTIONS: "SUGGESTIONS_ADD", // Legacy
  EDIT_ALL_SUGGESTIONS: "SUGGESTIONS_EDIT", // Legacy
  DELETE_ALL_SUGGESTIONS: "SUGGESTIONS_DELETE", // Legacy
  CREATE_WORK_LOGS: "WORK_LOGS_ADD", // Legacy
  VIEW_ALL_WORK_LOGS: "WORK_LOGS_VIEW_ALL", // Legacy
  EDIT_ALL_WORK_LOGS: "WORK_LOGS_EDIT", // Legacy
  DELETE_ALL_WORK_LOGS: "WORK_LOGS_DELETE", // Legacy
  SEND_MESSAGES: "MESSAGES_SEND", // Legacy
  MODERATE_MESSAGES: "MESSAGES_MODERATE", // Legacy
  DIRECT_MESSAGES: "CHAT_DIRECT", // Legacy
  GROUP_MESSAGES: "CHAT_GROUP", // Legacy
  GENERAL_CHAT: "CHAT_GENERAL", // Legacy
  COMMITTEE_CHAT: "CHAT_COMMITTEE", // Legacy
  HOST_CHAT: "CHAT_HOST", // Legacy
  DRIVER_CHAT: "CHAT_DRIVER", // Legacy
  RECIPIENT_CHAT: "CHAT_RECIPIENT", // Legacy
  CORE_TEAM_CHAT: "CHAT_CORE_TEAM", // Legacy
  SEND_KUDOS: "KUDOS_SEND", // Legacy
  RECEIVE_KUDOS: "KUDOS_RECEIVE", // Legacy
  VIEW_KUDOS: "KUDOS_VIEW", // Legacy
  MANAGE_ALL_KUDOS: "KUDOS_MANAGE", // Legacy
  EXPORT_DATA: "DATA_EXPORT", // Legacy
  IMPORT_DATA: "DATA_IMPORT", // Legacy
  EDIT_DATA: "DATA_EXPORT", // Legacy (data editing is export functionality)
  VIEW_ORGANIZATIONS_CATALOG: "ORGANIZATIONS_VIEW", // Legacy
  VIEW_EVENT_REQUESTS: "EVENT_REQUESTS_VIEW", // Legacy
  ADD_EVENT_REQUESTS: "EVENT_REQUESTS_ADD", // Legacy
  EDIT_EVENT_REQUESTS: "EVENT_REQUESTS_EDIT", // Legacy
  DELETE_EVENT_REQUESTS: "EVENT_REQUESTS_DELETE", // Legacy
  MANAGE_EVENT_REQUESTS: "EVENT_REQUESTS_EDIT", // Legacy
  ASSIGN_EVENT_REQUESTS: "EVENT_REQUESTS_EDIT", // Legacy
  VIEW_DONATION_TRACKING: "DISTRIBUTIONS_VIEW", // Legacy
  ADD_DONATION_TRACKING: "DISTRIBUTIONS_ADD", // Legacy
  EDIT_DONATION_TRACKING: "DISTRIBUTIONS_EDIT", // Legacy
  DELETE_DONATION_TRACKING: "DISTRIBUTIONS_DELETE", // Legacy
  MANAGE_DONATION_TRACKING: "DISTRIBUTIONS_EDIT", // Legacy
  VIEW_DOCUMENTS: "DOCUMENTS_VIEW", // Legacy
  MANAGE_DOCUMENTS: "DOCUMENTS_MANAGE", // Legacy
  ACCESS_DOCUMENTS: "DOCUMENTS_VIEW", // Legacy
  MANAGE_MEETINGS: "MEETINGS_MANAGE", // Legacy
  MANAGE_SUGGESTIONS: "SUGGESTIONS_MANAGE", // Legacy
} as const;

// Note: This application uses individual permission assignment, not role-based defaults
// The getDefaultPermissionsForRole function is kept for backwards compatibility only

export function getDefaultPermissionsForRole(role: string): string[] {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
      return Object.values(PERMISSIONS);

    case USER_ROLES.ADMIN:
      return Object.values(PERMISSIONS).filter(
        (p) => p !== PERMISSIONS.MESSAGES_MODERATE,
      );

    case USER_ROLES.COMMITTEE_MEMBER:
      return [
        // Core access permissions
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.MEETINGS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        
        // Basic messaging and chat
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.CHAT_COMMITTEE,
        
        // Can create content
        PERMISSIONS.SUGGESTIONS_ADD, // Can create suggestions + edit/delete own
        PERMISSIONS.DATA_EXPORT,
        
        // Kudos system
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW
      ];

    case USER_ROLES.HOST:
      return [
        // Directory access
        PERMISSIONS.HOSTS_VIEW,
        PERMISSIONS.RECIPIENTS_VIEW,
        
        // Collections capability
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.COLLECTIONS_ADD, // Can create collections (automatically can edit/delete own)
        PERMISSIONS.COLLECTIONS_WALKTHROUGH, // Can use simplified walkthrough for collections
        
        // Chat permissions
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.CHAT_HOST,
        PERMISSIONS.CHAT_DIRECT,
        
        // Analytics and other access
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.SUGGESTIONS_ADD, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.TOOLKIT_ACCESS,
        
        // Kudos system
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW
      ];

    case USER_ROLES.CORE_TEAM:
      return [
        // Core viewing permissions
        PERMISSIONS.HOSTS_VIEW,
        PERMISSIONS.RECIPIENTS_VIEW,
        PERMISSIONS.DRIVERS_VIEW,
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.MEETINGS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        
        // Management permissions
        PERMISSIONS.HOSTS_EDIT,
        PERMISSIONS.RECIPIENTS_EDIT,
        PERMISSIONS.DRIVERS_EDIT,
        PERMISSIONS.USERS_EDIT, // Core team can manage users
        PERMISSIONS.DISTRIBUTIONS_EDIT,
        PERMISSIONS.EVENT_REQUESTS_EDIT,
        PERMISSIONS.SUGGESTIONS_MANAGE,
        
        // Collection permissions
        PERMISSIONS.COLLECTIONS_ADD,
        PERMISSIONS.COLLECTIONS_WALKTHROUGH,
        
        // Project permissions  
        PERMISSIONS.PROJECTS_ADD,
        
        // Communication
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.MESSAGES_SEND,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.CHAT_HOST,
        PERMISSIONS.CHAT_CORE_TEAM,
        PERMISSIONS.CHAT_DIRECT,
        
        // Data and analytics
        PERMISSIONS.DATA_EXPORT,
        
        // Kudos system
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW
      ];

    case USER_ROLES.DRIVER:
      return [
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.CHAT_DRIVER,
        PERMISSIONS.SUGGESTIONS_ADD, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW
      ];

    case USER_ROLES.VOLUNTEER:
      return [
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.COLLECTIONS_ADD, // Can create collections (automatically can edit/delete own)
        PERMISSIONS.COLLECTIONS_WALKTHROUGH, // Can use simplified walkthrough for collections
        PERMISSIONS.PROJECTS_ADD, // Can create projects (automatically can edit/delete own)
        PERMISSIONS.SUGGESTIONS_ADD, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW
      ];

    case USER_ROLES.RECIPIENT:
      return [
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.CHAT_RECIPIENT,
        PERMISSIONS.COLLECTIONS_WALKTHROUGH, // Can use simplified walkthrough for collections (recipients who help with collections)
        PERMISSIONS.SUGGESTIONS_ADD, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.KUDOS_RECEIVE, // Recipients can receive kudos but not send them by default
        PERMISSIONS.KUDOS_VIEW
      ];

    case USER_ROLES.DEMO_USER:
      return [
        // Can view all main sections but cannot edit/delete/manage anything
        PERMISSIONS.ACCESS_HOSTS,
        PERMISSIONS.ACCESS_RECIPIENTS,
        PERMISSIONS.ACCESS_DRIVERS,
        PERMISSIONS.ACCESS_VOLUNTEERS,
        PERMISSIONS.ACCESS_DONATION_TRACKING,
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.ACCESS_MEETINGS,
        PERMISSIONS.ACCESS_ANALYTICS,
        PERMISSIONS.ACCESS_PROJECTS,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.ACCESS_WORK_LOGS,
        PERMISSIONS.ACCESS_WEEKLY_MONITORING,
        PERMISSIONS.ACCESS_EVENTS,
        PERMISSIONS.ACCESS_DEVELOPMENT,
        PERMISSIONS.ACCESS_SIGNUP_GENIUS,
        
        // Chat permissions (read-only)
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.COMMITTEE_CHAT,
        PERMISSIONS.HOST_CHAT,
        PERMISSIONS.DRIVER_CHAT,
        PERMISSIONS.RECIPIENT_CHAT,
        PERMISSIONS.CORE_TEAM_CHAT,
        
        // Can receive kudos but cannot send
        PERMISSIONS.RECEIVE_KUDOS,
        PERMISSIONS.VIEW_KUDOS,
        
        // Export data for reporting
        PERMISSIONS.EXPORT_DATA,
      ];

    case USER_ROLES.VIEWER:
      return [
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.ACCESS_PROJECTS,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.ACCESS_SANDWICH_DATA,
        PERMISSIONS.CREATE_SUGGESTIONS, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.VIEW_KUDOS // Viewers can only view kudos, not send or receive
      ];

    case USER_ROLES.WORK_LOGGER:
      return [
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.ACCESS_PROJECTS,
        PERMISSIONS.GENERAL_CHAT,
        "log_work",
      ];

    default:
      return [];
  }
}

// Chat room to permission mapping
export const CHAT_PERMISSIONS = {
  general: PERMISSIONS.GENERAL_CHAT,
  committee: PERMISSIONS.COMMITTEE_CHAT,
  host: PERMISSIONS.HOST_CHAT,        // Fixed: singular to match frontend
  hosts: PERMISSIONS.HOST_CHAT,       // Keep plural for backwards compatibility
  driver: PERMISSIONS.DRIVER_CHAT,    // Fixed: singular to match frontend  
  drivers: PERMISSIONS.DRIVER_CHAT,   // Keep plural for backwards compatibility
  recipient: PERMISSIONS.RECIPIENT_CHAT,
  recipients: PERMISSIONS.RECIPIENT_CHAT,
  core_team: PERMISSIONS.CORE_TEAM_CHAT,
  "core-team": PERMISSIONS.CORE_TEAM_CHAT, // Also support kebab-case from frontend
  direct: PERMISSIONS.DIRECT_MESSAGES,
  groups: PERMISSIONS.GROUP_MESSAGES,
} as const;

// Function to check if user has access to a specific chat room
export function hasAccessToChat(user: any, chatRoom: string): boolean {
  if (!user || !user.permissions) return false;

  const requiredPermission =
    CHAT_PERMISSIONS[chatRoom as keyof typeof CHAT_PERMISSIONS];
  if (!requiredPermission) return false;

  // Use the enhanced hasPermission function that checks case variations
  return hasPermission(user, requiredPermission);
}

// Function to check if user has a specific permission
export function hasPermission(user: any, permission: string): boolean {
  if (!user || !user.permissions) return false;
  
  // Super admins get all permissions automatically
  if (user.role === "super_admin" || user.role === USER_ROLES.SUPER_ADMIN) return true;
  
  // Check for exact match first
  if (user.permissions.includes(permission)) return true;
  
  // Check for case variations to handle mixed case permissions
  const lowerPermission = permission.toLowerCase();
  const upperPermission = permission.toUpperCase();
  
  return user.permissions.includes(lowerPermission) || 
         user.permissions.includes(upperPermission);
}

// Function to check if user can edit a specific collection entry
export function canEditCollection(user: any, collection: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with EDIT_ALL_COLLECTIONS can edit all collections
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.EDIT_ALL_COLLECTIONS)
  )
    return true;

  // Users with CREATE_COLLECTIONS can edit collections they created
  if (
    user.permissions.includes(PERMISSIONS.CREATE_COLLECTIONS) &&
    (collection?.createdBy === user.id || collection?.created_by === user.id)
  )
    return true;

  return false;
}

// Function to check if user can delete a specific collection entry
export function canDeleteCollection(user: any, collection: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with DELETE_ALL_COLLECTIONS can delete all collections
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.DELETE_ALL_COLLECTIONS)
  )
    return true;

  // Users with CREATE_COLLECTIONS can delete collections they created
  if (
    user.permissions.includes(PERMISSIONS.CREATE_COLLECTIONS) &&
    (collection?.createdBy === user.id || collection?.created_by === user.id)
  )
    return true;

  return false;
}

// Function to check if user can edit a specific project
export function canEditProject(user: any, project: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with EDIT_ALL_PROJECTS or MANAGE_ALL_PROJECTS can edit all projects
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.EDIT_ALL_PROJECTS) ||
    user.permissions.includes("MANAGE_ALL_PROJECTS")
  )
    return true;

  // Users with CREATE_PROJECTS can edit projects they created
  if (
    user.permissions.includes(PERMISSIONS.CREATE_PROJECTS) &&
    (project?.createdBy === user.id || project?.created_by === user.id)
  )
    return true;

  // Users with CREATE_PROJECTS can edit projects they're assigned to
  if (user.permissions.includes(PERMISSIONS.CREATE_PROJECTS)) {
    // Check multi-assignee IDs
    if (project?.assigneeIds && Array.isArray(project.assigneeIds)) {
      if (project.assigneeIds.includes(user.id)) return true;
    }

    // Check legacy single assignee ID
    if (project?.assigneeId === user.id) return true;

    // Check assigneeName matches user's display name or email
    if (project?.assigneeName) {
      const userDisplayName =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email;
      if (
        project.assigneeName === userDisplayName ||
        project.assigneeName === user.email
      )
        return true;
    }
  }

  return false;
}

// Function to check if user can delete a specific project
export function canDeleteProject(user: any, project: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with DELETE_ALL_PROJECTS can delete all projects
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.DELETE_ALL_PROJECTS)
  )
    return true;

  // Users with CREATE_PROJECTS can only delete projects they created (not assigned ones)
  if (
    user.permissions.includes(PERMISSIONS.CREATE_PROJECTS) &&
    (project?.createdBy === user.id || project?.created_by === user.id)
  )
    return true;

  return false;
}

// Function to check if user can edit a specific suggestion entry
export function canEditSuggestion(user: any, suggestion: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with EDIT_ALL_SUGGESTIONS can edit all suggestions
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.EDIT_ALL_SUGGESTIONS)
  )
    return true;

  // Users with CREATE_SUGGESTIONS can edit suggestions they created
  if (
    user.permissions.includes(PERMISSIONS.CREATE_SUGGESTIONS) &&
    (suggestion?.createdBy === user.id ||
      suggestion?.created_by === user.id ||
      suggestion?.submittedBy === user.id)
  )
    return true;

  return false;
}

// Function to check if user can delete a specific suggestion entry
export function canDeleteSuggestion(user: any, suggestion: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with DELETE_ALL_SUGGESTIONS can delete all suggestions
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.DELETE_ALL_SUGGESTIONS)
  )
    return true;

  // Users with CREATE_SUGGESTIONS can delete suggestions they created
  if (
    user.permissions.includes(PERMISSIONS.CREATE_SUGGESTIONS) &&
    (suggestion?.createdBy === user.id ||
      suggestion?.created_by === user.id ||
      suggestion?.submittedBy === user.id)
  )
    return true;

  return false;
}

// Function to check if user can edit a specific work log entry
export function canEditWorkLog(user: any, workLog: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with EDIT_ALL_WORK_LOGS can edit all work logs
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.EDIT_ALL_WORK_LOGS)
  )
    return true;

  // Users with CREATE_WORK_LOGS can edit work logs they created
  if (
    user.permissions.includes(PERMISSIONS.CREATE_WORK_LOGS) &&
    (workLog?.createdBy === user.id ||
      workLog?.created_by === user.id ||
      workLog?.userId === user.id)
  )
    return true;

  return false;
}

// Function to check if user can delete a specific work log entry
export function canDeleteWorkLog(user: any, workLog: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with DELETE_ALL_WORK_LOGS can delete all work logs
  if (
    user.role === "super_admin" ||
    user.permissions.includes(PERMISSIONS.DELETE_ALL_WORK_LOGS)
  )
    return true;

  // Users with CREATE_WORK_LOGS can delete work logs they created
  if (
    user.permissions.includes(PERMISSIONS.CREATE_WORK_LOGS) &&
    (workLog?.createdBy === user.id ||
      workLog?.created_by === user.id ||
      workLog?.userId === user.id)
  )
    return true;

  return false;
}

// Function to get human-readable role display name
export function getRoleDisplayName(role: string): string {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
      return "Super Administrator";
    case USER_ROLES.ADMIN:
      return "Administrator";
    case USER_ROLES.COMMITTEE_MEMBER:
      return "Committee Member";
    case USER_ROLES.CORE_TEAM:
      return "Core Team";
    case USER_ROLES.HOST:
      return "Host Location";
    case USER_ROLES.DRIVER:
      return "Delivery Driver";
    case USER_ROLES.VOLUNTEER:
      return "Volunteer";
    case USER_ROLES.RECIPIENT:
      return "Recipient Organization";
    case USER_ROLES.VIEWER:
      return "Viewer";
    case USER_ROLES.WORK_LOGGER:
      return "Work Logger";
    case USER_ROLES.DEMO_USER:
      return "Demo User";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).replace("_", " ");
  }
}
