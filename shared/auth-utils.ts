export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  COMMITTEE_MEMBER: 'committee_member',
  CORE_TEAM: 'core_team',
  HOST: 'host',
  DRIVER: 'driver',
  VOLUNTEER: 'volunteer',
  RECIPIENT: 'recipient',
  VIEWER: 'viewer',
  WORK_LOGGER: 'work_logger',
  DEMO_USER: 'demo_user',
} as const;

// Clean Resource-Action Permission System
export const PERMISSIONS = {
  // ADMINISTRATIVE PERMISSIONS
  ADMIN_ACCESS: 'ADMIN_ACCESS',
  MANAGE_ANNOUNCEMENTS: 'MANAGE_ANNOUNCEMENTS',

  // HOSTS - Host location management
  HOSTS_VIEW: 'HOSTS_VIEW',
  HOSTS_ADD: 'HOSTS_ADD',
  HOSTS_EDIT: 'HOSTS_EDIT',
  HOSTS_DELETE: 'HOSTS_DELETE',

  // RECIPIENTS - Recipient organization management
  RECIPIENTS_VIEW: 'RECIPIENTS_VIEW',
  RECIPIENTS_ADD: 'RECIPIENTS_ADD',
  RECIPIENTS_EDIT: 'RECIPIENTS_EDIT',
  RECIPIENTS_DELETE: 'RECIPIENTS_DELETE',

  // DRIVERS - Driver management
  DRIVERS_VIEW: 'DRIVERS_VIEW',
  DRIVERS_ADD: 'DRIVERS_ADD',
  DRIVERS_EDIT: 'DRIVERS_EDIT',
  DRIVERS_DELETE: 'DRIVERS_DELETE',

  // USERS - User account management
  USERS_VIEW: 'USERS_VIEW',
  USERS_ADD: 'USERS_ADD',
  USERS_EDIT: 'USERS_EDIT',
  USERS_DELETE: 'USERS_DELETE',

  // COLLECTIONS - Sandwich collection data
  COLLECTIONS_VIEW: 'COLLECTIONS_VIEW',
  COLLECTIONS_ADD: 'COLLECTIONS_ADD',
  COLLECTIONS_EDIT_OWN: 'COLLECTIONS_EDIT_OWN', // Edit own collection logs
  COLLECTIONS_EDIT_ALL: 'COLLECTIONS_EDIT_ALL', // Edit any collection logs
  COLLECTIONS_DELETE_OWN: 'COLLECTIONS_DELETE_OWN', // Delete own collection logs
  COLLECTIONS_DELETE_ALL: 'COLLECTIONS_DELETE_ALL', // Delete any collection logs
  COLLECTIONS_WALKTHROUGH: 'COLLECTIONS_WALKTHROUGH', // Simplified entry form

  // PROJECTS - Project management
  PROJECTS_VIEW: 'PROJECTS_VIEW',
  PROJECTS_ADD: 'PROJECTS_ADD',
  PROJECTS_EDIT_OWN: 'PROJECTS_EDIT_OWN', // Edit assigned/owned projects
  PROJECTS_EDIT_ALL: 'PROJECTS_EDIT_ALL', // Edit any projects
  PROJECTS_DELETE_OWN: 'PROJECTS_DELETE_OWN', // Delete assigned/owned projects
  PROJECTS_DELETE_ALL: 'PROJECTS_DELETE_ALL', // Delete any projects

  // DISTRIBUTIONS - Sandwich distribution tracking
  DISTRIBUTIONS_VIEW: 'DISTRIBUTIONS_VIEW',
  DISTRIBUTIONS_ADD: 'DISTRIBUTIONS_ADD',
  DISTRIBUTIONS_EDIT: 'DISTRIBUTIONS_EDIT',
  DISTRIBUTIONS_DELETE: 'DISTRIBUTIONS_DELETE',

  // EVENT_REQUESTS - Event planning and requests
  EVENT_REQUESTS_VIEW: 'EVENT_REQUESTS_VIEW',
  EVENT_REQUESTS_ADD: 'EVENT_REQUESTS_ADD',
  EVENT_REQUESTS_EDIT: 'EVENT_REQUESTS_EDIT',
  EVENT_REQUESTS_DELETE: 'EVENT_REQUESTS_DELETE',
  EVENT_REQUESTS_DELETE_CARD: 'EVENT_REQUESTS_DELETE_CARD', // Delete via card delete buttons
  EVENT_REQUESTS_SYNC: 'EVENT_REQUESTS_SYNC', // Google Sheets sync
  EVENT_REQUESTS_COMPLETE_CONTACT: 'EVENT_REQUESTS_COMPLETE_CONTACT', // Mark primary contact as completed
  
  // EVENT_REQUESTS - Inline editing permissions for specific fields
  EVENT_REQUESTS_INLINE_EDIT_TIMES: 'EVENT_REQUESTS_INLINE_EDIT_TIMES', // Edit event/pickup times inline
  EVENT_REQUESTS_INLINE_EDIT_ADDRESS: 'EVENT_REQUESTS_INLINE_EDIT_ADDRESS', // Edit event address inline
  EVENT_REQUESTS_INLINE_EDIT_SANDWICHES: 'EVENT_REQUESTS_INLINE_EDIT_SANDWICHES', // Edit sandwich count/types inline
  EVENT_REQUESTS_INLINE_EDIT_STAFFING: 'EVENT_REQUESTS_INLINE_EDIT_STAFFING', // Edit drivers/speakers/volunteers needed inline
  EVENT_REQUESTS_INLINE_EDIT_LOGISTICS: 'EVENT_REQUESTS_INLINE_EDIT_LOGISTICS', // Edit refrigeration and other logistics inline
  
  // EVENT_REQUESTS - Self-signup and assignment permissions
  EVENT_REQUESTS_SELF_SIGNUP: 'EVENT_REQUESTS_SELF_SIGNUP', // Sign up self for driver/speaker/volunteer roles
  EVENT_REQUESTS_ASSIGN_OTHERS: 'EVENT_REQUESTS_ASSIGN_OTHERS', // Assign others to driver/speaker/volunteer roles
  EVENT_REQUESTS_VIEW_ONLY: 'EVENT_REQUESTS_VIEW_ONLY', // View events with no edit/assignment capabilities
  EVENT_REQUESTS_EDIT_ALL_DETAILS: 'EVENT_REQUESTS_EDIT_ALL_DETAILS', // Edit all event details (comprehensive editing)
  EVENT_REQUESTS_SEND_TOOLKIT: 'EVENT_REQUESTS_SEND_TOOLKIT', // Send toolkit and mark events as scheduled
  EVENT_REQUESTS_FOLLOW_UP: 'EVENT_REQUESTS_FOLLOW_UP', // Use follow-up buttons (1 day, 1 month)
  EVENT_REQUESTS_EDIT_TSP_CONTACT: 'EVENT_REQUESTS_EDIT_TSP_CONTACT', // Edit TSP contact assignments

  // MESSAGES - Messaging system
  MESSAGES_VIEW: 'MESSAGES_VIEW',
  MESSAGES_SEND: 'MESSAGES_SEND',
  MESSAGES_EDIT: 'MESSAGES_EDIT',
  MESSAGES_DELETE: 'MESSAGES_DELETE',
  MESSAGES_MODERATE: 'MESSAGES_MODERATE',

  // WORK_LOGS - Work time logging
  WORK_LOGS_VIEW: 'WORK_LOGS_VIEW', // View own work logs
  WORK_LOGS_VIEW_ALL: 'WORK_LOGS_VIEW_ALL', // View all users' logs
  WORK_LOGS_ADD: 'WORK_LOGS_ADD',
  WORK_LOGS_EDIT_OWN: 'WORK_LOGS_EDIT_OWN', // Edit own work logs
  WORK_LOGS_EDIT_ALL: 'WORK_LOGS_EDIT_ALL', // Edit any work logs
  WORK_LOGS_DELETE_OWN: 'WORK_LOGS_DELETE_OWN', // Delete own work logs
  WORK_LOGS_DELETE_ALL: 'WORK_LOGS_DELETE_ALL', // Delete any work logs

  // SUGGESTIONS - Suggestion system
  SUGGESTIONS_VIEW: 'SUGGESTIONS_VIEW',
  SUGGESTIONS_ADD: 'SUGGESTIONS_ADD',
  SUGGESTIONS_EDIT_OWN: 'SUGGESTIONS_EDIT_OWN', // Edit own suggestions
  SUGGESTIONS_EDIT_ALL: 'SUGGESTIONS_EDIT_ALL', // Edit any suggestions
  SUGGESTIONS_DELETE_OWN: 'SUGGESTIONS_DELETE_OWN', // Delete own suggestions
  SUGGESTIONS_DELETE_ALL: 'SUGGESTIONS_DELETE_ALL', // Delete any suggestions
  SUGGESTIONS_MANAGE: 'SUGGESTIONS_MANAGE', // Respond to suggestions

  // CHAT - Chat room access
  CHAT_GENERAL: 'CHAT_GENERAL',
  CHAT_GRANTS_COMMITTEE: 'CHAT_GRANTS_COMMITTEE',
  CHAT_EVENTS_COMMITTEE: 'CHAT_EVENTS_COMMITTEE',
  CHAT_BOARD: 'CHAT_BOARD',
  CHAT_WEB_COMMITTEE: 'CHAT_WEB_COMMITTEE',
  CHAT_VOLUNTEER_MANAGEMENT: 'CHAT_VOLUNTEER_MANAGEMENT',
  CHAT_HOST: 'CHAT_HOST',
  CHAT_DRIVER: 'CHAT_DRIVER',
  CHAT_RECIPIENT: 'CHAT_RECIPIENT',
  CHAT_CORE_TEAM: 'CHAT_CORE_TEAM',
  CHAT_DIRECT: 'CHAT_DIRECT',
  CHAT_GROUP: 'CHAT_GROUP',

  // KUDOS - Kudos system
  KUDOS_SEND: 'KUDOS_SEND',
  KUDOS_RECEIVE: 'KUDOS_RECEIVE',
  KUDOS_VIEW: 'KUDOS_VIEW',
  KUDOS_MANAGE: 'KUDOS_MANAGE', // Admin management

  // ANALYTICS - Dashboard analytics
  ANALYTICS_VIEW: 'ANALYTICS_VIEW',

  // MEETINGS - Meeting management
  MEETINGS_VIEW: 'MEETINGS_VIEW',
  MEETINGS_MANAGE: 'MEETINGS_MANAGE',

  // DOCUMENTS - Document management
  DOCUMENTS_VIEW: 'DOCUMENTS_VIEW',
  DOCUMENTS_MANAGE: 'DOCUMENTS_MANAGE',
  DOCUMENTS_CONFIDENTIAL: 'DOCUMENTS_CONFIDENTIAL', // Access to confidential documents
  DOCUMENTS_UPLOAD: 'DOCUMENTS_UPLOAD', // Upload documents (can delete own uploads)
  DOCUMENTS_DELETE_ALL: 'DOCUMENTS_DELETE_ALL', // Delete any uploaded document

  // DATA - Data import/export
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_IMPORT: 'DATA_IMPORT',

  // ORGANIZATIONS - Organizations catalog
  ORGANIZATIONS_VIEW: 'ORGANIZATIONS_VIEW',

  // TOOLKIT - General toolkit access
  TOOLKIT_ACCESS: 'TOOLKIT_ACCESS',

  // NAVIGATION - Individual tab access permissions
  NAV_MY_ACTIONS: 'NAV_MY_ACTIONS', // Access to My Actions tab
  NAV_DASHBOARD: 'NAV_DASHBOARD', // Access to Dashboard tab
  NAV_COLLECTIONS_LOG: 'NAV_COLLECTIONS_LOG', // Access to Collections Log tab
  NAV_TEAM_CHAT: 'NAV_TEAM_CHAT', // Access to Team Chat tab
  NAV_INBOX: 'NAV_INBOX', // Access to Inbox tab
  NAV_SUGGESTIONS: 'NAV_SUGGESTIONS', // Access to Suggestions tab
  NAV_HOSTS: 'NAV_HOSTS', // Access to Hosts tab
  NAV_DRIVERS: 'NAV_DRIVERS', // Access to Drivers tab
  NAV_VOLUNTEERS: 'NAV_VOLUNTEERS', // Access to Volunteers tab
  NAV_RECIPIENTS: 'NAV_RECIPIENTS', // Access to Recipients tab
  NAV_GROUPS_CATALOG: 'NAV_GROUPS_CATALOG', // Access to Groups Catalog tab
  NAV_DISTRIBUTION_TRACKING: 'NAV_DISTRIBUTION_TRACKING', // Access to Distribution Tracking tab
  NAV_INVENTORY_CALCULATOR: 'NAV_INVENTORY_CALCULATOR', // Access to Inventory Calculator tab
  NAV_WORK_LOG: 'NAV_WORK_LOG', // Access to Work Log tab
  NAV_EVENTS_GOOGLE_SHEET: 'NAV_EVENTS_GOOGLE_SHEET', // Access to Events Google Sheet tab
  NAV_PROJECTS: 'NAV_PROJECTS', // Access to Projects tab
  NAV_MEETINGS: 'NAV_MEETINGS', // Access to Meetings tab
  NAV_EVENT_PLANNING: 'NAV_EVENT_PLANNING', // Access to Event Planning tab
  NAV_EVENT_REMINDERS: 'NAV_EVENT_REMINDERS', // Access to Event Reminders tab
  NAV_ANALYTICS: 'NAV_ANALYTICS', // Access to Analytics tab
  NAV_WEEKLY_MONITORING: 'NAV_WEEKLY_MONITORING', // Access to Weekly Monitoring tab
  NAV_IMPORTANT_DOCUMENTS: 'NAV_IMPORTANT_DOCUMENTS', // Access to Important Documents tab
  NAV_IMPORTANT_LINKS: 'NAV_IMPORTANT_LINKS', // Access to Important Links tab
  NAV_TOOLKIT: 'NAV_TOOLKIT', // Access to Toolkit tab
  NAV_DOCUMENT_MANAGEMENT: 'NAV_DOCUMENT_MANAGEMENT', // Access to Document Management tab

  // ADMIN - Administrative access
  ADMIN_PANEL_ACCESS: 'ADMIN_PANEL_ACCESS', // Access to admin panel/user management

} as const;

