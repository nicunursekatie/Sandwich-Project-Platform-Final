import { PERMISSIONS } from './auth-utils';

/**
 * Permission Groups for UI Organization
 * Groups permissions by resource/feature area
 */
export const PERMISSION_GROUPS = {
  ADMIN: {
    label: 'Administration',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.MANAGE_ANNOUNCEMENTS,
    ],
  },
  USERS: {
    label: 'User Management',
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_ADD,
      PERMISSIONS.USERS_EDIT,
      PERMISSIONS.USERS_DELETE,
    ],
  },
  HOSTS: {
    label: 'Host Locations',
    permissions: [
      PERMISSIONS.HOSTS_VIEW,
      PERMISSIONS.HOSTS_ADD,
      PERMISSIONS.HOSTS_EDIT,
      PERMISSIONS.HOSTS_DELETE,
    ],
  },
  RECIPIENTS: {
    label: 'Recipient Organizations',
    permissions: [
      PERMISSIONS.RECIPIENTS_VIEW,
      PERMISSIONS.RECIPIENTS_ADD,
      PERMISSIONS.RECIPIENTS_EDIT,
      PERMISSIONS.RECIPIENTS_DELETE,
    ],
  },
  DRIVERS: {
    label: 'Drivers',
    permissions: [
      PERMISSIONS.DRIVERS_VIEW,
      PERMISSIONS.DRIVERS_ADD,
      PERMISSIONS.DRIVERS_EDIT,
      PERMISSIONS.DRIVERS_DELETE,
    ],
  },
  VOLUNTEERS: {
    label: 'Volunteers',
    permissions: [
      PERMISSIONS.VOLUNTEERS_VIEW,
      PERMISSIONS.VOLUNTEERS_ADD,
      PERMISSIONS.VOLUNTEERS_EDIT,
      PERMISSIONS.VOLUNTEERS_DELETE,
    ],
  },
  COLLECTIONS: {
    label: 'Sandwich Collections',
    permissions: [
      PERMISSIONS.COLLECTIONS_VIEW,
      PERMISSIONS.COLLECTIONS_ADD,
      PERMISSIONS.COLLECTIONS_EDIT_OWN,
      PERMISSIONS.COLLECTIONS_EDIT_ALL,
      PERMISSIONS.COLLECTIONS_DELETE_OWN,
      PERMISSIONS.COLLECTIONS_DELETE_ALL,
      PERMISSIONS.COLLECTIONS_WALKTHROUGH,
    ],
  },
  PROJECTS: {
    label: 'Projects',
    permissions: [
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.PROJECTS_ADD,
      PERMISSIONS.PROJECTS_EDIT_OWN,
      PERMISSIONS.PROJECTS_EDIT_ALL,
      PERMISSIONS.PROJECTS_DELETE_OWN,
      PERMISSIONS.PROJECTS_DELETE_ALL,
    ],
  },
  EVENT_REQUESTS: {
    label: 'Event Requests',
    permissions: [
      PERMISSIONS.EVENT_REQUESTS_VIEW,
      PERMISSIONS.EVENT_REQUESTS_ADD,
      PERMISSIONS.EVENT_REQUESTS_EDIT,
      PERMISSIONS.EVENT_REQUESTS_DELETE,
      PERMISSIONS.EVENT_REQUESTS_SELF_SIGNUP,
      PERMISSIONS.EVENT_REQUESTS_ASSIGN_OTHERS,
      PERMISSIONS.EVENT_REQUESTS_SEND_TOOLKIT,
      PERMISSIONS.EVENT_REQUESTS_FOLLOW_UP,
    ],
  },
  MESSAGES: {
    label: 'Messaging',
    permissions: [
      PERMISSIONS.MESSAGES_VIEW,
      PERMISSIONS.MESSAGES_SEND,
      PERMISSIONS.MESSAGES_EDIT,
      PERMISSIONS.MESSAGES_DELETE,
      PERMISSIONS.MESSAGES_MODERATE,
    ],
  },
  WORK_LOGS: {
    label: 'Work Logs',
    permissions: [
      PERMISSIONS.WORK_LOGS_VIEW,
      PERMISSIONS.WORK_LOGS_VIEW_ALL,
      PERMISSIONS.WORK_LOGS_ADD,
      PERMISSIONS.WORK_LOGS_EDIT_OWN,
      PERMISSIONS.WORK_LOGS_EDIT_ALL,
      PERMISSIONS.WORK_LOGS_DELETE_OWN,
      PERMISSIONS.WORK_LOGS_DELETE_ALL,
    ],
  },
  SUGGESTIONS: {
    label: 'Suggestions',
    permissions: [
      PERMISSIONS.SUGGESTIONS_VIEW,
      PERMISSIONS.SUGGESTIONS_ADD,
      PERMISSIONS.SUGGESTIONS_EDIT_OWN,
      PERMISSIONS.SUGGESTIONS_EDIT_ALL,
      PERMISSIONS.SUGGESTIONS_DELETE_OWN,
      PERMISSIONS.SUGGESTIONS_DELETE_ALL,
      PERMISSIONS.SUGGESTIONS_MANAGE,
    ],
  },
  AVAILABILITY: {
    label: 'Availability',
    permissions: [
      PERMISSIONS.AVAILABILITY_VIEW,
      PERMISSIONS.AVAILABILITY_ADD,
      PERMISSIONS.AVAILABILITY_EDIT_OWN,
      PERMISSIONS.AVAILABILITY_EDIT_ALL,
      PERMISSIONS.AVAILABILITY_DELETE_OWN,
      PERMISSIONS.AVAILABILITY_DELETE_ALL,
    ],
  },
  GRANT_METRICS: {
    label: 'Grant Metrics',
    permissions: [
      PERMISSIONS.GRANT_METRICS_VIEW,
      PERMISSIONS.GRANT_METRICS_EXPORT,
      PERMISSIONS.GRANT_METRICS_EDIT,
    ],
  },
  COOLER_TRACKING: {
    label: 'Cooler Tracking',
    permissions: [
      PERMISSIONS.COOLERS_VIEW,
      PERMISSIONS.COOLERS_REPORT,
      PERMISSIONS.COOLERS_MANAGE,
    ],
  },
  VOLUNTEER_CALENDAR: {
    label: 'Volunteer Calendar',
    permissions: [
      PERMISSIONS.VOLUNTEER_CALENDAR_VIEW,
      PERMISSIONS.VOLUNTEER_CALENDAR_SYNC,
      PERMISSIONS.VOLUNTEER_CALENDAR_MANAGE,
    ],
  },
  DOCUMENTS: {
    label: 'Documents',
    permissions: [
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_MANAGE,
      PERMISSIONS.DOCUMENTS_CONFIDENTIAL,
      PERMISSIONS.DOCUMENTS_UPLOAD,
      PERMISSIONS.DOCUMENTS_DELETE_ALL,
    ],
  },
  CHAT: {
    label: 'Chat Rooms',
    permissions: [
      PERMISSIONS.CHAT_GENERAL,
      PERMISSIONS.CHAT_GRANTS_COMMITTEE,
      PERMISSIONS.CHAT_EVENTS_COMMITTEE,
      PERMISSIONS.CHAT_BOARD,
      PERMISSIONS.CHAT_WEB_COMMITTEE,
      PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT,
      PERMISSIONS.CHAT_HOST,
      PERMISSIONS.CHAT_DRIVER,
      PERMISSIONS.CHAT_RECIPIENT,
      PERMISSIONS.CHAT_CORE_TEAM,
      PERMISSIONS.CHAT_DIRECT,
      PERMISSIONS.CHAT_GROUP,
    ],
  },
  KUDOS: {
    label: 'Recognition & Kudos',
    permissions: [
      PERMISSIONS.KUDOS_SEND,
      PERMISSIONS.KUDOS_RECEIVE,
      PERMISSIONS.KUDOS_VIEW,
      PERMISSIONS.KUDOS_MANAGE,
    ],
  },
  RESOURCES: {
    label: 'Resources & Tools',
    permissions: [
      PERMISSIONS.RESOURCES_VIEW,
      PERMISSIONS.RESOURCES_EDIT,
      PERMISSIONS.TOOLKIT_VIEW,
      PERMISSIONS.TOOLKIT_EDIT,
    ],
  },
  MEETINGS: {
    label: 'Meetings',
    permissions: [
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.MEETINGS_ADD,
      PERMISSIONS.MEETINGS_EDIT,
      PERMISSIONS.MEETINGS_DELETE,
    ],
  },
  EXPENSES: {
    label: 'Expenses & Receipts',
    permissions: [
      PERMISSIONS.EXPENSES_VIEW,
      PERMISSIONS.EXPENSES_ADD,
      PERMISSIONS.EXPENSES_EDIT_OWN,
      PERMISSIONS.EXPENSES_EDIT_ALL,
      PERMISSIONS.EXPENSES_DELETE_OWN,
      PERMISSIONS.EXPENSES_DELETE_ALL,
      PERMISSIONS.EXPENSES_APPROVE,
    ],
  },
  ANALYTICS: {
    label: 'Analytics & Reporting',
    permissions: [
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.ANALYTICS_ADVANCED,
    ],
  },
  DATA_MANAGEMENT: {
    label: 'Data Import/Export',
    permissions: [
      PERMISSIONS.DATA_IMPORT,
      PERMISSIONS.DATA_EXPORT,
      PERMISSIONS.DATA_DELETE_BULK,
    ],
  },
  NAVIGATION: {
    label: 'Navigation Tabs',
    permissions: [
      PERMISSIONS.NAV_DASHBOARD,
      PERMISSIONS.NAV_MY_ACTIONS,
      PERMISSIONS.NAV_MY_AVAILABILITY,
      PERMISSIONS.NAV_TEAM_AVAILABILITY,
      PERMISSIONS.NAV_VOLUNTEER_CALENDAR,
      PERMISSIONS.NAV_COLLECTIONS_LOG,
      PERMISSIONS.NAV_TEAM_CHAT,
      PERMISSIONS.NAV_INBOX,
      PERMISSIONS.NAV_SUGGESTIONS,
      PERMISSIONS.NAV_TEAM_BOARD,
      PERMISSIONS.NAV_HOSTS,
      PERMISSIONS.NAV_ROUTE_MAP,
      PERMISSIONS.NAV_DRIVERS,
      PERMISSIONS.NAV_VOLUNTEERS,
      PERMISSIONS.NAV_RECIPIENTS,
      PERMISSIONS.NAV_GROUPS_CATALOG,
      PERMISSIONS.NAV_DISTRIBUTION_TRACKING,
      PERMISSIONS.NAV_INVENTORY_CALCULATOR,
      PERMISSIONS.NAV_WORK_LOG,
      PERMISSIONS.NAV_EVENT_PLANNING,
      PERMISSIONS.NAV_HISTORICAL_IMPORT,
      PERMISSIONS.NAV_EVENTS_GOOGLE_SHEET,
      PERMISSIONS.NAV_SIGNUP_GENIUS,
      PERMISSIONS.NAV_PROJECTS,
      PERMISSIONS.NAV_MEETINGS,
      PERMISSIONS.NAV_EVENT_REMINDERS,
      PERMISSIONS.NAV_ANALYTICS,
      PERMISSIONS.NAV_GRANT_METRICS,
      PERMISSIONS.NAV_WEEKLY_MONITORING,
      PERMISSIONS.NAV_IMPORTANT_DOCUMENTS,
      PERMISSIONS.NAV_IMPORTANT_LINKS,
      PERMISSIONS.NAV_HELP,
      PERMISSIONS.NAV_WISHLIST,
      PERMISSIONS.NAV_COOLER_TRACKING,
      PERMISSIONS.NAV_DOCUMENT_MANAGEMENT,
      PERMISSIONS.NAV_USER_MANAGEMENT,
      PERMISSIONS.NAV_TOOLKIT,
    ],
  },
} as const;

