import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Users,
  Building,
  UserCheck,
  Truck,
  Database,
  MessageCircle,
  Mail,
  Calendar,
  TrendingUp,
  FileText,
  Lightbulb,
  MapPin,
  ClipboardList,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

interface EnhancedPermissionsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: string, permissions: string[]) => void;
}

// Resource-based permission structure using RESOURCE_ACTION format
const RESOURCE_PERMISSIONS = [
  {
    resource: 'HOSTS',
    label: 'Host Organizations',
    description: 'Manage partner organization information',
    icon: Building,
    color: 'bg-orange-50 border-orange-200',
    iconColor: 'text-orange-600',
    actions: [
      { action: 'VIEW', label: 'View host information', key: 'HOSTS_VIEW' },
      { action: 'ADD', label: 'Add new hosts', key: 'HOSTS_ADD' },
      { action: 'EDIT', label: 'Edit host details', key: 'HOSTS_EDIT' },
      { action: 'DELETE', label: 'Delete hosts', key: 'HOSTS_DELETE' },
    ],
  },
  {
    resource: 'RECIPIENTS',
    label: 'Recipient Organizations',
    description: 'Manage receiving organization information',
    icon: Users,
    color: 'bg-green-50 border-green-200',
    iconColor: 'text-green-600',
    actions: [
      {
        action: 'VIEW',
        label: 'View recipient information',
        key: 'RECIPIENTS_VIEW',
      },
      { action: 'ADD', label: 'Add new recipients', key: 'RECIPIENTS_ADD' },
      {
        action: 'EDIT',
        label: 'Edit recipient details',
        key: 'RECIPIENTS_EDIT',
      },
      {
        action: 'DELETE',
        label: 'Delete recipients',
        key: 'RECIPIENTS_DELETE',
      },
    ],
  },
  {
    resource: 'DRIVERS',
    label: 'Drivers',
    description: 'Manage volunteer drivers and vehicles',
    icon: Truck,
    color: 'bg-blue-50 border-blue-200',
    iconColor: 'text-brand-primary',
    actions: [
      { action: 'VIEW', label: 'View driver information', key: 'DRIVERS_VIEW' },
      { action: 'ADD', label: 'Add new drivers', key: 'DRIVERS_ADD' },
      { action: 'EDIT', label: 'Edit driver details', key: 'DRIVERS_EDIT' },
      { action: 'DELETE', label: 'Delete drivers', key: 'DRIVERS_DELETE' },
    ],
  },
  {
    resource: 'USERS',
    label: 'User Management',
    description: 'Manage user accounts and permissions',
    icon: UserCheck,
    color: 'bg-purple-50 border-purple-200',
    iconColor: 'text-purple-600',
    actions: [
      { action: 'VIEW', label: 'View user accounts', key: 'USERS_VIEW' },
      { action: 'ADD', label: 'Create new users', key: 'USERS_ADD' },
      { action: 'EDIT', label: 'Edit user accounts', key: 'USERS_EDIT' },
      { action: 'DELETE', label: 'Delete user accounts', key: 'USERS_DELETE' },
    ],
  },
  {
    resource: 'COLLECTIONS',
    label: 'Sandwich Collections',
    description: 'Log and track sandwich collection data',
    icon: Database,
    color: 'bg-yellow-50 border-yellow-200',
    iconColor: 'text-yellow-600',
    actions: [
      {
        action: 'VIEW',
        label: 'View collection data',
        key: 'COLLECTIONS_VIEW',
      },
      {
        action: 'ADD',
        label: 'Submit new collections',
        key: 'COLLECTIONS_ADD',
      },
      {
        action: 'EDIT_OWN',
        label: 'Edit own collection entries',
        key: 'COLLECTIONS_EDIT_OWN',
      },
      {
        action: 'EDIT_ALL',
        label: 'Edit any collection entries',
        key: 'COLLECTIONS_EDIT_ALL',
      },
      {
        action: 'DELETE_OWN',
        label: 'Delete own collection data',
        key: 'COLLECTIONS_DELETE_OWN',
      },
      {
        action: 'DELETE_ALL',
        label: 'Delete any collection data',
        key: 'COLLECTIONS_DELETE_ALL',
      },
      {
        action: 'WALKTHROUGH',
        label: 'Use collection walkthrough tool',
        key: 'COLLECTIONS_WALKTHROUGH',
      },
    ],
  },
  {
    resource: 'PROJECTS',
    label: 'Projects',
    description: 'Manage organizational projects and initiatives',
    icon: FileText,
    color: 'bg-indigo-50 border-indigo-200',
    iconColor: 'text-indigo-600',
    actions: [
      { action: 'VIEW', label: 'View projects', key: 'PROJECTS_VIEW' },
      { action: 'ADD', label: 'Create new projects', key: 'PROJECTS_ADD' },
      {
        action: 'EDIT_OWN',
        label: 'Edit assigned projects',
        key: 'PROJECTS_EDIT_OWN',
      },
      {
        action: 'EDIT_ALL',
        label: 'Edit any projects',
        key: 'PROJECTS_EDIT_ALL',
      },
      {
        action: 'DELETE_OWN',
        label: 'Delete assigned projects',
        key: 'PROJECTS_DELETE_OWN',
      },
      {
        action: 'DELETE_ALL',
        label: 'Delete any projects',
        key: 'PROJECTS_DELETE_ALL',
      },
    ],
  },
  {
    resource: 'DISTRIBUTIONS',
    label: 'Distribution Tracking',
    description: 'Track sandwich deliveries and distributions',
    icon: MapPin,
    color: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
    actions: [
      {
        action: 'VIEW',
        label: 'View distribution data',
        key: 'DISTRIBUTIONS_VIEW',
      },
      {
        action: 'ADD',
        label: 'Log new distributions',
        key: 'DISTRIBUTIONS_ADD',
      },
      {
        action: 'EDIT',
        label: 'Edit distribution records',
        key: 'DISTRIBUTIONS_EDIT',
      },
      {
        action: 'DELETE',
        label: 'Delete distribution data',
        key: 'DISTRIBUTIONS_DELETE',
      },
    ],
  },
  {
    resource: 'EVENT_REQUESTS',
    label: 'Event Requests',
    description: 'Manage incoming event requests',
    icon: Calendar,
    color: 'bg-pink-50 border-pink-200',
    iconColor: 'text-pink-600',
    actions: [
      {
        action: 'VIEW',
        label: 'View event requests',
        key: 'EVENT_REQUESTS_VIEW',
      },
      {
        action: 'ADD',
        label: 'Submit new requests',
        key: 'EVENT_REQUESTS_ADD',
      },
      {
        action: 'EDIT',
        label: 'Update event details',
        key: 'EVENT_REQUESTS_EDIT',
      },
      {
        action: 'DELETE',
        label: 'Delete event requests',
        key: 'EVENT_REQUESTS_DELETE',
      },
      {
        action: 'COMPLETE_CONTACT',
        label: 'Mark primary contact completed',
        key: 'EVENT_REQUESTS_COMPLETE_CONTACT',
      },
      {
        action: 'INLINE_EDIT_TIMES',
        label: 'Inline edit event/pickup times',
        key: 'EVENT_REQUESTS_INLINE_EDIT_TIMES',
      },
      {
        action: 'INLINE_EDIT_ADDRESS',
        label: 'Inline edit event address',
        key: 'EVENT_REQUESTS_INLINE_EDIT_ADDRESS',
      },
      {
        action: 'INLINE_EDIT_SANDWICHES',
        label: 'Inline edit sandwich details',
        key: 'EVENT_REQUESTS_INLINE_EDIT_SANDWICHES',
      },
      {
        action: 'INLINE_EDIT_STAFFING',
        label: 'Inline edit staffing needs',
        key: 'EVENT_REQUESTS_INLINE_EDIT_STAFFING',
      },
      {
        action: 'INLINE_EDIT_LOGISTICS',
        label: 'Inline edit logistics (refrigeration)',
        key: 'EVENT_REQUESTS_INLINE_EDIT_LOGISTICS',
      },
      {
        action: 'SELF_SIGNUP',
        label: 'Self-signup for roles (driver/speaker/volunteer)',
        key: 'EVENT_REQUESTS_SELF_SIGNUP',
      },
      {
        action: 'ASSIGN_OTHERS',
        label: 'Assign others to roles',
        key: 'EVENT_REQUESTS_ASSIGN_OTHERS',
      },
      {
        action: 'VIEW_ONLY',
        label: 'View-only access (no edits/assignments)',
        key: 'EVENT_REQUESTS_VIEW_ONLY',
      },
      {
        action: 'EDIT_ALL_DETAILS',
        label: 'Edit all event details (comprehensive)',
        key: 'EVENT_REQUESTS_EDIT_ALL_DETAILS',
      },
      {
        action: 'SEND_TOOLKIT',
        label: 'Send toolkit & mark scheduled',
        key: 'EVENT_REQUESTS_SEND_TOOLKIT',
      },
      {
        action: 'FOLLOW_UP',
        label: 'Use follow-up buttons',
        key: 'EVENT_REQUESTS_FOLLOW_UP',
      },
    ],
  },
  {
    resource: 'MESSAGES',
    label: 'Email System',
    description: 'Send and manage organizational communications',
    icon: Mail,
    color: 'bg-cyan-50 border-cyan-200',
    iconColor: 'text-cyan-600',
    actions: [
      { action: 'VIEW', label: 'Access email system', key: 'MESSAGES_VIEW' },
      { action: 'SEND', label: 'Send emails', key: 'MESSAGES_SEND' },
      {
        action: 'MODERATE',
        label: 'Moderate communications',
        key: 'MESSAGES_MODERATE',
      },
    ],
  },
  {
    resource: 'WORK_LOGS',
    label: 'Work Logs',
    description: 'Log and track volunteer work hours',
    icon: ClipboardList,
    color: 'bg-slate-50 border-slate-200',
    iconColor: 'text-slate-600',
    actions: [
      { action: 'VIEW', label: 'View own work logs', key: 'WORK_LOGS_VIEW' },
      {
        action: 'VIEW_ALL',
        label: 'View all volunteer logs',
        key: 'WORK_LOGS_VIEW_ALL',
      },
      { action: 'ADD', label: 'Create work logs', key: 'WORK_LOGS_ADD' },
      {
        action: 'EDIT_OWN',
        label: 'Edit own work logs',
        key: 'WORK_LOGS_EDIT_OWN',
      },
      {
        action: 'EDIT_ALL',
        label: 'Edit any work logs',
        key: 'WORK_LOGS_EDIT_ALL',
      },
      {
        action: 'DELETE_OWN',
        label: 'Delete own work logs',
        key: 'WORK_LOGS_DELETE_OWN',
      },
      {
        action: 'DELETE_ALL',
        label: 'Delete any work logs',
        key: 'WORK_LOGS_DELETE_ALL',
      },
    ],
  },
  {
    resource: 'CHAT',
    label: 'Chat System',
    description: 'Access real-time messaging channels',
    icon: MessageCircle,
    color: 'bg-emerald-50 border-emerald-200',
    iconColor: 'text-emerald-600',
    actions: [
      { action: 'GENERAL', label: 'General chat channel', key: 'CHAT_GENERAL' },
      {
        action: 'GRANTS_COMMITTEE',
        label: 'Grants committee chat',
        key: 'CHAT_GRANTS_COMMITTEE',
      },
      {
        action: 'EVENTS_COMMITTEE',
        label: 'Events committee chat',
        key: 'CHAT_EVENTS_COMMITTEE',
      },
      { action: 'BOARD', label: 'Board chat access', key: 'CHAT_BOARD' },
      {
        action: 'WEB_COMMITTEE',
        label: 'Web committee chat',
        key: 'CHAT_WEB_COMMITTEE',
      },
      {
        action: 'VOLUNTEER_MANAGEMENT',
        label: 'Volunteer management chat',
        key: 'CHAT_VOLUNTEER_MANAGEMENT',
      },
      { action: 'HOST', label: 'Host organization channel', key: 'CHAT_HOST' },
      {
        action: 'DRIVER',
        label: 'Driver coordination channel',
        key: 'CHAT_DRIVER',
      },
      {
        action: 'RECIPIENT',
        label: 'Recipient organization channel',
        key: 'CHAT_RECIPIENT',
      },
      {
        action: 'CORE_TEAM',
        label: 'Core team channel',
        key: 'CHAT_CORE_TEAM',
      },
      { action: 'DIRECT', label: 'Direct messaging', key: 'CHAT_DIRECT' },
    ],
  },
  {
    resource: 'ANALYTICS',
    label: 'Analytics Dashboard',
    description: 'View organizational metrics and reports',
    icon: TrendingUp,
    color: 'bg-violet-50 border-violet-200',
    iconColor: 'text-violet-600',
    actions: [
      {
        action: 'VIEW',
        label: 'Access analytics dashboard',
        key: 'ANALYTICS_VIEW',
      },
    ],
  },
  {
    resource: 'MEETINGS',
    label: 'Meeting Management',
    description: 'Schedule and manage organizational meetings',
    icon: Calendar,
    color: 'bg-rose-50 border-rose-200',
    iconColor: 'text-rose-600',
    actions: [
      {
        action: 'VIEW',
        label: 'View meeting information',
        key: 'MEETINGS_VIEW',
      },
      {
        action: 'MANAGE',
        label: 'Manage meetings and agendas',
        key: 'MEETINGS_MANAGE',
      },
    ],
  },
  {
    resource: 'SUGGESTIONS',
    label: 'Suggestion System',
    description: 'Submit and manage organizational suggestions',
    icon: Lightbulb,
    color: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-600',
    actions: [
      { action: 'VIEW', label: 'View suggestions', key: 'SUGGESTIONS_VIEW' },
      {
        action: 'ADD',
        label: 'Submit new suggestions',
        key: 'SUGGESTIONS_ADD',
      },
      {
        action: 'EDIT_OWN',
        label: 'Edit own suggestions',
        key: 'SUGGESTIONS_EDIT_OWN',
      },
      {
        action: 'EDIT_ALL',
        label: 'Edit any suggestions',
        key: 'SUGGESTIONS_EDIT_ALL',
      },
      {
        action: 'DELETE_OWN',
        label: 'Delete own suggestions',
        key: 'SUGGESTIONS_DELETE_OWN',
      },
      {
        action: 'DELETE_ALL',
        label: 'Delete any suggestions',
        key: 'SUGGESTIONS_DELETE_ALL',
      },
      {
        action: 'MANAGE',
        label: 'Manage suggestion workflows',
        key: 'SUGGESTIONS_MANAGE',
      },
    ],
  },
  {
    resource: 'DOCUMENTS',
    label: 'Documents & Toolkit',
    description: 'Access organizational documents and tools',
    icon: FileText,
    color: 'bg-stone-50 border-stone-200',
    iconColor: 'text-stone-600',
    actions: [
      {
        action: 'VIEW',
        label: 'View documents and toolkit',
        key: 'DOCUMENTS_VIEW',
      },
      { action: 'MANAGE', label: 'Manage documents', key: 'DOCUMENTS_MANAGE' },
      { action: 'UPLOAD', label: 'Upload documents', key: 'DOCUMENTS_UPLOAD' },
      { action: 'DELETE_ALL', label: 'Delete any document', key: 'DOCUMENTS_DELETE_ALL' },
    ],
  },
  {
    resource: 'DATA',
    label: 'Data Management',
    description: 'Import/export and manage organizational data',
    icon: Database,
    color: 'bg-gray-50 border-gray-200',
    iconColor: 'text-gray-600',
    actions: [
      {
        action: 'EXPORT',
        label: 'Export organizational data',
        key: 'DATA_EXPORT',
      },
      {
        action: 'IMPORT',
        label: 'Import data into system',
        key: 'DATA_IMPORT',
      },
    ],
  },
  {
    resource: 'NAVIGATION',
    label: 'Navigation Access',
    description: 'Control which tabs appear in navigation',
    icon: Settings,
    color: 'bg-slate-50 border-slate-200',
    iconColor: 'text-slate-600',
    actions: [
      { action: 'MY_ACTIONS', label: 'My Actions tab', key: 'NAV_MY_ACTIONS' },
      { action: 'DASHBOARD', label: 'Dashboard tab', key: 'NAV_DASHBOARD' },
      { action: 'COLLECTIONS_LOG', label: 'Collections Log tab', key: 'NAV_COLLECTIONS_LOG' },
      { action: 'TEAM_CHAT', label: 'Team Chat tab', key: 'NAV_TEAM_CHAT' },
      { action: 'INBOX', label: 'Inbox tab', key: 'NAV_INBOX' },
      { action: 'SUGGESTIONS', label: 'Suggestions tab', key: 'NAV_SUGGESTIONS' },
      { action: 'HOSTS', label: 'Hosts tab', key: 'NAV_HOSTS' },
      { action: 'DRIVERS', label: 'Drivers tab', key: 'NAV_DRIVERS' },
      { action: 'VOLUNTEERS', label: 'Volunteers tab', key: 'NAV_VOLUNTEERS' },
      { action: 'RECIPIENTS', label: 'Recipients tab', key: 'NAV_RECIPIENTS' },
      { action: 'GROUPS_CATALOG', label: 'Groups Catalog tab', key: 'NAV_GROUPS_CATALOG' },
      { action: 'DISTRIBUTION_TRACKING', label: 'Distribution Tracking tab', key: 'NAV_DISTRIBUTION_TRACKING' },
      { action: 'INVENTORY_CALCULATOR', label: 'Inventory Calculator tab', key: 'NAV_INVENTORY_CALCULATOR' },
      { action: 'WORK_LOG', label: 'Work Log tab', key: 'NAV_WORK_LOG' },
      { action: 'EVENTS_GOOGLE_SHEET', label: 'Events Google Sheet tab', key: 'NAV_EVENTS_GOOGLE_SHEET' },
      { action: 'PROJECTS', label: 'Projects tab', key: 'NAV_PROJECTS' },
      { action: 'MEETINGS', label: 'Meetings tab', key: 'NAV_MEETINGS' },
      { action: 'EVENT_PLANNING', label: 'Event Requests tab', key: 'NAV_EVENT_PLANNING' },
      { action: 'EVENT_REMINDERS', label: 'Event Reminders tab', key: 'NAV_EVENT_REMINDERS' },
      { action: 'ANALYTICS', label: 'Analytics tab', key: 'NAV_ANALYTICS' },
      { action: 'WEEKLY_MONITORING', label: 'Weekly Monitoring tab', key: 'NAV_WEEKLY_MONITORING' },
      { action: 'IMPORTANT_DOCUMENTS', label: 'Important Documents tab', key: 'NAV_IMPORTANT_DOCUMENTS' },
      { action: 'IMPORTANT_LINKS', label: 'Important Links tab', key: 'NAV_IMPORTANT_LINKS' },
      { action: 'TOOLKIT', label: 'Toolkit tab', key: 'NAV_TOOLKIT' },
      { action: 'DOCUMENT_MANAGEMENT', label: 'Document Management tab', key: 'NAV_DOCUMENT_MANAGEMENT' },
    ],
  },
  {
    resource: 'ADMIN',
    label: 'Administrative Access',
    description: 'Administrative functions and panels',
    icon: Shield,
    color: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
    actions: [
      { action: 'PANEL_ACCESS', label: 'Admin panel access', key: 'ADMIN_PANEL_ACCESS' },
    ],
  },
];