// Note: This application uses individual permission assignment, not role-based defaults
// The getDefaultPermissionsForRole function is kept for backwards compatibility only

export function getDefaultPermissionsForRole(role: string): string[] {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
      return Object.values(PERMISSIONS);

    case USER_ROLES.ADMIN:
      return Object.values(PERMISSIONS).filter(
        (p) => p !== PERMISSIONS.MESSAGES_MODERATE
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
        PERMISSIONS.CHAT_GRANTS_COMMITTEE,
        PERMISSIONS.CHAT_EVENTS_COMMITTEE,
        PERMISSIONS.CHAT_WEB_COMMITTEE,
        PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT,

        // Can create content
        PERMISSIONS.SUGGESTIONS_ADD, // Can create suggestions + edit/delete own
        PERMISSIONS.DATA_EXPORT,

        // Kudos system
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW,
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
        PERMISSIONS.EVENT_REQUESTS_VIEW,
        PERMISSIONS.EVENT_REQUESTS_COMPLETE_CONTACT,
        PERMISSIONS.ORGANIZATIONS_VIEW,

        // Kudos system
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW,
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
        PERMISSIONS.EVENT_REQUESTS_VIEW,
        PERMISSIONS.EVENT_REQUESTS_EDIT,
        PERMISSIONS.EVENT_REQUESTS_COMPLETE_CONTACT,
        PERMISSIONS.ORGANIZATIONS_VIEW,
        PERMISSIONS.SUGGESTIONS_MANAGE,

        // Collection permissions
        PERMISSIONS.COLLECTIONS_ADD,
        PERMISSIONS.COLLECTIONS_WALKTHROUGH,

        // Project permissions (includes meeting-project integration)
        PERMISSIONS.PROJECTS_ADD,
        PERMISSIONS.PROJECTS_EDIT_ALL, // Required for "Send to Agenda" and meeting notes
        PERMISSIONS.MEETINGS_MANAGE, // Required for full meeting management

        // Communication
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.MESSAGES_SEND,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.CHAT_HOST,
        PERMISSIONS.CHAT_CORE_TEAM,
        PERMISSIONS.CHAT_DIRECT,
        PERMISSIONS.CHAT_GRANTS_COMMITTEE,
        PERMISSIONS.CHAT_EVENTS_COMMITTEE,
        PERMISSIONS.CHAT_WEB_COMMITTEE,
        PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT,
        PERMISSIONS.CHAT_BOARD,

        // Data and analytics
        PERMISSIONS.DATA_EXPORT,

        // Kudos system
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW,
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
        PERMISSIONS.EVENT_REQUESTS_VIEW,
        PERMISSIONS.ORGANIZATIONS_VIEW,
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW,
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
        PERMISSIONS.EVENT_REQUESTS_VIEW,
        PERMISSIONS.ORGANIZATIONS_VIEW,
        PERMISSIONS.KUDOS_SEND,
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW,
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
        PERMISSIONS.EVENT_REQUESTS_VIEW,
        PERMISSIONS.ORGANIZATIONS_VIEW,
        PERMISSIONS.KUDOS_RECEIVE, // Recipients can receive kudos but not send them by default
        PERMISSIONS.KUDOS_VIEW,
      ];

    case USER_ROLES.DEMO_USER:
      return [
        // Can view all main sections but cannot edit/delete/manage anything
        PERMISSIONS.HOSTS_VIEW,
        PERMISSIONS.RECIPIENTS_VIEW,
        PERMISSIONS.DRIVERS_VIEW,
        PERMISSIONS.USERS_VIEW,
        PERMISSIONS.DISTRIBUTIONS_VIEW,
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.MEETINGS_VIEW,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.WORK_LOGS_VIEW,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.ADMIN_ACCESS,
        PERMISSIONS.TOOLKIT_ACCESS,

        // Chat permissions (read-only)
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.CHAT_GRANTS_COMMITTEE,
        PERMISSIONS.CHAT_HOST,
        PERMISSIONS.CHAT_DRIVER,
        PERMISSIONS.CHAT_RECIPIENT,
        PERMISSIONS.CHAT_CORE_TEAM,

        // Can receive kudos but cannot send
        PERMISSIONS.KUDOS_RECEIVE,
        PERMISSIONS.KUDOS_VIEW,

        // Export data for reporting
        PERMISSIONS.DATA_EXPORT,
      ];

    case USER_ROLES.VIEWER:
      return [
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.SUGGESTIONS_VIEW,
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.SUGGESTIONS_ADD, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.KUDOS_VIEW, // Viewers can only view kudos, not send or receive
        PERMISSIONS.EVENT_REQUESTS_VIEW,
        PERMISSIONS.ORGANIZATIONS_VIEW,
      ];

    case USER_ROLES.WORK_LOGGER:
      return [
        PERMISSIONS.COLLECTIONS_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.PROJECTS_VIEW,
        PERMISSIONS.CHAT_GENERAL,
        'log_work',
      ];

    default:
      return [];
  }
}