/**
 * Get human-readable label for a permission
 */
export function getPermissionLabel(permission: string): string {
  // Convert SNAKE_CASE to Title Case
  return permission
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get permission description (optional - can be enhanced later)
 */
export function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    [PERMISSIONS.ADMIN_ACCESS]: 'Full administrative access to the platform',
    [PERMISSIONS.USERS_EDIT]: 'Edit user accounts and permissions',
    [PERMISSIONS.HOSTS_VIEW]: 'View host location directory',
    [PERMISSIONS.EVENT_REQUESTS_ASSIGN_OTHERS]: 'Assign team members to events',

    // Chat room descriptions
    [PERMISSIONS.CHAT_GENERAL]: 'Access to general team chat',
    [PERMISSIONS.CHAT_GRANTS_COMMITTEE]: 'Access to grants committee chat',
    [PERMISSIONS.CHAT_EVENTS_COMMITTEE]: 'Access to events committee chat',
    [PERMISSIONS.CHAT_BOARD]: 'Access to board members chat',
    [PERMISSIONS.CHAT_WEB_COMMITTEE]: 'Access to web committee chat',
    [PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT]: 'Access to volunteer management chat',
    [PERMISSIONS.CHAT_HOST]: 'Access to host organization chat',
    [PERMISSIONS.CHAT_DRIVER]: 'Access to driver coordination chat',
    [PERMISSIONS.CHAT_RECIPIENT]: 'Access to recipient organization chat',
    [PERMISSIONS.CHAT_CORE_TEAM]: 'Access to core team chat',
    [PERMISSIONS.CHAT_DIRECT]: 'Access to direct messaging',
    [PERMISSIONS.CHAT_GROUP]: 'Access to group chat features',

    // Kudos descriptions
    [PERMISSIONS.KUDOS_SEND]: 'Send kudos to recognize team members',
    [PERMISSIONS.KUDOS_RECEIVE]: 'Receive kudos from other team members',
    [PERMISSIONS.KUDOS_VIEW]: 'View kudos inbox and sent recognition',
    [PERMISSIONS.KUDOS_MANAGE]: 'Administrative management of all kudos',

    // Add more as needed...
  };
  return descriptions[permission] || getPermissionLabel(permission);
}
