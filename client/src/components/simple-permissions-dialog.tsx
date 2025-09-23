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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  USER_ROLES,
  PERMISSIONS,
  getDefaultPermissionsForRole,
  getRoleDisplayName,
} from '@shared/auth-utils';
import {
  Users,
  Phone,
  Building,
  UserCheck,
  Truck,
  Database,
  MessageCircle,
  Mail,
  Wrench,
  Calendar,
  TrendingUp,
  FileText,
  FolderOpen,
  Lightbulb,
  PieChart,
  Shield,
  Edit,
  Eye,
  Settings,
  CheckSquare,
  Square,
  Minus,
  Trophy,
  Heart,
  Send,
  UserPlus,
  Clock,
  ListTodo,
  LayoutDashboard,
  ClipboardList,
  Calculator,
  ExternalLink,
  Upload,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

interface SimplePermissionsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: string, permissions: string[]) => void;
}

// Content-focused permission groups organized by user capabilities
const PERMISSION_GROUPS = [
  {
    id: 'content_management',
    label: 'Content Management',
    description:
      'Control over creating, editing, and managing various content types',
    type: 'content',
    permissions: [
      {
        key: PERMISSIONS.COLLECTIONS_VIEW,
        label: 'View Collections',
        icon: Eye,
        description: 'View all collection records',
      },
      {
        key: PERMISSIONS.COLLECTIONS_ADD,
        label: 'Create Collections',
        icon: Database,
        description:
          'Create collections + automatically edit/delete own collections',
      },
      {
        key: PERMISSIONS.COLLECTIONS_EDIT_ALL,
        label: 'Edit All Collections',
        icon: Shield,
        description: 'Edit any collection record (admin level)',
      },
      {
        key: PERMISSIONS.COLLECTIONS_DELETE_ALL,
        label: 'Delete All Collections',
        icon: Shield,
        description: 'Delete any collection record (admin level)',
      },

      {
        key: PERMISSIONS.PROJECTS_VIEW,
        label: 'View Projects',
        icon: Eye,
        description: 'View project information',
      },
      {
        key: PERMISSIONS.PROJECTS_ADD,
        label: 'Create Projects',
        icon: FolderOpen,
        description:
          'Create projects + automatically edit/delete own projects + edit assigned projects',
      },
      {
        key: PERMISSIONS.PROJECTS_EDIT_ALL,
        label: 'Edit All Projects',
        icon: Shield,
        description: 'Edit any project (admin level)',
      },
      {
        key: PERMISSIONS.PROJECTS_DELETE_ALL,
        label: 'Delete All Projects',
        icon: Shield,
        description: 'Delete any project (admin level)',
      },

      {
        key: PERMISSIONS.SUGGESTIONS_VIEW,
        label: 'View Suggestions',
        icon: Eye,
        description: 'View suggestion portal',
      },
      {
        key: PERMISSIONS.SUGGESTIONS_ADD,
        label: 'Create Suggestions',
        icon: Lightbulb,
        description:
          'Create suggestions + automatically edit/delete own suggestions',
      },
      {
        key: PERMISSIONS.SUGGESTIONS_MANAGE,
        label: 'Manage All Suggestions',
        icon: Shield,
        description: 'Review and respond to all suggestions (admin level)',
      },
      {
        key: PERMISSIONS.SUGGESTIONS_EDIT_ALL,
        label: 'Edit All Suggestions',
        icon: Shield,
        description: 'Edit any suggestion (admin level)',
      },
      {
        key: PERMISSIONS.SUGGESTIONS_DELETE_ALL,
        label: 'Delete All Suggestions',
        icon: Shield,
        description: 'Delete any suggestion (admin level)',
      },

      {
        key: PERMISSIONS.WORK_LOGS_VIEW,
        label: 'View Work Logs',
        icon: Eye,
        description: 'Access work logs section',
      },
      {
        key: PERMISSIONS.WORK_LOGS_ADD,
        label: 'Create Work Logs',
        icon: Edit,
        description:
          'Create work logs + automatically edit/delete own work logs',
      },
      {
        key: PERMISSIONS.WORK_LOGS_VIEW,
        label: 'View All Work Logs',
        icon: Eye,
        description: "View everyone's work logs (admin/supervisor)",
      },
      {
        key: PERMISSIONS.WORK_LOGS_EDIT_ALL,
        label: 'Edit All Work Logs',
        icon: Shield,
        description: 'Edit any work log entry (admin level)',
      },
      {
        key: PERMISSIONS.WORK_LOGS_DELETE_ALL,
        label: 'Delete All Work Logs',
        icon: Shield,
        description: 'Delete any work log entry (admin level)',
      },

      // Event Requests
      {
        key: PERMISSIONS.EVENT_REQUESTS_VIEW,
        label: 'View Event Requests',
        icon: Eye,
        description: 'View event request submissions',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_ADD,
        label: 'Submit Event Requests',
        icon: Calendar,
        description: 'Submit new event requests',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_EDIT,
        label: 'Edit Event Requests',
        icon: Edit,
        description: 'Edit event request details',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_DELETE,
        label: 'Delete Event Requests',
        icon: Shield,
        description: 'Delete event requests (admin level)',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_INLINE_EDIT_TIMES,
        label: 'Inline Edit Event Times',
        icon: Clock,
        description: 'Edit event/pickup times directly on cards',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_INLINE_EDIT_ADDRESS,
        label: 'Inline Edit Event Address',
        icon: MapPin,
        description: 'Edit event address directly on cards',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_INLINE_EDIT_SANDWICHES,
        label: 'Inline Edit Sandwich Details',
        icon: Package,
        description: 'Edit sandwich count/types directly on cards',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_INLINE_EDIT_STAFFING,
        label: 'Inline Edit Staffing Needs',
        icon: Users,
        description: 'Edit driver/speaker/volunteer needs on cards',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_INLINE_EDIT_LOGISTICS,
        label: 'Inline Edit Logistics',
        icon: Settings,
        description: 'Edit refrigeration and logistics on cards',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_SELF_SIGNUP,
        label: 'Self-Signup for Roles',
        icon: UserCheck,
        description: 'Sign up self for driver/speaker/volunteer roles',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_ASSIGN_OTHERS,
        label: 'Assign Others to Roles',
        icon: UserPlus,
        description: 'Assign others to driver/speaker/volunteer roles',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_VIEW_ONLY,
        label: 'Event Requests View Only',
        icon: Eye,
        description: 'View events with no edit/assignment capabilities',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_EDIT_ALL_DETAILS,
        label: 'Edit All Event Details',
        icon: Edit,
        description: 'Edit all event details (comprehensive editing)',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_SEND_TOOLKIT,
        label: 'Send Toolkit & Mark Scheduled',
        icon: Shield,
        description: 'Send toolkit and mark events as scheduled',
      },
      {
        key: PERMISSIONS.EVENT_REQUESTS_FOLLOW_UP,
        label: 'Use Follow-Up Buttons',
        icon: Clock,
        description: 'Use follow-up buttons (1 day, 1 month)',
      },
    ],
  },
  {
    id: 'directory_contact',
    label: 'Directory & Contact Data',
    description: 'Access levels to organizational contact information',
    type: 'directory',
    permissions: [
      {
        key: PERMISSIONS.HOSTS_VIEW,
        label: 'Basic Directory Access',
        icon: Phone,
        description: 'View basic contact information',
      },
      // Note: Full contact details would need a new permission

      {
        key: PERMISSIONS.HOSTS_VIEW,
        label: 'View Hosts',
        icon: Eye,
        description: 'View host locations',
      },
      {
        key: PERMISSIONS.HOSTS_EDIT,
        label: 'Add/Edit Hosts',
        icon: Building,
        description: 'Add and edit host locations',
      },
      // Note: "Manage All Hosts" would be separate from basic edit

      {
        key: PERMISSIONS.DRIVERS_VIEW,
        label: 'View Drivers',
        icon: Eye,
        description: 'View driver information',
      },
      {
        key: PERMISSIONS.DRIVERS_EDIT,
        label: 'Add/Edit Drivers',
        icon: Truck,
        description: 'Add and edit driver records',
      },

      {
        key: PERMISSIONS.RECIPIENTS_VIEW,
        label: 'View Recipients',
        icon: Eye,
        description: 'View recipient organizations',
      },
      {
        key: PERMISSIONS.RECIPIENTS_EDIT,
        label: 'Add/Edit Recipients',
        icon: UserCheck,
        description: 'Add and edit recipient organizations',
      },
    ],
  },
  {
    id: 'communication_access',
    label: 'Communication',
    description: 'Chat room access and messaging capabilities',
    type: 'communication',
    permissions: [
      {
        key: PERMISSIONS.CHAT_GENERAL,
        label: 'General Chat',
        icon: MessageCircle,
        description: 'Access general team chat',
      },
      {
        key: PERMISSIONS.CHAT_HOST,
        label: 'Host Chat',
        icon: Building,
        description: 'Access host-specific chat room',
      },
      {
        key: PERMISSIONS.CHAT_DRIVER,
        label: 'Driver Chat',
        icon: Truck,
        description: 'Access driver-specific chat room',
      },
      {
        key: PERMISSIONS.CHAT_RECIPIENT,
        label: 'Recipient Chat',
        icon: UserCheck,
        description: 'Access recipient-specific chat room',
      },
      {
        key: PERMISSIONS.CHAT_GRANTS_COMMITTEE,
        label: 'Grants Committee Chat',
        icon: Users,
        description: 'Access grants committee chat',
      },
      {
        key: PERMISSIONS.CHAT_EVENTS_COMMITTEE,
        label: 'Events Committee Chat',
        icon: Users,
        description: 'Access events committee chat',
      },
      {
        key: PERMISSIONS.CHAT_BOARD,
        label: 'Board Chat',
        icon: Users,
        description: 'Access board chat',
      },
      {
        key: PERMISSIONS.CHAT_WEB_COMMITTEE,
        label: 'Web Committee Chat',
        icon: Users,
        description: 'Access web committee chat',
      },
      {
        key: PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT,
        label: 'Volunteer Management Chat',
        icon: Users,
        description: 'Access volunteer management chat',
      },
      {
        key: PERMISSIONS.CHAT_CORE_TEAM,
        label: 'Core Team Chat',
        icon: Shield,
        description: 'Access leadership chat room',
      },

      {
        key: PERMISSIONS.CHAT_DIRECT,
        label: 'Direct Messaging',
        icon: Mail,
        description: 'Send/receive private messages',
      },
      {
        key: PERMISSIONS.CHAT_GROUP,
        label: 'Group Chat',
        icon: Users,
        description: 'Create and participate in group chats',
      },
    ],
  },
  {
    id: 'kudos_system',
    label: 'Kudos & Recognition',
    description:
      'Controls access to the kudos system for recognizing achievements and contributions',
    type: 'kudos',
    permissions: [
      {
        key: PERMISSIONS.SEND_KUDOS,
        label: 'Send Kudos',
        icon: Send,
        description: "Can send kudos messages to recognize other users' work",
      },
      {
        key: PERMISSIONS.RECEIVE_KUDOS,
        label: 'Receive Kudos',
        icon: Heart,
        description: 'Can receive kudos messages from other users',
      },
      {
        key: PERMISSIONS.KUDOS_VIEW,
        label: 'View Kudos',
        icon: Trophy,
        description: 'Can view kudos messages in the inbox',
      },
      {
        key: PERMISSIONS.KUDOS_MANAGE,
        label: 'Manage All Kudos',
        icon: Shield,
        description: 'Admin ability to manage all kudos (view, delete)',
      },
    ],
  },
  {
    id: 'navigation_control',
    label: 'Navigation Control',
    description: "Which tabs and features appear in user's interface",
    type: 'navigation',
    permissions: [
      {
        key: PERMISSIONS.CHAT_GENERAL,
        label: 'Chat Tab',
        icon: MessageCircle,
        description: 'Show Chat tab in navigation',
      },
      {
        key: PERMISSIONS.MESSAGES_VIEW,
        label: 'Messages Tab',
        icon: Mail,
        description: 'Show Messages tab in navigation',
      },
      {
        key: PERMISSIONS.TOOLKIT_ACCESS,
        label: 'Toolkit Tab',
        icon: Wrench,
        description: 'Show Toolkit/Documents tab',
      },
      {
        key: PERMISSIONS.MEETINGS_VIEW,
        label: 'Meetings Section',
        icon: Calendar,
        description: 'Show Meetings in Operations',
      },
      {
        key: PERMISSIONS.ANALYTICS_VIEW,
        label: 'Analytics Section',
        icon: TrendingUp,
        description: 'Show Analytics in Operations',
      },
      {
        key: PERMISSIONS.ANALYTICS_VIEW,
        label: 'Reports Section',
        icon: FileText,
        description: 'Show Reports in Operations',
      },
      {
        key: PERMISSIONS.COLLECTIONS_VIEW,
        label: 'Sandwich Data',
        icon: PieChart,
        description: 'Access to sandwich totals data sheet',
      },
      {
        key: PERMISSIONS.WORK_LOGS_VIEW,
        label: 'Work Logs Section',
        icon: Calendar,
        description: 'Show Work Logs in navigation',
      },
    ],
  },
  {
    id: 'system_access',
    label: 'System Access',
    description: 'Administrative functions and system-level capabilities',
    type: 'system',
    permissions: [
      {
        key: PERMISSIONS.ADMIN_ACCESS,
        label: 'Admin Panel',
        icon: Shield,
        description: 'Access to admin interface',
      },
      {
        key: PERMISSIONS.USERS_EDIT,
        label: 'User Management',
        icon: Users,
        description: 'Manage users and permissions',
      },
      {
        key: PERMISSIONS.ANNOUNCEMENTS_MANAGE,
        label: 'System Announcements',
        icon: FileText,
        description: 'Create/edit system announcements',
      },
      {
        key: PERMISSIONS.MEETINGS_MANAGE,
        label: 'Meeting Management',
        icon: Calendar,
        description: 'Schedule and manage meetings',
      },
    ],
  },
  {
    id: 'data_operations',
    label: 'Data Operations',
    description: 'Bulk operations and cross-content editing capabilities',
    type: 'operations',
    permissions: [
      {
        key: PERMISSIONS.DATA_EXPORT,
        label: 'Export Data',
        icon: FileText,
        description: 'Download data as files',
      },
      {
        key: PERMISSIONS.IMPORT_DATA,
        label: 'Import Data',
        icon: Database,
        description: 'Upload bulk data from files',
      },
      {
        key: PERMISSIONS.DATA_EXPORT,
        label: 'Schedule Reports',
        icon: Calendar,
        description: 'Set up automated reporting',
      },
      // Note: Cross-content editing and permanent deletions would need new granular permissions
    ],
  },
  {
    id: 'navigation_access',
    label: 'Navigation Tab Access',
    description: 'Control which tabs appear in user navigation',
    type: 'navigation',
    permissions: [
      {
        key: PERMISSIONS.NAV_MY_ACTIONS,
        label: 'My Actions Tab',
        icon: ListTodo,
        description: 'Show My Actions tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_DASHBOARD,
        label: 'Dashboard Tab',
        icon: LayoutDashboard,
        description: 'Show Dashboard tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_COLLECTIONS_LOG,
        label: 'Collections Log Tab',
        icon: Database,
        description: 'Show Collections Log tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_TEAM_CHAT,
        label: 'Team Chat Tab',
        icon: MessageCircle,
        description: 'Show Team Chat tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_INBOX,
        label: 'Inbox Tab',
        icon: Mail,
        description: 'Show Inbox tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_SUGGESTIONS,
        label: 'Suggestions Tab',
        icon: Lightbulb,
        description: 'Show Suggestions tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_HOSTS,
        label: 'Hosts Tab',
        icon: Building,
        description: 'Show Hosts tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_DRIVERS,
        label: 'Drivers Tab',
        icon: Truck,
        description: 'Show Drivers tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_VOLUNTEERS,
        label: 'Volunteers Tab',
        icon: Users,
        description: 'Show Volunteers tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_RECIPIENTS,
        label: 'Recipients Tab',
        icon: Users,
        description: 'Show Recipients tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_GROUPS_CATALOG,
        label: 'Groups Catalog Tab',
        icon: Building,
        description: 'Show Groups Catalog tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_DISTRIBUTION_TRACKING,
        label: 'Distribution Tracking Tab',
        icon: Truck,
        description: 'Show Distribution Tracking tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_INVENTORY_CALCULATOR,
        label: 'Inventory Calculator Tab',
        icon: Calculator,
        description: 'Show Inventory Calculator tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_WORK_LOG,
        label: 'Work Log Tab',
        icon: ClipboardList,
        description: 'Show Work Log tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_EVENTS_GOOGLE_SHEET,
        label: 'Events Google Sheet Tab',
        icon: Calendar,
        description: 'Show Events Google Sheet tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_PROJECTS,
        label: 'Projects Tab',
        icon: FolderOpen,
        description: 'Show Projects tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_MEETINGS,
        label: 'Meetings Tab',
        icon: Calendar,
        description: 'Show Meetings tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_EVENT_PLANNING,
        label: 'Event Requests Tab',
        icon: Calendar,
        description: 'Show Event Requests tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_EVENT_REMINDERS,
        label: 'Event Reminders Tab',
        icon: Clock,
        description: 'Show Event Reminders tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_ANALYTICS,
        label: 'Analytics Tab',
        icon: TrendingUp,
        description: 'Show Analytics tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_WEEKLY_MONITORING,
        label: 'Weekly Monitoring Tab',
        icon: Calendar,
        description: 'Show Weekly Monitoring tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_IMPORTANT_DOCUMENTS,
        label: 'Important Documents Tab',
        icon: FileText,
        description: 'Show Important Documents tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_IMPORTANT_LINKS,
        label: 'Important Links Tab',
        icon: ExternalLink,
        description: 'Show Important Links tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_TOOLKIT,
        label: 'Toolkit Tab',
        icon: Wrench,
        description: 'Show Toolkit tab in navigation',
      },
      {
        key: PERMISSIONS.NAV_DOCUMENT_MANAGEMENT,
        label: 'Document Management Tab',
        icon: FileText,
        description: 'Show Document Management tab in navigation',
      },
    ],
  },
  {
    id: 'document_management',
    label: 'Document Management',
    description: 'Upload and manage documents',
    type: 'documents',
    permissions: [
      {
        key: PERMISSIONS.DOCUMENTS_UPLOAD,
        label: 'Upload Documents',
        icon: Upload,
        description: 'Upload documents (can delete own uploads)',
      },
      {
        key: PERMISSIONS.DOCUMENTS_DELETE_ALL,
        label: 'Delete Any Document',
        icon: Shield,
        description: 'Delete any uploaded document (admin level)',
      },
    ],
  },
  {
    id: 'administrative',
    label: 'Administrative Access',
    description: 'Administrative functions and panels',
    type: 'admin',
    permissions: [
      {
        key: PERMISSIONS.ADMIN_PANEL_ACCESS,
        label: 'Admin Panel Access',
        icon: Shield,
        description: 'Access to admin panel/user management',
      },
    ],
  },
];