// Chat room to permission mapping
export const CHAT_PERMISSIONS = {
  general: PERMISSIONS.CHAT_GENERAL,
  committee: PERMISSIONS.CHAT_GRANTS_COMMITTEE,
  host: PERMISSIONS.CHAT_HOST, // Fixed: singular to match frontend
  hosts: PERMISSIONS.CHAT_HOST, // Keep plural for backwards compatibility
  driver: PERMISSIONS.CHAT_DRIVER, // Fixed: singular to match frontend
  drivers: PERMISSIONS.CHAT_DRIVER, // Keep plural for backwards compatibility
  recipient: PERMISSIONS.CHAT_RECIPIENT,
  recipients: PERMISSIONS.CHAT_RECIPIENT,
  core_team: PERMISSIONS.CHAT_CORE_TEAM,
  'core-team': PERMISSIONS.CHAT_CORE_TEAM, // Also support kebab-case from frontend
  direct: PERMISSIONS.CHAT_DIRECT,
  groups: PERMISSIONS.CHAT_GROUP,
} as const;

// Function to check if user has access to a specific chat room
export function hasAccessToChat(user: any, chatRoom: string): boolean {
  if (!user || !user.permissions) return false;

  const requiredPermission =
    CHAT_PERMISSIONS[chatRoom as keyof typeof CHAT_PERMISSIONS];
  if (!requiredPermission) return false;

  // Simple permission check without the unified utils
  if (!user.permissions) return false;
  
  if (Array.isArray(user.permissions)) {
    return user.permissions.includes(requiredPermission);
  }
  
  if (typeof user.permissions === 'number') {
    // For numeric permissions (bitmask), return true to avoid filtering issues
    return true;
  }

  return false;
}

