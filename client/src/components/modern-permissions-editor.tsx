import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Search,
  Shield,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  Upload,
  Settings,
  Crown,
  AlertCircle,
  Check,
  X,
  Clock,
  ToggleLeft,
  ToggleRight,
  CheckSquare,
  Square,
} from 'lucide-react';
import { PERMISSIONS, USER_ROLES, getDefaultPermissionsForRole } from '@shared/auth-utils';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive?: boolean;
}

interface ModernPermissionsEditorProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: string, permissions: string[]) => void;
}

// Permission categories with icons and descriptions
const PERMISSION_CATEGORIES = {
  'Core Access': {
    icon: Shield,
    description: 'Basic access to main platform features',
    permissions: [
      { 
        key: 'HOSTS_VIEW', 
        name: 'View Hosts', 
        description: 'Access host directory and contact information',
        level: 'view'
      },
      { 
        key: 'RECIPIENTS_VIEW', 
        name: 'View Recipients', 
        description: 'Access recipient organizations directory',
        level: 'view'
      },
      { 
        key: 'DRIVERS_VIEW', 
        name: 'View Drivers', 
        description: 'Access driver directory and information',
        level: 'view'
      },
      { 
        key: 'COLLECTIONS_VIEW', 
        name: 'View Collections', 
        description: 'View sandwich collection data and reports',
        level: 'view'
      },
      { 
        key: 'PROJECTS_VIEW', 
        name: 'View Projects', 
        description: 'View project tracker and assignments',
        level: 'view'
      },
    ]
  },
  
  'Data Management': {
    icon: Database,
    description: 'Create and manage data across the platform',
    permissions: [
      { 
        key: 'HOSTS_ADD', 
        name: 'Add Hosts', 
        description: 'Add new host organizations',
        level: 'create'
      },
      { 
        key: 'HOSTS_EDIT', 
        name: 'Edit Hosts', 
        description: 'Edit existing host organizations',
        level: 'edit'
      },
      { 
        key: 'HOSTS_DELETE', 
        name: 'Delete Hosts', 
        description: 'Delete host organizations',
        level: 'admin'
      },
      { 
        key: 'RECIPIENTS_ADD', 
        name: 'Add Recipients', 
        description: 'Add new recipient organizations',
        level: 'create'
      },
      { 
        key: 'RECIPIENTS_EDIT', 
        name: 'Edit Recipients', 
        description: 'Edit existing recipient organizations',
        level: 'edit'
      },
      { 
        key: 'RECIPIENTS_DELETE', 
        name: 'Delete Recipients', 
        description: 'Delete recipient organizations',
        level: 'admin'
      },
      { 
        key: 'DRIVERS_ADD', 
        name: 'Add Drivers', 
        description: 'Add new drivers to the system',
        level: 'create'
      },
      { 
        key: 'DRIVERS_EDIT', 
        name: 'Edit Drivers', 
        description: 'Edit existing driver information',
        level: 'edit'
      },
      { 
        key: 'DRIVERS_DELETE', 
        name: 'Delete Drivers', 
        description: 'Delete driver records',
        level: 'admin'
      },
      { 
        key: 'COLLECTIONS_ADD', 
        name: 'Create Collections', 
        description: 'Log new sandwich collections (includes editing own)',
        level: 'create'
      },
      { 
        key: 'COLLECTIONS_EDIT_ALL', 
        name: 'Edit All Collections', 
        description: 'Edit any collection data (admin level)',
        level: 'admin'
      },
      { 
        key: 'COLLECTIONS_DELETE_ALL', 
        name: 'Delete Collections', 
        description: 'Delete any collection records (admin level)',
        level: 'admin'
      },
      { 
        key: 'DISTRIBUTIONS_ADD', 
        name: 'Add Distributions', 
        description: 'Create new distribution records',
        level: 'create'
      },
      { 
        key: 'DISTRIBUTIONS_EDIT', 
        name: 'Edit Distributions', 
        description: 'Edit distribution tracking data',
        level: 'edit'
      },
      { 
        key: 'DISTRIBUTIONS_DELETE', 
        name: 'Delete Distributions', 
        description: 'Delete distribution records',
        level: 'admin'
      },
      { 
        key: 'DATA_IMPORT', 
        name: 'Import Data', 
        description: 'Import data from external sources',
        level: 'admin'
      },
    ]
  },

  'Event Management': {
    icon: Calendar,
    description: 'Manage event requests and scheduling',
    permissions: [
      { 
        key: 'EVENT_REQUESTS_VIEW', 
        name: 'View Event Requests', 
        description: 'View all event requests and scheduling',
        level: 'view'
      },
      { 
        key: 'EVENT_REQUESTS_ADD', 
        name: 'Add Event Requests', 
        description: 'Create new event requests',
        level: 'create'
      },
      { 
        key: 'EVENT_REQUESTS_EDIT', 
        name: 'Edit Event Requests', 
        description: 'Edit, schedule, and manage event requests',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_DELETE', 
        name: 'Delete Event Requests', 
        description: 'Delete event requests from the system',
        level: 'admin'
      },
      { 
        key: 'EVENT_REQUESTS_DELETE_CARD', 
        name: 'Delete via Card Buttons', 
        description: 'Delete events using card delete buttons',
        level: 'admin'
      },
      { 
        key: 'EVENT_REQUESTS_SYNC', 
        name: 'Google Sheets Sync', 
        description: 'Sync event requests with Google Sheets',
        level: 'admin'
      },
      { 
        key: 'EVENT_REQUESTS_COMPLETE_CONTACT', 
        name: 'Complete Contacts', 
        description: 'Mark primary contacts as completed',
        level: 'action'
      },
      { 
        key: 'ORGANIZATIONS_VIEW', 
        name: 'Organizations Catalog', 
        description: 'Access organizations catalog for events',
        level: 'view'
      },
    ]
  },

  'Project Management': {
    icon: ClipboardList,
    description: 'Manage projects and assignments',
    permissions: [
      { 
        key: 'PROJECTS_ADD', 
        name: 'Create Projects', 
        description: 'Create new projects',
        level: 'create'
      },
      { 
        key: 'PROJECTS_EDIT_OWN', 
        name: 'Edit Own Projects', 
        description: 'Edit projects you created or are assigned to',
        level: 'edit'
      },
      { 
        key: 'PROJECTS_EDIT_ALL', 
        name: 'Edit All Projects', 
        description: 'Edit any project regardless of assignment',
        level: 'admin'
      },
      { 
        key: 'PROJECTS_DELETE_OWN', 
        name: 'Delete Own Projects', 
        description: 'Delete projects you created',
        level: 'edit'
      },
      { 
        key: 'PROJECTS_DELETE_ALL', 
        name: 'Delete All Projects', 
        description: 'Delete any project (admin level)',
        level: 'admin'
      },
    ]
  },

  'Communication': {
    icon: MessageCircle,
    description: 'Chat rooms and messaging features',
    permissions: [
      { 
        key: 'MESSAGES_VIEW', 
        name: 'View Messages', 
        description: 'Access messaging system',
        level: 'view'
      },
      { 
        key: 'MESSAGES_SEND', 
        name: 'Send Messages', 
        description: 'Send messages to other users',
        level: 'action'
      },
      { 
        key: 'MESSAGES_EDIT', 
        name: 'Edit Messages', 
        description: 'Edit sent messages',
        level: 'edit'
      },
      { 
        key: 'MESSAGES_DELETE', 
        name: 'Delete Messages', 
        description: 'Delete messages',
        level: 'admin'
      },
      { 
        key: 'MESSAGES_MODERATE', 
        name: 'Moderate Messages', 
        description: 'Moderate and manage all messages',
        level: 'admin'
      },
      { 
        key: 'CHAT_GENERAL', 
        name: 'General Chat', 
        description: 'Access to general chat room',
        level: 'access'
      },
      { 
        key: 'CHAT_HOST', 
        name: 'Host Chat', 
        description: 'Access to host-specific chat room',
        level: 'access'
      },
      { 
        key: 'CHAT_DRIVER', 
        name: 'Driver Chat', 
        description: 'Access to driver-specific chat room',
        level: 'access'
      },
      { 
        key: 'CHAT_CORE_TEAM', 
        name: 'Core Team Chat', 
        description: 'Access to core team chat room',
        level: 'access'
      },
      { 
        key: 'CHAT_GRANTS_COMMITTEE', 
        name: 'Grants Committee Chat', 
        description: 'Access to grants committee chat room',
        level: 'access'
      },
      { 
        key: 'CHAT_EVENTS_COMMITTEE', 
        name: 'Events Committee Chat', 
        description: 'Access to events committee chat room',
        level: 'access'
      },
      { 
        key: 'CHAT_WEB_COMMITTEE', 
        name: 'Web Committee Chat', 
        description: 'Access to web committee chat room',
        level: 'access'
      },
    ]
  },

  'Analytics & Reports': {
    icon: TrendingUp,
    description: 'Data analysis and reporting tools',
    permissions: [
      { 
        key: 'ANALYTICS_VIEW', 
        name: 'View Analytics', 
        description: 'Access analytics dashboards and reports',
        level: 'view'
      },
      { 
        key: 'DATA_EXPORT', 
        name: 'Export Data', 
        description: 'Export data to CSV and other formats',
        level: 'action'
      },
    ]
  },

  'System Administration': {
    icon: Settings,
    description: 'User management and system administration',
    permissions: [
      { 
        key: 'USERS_VIEW', 
        name: 'View Users', 
        description: 'View user directory and information',
        level: 'view'
      },
      { 
        key: 'USERS_ADD', 
        name: 'Add Users', 
        description: 'Create new user accounts',
        level: 'admin'
      },
      { 
        key: 'USERS_EDIT', 
        name: 'Edit Users', 
        description: 'Edit user accounts, roles, and permissions',
        level: 'admin'
      },
      { 
        key: 'USERS_DELETE', 
        name: 'Delete Users', 
        description: 'Delete user accounts',
        level: 'admin'
      },
      { 
        key: 'ADMIN_ACCESS', 
        name: 'Admin Access', 
        description: 'Full administrative access to system',
        level: 'admin'
      },
      { 
        key: 'MANAGE_ANNOUNCEMENTS', 
        name: 'Manage Announcements', 
        description: 'Create and manage system announcements',
        level: 'admin'
      },
    ]
  },

  'Work & Time Tracking': {
    icon: Clock,
    description: 'Work log and time tracking features',
    permissions: [
      { 
        key: 'WORK_LOGS_VIEW', 
        name: 'View Own Work Logs', 
        description: 'View your own work time logs',
        level: 'view'
      },
      { 
        key: 'WORK_LOGS_VIEW_ALL', 
        name: 'View All Work Logs', 
        description: 'View all users\' work time logs',
        level: 'admin'
      },
      { 
        key: 'WORK_LOGS_ADD', 
        name: 'Add Work Logs', 
        description: 'Log work time and activities',
        level: 'create'
      },
      { 
        key: 'WORK_LOGS_EDIT_OWN', 
        name: 'Edit Own Work Logs', 
        description: 'Edit your own work time logs',
        level: 'edit'
      },
      { 
        key: 'WORK_LOGS_EDIT_ALL', 
        name: 'Edit All Work Logs', 
        description: 'Edit any user\'s work time logs',
        level: 'admin'
      },
      { 
        key: 'WORK_LOGS_DELETE_OWN', 
        name: 'Delete Own Work Logs', 
        description: 'Delete your own work time logs',
        level: 'edit'
      },
      { 
        key: 'WORK_LOGS_DELETE_ALL', 
        name: 'Delete All Work Logs', 
        description: 'Delete any user\'s work time logs',
        level: 'admin'
      },
    ]
  },

  'Community Features': {
    icon: Users,
    description: 'Community engagement and recognition',
    permissions: [
      { 
        key: 'KUDOS_SEND', 
        name: 'Send Kudos', 
        description: 'Send recognition and kudos to team members',
        level: 'action'
      },
      { 
        key: 'KUDOS_RECEIVE', 
        name: 'Receive Kudos', 
        description: 'Receive kudos from other team members',
        level: 'receive'
      },
      { 
        key: 'KUDOS_VIEW', 
        name: 'View Kudos', 
        description: 'View kudos board and recognition',
        level: 'view'
      },
      { 
        key: 'SUGGESTIONS_VIEW', 
        name: 'View Suggestions', 
        description: 'View suggestion board and feedback',
        level: 'view'
      },
      { 
        key: 'SUGGESTIONS_ADD', 
        name: 'Submit Suggestions', 
        description: 'Submit suggestions and feedback',
        level: 'create'
      },
      { 
        key: 'SUGGESTIONS_MANAGE', 
        name: 'Manage Suggestions', 
        description: 'Respond to and manage suggestions',
        level: 'admin'
      },
    ]
  },

  'Meeting Management': {
    icon: Calendar,
    description: 'Meeting scheduling and agenda management with project integration',
    permissions: [
      { 
        key: 'MEETINGS_VIEW', 
        name: 'View Meetings', 
        description: 'Access to meeting information and minutes',
        level: 'view'
      },
      { 
        key: 'MEETINGS_MANAGE', 
        name: 'Manage Meetings', 
        description: 'Schedule meetings and manage agendas',
        level: 'admin'
      },
      { 
        key: 'PROJECTS_VIEW', 
        name: 'View Projects (for Agenda)', 
        description: 'View projects to add to meeting agendas',
        level: 'view'
      },
      { 
        key: 'PROJECTS_EDIT_ALL', 
        name: 'Edit Projects (for Agenda)', 
        description: 'Required to send projects to agenda and update meeting notes',
        level: 'admin'
      },
    ]
  },

  'Resources': {
    icon: FileText,
    description: 'Access to tools and documentation',
    permissions: [
      { 
        key: 'TOOLKIT_ACCESS', 
        name: 'Toolkit Access', 
        description: 'Access to toolkit and documentation',
        level: 'access'
      },
      { 
        key: 'DOCUMENTS_VIEW', 
        name: 'View Documents', 
        description: 'Access to document library',
        level: 'view'
      },
      { 
        key: 'DOCUMENTS_MANAGE', 
        name: 'Manage Documents', 
        description: 'Upload and manage documents',
        level: 'admin'
      },
      { 
        key: 'DOCUMENTS_UPLOAD', 
        name: 'Upload Documents', 
        description: 'Upload documents (can delete own)',
        level: 'create'
      },
      { 
        key: 'DOCUMENTS_DELETE_ALL', 
        name: 'Delete Any Document', 
        description: 'Delete any uploaded document',
        level: 'admin'
      },
    ]
  },

  'Event Request Management': {
    icon: Calendar,
    description: 'Granular control over event request functionality',
    permissions: [
      { 
        key: 'EVENT_REQUESTS_VIEW', 
        name: 'View Event Requests', 
        description: 'View event request submissions',
        level: 'view'
      },
      { 
        key: 'EVENT_REQUESTS_ADD', 
        name: 'Submit Event Requests', 
        description: 'Submit new event requests',
        level: 'create'
      },
      { 
        key: 'EVENT_REQUESTS_EDIT', 
        name: 'Edit Event Requests', 
        description: 'Edit event request details',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_DELETE', 
        name: 'Delete Event Requests', 
        description: 'Delete event requests',
        level: 'admin'
      },
      { 
        key: 'EVENT_REQUESTS_SELF_SIGNUP', 
        name: 'Self-Signup for Roles', 
        description: 'Sign up self for driver/speaker/volunteer roles',
        level: 'action'
      },
      { 
        key: 'EVENT_REQUESTS_ASSIGN_OTHERS', 
        name: 'Assign Others to Roles', 
        description: 'Assign others to driver/speaker/volunteer roles',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_VIEW_ONLY', 
        name: 'View-Only Access', 
        description: 'View events with no edit/assignment capabilities',
        level: 'view'
      },
      { 
        key: 'EVENT_REQUESTS_EDIT_ALL_DETAILS', 
        name: 'Edit All Event Details', 
        description: 'Edit all event details (comprehensive)',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_SEND_TOOLKIT', 
        name: 'Send Toolkit & Mark Scheduled', 
        description: 'Send toolkit and mark events as scheduled',
        level: 'action'
      },
      { 
        key: 'EVENT_REQUESTS_FOLLOW_UP', 
        name: 'Use Follow-Up Buttons', 
        description: 'Use follow-up buttons (1 day, 1 month)',
        level: 'action'
      },
      { 
        key: 'EVENT_REQUESTS_INLINE_EDIT_TIMES', 
        name: 'Inline Edit Times', 
        description: 'Edit event/pickup times directly on cards',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_INLINE_EDIT_ADDRESS', 
        name: 'Inline Edit Address', 
        description: 'Edit event address directly on cards',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_INLINE_EDIT_SANDWICHES', 
        name: 'Inline Edit Sandwich Details', 
        description: 'Edit sandwich count/types directly on cards',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_INLINE_EDIT_STAFFING', 
        name: 'Inline Edit Staffing', 
        description: 'Edit staffing needs directly on cards',
        level: 'edit'
      },
      { 
        key: 'EVENT_REQUESTS_INLINE_EDIT_LOGISTICS', 
        name: 'Inline Edit Logistics', 
        description: 'Edit refrigeration/logistics on cards',
        level: 'edit'
      },
    ]
  },

  'Navigation Control': {
    icon: MapPin,
    description: 'Control which tabs appear in user navigation',
    permissions: [
      { 
        key: 'NAV_MY_ACTIONS', 
        name: 'My Actions Tab', 
        description: 'Show My Actions tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_DASHBOARD', 
        name: 'Dashboard Tab', 
        description: 'Show Dashboard tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_COLLECTIONS_LOG', 
        name: 'Collections Log Tab', 
        description: 'Show Collections Log tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_TEAM_CHAT', 
        name: 'Team Chat Tab', 
        description: 'Show Team Chat tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_INBOX', 
        name: 'Inbox Tab', 
        description: 'Show Inbox tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_SUGGESTIONS', 
        name: 'Suggestions Tab', 
        description: 'Show Suggestions tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_HOSTS', 
        name: 'Hosts Tab', 
        description: 'Show Hosts tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_DRIVERS', 
        name: 'Drivers Tab', 
        description: 'Show Drivers tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_VOLUNTEERS', 
        name: 'Volunteers Tab', 
        description: 'Show Volunteers tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_RECIPIENTS', 
        name: 'Recipients Tab', 
        description: 'Show Recipients tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_GROUPS_CATALOG', 
        name: 'Groups Catalog Tab', 
        description: 'Show Groups Catalog tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_DISTRIBUTION_TRACKING', 
        name: 'Distribution Tracking Tab', 
        description: 'Show Distribution Tracking tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_INVENTORY_CALCULATOR', 
        name: 'Inventory Calculator Tab', 
        description: 'Show Inventory Calculator tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_WORK_LOG', 
        name: 'Work Log Tab', 
        description: 'Show Work Log tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_EVENTS_GOOGLE_SHEET', 
        name: 'Events Google Sheet Tab', 
        description: 'Show Events Google Sheet tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_PROJECTS', 
        name: 'Projects Tab', 
        description: 'Show Projects tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_MEETINGS', 
        name: 'Meetings Tab', 
        description: 'Show Meetings tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_EVENT_PLANNING', 
        name: 'Event Requests Tab', 
        description: 'Show Event Requests tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_EVENT_REMINDERS', 
        name: 'Event Reminders Tab', 
        description: 'Show Event Reminders tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_ANALYTICS', 
        name: 'Analytics Tab', 
        description: 'Show Analytics tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_WEEKLY_MONITORING', 
        name: 'Weekly Monitoring Tab', 
        description: 'Show Weekly Monitoring tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_IMPORTANT_DOCUMENTS', 
        name: 'Important Documents Tab', 
        description: 'Show Important Documents tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_IMPORTANT_LINKS', 
        name: 'Important Links Tab', 
        description: 'Show Important Links tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_TOOLKIT', 
        name: 'Toolkit Tab', 
        description: 'Show Toolkit tab in navigation',
        level: 'access'
      },
      { 
        key: 'NAV_DOCUMENT_MANAGEMENT', 
        name: 'Document Management Tab', 
        description: 'Show Document Management tab in navigation',
        level: 'access'
      },
    ]
  },

  'Administrative Access': {
    icon: Shield,
    description: 'Administrative functions and panels',
    permissions: [
      { 
        key: 'ADMIN_PANEL_ACCESS', 
        name: 'Admin Panel Access', 
        description: 'Access to admin panel/user management',
        level: 'admin'
      },
    ]
  },
};