// Permission mapping for migration from old format to new RESOURCE_ACTION format
const PERMISSION_MIGRATION_MAP: Record<string, string> = {
  // Host management
  access_hosts: 'HOSTS_VIEW',
  manage_hosts: 'HOSTS_EDIT',
  view_hosts: 'HOSTS_VIEW',
  add_hosts: 'HOSTS_ADD',
  edit_hosts: 'HOSTS_EDIT',
  delete_hosts: 'HOSTS_DELETE',

  // Recipient management
  access_recipients: 'RECIPIENTS_VIEW',
  manage_recipients: 'RECIPIENTS_EDIT',
  view_recipients: 'RECIPIENTS_VIEW',
  add_recipients: 'RECIPIENTS_ADD',
  edit_recipients: 'RECIPIENTS_EDIT',
  delete_recipients: 'RECIPIENTS_DELETE',

  // Driver management
  access_drivers: 'DRIVERS_VIEW',
  manage_drivers: 'DRIVERS_EDIT',
  view_drivers: 'DRIVERS_VIEW',
  add_drivers: 'DRIVERS_ADD',
  edit_drivers: 'DRIVERS_EDIT',
  delete_drivers: 'DRIVERS_DELETE',

  // User management
  manage_users: 'USERS_EDIT',
  view_users: 'USERS_VIEW',

  // Collections
  access_collections: 'COLLECTIONS_VIEW',
  manage_collections: 'COLLECTIONS_EDIT',
  create_collections: 'COLLECTIONS_ADD',
  edit_all_collections: 'COLLECTIONS_EDIT_ALL',
  delete_all_collections: 'COLLECTIONS_DELETE_ALL',
  use_collection_walkthrough: 'COLLECTIONS_WALKTHROUGH',

  // Projects
  access_projects: 'PROJECTS_VIEW',
  manage_projects: 'PROJECTS_EDIT',
  create_projects: 'PROJECTS_ADD',
  edit_all_projects: 'PROJECTS_EDIT_ALL',
  delete_all_projects: 'PROJECTS_DELETE_ALL',

  // Distributions (donation tracking)
  access_donation_tracking: 'DISTRIBUTIONS_VIEW',
  manage_donation_tracking: 'DISTRIBUTIONS_EDIT',
  view_donation_tracking: 'DISTRIBUTIONS_VIEW',
  add_donation_tracking: 'DISTRIBUTIONS_ADD',
  edit_donation_tracking: 'DISTRIBUTIONS_EDIT',
  delete_donation_tracking: 'DISTRIBUTIONS_DELETE',

  // Event requests
  access_event_requests: 'EVENT_REQUESTS_VIEW',
  manage_event_requests: 'EVENT_REQUESTS_EDIT',
  view_event_requests: 'EVENT_REQUESTS_VIEW',
  add_event_requests: 'EVENT_REQUESTS_ADD',
  edit_event_requests: 'EVENT_REQUESTS_EDIT',
  delete_event_requests: 'EVENT_REQUESTS_DELETE',

  // Messages
  access_messages: 'MESSAGES_VIEW',
  send_messages: 'MESSAGES_SEND',
  moderate_messages: 'MESSAGES_MODERATE',

  // Work logs
  access_work_logs: 'WORK_LOGS_VIEW',
  create_work_logs: 'WORK_LOGS_ADD',
  view_all_work_logs: 'WORK_LOGS_VIEW_ALL',
  edit_all_work_logs: 'WORK_LOGS_EDIT_ALL',
  delete_all_work_logs: 'WORK_LOGS_DELETE_ALL',

  // Chat permissions
  access_chat: 'CHAT_GENERAL',
  general_chat: 'CHAT_GENERAL',
  committee_chat: 'CHAT_COMMITTEE',
  host_chat: 'CHAT_HOST',
  driver_chat: 'CHAT_DRIVER',
  recipient_chat: 'CHAT_RECIPIENT',
  core_team_chat: 'CHAT_CORE_TEAM',
  direct_messages: 'CHAT_DIRECT',
  GENERAL_CHAT: 'CHAT_GENERAL',
  COMMITTEE_CHAT: 'CHAT_COMMITTEE',
  HOST_CHAT: 'CHAT_HOST',
  DRIVER_CHAT: 'CHAT_DRIVER',
  RECIPIENT_CHAT: 'CHAT_RECIPIENT',
  CORE_TEAM_CHAT: 'CHAT_CORE_TEAM',

  // Analytics and other features
  access_analytics: 'ANALYTICS_VIEW',
  access_meetings: 'MEETINGS_VIEW',
  manage_meetings: 'MEETINGS_MANAGE',
  access_suggestions: 'SUGGESTIONS_VIEW',
  create_suggestions: 'SUGGESTIONS_ADD',
  manage_suggestions: 'SUGGESTIONS_MANAGE',
  access_toolkit: 'DOCUMENTS_VIEW',
  access_documents: 'DOCUMENTS_VIEW',
  manage_documents: 'DOCUMENTS_MANAGE',
  export_data: 'DATA_EXPORT',
  import_data: 'DATA_IMPORT',
  edit_data: 'DATA_EXPORT',
};

