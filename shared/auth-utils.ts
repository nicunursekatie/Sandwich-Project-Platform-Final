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

// Granular yet intuitive permission system
export const PERMISSIONS = {
  // Administrative permissions
  ADMIN_ACCESS: "admin_access",
  MANAGE_USERS: "manage_users",
  MANAGE_ANNOUNCEMENTS: "manage_announcements",

  // Main tab access permissions
  ACCESS_HOSTS: "access_hosts",
  ACCESS_RECIPIENTS: "access_recipients",
  ACCESS_DRIVERS: "access_drivers",
  ACCESS_VOLUNTEERS: "access_volunteers", // New volunteer management tab access
  ACCESS_DONATION_TRACKING: "access_donation_tracking", // New distribution tracking access
  ACCESS_EVENT_REQUESTS: "access_event_requests", // Event planning and organization requests
  ACCESS_COLLECTIONS: "access_collections",
  ACCESS_CHAT: "access_chat",
  ACCESS_MESSAGES: "access_messages",
  ACCESS_TOOLKIT: "access_toolkit",

  // Operations section permissions
  ACCESS_MEETINGS: "access_meetings",
  ACCESS_ANALYTICS: "access_analytics",
  ACCESS_PROJECTS: "access_projects",
  ACCESS_ROLE_DEMO: "access_role_demo",

  // Resources section permissions
  ACCESS_SUGGESTIONS: "access_suggestions",
  ACCESS_SANDWICH_DATA: "access_sandwich_data",
  ACCESS_GOVERNANCE: "access_governance",
  ACCESS_WORK_LOGS: "access_work_logs",
  ACCESS_WEEKLY_MONITORING: "access_weekly_monitoring",
  ACCESS_EVENTS: "access_events",
  ACCESS_SIGNUP_GENIUS: "access_signup_genius",
  ACCESS_DEVELOPMENT: "access_development",

  // Simplified management permissions for each section
  MANAGE_HOSTS: "manage_hosts",
  MANAGE_RECIPIENTS: "manage_recipients",
  MANAGE_DRIVERS: "manage_drivers",
  MANAGE_VOLUNTEERS: "manage_volunteers", // Full volunteer management permissions
  MANAGE_DONATION_TRACKING: "manage_donation_tracking", // Create, edit, delete distributions
  MANAGE_EVENT_REQUESTS: "manage_event_requests", // Create, edit, delete event requests
  MANAGE_DIRECTORY: "manage_directory", // Edit/add contacts in directory
  MANAGE_MEETINGS: "manage_meetings",
  MANAGE_SUGGESTIONS: "manage_suggestions",
  SUBMIT_SUGGESTIONS: "submit_suggestions",
  MANAGE_WISHLIST: "manage_wishlist", // Approve/reject wishlist suggestions
  MANAGE_WEEKLY_MONITORING: "manage_weekly_monitoring", // Send notifications and manage monitoring
  MANAGE_EVENTS: "manage_events", // Create, edit, delete events
  MANAGE_SIGNUP_GENIUS: "manage_signup_genius", // Manage SignUp Genius integrations
  MANAGE_DEVELOPMENT: "manage_development", // Access development tools and logs

  // Simplified suggestions permissions - CREATE automatically includes edit/delete own
  CREATE_SUGGESTIONS: "create_suggestions", // Create new suggestions + automatically edit/delete own suggestions
  EDIT_ALL_SUGGESTIONS: "edit_all_suggestions", // Edit any suggestion (admin level)
  DELETE_ALL_SUGGESTIONS: "delete_all_suggestions", // Delete any suggestion (admin level)

  MANAGE_COLLECTIONS: "manage_collections",

  // Simplified project permissions - CREATE automatically includes edit/delete own + assigned projects
  CREATE_PROJECTS: "create_projects", // Create new projects + automatically edit/delete own projects + edit assigned projects
  EDIT_ALL_PROJECTS: "edit_all_projects", // Edit any project regardless of ownership
  DELETE_ALL_PROJECTS: "delete_all_projects", // Delete any project regardless of ownership

  // Simplified collection permissions - CREATE automatically includes edit/delete own
  CREATE_COLLECTIONS: "create_collections", // Create new collections + automatically edit/delete own collections
  EDIT_ALL_COLLECTIONS: "edit_all_collections", // Edit any collection regardless of ownership
  DELETE_ALL_COLLECTIONS: "delete_all_collections", // Delete any collection regardless of ownership
  USE_COLLECTION_WALKTHROUGH: "use_collection_walkthrough", // Access to simplified walkthrough form

  // Granular volunteer management permissions
  VIEW_VOLUNTEERS: "view_volunteers", // View volunteer information
  ADD_VOLUNTEERS: "add_volunteers", // Add new volunteers
  EDIT_VOLUNTEERS: "edit_volunteers", // Edit volunteer information

  // Granular recipient management permissions
  VIEW_RECIPIENTS: "view_recipients", // View recipient information
  ADD_RECIPIENTS: "add_recipients", // Add new recipients
  EDIT_RECIPIENTS: "edit_recipients", // Edit recipient information
  DELETE_RECIPIENTS: "delete_recipients", // Delete recipients

  // Granular host management permissions
  VIEW_HOSTS: "view_hosts", // View host information
  ADD_HOSTS: "add_hosts", // Add new hosts
  EDIT_HOSTS: "edit_hosts", // Edit host information
  DELETE_HOSTS: "delete_hosts", // Delete hosts

  // Granular driver management permissions
  VIEW_DRIVERS: "view_drivers", // View driver information
  ADD_DRIVERS: "add_drivers", // Add new drivers
  EDIT_DRIVERS: "edit_drivers", // Edit driver information
  DELETE_DRIVERS: "delete_drivers", // Delete drivers

  // Granular distribution tracking permissions
  VIEW_DONATION_TRACKING: "view_donation_tracking", // View distribution records
  ADD_DONATION_TRACKING: "add_donation_tracking", // Add new distribution records
  EDIT_DONATION_TRACKING: "edit_donation_tracking", // Edit distribution records
  DELETE_DONATION_TRACKING: "delete_donation_tracking", // Delete distribution records

  // Granular event request permissions
  VIEW_EVENT_REQUESTS: "view_event_requests", // View event request information
  ADD_EVENT_REQUESTS: "add_event_requests", // Add new event requests
  EDIT_EVENT_REQUESTS: "edit_event_requests", // Edit event request information
  DELETE_EVENT_REQUESTS: "delete_event_requests", // Delete event requests
  ASSIGN_EVENT_REQUESTS: "assign_event_requests", // Assign event requests to team members

  // Simplified work log permissions - CREATE automatically includes edit/delete own
  CREATE_WORK_LOGS: "create_work_logs", // Create new work logs + automatically edit/delete own work logs
  VIEW_ALL_WORK_LOGS: "view_all_work_logs",
  EDIT_ALL_WORK_LOGS: "edit_all_work_logs",
  DELETE_ALL_WORK_LOGS: "delete_all_work_logs",

  // Data action permissions
  EXPORT_DATA: "export_data",
  IMPORT_DATA: "import_data",
  EDIT_DATA: "edit_data", // General data editing permission

  // Document management permissions
  MANAGE_DOCUMENTS: "manage_documents", // Full document management (create, edit, delete, permissions)
  VIEW_DOCUMENTS: "view_documents", // View document management interface
  ACCESS_DOCUMENTS: "access_documents", // Access to specific documents based on permissions

  // Message and communication permissions
  SEND_MESSAGES: "send_messages",
  MODERATE_MESSAGES: "moderate_messages",
  DIRECT_MESSAGES: "direct_messages",
  GROUP_MESSAGES: "group_messages",

  // Chat-specific permissions
  GENERAL_CHAT: "general_chat",
  COMMITTEE_CHAT: "committee_chat",
  HOST_CHAT: "host_chat",
  DRIVER_CHAT: "driver_chat",
  RECIPIENT_CHAT: "recipient_chat",
  CORE_TEAM_CHAT: "core_team_chat",

  // Kudos system permissions
  SEND_KUDOS: "send_kudos", // Can send kudos to other users
  RECEIVE_KUDOS: "receive_kudos", // Can receive kudos from other users  
  VIEW_KUDOS: "view_kudos", // Can view kudos in inbox
  MANAGE_ALL_KUDOS: "manage_all_kudos", // Admin ability to manage all kudos (view, delete)

  // Legacy support for existing components (backwards compatibility)
  VIEW_VOLUNTEERS_TAB: "access_volunteers", // Legacy support
  VIEW_DONATION_TRACKING_TAB: "access_donation_tracking", // Legacy support
  VIEW_COLLECTIONS: "access_collections",
  VIEW_MEETINGS: "access_meetings",
  VIEW_ANALYTICS: "access_analytics",
  VIEW_WEEKLY_MONITORING: "access_weekly_monitoring", // Legacy support
  VIEW_EVENTS: "access_events", // Legacy support
  VIEW_SIGNUP_GENIUS: "access_signup_genius", // Legacy support
  VIEW_DEVELOPMENT: "access_development", // Legacy support
  VIEW_WORK_LOGS: "access_work_logs", // Legacy support
  VIEW_TOOLKIT: "access_toolkit", // Legacy support
  VIEW_PROJECTS: "access_projects",
  VIEW_ROLE_DEMO: "access_role_demo",
  VIEW_SUGGESTIONS: "access_suggestions",
  VIEW_SANDWICH_DATA: "access_sandwich_data",
  VIEW_GOVERNANCE: "access_governance",
  VIEW_USERS: "manage_users",
  VIEW_COMMITTEE: "committee_chat",
  TOOLKIT_ACCESS: "access_toolkit",
  EDIT_MEETINGS: "manage_meetings",
  RESPOND_TO_SUGGESTIONS: "manage_suggestions",
  // Legacy project permission (deprecated - use CREATE_PROJECTS instead)
  MANAGE_PROJECTS: "create_projects", // Maps to new CREATE_PROJECTS permission
} as const;