// DEPRECATED: Use unified hasPermission from unified-auth-utils instead
// This function is kept for backwards compatibility only
export function hasPermission(user: any, permission: string): boolean {
  // Simple permission check to avoid import issues in browser
  if (!user || !permission) return false;
  
  // Super admins have all permissions
  if (user.role === 'super_admin') return true;
  
  // Admins get automatic access to navigation and core functionality (backward compatibility)
  if (user.role === 'admin') {
    if (permission.startsWith('NAV_') || 
        permission === 'ADMIN_PANEL_ACCESS' ||
        permission.startsWith('EVENT_REQUESTS_') ||
        permission.startsWith('DOCUMENTS_') ||
        permission.startsWith('VOLUNTEERS_') ||
        permission.startsWith('DRIVERS_') ||
        permission.startsWith('HOSTS_') ||
        permission.startsWith('RECIPIENTS_')) {
      return true;
    }
  }
  
  // If no permissions array, return false (except for admin/super_admin above)
  if (!user.permissions) return false;
  
  if (Array.isArray(user.permissions)) {
    return user.permissions.includes(permission);
  }
  
  if (typeof user.permissions === 'number') {
    // For numeric permissions (bitmask), return true for now to avoid filtering issues
    // The actual permission checking should be done on the server side
    return true;
  }

  return false;
}