// Helper functions for visual organization
function getCardColorForType(type: string) {
  switch (type) {
    case 'content':
      return 'border-blue-200 bg-blue-50/50';
    case 'directory':
      return 'border-green-200 bg-green-50/50';
    case 'communication':
      return 'border-purple-200 bg-purple-50/50';
    case 'navigation':
      return 'border-orange-200 bg-orange-50/50';
    case 'system':
      return 'border-red-200 bg-red-50/50';
    case 'operations':
      return 'border-indigo-200 bg-indigo-50/50';
    case 'kudos':
      return 'border-yellow-200 bg-yellow-50/50';
    default:
      return 'border-gray-200 bg-gray-50/50';
  }
}

function getIconForType(type: string) {
  switch (type) {
    case 'content':
      return <Database className="h-4 w-4 text-brand-primary" />;
    case 'directory':
      return <Phone className="h-4 w-4 text-green-600" />;
    case 'communication':
      return <MessageCircle className="h-4 w-4 text-purple-600" />;
    case 'navigation':
      return <Eye className="h-4 w-4 text-orange-600" />;
    case 'system':
      return <Shield className="h-4 w-4 text-red-600" />;
    case 'operations':
      return <Settings className="h-4 w-4 text-indigo-600" />;
    case 'kudos':
      return <Trophy className="h-4 w-4 text-yellow-600" />;
    default:
      return <Settings className="h-4 w-4 text-gray-600" />;
  }
}