// Helper functions for improved project permissions system

export function getDefaultPermissionsForRole(role: string): string[] {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
      return Object.values(PERMISSIONS);

    case USER_ROLES.ADMIN:
      return Object.values(PERMISSIONS).filter(
        (p) => p !== PERMISSIONS.MODERATE_MESSAGES,
      );

    case USER_ROLES.COMMITTEE_MEMBER:
      return [
        // Can view these sections but not manage them
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.ACCESS_MEETINGS,
        PERMISSIONS.ACCESS_ANALYTICS,
        PERMISSIONS.ACCESS_ROLE_DEMO,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.ACCESS_SANDWICH_DATA,
        PERMISSIONS.ACCESS_GOVERNANCE,
        PERMISSIONS.ACCESS_PROJECTS, // Committee members can view projects
        PERMISSIONS.ACCESS_WORK_LOGS,
        PERMISSIONS.ACCESS_WEEKLY_MONITORING,
        PERMISSIONS.ACCESS_EVENTS,
        PERMISSIONS.ACCESS_DEVELOPMENT,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.COMMITTEE_CHAT,
        PERMISSIONS.EXPORT_DATA,
        PERMISSIONS.CREATE_SUGGESTIONS, // Can create suggestions + edit/delete own
        PERMISSIONS.SEND_KUDOS,
        PERMISSIONS.RECEIVE_KUDOS,
        PERMISSIONS.VIEW_KUDOS
      ];

    case USER_ROLES.HOST:
      return [
        // Directory access
        PERMISSIONS.ACCESS_HOSTS,
        PERMISSIONS.ACCESS_RECIPIENTS,
        
        // Collections capability
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.CREATE_COLLECTIONS, // Can create collections (automatically can edit/delete own)
        PERMISSIONS.USE_COLLECTION_WALKTHROUGH, // Can use simplified walkthrough for collections
        
        // Chat permissions
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.HOST_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        
        // Analytics and other access
        PERMISSIONS.ACCESS_ANALYTICS,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.CREATE_SUGGESTIONS, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.ACCESS_EVENTS,
        
        // Kudos system
        PERMISSIONS.SEND_KUDOS,
        PERMISSIONS.RECEIVE_KUDOS,
        PERMISSIONS.VIEW_KUDOS
      ];

    case USER_ROLES.CORE_TEAM:
      return [
        // All Host permissions first
        PERMISSIONS.ACCESS_HOSTS,
        PERMISSIONS.ACCESS_RECIPIENTS,
        PERMISSIONS.ACCESS_DRIVERS,
        PERMISSIONS.ACCESS_VOLUNTEERS,
        PERMISSIONS.ACCESS_DONATION_TRACKING,
        PERMISSIONS.ACCESS_EVENT_REQUESTS,
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.CREATE_COLLECTIONS, // Can create collections (automatically can edit/delete own)
        PERMISSIONS.USE_COLLECTION_WALKTHROUGH, // Can use simplified walkthrough for collections
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.HOST_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.ACCESS_ANALYTICS,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.CREATE_SUGGESTIONS, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.SEND_KUDOS,
        PERMISSIONS.RECEIVE_KUDOS,
        PERMISSIONS.VIEW_KUDOS,
        
        // Additional Core Team specific permissions
        PERMISSIONS.ACCESS_DRIVERS,
        PERMISSIONS.MANAGE_HOSTS,
        PERMISSIONS.MANAGE_RECIPIENTS,
        PERMISSIONS.MANAGE_DRIVERS,
        PERMISSIONS.MANAGE_VOLUNTEERS,
        PERMISSIONS.MANAGE_USERS, // Core team can manage users
        PERMISSIONS.MANAGE_DONATION_TRACKING,
        PERMISSIONS.MANAGE_EVENT_REQUESTS,
        // Granular volunteer permissions
        PERMISSIONS.VIEW_VOLUNTEERS,
        PERMISSIONS.ADD_VOLUNTEERS,
        PERMISSIONS.EDIT_VOLUNTEERS,
        // Granular distribution tracking permissions
        PERMISSIONS.VIEW_DONATION_TRACKING,
        PERMISSIONS.ADD_DONATION_TRACKING,
        PERMISSIONS.EDIT_DONATION_TRACKING,
        PERMISSIONS.DELETE_DONATION_TRACKING,
        // Granular event request permissions
        PERMISSIONS.VIEW_EVENT_REQUESTS,
        PERMISSIONS.ADD_EVENT_REQUESTS,
        PERMISSIONS.EDIT_EVENT_REQUESTS,
        PERMISSIONS.DELETE_EVENT_REQUESTS,
        PERMISSIONS.ASSIGN_EVENT_REQUESTS,
        PERMISSIONS.CORE_TEAM_CHAT,
        PERMISSIONS.CREATE_PROJECTS, // Can create projects (automatically can edit/delete own)
        PERMISSIONS.ACCESS_PROJECTS,
        PERMISSIONS.SEND_MESSAGES,
        PERMISSIONS.EXPORT_DATA,
        PERMISSIONS.EDIT_DATA, // Allow core team to edit data including collections
        PERMISSIONS.MANAGE_SUGGESTIONS,
        PERMISSIONS.ACCESS_SANDWICH_DATA,
        PERMISSIONS.ACCESS_WORK_LOGS,
        PERMISSIONS.ACCESS_WEEKLY_MONITORING,
        PERMISSIONS.ACCESS_EVENTS,
        PERMISSIONS.ACCESS_DEVELOPMENT,
        PERMISSIONS.MANAGE_WEEKLY_MONITORING,
        PERMISSIONS.MANAGE_EVENTS,
        PERMISSIONS.MANAGE_DEVELOPMENT
      ];

    case USER_ROLES.DRIVER:
      return [
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.ACCESS_PROJECTS,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.ACCESS_SANDWICH_DATA,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.DRIVER_CHAT,
        PERMISSIONS.CREATE_SUGGESTIONS, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.SEND_KUDOS,
        PERMISSIONS.RECEIVE_KUDOS,
        PERMISSIONS.VIEW_KUDOS
      ];

    case USER_ROLES.VOLUNTEER:
      return [
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.ACCESS_TOOLKIT,
        PERMISSIONS.ACCESS_PROJECTS,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.CREATE_COLLECTIONS, // Can create collections (automatically can edit/delete own)
        PERMISSIONS.USE_COLLECTION_WALKTHROUGH, // Can use simplified walkthrough for collections
        PERMISSIONS.CREATE_PROJECTS, // Can create projects (automatically can edit/delete own)
        PERMISSIONS.CREATE_SUGGESTIONS, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.SEND_KUDOS,
        PERMISSIONS.RECEIVE_KUDOS,
        PERMISSIONS.VIEW_KUDOS
      ];

    case USER_ROLES.RECIPIENT:
      return [
        PERMISSIONS.ACCESS_COLLECTIONS,
        PERMISSIONS.ACCESS_CHAT,
        PERMISSIONS.ACCESS_MESSAGES,
        PERMISSIONS.ACCESS_SUGGESTIONS,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.RECIPIENT_CHAT,
        PERMISSIONS.USE_COLLECTION_WALKTHROUGH, // Can use simplified walkthrough for collections (recipients who help with collections)
        PERMISSIONS.CREATE_SUGGESTIONS, // Can create suggestions (automatically can edit/delete own)
        PERMISSIONS.RECEIVE_KUDOS, // Recipients can receive kudos but not send them by default
        PERMISSIONS.VIEW_KUDOS
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