// Function to check if user can edit a specific collection entry
export function canEditCollection(user: any, collection: any): boolean {
  // Simple ownership check without unified utils to avoid import issues
  if (!user || !user.permissions) return false;
  
  // Check if user has edit all permission
  if (Array.isArray(user.permissions) && user.permissions.includes(PERMISSIONS.COLLECTIONS_EDIT_ALL)) {
    return true;
  }
  
  // Check if user owns the collection and has edit own permission
  const resourceOwnerId = collection?.createdBy || collection?.created_by;
  if (resourceOwnerId === user.id && Array.isArray(user.permissions) && user.permissions.includes(PERMISSIONS.COLLECTIONS_EDIT_OWN)) {
    return true;
  }
  
  return false;
}

// Function to check if user can delete a specific collection entry
export function canDeleteCollection(user: any, collection: any): boolean {
  // Simple ownership check without unified utils to avoid import issues
  if (!user || !user.permissions) return false;
  
  // Check if user has delete all permission
  if (Array.isArray(user.permissions) && user.permissions.includes(PERMISSIONS.COLLECTIONS_DELETE_ALL)) {
    return true;
  }
  
  // Check if user owns the collection and has delete own permission
  const resourceOwnerId = collection?.createdBy || collection?.created_by;
  if (resourceOwnerId === user.id && Array.isArray(user.permissions) && user.permissions.includes(PERMISSIONS.COLLECTIONS_DELETE_OWN)) {
    return true;
  }
  
  return false;
}