export function SimplePermissionsDialog({
  user,
  open,
  onOpenChange,
  onSave,
}: SimplePermissionsDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user && open) {
      setSelectedRole(user.role);
      setSelectedPermissions(user.permissions || []);
    }
  }, [user, open]);

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    const defaultPermissions = getDefaultPermissionsForRole(newRole);
    setSelectedPermissions(defaultPermissions);
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permission]);
    } else {
      setSelectedPermissions(
        selectedPermissions.filter((p) => p !== permission)
      );
    }
  };

  const handleSave = () => {
    if (user) {
      onSave(user.id, selectedRole, selectedPermissions);
      onOpenChange(false);
    }
  };

  const isPermissionChecked = (permission: string) => {
    return selectedPermissions.includes(permission);
  };

  // Bulk selection helpers
  const getCategoryStatus = (category: any) => {
    const categoryPermissions = category.permissions.map((p: any) => p.key);
    const checkedCount = categoryPermissions.filter((p: string) =>
      selectedPermissions.includes(p)
    ).length;

    if (checkedCount === 0) return 'none';
    if (checkedCount === categoryPermissions.length) return 'all';
    return 'partial';
  };

  const handleBulkCategoryToggle = (category: any) => {
    const categoryPermissions = category.permissions.map((p: any) => p.key);
    const status = getCategoryStatus(category);

    if (status === 'all') {
      // Remove all category permissions
      setSelectedPermissions(
        selectedPermissions.filter((p) => !categoryPermissions.includes(p))
      );
    } else {
      // Add all category permissions
      const newPermissions = [...selectedPermissions];
      categoryPermissions.forEach((perm: string) => {
        if (!newPermissions.includes(perm)) {
          newPermissions.push(perm);
        }
      });
      setSelectedPermissions(newPermissions);
    }
  };

  const getBulkIcon = (status: string) => {
    switch (status) {
      case 'all':
        return <CheckSquare className="h-4 w-4" />;
      case 'partial':
        return <Minus className="h-4 w-4" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Permissions: {user.firstName} {user.lastName}
          </DialogTitle>
          <DialogDescription>
            Control which sections of the application this user can access.
            Choose a role preset or customize individual permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Role Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="role">User Role</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Common viewer permissions - view-only access
                    const viewerPermissions = [
                      PERMISSIONS.HOSTS_VIEW,
                      PERMISSIONS.COLLECTIONS_VIEW,
                      PERMISSIONS.HOSTS_VIEW,
                      PERMISSIONS.RECIPIENTS_VIEW,
                      PERMISSIONS.DRIVERS_VIEW,
                      PERMISSIONS.PROJECTS_VIEW,
                      PERMISSIONS.TOOLKIT_ACCESS,
                      PERMISSIONS.COLLECTIONS_VIEW,
                      PERMISSIONS.GENERAL_CHAT,
                    ];
                    setSelectedPermissions(viewerPermissions);
                  }}
                  className="text-xs"
                >
                  Viewer Preset
                </Button>
              </div>
            </div>
            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(USER_ROLES).map((role) => (
                  <SelectItem key={role} value={role}>
                    {getRoleDisplayName(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Use role presets for quick setup, or choose permission presets
              above for common configurations.
            </p>
          </div>

          {/* Permission Categories */}
          <div className="space-y-6">
            {PERMISSION_GROUPS.map((category) => (
              <Card
                key={category.id}
                className={`${getCardColorForType(category.type)}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {getIconForType(category.type)}
                      {category.label}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBulkCategoryToggle(category)}
                      className="h-8 px-2 text-xs"
                      title={`Select all ${category.label.toLowerCase()}`}
                    >
                      {getBulkIcon(getCategoryStatus(category))}
                      <span className="ml-1 hidden sm:inline">
                        {getCategoryStatus(category) === 'all'
                          ? 'Deselect All'
                          : 'Select All'}
                      </span>
                    </Button>
                  </div>
                  <CardDescription className="text-sm">
                    {category.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.permissions.map((permission) => {
                      const Icon = permission.icon;
                      return (
                        <div
                          key={permission.key}
                          className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                        >
                          <Checkbox
                            id={permission.key}
                            checked={isPermissionChecked(permission.key)}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(
                                permission.key,
                                checked as boolean
                              )
                            }
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <Label
                                htmlFor={permission.key}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {permission.label}
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions & Permission Count */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedPermissions.length} permissions selected
              </Badge>
              <span className="text-sm text-muted-foreground">
                Role: {getRoleDisplayName(selectedRole)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPermissions([])}
                disabled={selectedPermissions.length === 0}
              >
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allPermissions = PERMISSION_GROUPS.flatMap((group) =>
                    group.permissions.map((p) => p.key)
                  );
                  setSelectedPermissions(allPermissions);
                }}
                disabled={
                  selectedPermissions.length ===
                  Object.values(PERMISSIONS).length
                }
              >
                Select All
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