function migrateUserPermissions(oldPermissions: string[]): string[] {
  const newPermissions = new Set<string>();

  for (const oldPerm of oldPermissions) {
    const newPerm = PERMISSION_MIGRATION_MAP[oldPerm.toLowerCase()];
    if (newPerm) {
      newPermissions.add(newPerm);
    } else if (oldPerm.includes('_')) {
      // Already in new format or unknown - keep as is
      newPermissions.add(oldPerm);
    }
  }

  return Array.from(newPermissions);
}

export default function EnhancedPermissionsDialog({
  user,
  open,
  onOpenChange,
  onSave,
}: EnhancedPermissionsDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      // Migrate old permissions to new format for display
      const migratedPermissions = migrateUserPermissions(user.permissions);
      setSelectedPermissions(migratedPermissions);
    }
  }, [user]);

  const handlePermissionToggle = (permissionKey: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permissionKey]);
    } else {
      setSelectedPermissions(
        selectedPermissions.filter((p) => p !== permissionKey)
      );
    }
  };

  const handleResourceToggle = (resource: any, checked: boolean) => {
    const resourcePermissions = resource.actions.map(
      (action: any) => action.key
    );

    if (checked) {
      // Add all permissions for this resource
      const updatedPermissions = [...selectedPermissions];
      resourcePermissions.forEach((perm: string) => {
        if (!updatedPermissions.includes(perm)) {
          updatedPermissions.push(perm);
        }
      });
      setSelectedPermissions(updatedPermissions);
    } else {
      // Remove all permissions for this resource
      setSelectedPermissions(
        selectedPermissions.filter((p) => !resourcePermissions.includes(p))
      );
    }
  };

  const getResourceState = (resource: any) => {
    const resourcePermissions = resource.actions.map(
      (action: any) => action.key
    );
    const selectedCount = resourcePermissions.filter((perm: string) =>
      selectedPermissions.includes(perm)
    ).length;

    if (selectedCount === 0) return 'none';
    if (selectedCount === resourcePermissions.length) return 'all';
    return 'partial';
  };

  const handleSave = () => {
    if (user) {
      onSave(user.id, user.role, selectedPermissions);
      onOpenChange(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            Manage Permissions for {user.firstName} {user.lastName}
          </DialogTitle>
          <DialogDescription>
            Configure granular permissions for {user.email}. Select specific
            actions for each resource.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-1">
            {RESOURCE_PERMISSIONS.map((resource) => {
              const Icon = resource.icon;
              const resourceState = getResourceState(resource);

              return (
                <Card
                  key={resource.resource}
                  className={`${resource.color} transition-colors`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 ${resource.iconColor}`} />
                        <div>
                          <CardTitle className="text-lg">
                            {resource.label}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {resource.description}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`resource-${resource.resource}`}
                          checked={resourceState === 'all'}
                          ref={
                            resourceState === 'partial'
                              ? (el) => {
                                  if (el) el.indeterminate = true;
                                }
                              : undefined
                          }
                          onCheckedChange={(checked) =>
                            handleResourceToggle(resource, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={`resource-${resource.resource}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {resourceState === 'all'
                            ? 'All'
                            : resourceState === 'partial'
                              ? 'Some'
                              : 'None'}
                        </label>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      {resource.actions.map((action) => (
                        <div
                          key={action.key}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={action.key}
                            checked={selectedPermissions.includes(action.key)}
                            onCheckedChange={(checked) =>
                              handlePermissionToggle(
                                action.key,
                                checked as boolean
                              )
                            }
                          />
                          <label
                            htmlFor={action.key}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {action.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-teal-600 hover:bg-teal-700"
          >
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