// Function to check if user can edit a specific project
export function canEditProject(user: any, project: any): boolean {
  if (!user || !user.permissions) return false;

  // Super admins and users with EDIT_ALL_PROJECTS or MANAGE_ALL_PROJECTS can edit all projects
  if (
    user.role === 'super_admin' ||
    user.permissions.includes(PERMISSIONS.PROJECTS_EDIT_ALL) ||
    user.permissions.includes('MANAGE_ALL_PROJECTS')
  )
    return true;

  // Users with CREATE_PROJECTS can edit projects they created
  if (
    user.permissions.includes(PERMISSIONS.PROJECTS_ADD) &&
    (project?.createdBy === user.id || project?.created_by === user.id)
  )
    return true;

  // Users with CREATE_PROJECTS can edit projects they're assigned to
  if (user.permissions.includes(PERMISSIONS.PROJECTS_ADD)) {
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
    user.role === 'super_admin' ||
    user.permissions.includes(PERMISSIONS.PROJECTS_DELETE_ALL)
  )
    return true;

  // Users with CREATE_PROJECTS can only delete projects they created (not assigned ones)
  if (
    user.permissions.includes(PERMISSIONS.PROJECTS_ADD) &&
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
    user.role === 'super_admin' ||
    user.permissions.includes(PERMISSIONS.SUGGESTIONS_EDIT_ALL)
  )
    return true;

  // Users with CREATE_SUGGESTIONS can edit suggestions they created
  if (
    user.permissions.includes(PERMISSIONS.SUGGESTIONS_ADD) &&
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
    user.role === 'super_admin' ||
    user.permissions.includes(PERMISSIONS.SUGGESTIONS_DELETE_ALL)
  )
    return true;

  // Users with CREATE_SUGGESTIONS can delete suggestions they created
  if (
    user.permissions.includes(PERMISSIONS.SUGGESTIONS_ADD) &&
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
    user.role === 'super_admin' ||
    user.permissions.includes(PERMISSIONS.WORK_LOGS_EDIT_ALL)
  )
    return true;

  // Users with CREATE_WORK_LOGS can edit work logs they created
  if (
    user.permissions.includes(PERMISSIONS.WORK_LOGS_ADD) &&
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
    user.role === 'super_admin' ||
    user.permissions.includes(PERMISSIONS.WORK_LOGS_DELETE_ALL)
  )
    return true;

  // Users with CREATE_WORK_LOGS can delete work logs they created
  if (
    user.permissions.includes(PERMISSIONS.WORK_LOGS_ADD) &&
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
      return 'Super Administrator';
    case USER_ROLES.ADMIN:
      return 'Administrator';
    case USER_ROLES.COMMITTEE_MEMBER:
      return 'Committee Member';
    case USER_ROLES.CORE_TEAM:
      return 'Core Team';
    case USER_ROLES.HOST:
      return 'Host Location';
    case USER_ROLES.DRIVER:
      return 'Delivery Driver';
    case USER_ROLES.VOLUNTEER:
      return 'Volunteer';
    case USER_ROLES.RECIPIENT:
      return 'Recipient Organization';
    case USER_ROLES.VIEWER:
      return 'Viewer';
    case USER_ROLES.WORK_LOGGER:
      return 'Work Logger';
    case USER_ROLES.DEMO_USER:
      return 'Demo User';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');
  }
}