// Permission level styling
const PERMISSION_LEVELS = {
  view: { color: 'bg-blue-100 text-blue-800', icon: Eye },
  edit: { color: 'bg-green-100 text-green-800', icon: Edit },
  create: { color: 'bg-purple-100 text-purple-800', icon: Plus },
  admin: { color: 'bg-red-100 text-red-800', icon: Crown },
  action: { color: 'bg-orange-100 text-orange-800', icon: Settings },
  access: { color: 'bg-gray-100 text-gray-800', icon: Shield },
  receive: { color: 'bg-pink-100 text-pink-800', icon: Users },
};

// Role templates for quick assignment
const ROLE_TEMPLATES = {
  [USER_ROLES.VOLUNTEER]: {
    name: 'Volunteer',
    description: 'Basic access for volunteers',
    permissions: getDefaultPermissionsForRole(USER_ROLES.VOLUNTEER)
  },
  [USER_ROLES.HOST]: {
    name: 'Host Organization',
    description: 'Permissions for host organizations',
    permissions: getDefaultPermissionsForRole(USER_ROLES.HOST)
  },
  [USER_ROLES.CORE_TEAM]: {
    name: 'Core Team Member',
    description: 'Enhanced permissions for core team (includes meeting-project integration)',
    permissions: getDefaultPermissionsForRole(USER_ROLES.CORE_TEAM)
  },
  [USER_ROLES.COMMITTEE_MEMBER]: {
    name: 'Committee Member',
    description: 'Committee-level access',
    permissions: getDefaultPermissionsForRole(USER_ROLES.COMMITTEE_MEMBER)
  },
  [USER_ROLES.ADMIN]: {
    name: 'Administrator',
    description: 'Administrative access',
    permissions: getDefaultPermissionsForRole(USER_ROLES.ADMIN)
  },
  [USER_ROLES.SUPER_ADMIN]: {
    name: 'Super Administrator',
    description: 'Full system access',
    permissions: getDefaultPermissionsForRole(USER_ROLES.SUPER_ADMIN)
  },
};

export default function ModernPermissionsEditor({
  user,
  open,
  onOpenChange,
  onSave,
}: ModernPermissionsEditorProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('permissions');
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when user changes
  useEffect(() => {
    if (user) {
      setSelectedPermissions(user.permissions || []);
      setSelectedRole(user.role || 'volunteer');
      setHasChanges(false);
    }
  }, [user]);

  // Track changes
  useEffect(() => {
    if (user) {
      const permissionsChanged = JSON.stringify(selectedPermissions.sort()) !== 
                               JSON.stringify((user.permissions || []).sort());
      const roleChanged = selectedRole !== user.role;
      setHasChanges(permissionsChanged || roleChanged);
    }
  }, [selectedPermissions, selectedRole, user]);

  // Filter permissions based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return PERMISSION_CATEGORIES;
    
    const filtered: Partial<typeof PERMISSION_CATEGORIES> = {};
    
    Object.entries(PERMISSION_CATEGORIES).forEach(([categoryName, category]) => {
      const matchingPermissions = category.permissions.filter(perm =>
        perm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        perm.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        perm.key.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (matchingPermissions.length > 0) {
        filtered[categoryName as keyof typeof PERMISSION_CATEGORIES] = {
          ...category,
          permissions: matchingPermissions
        };
      }
    });
    
    return filtered;
  }, [searchQuery]);

  const handlePermissionToggle = (permissionKey: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionKey)
        ? prev.filter(p => p !== permissionKey)
        : [...prev, permissionKey]
    );
  };

  // Bulk toggle functions
  const handleCategoryToggle = (categoryName: string, enable: boolean) => {
    const category = PERMISSION_CATEGORIES[categoryName as keyof typeof PERMISSION_CATEGORIES];
    if (!category) return;
    
    const categoryPermissionKeys = category.permissions
      .filter(p => Object.values(PERMISSIONS).includes(p.key as any))
      .map(p => p.key);
    
    setSelectedPermissions(prev => {
      if (enable) {
        // Add all category permissions that aren't already selected
        const newPermissions = [...prev];
        categoryPermissionKeys.forEach(key => {
          if (!newPermissions.includes(key)) {
            newPermissions.push(key);
          }
        });
        return newPermissions;
      } else {
        // Remove all category permissions
        return prev.filter(p => !categoryPermissionKeys.includes(p));
      }
    });
  };

  const handleBulkToggle = (permissionKeys: string[], enable: boolean) => {
    setSelectedPermissions(prev => {
      if (enable) {
        const newPermissions = [...prev];
        permissionKeys.forEach(key => {
          if (!newPermissions.includes(key)) {
            newPermissions.push(key);
          }
        });
        return newPermissions;
      } else {
        return prev.filter(p => !permissionKeys.includes(p));
      }
    });
  };

  // Helper function to check if all permissions in a group are selected
  const areAllSelected = (permissionKeys: string[]) => {
    return permissionKeys.every(key => selectedPermissions.includes(key));
  };

  // Helper function to check if some permissions in a group are selected
  const areSomeSelected = (permissionKeys: string[]) => {
    return permissionKeys.some(key => selectedPermissions.includes(key));
  };

  const handleRoleTemplateApply = (templateRole: string) => {
    const template = ROLE_TEMPLATES[templateRole as keyof typeof ROLE_TEMPLATES];
    if (template) {
      setSelectedRole(templateRole);
      setSelectedPermissions(template.permissions);
    }
  };

  const handleSave = () => {
    if (user) {
      onSave(user.id, selectedRole, selectedPermissions);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setSelectedPermissions(user.permissions || []);
      setSelectedRole(user.role || 'volunteer');
      setHasChanges(false);
    }
    onOpenChange(false);
  };

  const permissionCount = selectedPermissions.length;
  const totalPermissions = Object.values(PERMISSION_CATEGORIES)
    .reduce((sum, cat) => sum + cat.permissions.length, 0);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Permissions - {user.firstName} {user.lastName}
          </DialogTitle>
          <DialogDescription>
            Manage user role and permissions. {permissionCount} of {totalPermissions} permissions selected.
          </DialogDescription>
        </DialogHeader>

        {/* Global actions */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPermissions([])}
                className="text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allPermissions = Object.values(PERMISSION_CATEGORIES)
                    .flatMap(cat => cat.permissions)
                    .filter(p => Object.values(PERMISSIONS).includes(p.key as any))
                    .map(p => p.key);
                  setSelectedPermissions(allPermissions);
                }}
                className="text-green-600 hover:bg-green-50"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{permissionCount}</span> of{' '}
              <span className="font-medium">{totalPermissions}</span> permissions selected
            </div>
          </div>
          
          {/* Level-based toggles */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">By level:</span>
            {Object.entries(PERMISSION_LEVELS).map(([level, levelInfo]) => {
              const levelPermissions = Object.values(PERMISSION_CATEGORIES)
                .flatMap(cat => cat.permissions)
                .filter(p => p.level === level && Object.values(PERMISSIONS).includes(p.key as any))
                .map(p => p.key);
              
              if (levelPermissions.length === 0) return null;
              
              const allLevelSelected = areAllSelected(levelPermissions);
              const LevelIcon = levelInfo.icon;
              
              return (
                <TooltipProvider key={level}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkToggle(levelPermissions, !allLevelSelected)}
                        className={`text-xs ${allLevelSelected ? levelInfo.color : 'hover:bg-gray-50'}`}
                      >
                        <LevelIcon className="h-3 w-3 mr-1" />
                        {level}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Toggle all {level}-level permissions ({levelPermissions.length} total)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">Role Templates</TabsTrigger>
            <TabsTrigger value="permissions">Custom Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="flex-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Quick Role Assignment</h3>
                <Badge variant="outline">
                  Current: {ROLE_TEMPLATES[selectedRole as keyof typeof ROLE_TEMPLATES]?.name || selectedRole}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(ROLE_TEMPLATES).map(([roleKey, template]) => (
                  <Card 
                    key={roleKey}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedRole === roleKey ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handleRoleTemplateApply(roleKey)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        {template.name}
                        {selectedRole === roleKey && (
                          <Check className="h-4 w-4 text-blue-500" />
                        )}
                      </CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {template.permissions.length} permissions included
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.permissions.slice(0, 3).map(perm => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm.replace('PERMISSIONS.', '').replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {template.permissions.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.permissions.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search permissions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_TEMPLATES).map(([roleKey, template]) => (
                      <SelectItem key={roleKey} value={roleKey}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-6">
                  {Object.entries(filteredCategories).map(([categoryName, category]) => {
                    const CategoryIcon = category.icon;
                    const categoryPermissions = category.permissions.filter(p => 
                      Object.values(PERMISSIONS).includes(p.key as any)
                    );
                    
                    if (categoryPermissions.length === 0) return null;

                    // Define bulk toggle groups for this category
                    const getBulkToggleGroups = (categoryName: string, permissions: typeof categoryPermissions) => {
                      const groups: { name: string; permissions: string[]; description: string }[] = [];
                      
                      // CRUD operations for data entities
                      if (categoryName === 'Data Management') {
                        const entities = ['HOSTS', 'RECIPIENTS', 'DRIVERS', 'COLLECTIONS', 'DISTRIBUTIONS'];
                        entities.forEach(entity => {
                          const entityPerms = permissions.filter(p => p.key.startsWith(entity + '_')).map(p => p.key);
                          if (entityPerms.length > 1) {
                            groups.push({
                              name: `All ${entity.toLowerCase()} operations`,
                              permissions: entityPerms,
                              description: `View, add, edit, delete ${entity.toLowerCase()}`
                            });
                          }
                        });
                      }
                      
                      // Navigation tabs
                      if (categoryName === 'Navigation Control') {
                        groups.push({
                          name: 'All Navigation Tabs',
                          permissions: permissions.map(p => p.key),
                          description: 'Enable all navigation tabs'
                        });
                        
                        // Group by functional areas
                        const navGroups = {
                          'Core Tabs': ['NAV_MY_ACTIONS', 'NAV_DASHBOARD', 'NAV_INBOX'],
                          'Data Tabs': ['NAV_HOSTS', 'NAV_DRIVERS', 'NAV_VOLUNTEERS', 'NAV_RECIPIENTS', 'NAV_GROUPS_CATALOG'],
                          'Event Tabs': ['NAV_EVENT_PLANNING', 'NAV_EVENT_REMINDERS', 'NAV_EVENTS_GOOGLE_SHEET'],
                          'Work Tabs': ['NAV_PROJECTS', 'NAV_WORK_LOG', 'NAV_MEETINGS'],
                          'Resource Tabs': ['NAV_TOOLKIT', 'NAV_IMPORTANT_DOCUMENTS', 'NAV_IMPORTANT_LINKS', 'NAV_DOCUMENT_MANAGEMENT'],
                          'Analysis Tabs': ['NAV_ANALYTICS', 'NAV_WEEKLY_MONITORING', 'NAV_COLLECTIONS_LOG', 'NAV_DISTRIBUTION_TRACKING', 'NAV_INVENTORY_CALCULATOR']
                        };
                        
                        Object.entries(navGroups).forEach(([groupName, navKeys]) => {
                          const groupPerms = permissions.filter(p => navKeys.includes(p.key)).map(p => p.key);
                          if (groupPerms.length > 0) {
                            groups.push({
                              name: groupName,
                              permissions: groupPerms,
                              description: `Enable ${groupName.toLowerCase()}`
                            });
                          }
                        });
                      }
                      
                      // Event Request inline editing
                      if (categoryName === 'Event Request Management') {
                        const inlineEditPerms = permissions.filter(p => p.key.includes('INLINE_EDIT')).map(p => p.key);
                        if (inlineEditPerms.length > 0) {
                          groups.push({
                            name: 'All Inline Editing',
                            permissions: inlineEditPerms,
                            description: 'Enable all inline editing on event cards'
                          });
                        }
                      }
                      
                      // Chat rooms
                      if (categoryName === 'Communication') {
                        const chatPerms = permissions.filter(p => p.key.startsWith('CHAT_')).map(p => p.key);
                        if (chatPerms.length > 0) {
                          groups.push({
                            name: 'All Chat Rooms',
                            permissions: chatPerms,
                            description: 'Access to all chat rooms'
                          });
                        }
                        
                        const messagePerms = permissions.filter(p => p.key.startsWith('MESSAGES_')).map(p => p.key);
                        if (messagePerms.length > 0) {
                          groups.push({
                            name: 'All Message Operations',
                            permissions: messagePerms,
                            description: 'View, send, edit, delete, moderate messages'
                          });
                        }
                      }
                      
                      // Work logs
                      if (categoryName === 'Work & Time Tracking') {
                        const ownPerms = permissions.filter(p => p.key.includes('_OWN')).map(p => p.key);
                        const allPerms = permissions.filter(p => p.key.includes('_ALL')).map(p => p.key);
                        
                        if (ownPerms.length > 0) {
                          groups.push({
                            name: 'Own Work Logs',
                            permissions: ownPerms,
                            description: 'Manage your own work logs'
                          });
                        }
                        if (allPerms.length > 0) {
                          groups.push({
                            name: 'All Work Logs (Admin)',
                            permissions: allPerms,
                            description: 'Manage all users\' work logs'
                          });
                        }
                      }
                      
                      // Projects
                      if (categoryName === 'Project Management') {
                        const ownPerms = permissions.filter(p => p.key.includes('_OWN')).map(p => p.key);
                        const allPerms = permissions.filter(p => p.key.includes('_ALL')).map(p => p.key);
                        
                        if (ownPerms.length > 0) {
                          groups.push({
                            name: 'Own Projects',
                            permissions: ownPerms,
                            description: 'Manage your own projects'
                          });
                        }
                        if (allPerms.length > 0) {
                          groups.push({
                            name: 'All Projects (Admin)',
                            permissions: allPerms,
                            description: 'Manage all projects'
                          });
                        }
                      }
                      
                      return groups;
                    };

                    const bulkGroups = getBulkToggleGroups(categoryName, categoryPermissions);
                    const allCategoryPermissions = categoryPermissions.map(p => p.key);
                    const allSelected = areAllSelected(allCategoryPermissions);
                    const someSelected = areSomeSelected(allCategoryPermissions);

                    return (
                      <Card key={categoryName}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <CategoryIcon className="h-4 w-4" />
                                {categoryName}
                              </CardTitle>
                              <CardDescription>{category.description}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCategoryToggle(categoryName, !allSelected)}
                                      className={`${someSelected && !allSelected ? 'bg-orange-50 border-orange-200' : ''}`}
                                    >
                                      {allSelected ? (
                                        <>
                                          <CheckSquare className="h-4 w-4 mr-1" />
                                          All On
                                        </>
                                      ) : someSelected ? (
                                        <>
                                          <Square className="h-4 w-4 mr-1" />
                                          Some On
                                        </>
                                      ) : (
                                        <>
                                          <Square className="h-4 w-4 mr-1" />
                                          All Off
                                        </>
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Toggle all permissions in this category</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          
                          {/* Bulk toggle groups */}
                          {bulkGroups.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">Quick toggles:</p>
                              <div className="flex flex-wrap gap-2">
                                {bulkGroups.map(group => {
                                  const groupAllSelected = areAllSelected(group.permissions);
                                  const groupSomeSelected = areSomeSelected(group.permissions);
                                  
                                  return (
                                    <TooltipProvider key={group.name}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleBulkToggle(group.permissions, !groupAllSelected)}
                                            className={`text-xs ${
                                              groupAllSelected 
                                                ? 'bg-green-50 border-green-200 text-green-700' 
                                                : groupSomeSelected 
                                                  ? 'bg-orange-50 border-orange-200 text-orange-700'
                                                  : 'hover:bg-gray-50'
                                            }`}
                                          >
                                            {groupAllSelected ? (
                                              <ToggleRight className="h-3 w-3 mr-1" />
                                            ) : (
                                              <ToggleLeft className="h-3 w-3 mr-1" />
                                            )}
                                            {group.name}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{group.description}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {categoryPermissions.map(permission => {
                              const isSelected = selectedPermissions.includes(permission.key);
                              const levelInfo = PERMISSION_LEVELS[permission.level as keyof typeof PERMISSION_LEVELS];
                              const LevelIcon = levelInfo?.icon || Shield;
                              
                              return (
                                <div
                                  key={permission.key}
                                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <Switch
                                      checked={isSelected}
                                      onCheckedChange={() => handlePermissionToggle(permission.key)}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{permission.name}</span>
                                        <Badge 
                                          variant="secondary" 
                                          className={`text-xs ${levelInfo?.color || ''}`}
                                        >
                                          <LevelIcon className="h-3 w-3 mr-1" />
                                          {permission.level}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {permission.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {hasChanges && (
              <>
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span>You have unsaved changes</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
