import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  USER_ROLES,
  PERMISSIONS,
  getDefaultPermissionsForRole,
  getRoleDisplayName,
} from "@shared/auth-utils";
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
  FormInput,
  Zap,
  Plus,
  User,
  Globe,
  Lock,
  Unlock,
  MapPin,
  ClipboardList,
  BarChart3,
  BookOpen,
  Clock,
  CheckCircle,
  Star,
  HelpCircle,
  Trash2,
  PlusCircle,
  Search,
  AlertTriangle,
  Upload,
} from "lucide-react";

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

// Complete permissions structure as specified
const PERMISSION_CATEGORIES = [
  {
    id: "collections_data",
    label: "📊 Collections & Data",
    description: "Collection data entry and management",
    icon: BarChart3,
    color: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-600",
    permissions: [
      { 
        key: PERMISSIONS.CREATE_COLLECTIONS, 
        label: "Submit collections", 
        description: "Auto-includes edit/delete own collections",
        icon: Database,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_COLLECTIONS', 'DELETE_OWN_COLLECTIONS']
      },
      { 
        key: PERMISSIONS.EDIT_ALL_COLLECTIONS, 
        label: "Manage ALL collections", 
        description: "Edit/delete anyone's collection entries",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.USE_COLLECTION_WALKTHROUGH, 
        label: "Collection walkthrough", 
        description: "Access to simplified step-by-step form",
        icon: FormInput,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_COLLECTIONS, 
        label: "View collections (granular)", 
        description: "Granular permission to view collection data",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.EXPORT_DATA, 
        label: "Export collection data", 
        description: "Download collections as CSV/PDF reports",
        icon: FileText,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.IMPORT_DATA, 
        label: "Import collection data", 
        description: "Upload and import collection data",
        icon: Plus,
        dangerLevel: "elevated"
      },
    ]
  },
  {
    id: "communication",
    label: "💬 Communication",
    description: "Team chat and direct messaging",
    icon: MessageCircle,
    color: "bg-green-50 border-green-200",
    iconColor: "text-green-600",
    permissions: [
      { 
        key: 'GENERAL_CHAT', 
        label: "General chat", 
        description: "Can edit/delete own messages",
        icon: MessageCircle,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_CHAT_MESSAGES', 'DELETE_OWN_CHAT_MESSAGES']
      },
      { 
        key: 'CORE_TEAM_CHAT', 
        label: "Core team chat", 
        description: "Can edit/delete own messages",
        icon: Users,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_CHAT_MESSAGES', 'DELETE_OWN_CHAT_MESSAGES']
      },
      { 
        key: 'HOST_CHAT', 
        label: "Host chat", 
        description: "Can edit/delete own messages",
        icon: Building,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_CHAT_MESSAGES', 'DELETE_OWN_CHAT_MESSAGES']
      },
      { 
        key: 'RECIPIENT_CHAT', 
        label: "Recipient chat", 
        description: "Can edit/delete own messages",
        icon: UserCheck,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_CHAT_MESSAGES', 'DELETE_OWN_CHAT_MESSAGES']
      },
      { 
        key: 'DRIVER_CHAT', 
        label: "Driver chat", 
        description: "Can edit/delete own messages",
        icon: Truck,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_CHAT_MESSAGES', 'DELETE_OWN_CHAT_MESSAGES']
      },
      { 
        key: 'MODERATE_ALL_CHAT', 
        label: "Moderate ALL chat messages", 
        description: "Delete and moderate any chat message",
        icon: Shield,
        dangerLevel: "dangerous"
      },
      { 
        key: PERMISSIONS.ACCESS_MESSAGES, 
        label: "Send direct messages", 
        description: "No edit/delete after sending",
        icon: Mail,
        dangerLevel: "safe"
      },
      { 
        key: 'DELETE_ALL_MESSAGES', 
        label: "Delete ALL messages", 
        description: "Admin only - permanent message deletion",
        icon: Trash2,
        dangerLevel: "dangerous"
      },
      { 
        key: PERMISSIONS.ACCESS_CHAT, 
        label: "View chat (granular)", 
        description: "Granular permission to view chat channels",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_MESSAGES, 
        label: "View messages (granular)", 
        description: "Granular permission to view direct messages",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.SEND_MESSAGES, 
        label: "Send messages (granular)", 
        description: "Granular permission to send direct messages",
        icon: Send,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.MODERATE_MESSAGES, 
        label: "Moderate messages (granular)", 
        description: "Granular permission to moderate messages",
        icon: Shield,
        dangerLevel: "elevated"
      },
    ]
  },
  {
    id: "projects_tasks",
    label: "📁 Projects & Tasks",
    description: "Project and task management",
    icon: FolderOpen,
    color: "bg-purple-50 border-purple-200",
    iconColor: "text-purple-600",
    permissions: [
      { 
        key: PERMISSIONS.CREATE_PROJECTS, 
        label: "Create projects", 
        description: "Auto-includes edit/delete own projects",
        icon: PlusCircle,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_PROJECTS', 'DELETE_OWN_PROJECTS']
      },
      { 
        key: 'MANAGE_ALL_PROJECTS', 
        label: "Manage ALL projects", 
        description: "Edit/delete any project",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.ACCESS_PROJECTS, 
        label: "View projects (granular)", 
        description: "Granular permission to view project information",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_MEETINGS, 
        label: "View meetings (granular)", 
        description: "Granular permission to view meeting information",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.MANAGE_MEETINGS, 
        label: "Manage meetings (granular)", 
        description: "Granular permission to create/edit meetings",
        icon: Edit,
        dangerLevel: "elevated"
      },
    ]
  },
  {
    id: "work_tracking",
    label: "⏱️ Work Tracking",
    description: "Time and work log management",
    icon: Clock,
    color: "bg-indigo-50 border-indigo-200",
    iconColor: "text-indigo-600",
    permissions: [
      { 
        key: PERMISSIONS.CREATE_WORK_LOGS, 
        label: "Submit work logs", 
        description: "Auto-includes view/edit/delete own logs",
        icon: Clock,
        dangerLevel: "safe",
        autoBundles: ['VIEW_OWN_WORK_LOGS', 'EDIT_OWN_WORK_LOGS', 'DELETE_OWN_WORK_LOGS']
      },
      { 
        key: PERMISSIONS.VIEW_ALL_WORK_LOGS, 
        label: "View ALL work logs", 
        description: "Read-only access to everyone's work logs",
        icon: Eye,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.ACCESS_WORK_LOGS, 
        label: "View work logs (granular)", 
        description: "Granular permission to view work log section",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.EDIT_ALL_WORK_LOGS, 
        label: "Edit ALL work logs (granular)", 
        description: "Granular permission to edit any work log",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.DELETE_ALL_WORK_LOGS, 
        label: "Delete ALL work logs (granular)", 
        description: "Granular permission to delete any work log",
        icon: Trash2,
        dangerLevel: "dangerous"
      },
      { 
        key: PERMISSIONS.ACCESS_WEEKLY_MONITORING, 
        label: "View weekly monitoring", 
        description: "Access weekly monitoring dashboard and status",
        icon: Clock,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.MANAGE_WEEKLY_MONITORING, 
        label: "Manage weekly monitoring", 
        description: "Send notifications and manage monitoring alerts",
        icon: Settings,
        dangerLevel: "elevated"
      },
    ]
  },
  {
    id: "resources_tools",
    label: "🛠️ Resources & Tools",
    description: "Access to organizational resources and development tools",
    icon: FolderOpen,
    color: "bg-orange-50 border-orange-200",
    iconColor: "text-orange-600",
    permissions: [
      { 
        key: PERMISSIONS.ACCESS_TOOLKIT, 
        label: "View toolkit", 
        description: "Access to organizational documents and resources",
        icon: FolderOpen,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_DEVELOPMENT, 
        label: "View development", 
        description: "Access development tools and system information",
        icon: FileText,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.MANAGE_DEVELOPMENT, 
        label: "Manage development", 
        description: "Access to system logs and development controls",
        icon: Settings,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.ACCESS_EVENTS, 
        label: "View events", 
        description: "Access to events calendar and scheduling",
        icon: Calendar,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.MANAGE_EVENTS, 
        label: "Manage events", 
        description: "Create, edit, and delete events",
        icon: Settings,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.ACCESS_SIGNUP_GENIUS, 
        label: "View SignUp Genius", 
        description: "Access to volunteer signup coordination",
        icon: Users,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.MANAGE_SIGNUP_GENIUS, 
        label: "Manage SignUp Genius", 
        description: "Create and manage volunteer signups",
        icon: Settings,
        dangerLevel: "elevated"
      },
    ]
  },
  {
    id: "directory_access",
    label: "📋 Directory Access",
    description: "Contact directory management",
    icon: Users,
    color: "bg-teal-50 border-teal-200",
    iconColor: "text-teal-600",
    permissions: [
      { 
        key: PERMISSIONS.ACCESS_HOSTS, 
        label: "Host directory", 
        description: "View host contact information",
        icon: Building,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_RECIPIENTS, 
        label: "Recipient directory", 
        description: "View recipient contact information",
        icon: UserCheck,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_DRIVERS, 
        label: "Driver directory", 
        description: "View driver contact information",
        icon: Truck,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_VOLUNTEERS, 
        label: "Volunteer directory", 
        description: "View volunteer contact information",
        icon: Users,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.MANAGE_HOSTS, 
        label: "Edit host info", 
        description: "Modify host details and status",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.MANAGE_RECIPIENTS, 
        label: "Edit recipient info", 
        description: "Modify recipient details and status",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.MANAGE_DRIVERS, 
        label: "Edit driver info", 
        description: "Modify driver details and status",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.MANAGE_VOLUNTEERS, 
        label: "Edit volunteer info", 
        description: "Modify volunteer details and status",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.VIEW_VOLUNTEERS, 
        label: "View volunteers (granular)", 
        description: "Granular permission to view volunteer information",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ADD_VOLUNTEERS, 
        label: "Add volunteers (granular)", 
        description: "Granular permission to add new volunteers",
        icon: Plus,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.EDIT_VOLUNTEERS, 
        label: "Edit volunteers (granular)", 
        description: "Granular permission to edit volunteer information",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.VIEW_RECIPIENTS, 
        label: "View recipients (granular)", 
        description: "Granular permission to view recipient information",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ADD_RECIPIENTS, 
        label: "Add recipients (granular)", 
        description: "Granular permission to add new recipients",
        icon: Plus,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.EDIT_RECIPIENTS, 
        label: "Edit recipients (granular)", 
        description: "Granular permission to edit recipient information",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.DELETE_RECIPIENTS, 
        label: "Delete recipients (granular)", 
        description: "Granular permission to delete recipients",
        icon: Trash2,
        dangerLevel: "high"
      },
      { 
        key: PERMISSIONS.VIEW_HOSTS, 
        label: "View hosts (granular)", 
        description: "Granular permission to view host information",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ADD_HOSTS, 
        label: "Add hosts (granular)", 
        description: "Granular permission to add new hosts",
        icon: Plus,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.EDIT_HOSTS, 
        label: "Edit hosts (granular)", 
        description: "Granular permission to edit host information",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.DELETE_HOSTS, 
        label: "Delete hosts (granular)", 
        description: "Granular permission to delete hosts",
        icon: Trash2,
        dangerLevel: "high"
      },
      { 
        key: PERMISSIONS.VIEW_DRIVERS, 
        label: "View drivers (granular)", 
        description: "Granular permission to view driver information",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ADD_DRIVERS, 
        label: "Add drivers (granular)", 
        description: "Granular permission to add new drivers",
        icon: Plus,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.EDIT_DRIVERS, 
        label: "Edit drivers (granular)", 
        description: "Granular permission to edit driver information",
        icon: Edit,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.DELETE_DRIVERS, 
        label: "Delete drivers (granular)", 
        description: "Granular permission to delete drivers",
        icon: Trash2,
        dangerLevel: "high"
      },
      { 
        key: PERMISSIONS.MANAGE_DIRECTORY, 
        label: "Edit directory contacts", 
        description: "Add/edit general contacts in directory",
        icon: Edit,
        dangerLevel: "elevated"
      },
    ]
  },
  {
    id: "platform_tools",
    label: "🛠️ Platform Tools",
    description: "Analytics and platform features",
    icon: Settings,
    color: "bg-orange-50 border-orange-200",
    iconColor: "text-orange-600",
    permissions: [
      { 
        key: PERMISSIONS.ACCESS_ANALYTICS, 
        label: "Analytics access", 
        description: "View reports and data analytics",
        icon: BarChart3,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_SANDWICH_DATA, 
        label: "Reports access", 
        description: "Generate and download reports",
        icon: FileText,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.CREATE_SUGGESTIONS, 
        label: "Suggestions", 
        description: "Auto-includes submit/edit/delete own",
        icon: Lightbulb,
        dangerLevel: "safe",
        autoBundles: ['EDIT_OWN_SUGGESTIONS', 'DELETE_OWN_SUGGESTIONS']
      },
      { 
        key: PERMISSIONS.MANAGE_SUGGESTIONS, 
        label: "Manage ALL suggestions", 
        description: "Review and respond to all suggestions",
        icon: Settings,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.MANAGE_ANNOUNCEMENTS, 
        label: "Announcements access", 
        description: "Create and manage announcements",
        icon: Send,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.ACCESS_TOOLKIT, 
        label: "View toolkit (granular)", 
        description: "Granular permission to view toolkit section",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_SUGGESTIONS, 
        label: "View suggestions (granular)", 
        description: "Granular permission to view suggestions section",
        icon: Eye,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.SUBMIT_SUGGESTIONS, 
        label: "Submit suggestions (granular)", 
        description: "Granular permission to submit new suggestions",
        icon: Plus,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.ACCESS_GOVERNANCE, 
        label: "View governance (granular)", 
        description: "Granular permission to view governance documents",
        icon: FileText,
        dangerLevel: "safe"
      },
      { 
        key: PERMISSIONS.EDIT_DATA, 
        label: "Edit data (granular)", 
        description: "Granular permission for general data editing",
        icon: Edit,
        dangerLevel: "elevated"
      },
    ]
  },
  {
    id: "administration",
    label: "👥 Administration",
    description: "User and system administration",
    icon: Shield,
    color: "bg-red-50 border-red-200",
    iconColor: "text-red-600",
    permissions: [
      { 
        key: 'VIEW_ALL_USERS', 
        label: "View all users", 
        description: "See user list and basic information",
        icon: Eye,
        dangerLevel: "elevated"
      },
      { 
        key: 'BASIC_USER_SUPPORT', 
        label: "Basic user support", 
        description: "Password resets, view permissions",
        icon: HelpCircle,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.MANAGE_USERS, 
        label: "Full user management", 
        description: "Create/edit accounts, set permissions",
        icon: Users,
        dangerLevel: "dangerous"
      },
      { 
        key: 'SYSTEM_ADMINISTRATOR', 
        label: "System administrator", 
        description: "FULL platform access - dangerous",
        icon: Shield,
        dangerLevel: "dangerous"
      },
      { 
        key: PERMISSIONS.ADMIN_ACCESS, 
        label: "Admin panel access (granular)", 
        description: "Granular permission to access admin panel",
        icon: Eye,
        dangerLevel: "elevated"
      },
      { 
        key: PERMISSIONS.VIEW_PHONE_DIRECTORY, 
        label: "View directory (granular)", 
        description: "Granular permission to view phone directory",
        icon: Eye,
        dangerLevel: "safe"
      },

    ]
  }
];

// Permission presets as specified
const PERMISSION_PRESETS = [
  {
    id: 'all_permissions',
    label: 'ALL Permissions',
    description: 'Complete system access with every permission',
    permissions: [
      // Core system permissions from PERMISSIONS object
      ...Object.values(PERMISSIONS),
      // Additional administrative permissions
      'VIEW_ALL_USERS',
      'BASIC_USER_SUPPORT',
      'SYSTEM_ADMINISTRATOR',
      'MODERATE_ALL_CHAT',
      'DELETE_ALL_MESSAGES',
      'MANAGE_ALL_PROJECTS',
      'MANAGE_ALL_KUDOS',
      'MANAGE_ANNOUNCEMENTS',
      'SCHEDULE_REPORTS'
    ]
  },
  {
    id: 'basic_volunteer',
    label: 'Basic Volunteer',
    description: 'Collections + general chat',
    permissions: [PERMISSIONS.CREATE_COLLECTIONS, 'GENERAL_CHAT']
  },
  {
    id: 'host_team_member',
    label: 'Host Team Member',
    description: 'Host operations and communications',
    permissions: [PERMISSIONS.CREATE_COLLECTIONS, PERMISSIONS.ACCESS_HOSTS, 'HOST_CHAT', 'GENERAL_CHAT', PERMISSIONS.USE_COLLECTION_WALKTHROUGH]
  },
  {
    id: 'recipient_team_member',
    label: 'Recipient Team Member',
    description: 'Recipient operations and communications',
    permissions: [PERMISSIONS.ACCESS_RECIPIENTS, 'RECIPIENT_CHAT', 'GENERAL_CHAT']
  },
  {
    id: 'driver_team_member',
    label: 'Driver Team Member',
    description: 'Driver operations and communications',
    permissions: [PERMISSIONS.ACCESS_DRIVERS, 'DRIVER_CHAT', 'GENERAL_CHAT']
  },
  {
    id: 'core_team_member',
    label: 'Core Team Member',
    description: 'Core team access and enhanced permissions',
    permissions: [
      PERMISSIONS.CREATE_COLLECTIONS, 
      PERMISSIONS.CREATE_PROJECTS, 
      PERMISSIONS.ACCESS_ANALYTICS,
      'CORE_TEAM_CHAT', 
      'GENERAL_CHAT',
      PERMISSIONS.ACCESS_HOSTS,
      PERMISSIONS.ACCESS_RECIPIENTS,
      PERMISSIONS.ACCESS_DRIVERS
    ]
  },
  {
    id: 'demo_user_access',
    label: 'Demo User',
    description: 'View-only access to all sections without edit permissions - perfect for demonstrations',
    permissions: [
      // View all main sections
      PERMISSIONS.ACCESS_DIRECTORY,
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
      'GENERAL_CHAT',
      'COMMITTEE_CHAT',
      'HOST_CHAT',
      'DRIVER_CHAT',
      'RECIPIENT_CHAT',
      'CORE_TEAM_CHAT',
      // Basic permissions
      PERMISSIONS.RECEIVE_KUDOS,
      PERMISSIONS.VIEW_KUDOS,
      PERMISSIONS.EXPORT_DATA
    ]
  },
  {
    id: 'team_lead',
    label: 'Team Lead',
    description: 'Leadership with elevated permissions',
    permissions: [
      PERMISSIONS.CREATE_COLLECTIONS,
      PERMISSIONS.EDIT_ALL_COLLECTIONS,
      PERMISSIONS.CREATE_PROJECTS,
      'MANAGE_ALL_PROJECTS',
      PERMISSIONS.ACCESS_ANALYTICS,
      PERMISSIONS.ACCESS_SANDWICH_DATA,
      PERMISSIONS.MANAGE_HOSTS,
      PERMISSIONS.MANAGE_RECIPIENTS,
      PERMISSIONS.MANAGE_DRIVERS,
      'CORE_TEAM_CHAT',
      'GENERAL_CHAT'
    ]
  },
  {
    id: 'administrator',
    label: 'Administrator',
    description: 'Full administrative access',
    permissions: [
      PERMISSIONS.MANAGE_USERS,
      'VIEW_ALL_USERS',
      'BASIC_USER_SUPPORT',
      PERMISSIONS.MANAGE_ANNOUNCEMENTS,
      PERMISSIONS.MANAGE_SUGGESTIONS,
      'MODERATE_ALL_CHAT'
    ]
  }
];

// Role presets with enhanced descriptions
const ROLE_PRESETS = [
  {
    role: USER_ROLES.SUPER_ADMIN,
    label: "Super Administrator",
    description: "Complete system access with all permissions",
    icon: Crown,
    color: "text-red-600 bg-red-50 border-red-200"
  },
  {
    role: USER_ROLES.ADMIN,
    label: "Administrator", 
    description: "Full administrative access to manage users and content",
    icon: Shield,
    color: "text-orange-600 bg-orange-50 border-orange-200"
  },
  {
    role: USER_ROLES.COMMITTEE_MEMBER,
    label: "Committee Member",
    description: "Access to planning tools and data management",
    icon: Users,
    color: "text-blue-600 bg-blue-50 border-blue-200"
  },
  {
    role: USER_ROLES.HOST,
    label: "Host",
    description: "Submit collections and access operational tools",
    icon: Building,
    color: "text-green-600 bg-green-50 border-green-200"
  },
  {
    role: USER_ROLES.CORE_TEAM,
    label: "Core Team",
    description: "Enhanced permissions for trusted operational team members",
    icon: Star,
    color: "text-purple-600 bg-purple-50 border-purple-200"
  },
  {
    role: USER_ROLES.VOLUNTEER,
    label: "Volunteer",
    description: "Basic access with collection submission capabilities",
    icon: Heart,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200"
  },
  {
    role: USER_ROLES.RECIPIENT,
    label: "Recipient",
    description: "Limited access with feedback submission",
    icon: UserCheck,
    color: "text-teal-600 bg-teal-50 border-teal-200"
  },
  {
    role: USER_ROLES.DRIVER,
    label: "Driver",
    description: "Access to logistics and delivery information",
    icon: Truck,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200"
  },
  {
    role: USER_ROLES.VIEWER,
    label: "Viewer",
    description: "Read-only access to basic information",
    icon: Eye,
    color: "text-gray-600 bg-gray-50 border-gray-200"
  }
];

function Crown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm8 8h4" />
    </svg>
  );
}

export default function EnhancedPermissionsDialog({
  user,
  open,
  onOpenChange,
  onSave,
}: EnhancedPermissionsDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("role");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDangerWarning, setShowDangerWarning] = useState(false);
  const [pendingDangerousPermission, setPendingDangerousPermission] = useState<string | null>(null);

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
    // Check if this is a dangerous permission that requires confirmation
    const isDangerous = PERMISSION_CATEGORIES.some(category => 
      category.permissions?.some(p => p.key === permission && p.dangerLevel === 'dangerous')
    );
    
    if (checked && isDangerous) {
      setPendingDangerousPermission(permission);
      setShowDangerWarning(true);
      return;
    }
    
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permission]);
    } else {
      setSelectedPermissions(
        selectedPermissions.filter((p) => p !== permission),
      );
    }
  };

  const handleDangerousPermissionConfirm = () => {
    if (pendingDangerousPermission) {
      setSelectedPermissions([...selectedPermissions, pendingDangerousPermission]);
      setPendingDangerousPermission(null);
    }
    setShowDangerWarning(false);
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = PERMISSION_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPermissions(preset.permissions);
    }
  };

  // Filter permissions based on search query
  const filteredCategories = PERMISSION_CATEGORIES.map(category => ({
    ...category,
    permissions: category.permissions?.filter(permission =>
      !searchQuery || 
      permission.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permission.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => !searchQuery || category.permissions?.length > 0);

  const handleSave = () => {
    if (user) {
      // Deduplicate permissions before saving to prevent database inconsistencies
      const deduplicatedPermissions = Array.from(new Set(selectedPermissions));
      onSave(user.id, selectedRole, deduplicatedPermissions);
      onOpenChange(false);
    }
  };

  const isPermissionChecked = (permission: string) => {
    return selectedPermissions.includes(permission);
  };

  // Category selection helpers
  const getCategoryStatus = (category: any) => {
    const categoryPermissions = category.permissions.map((p: any) => p.key);
    const checkedCount = categoryPermissions.filter((p: string) =>
      selectedPermissions.includes(p),
    ).length;

    if (checkedCount === 0) return "none";
    if (checkedCount === categoryPermissions.length) return "all";
    return "partial";
  };

  const handleCategoryToggle = (category: any) => {
    const categoryPermissions = category.permissions.map((p: any) => p.key);
    const status = getCategoryStatus(category);

    if (status === "all") {
      // Remove all category permissions
      setSelectedPermissions(
        selectedPermissions.filter((p) => !categoryPermissions.includes(p)),
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "all":
        return <CheckSquare className="h-4 w-4" />;
      case "partial":
        return <Minus className="h-4 w-4" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  const getSelectedRolePreset = () => {
    return ROLE_PRESETS.find(preset => preset.role === selectedRole);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900">
                Edit Permissions
              </div>
              <div className="text-sm text-gray-500 font-normal">
                {user.firstName} {user.lastName} • {user.email}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            Configure access levels and permissions for this user. Choose a role preset for quick setup or customize individual permissions.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="role" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Role Presets
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Custom Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="role" className="flex-1">
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 p-1">
                <div className="text-sm text-gray-600 mb-4">
                  Select a role to automatically apply the appropriate permissions for that user type.
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ROLE_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedRole === preset.role;
                    
                    return (
                      <Card 
                        key={preset.role} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected 
                            ? `border-2 ${preset.color} shadow-md` 
                            : 'border border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleRoleChange(preset.role)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isSelected ? preset.color : 'bg-gray-100'}`}>
                              <Icon className={`h-5 w-5 ${isSelected ? preset.color.split(' ')[0] : 'text-gray-600'}`} />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{preset.label}</CardTitle>
                              <CardDescription className="text-sm">
                                {preset.description}
                              </CardDescription>
                            </div>
                            {isSelected && (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                        </CardHeader>
                        {isSelected && (
                          <CardContent className="pt-0">
                            <div className="text-xs text-gray-500">
                              {getDefaultPermissionsForRole(preset.role).length} permissions included
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {selectedRole && (
                  <Card className="mt-6 bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-800">
                        <CheckCircle className="h-5 w-5" />
                        Selected Role: {getRoleDisplayName(selectedRole)}
                      </CardTitle>
                      <CardDescription className="text-blue-700">
                        This role includes {selectedPermissions.length} permissions. 
                        Switch to the Custom Permissions tab to modify individual permissions.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="permissions" className="flex-1">
            <div className="space-y-4 mb-4">
              {/* Permission Presets and Search */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quick Permission Presets</Label>
                  <Select onValueChange={handlePresetSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMISSION_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          <div className="flex flex-col text-left">
                            <span className="font-medium">{preset.label}</span>
                            <span className="text-xs text-gray-500">{preset.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Search Permissions</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search permissions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-6 p-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Individual Permissions</h3>
                    <p className="text-sm text-gray-600">
                      Fine-tune access by selecting specific permissions. 
                      <span className="font-medium"> {selectedPermissions.length} permissions selected</span>
                      {searchQuery && <span className="ml-2">• Filtered by "{searchQuery}"</span>}
                    </p>
                  </div>
                  {selectedRole && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      {(() => {
                        const preset = getSelectedRolePreset();
                        const Icon = preset?.icon;
                        return Icon ? <Icon className="h-3 w-3" /> : null;
                      })()}
                      {getRoleDisplayName(selectedRole)}
                    </Badge>
                  )}
                </div>

                <div className="space-y-6">
                  {filteredCategories.map((category) => {
                    const CategoryIcon = category.icon;
                    const status = getCategoryStatus(category);
                    
                    return (
                      <Card key={category.id} className={`${category.color} transition-all`}>
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-white/80`}>
                                <CategoryIcon className={`h-5 w-5 ${category.iconColor}`} />
                              </div>
                              <div>
                                <CardTitle className="text-lg text-gray-900">{category.label}</CardTitle>
                                <CardDescription className="text-gray-700">
                                  {category.description}
                                </CardDescription>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCategoryToggle(category)}
                              className="flex items-center gap-2 hover:bg-white/50"
                            >
                              {getStatusIcon(status)}
                              <span className="text-sm">
                                {status === "all" ? "Deselect All" : "Select All"}
                              </span>
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {category.permissions?.map((permission) => {
                              const PermissionIcon = permission.icon;
                              const isChecked = isPermissionChecked(permission.key);
                              
                              // Danger level color coding
                              const getDangerLevelColors = (dangerLevel: string) => {
                                switch (dangerLevel) {
                                  case 'safe':
                                    return {
                                      border: 'border-green-200',
                                      bg: isChecked ? 'bg-green-50' : 'bg-white/40',
                                      icon: 'text-green-600',
                                      indicator: '🟢'
                                    };
                                  case 'elevated':
                                    return {
                                      border: 'border-yellow-200',
                                      bg: isChecked ? 'bg-yellow-50' : 'bg-white/40',
                                      icon: 'text-yellow-600',
                                      indicator: '🟡'
                                    };
                                  case 'dangerous':
                                    return {
                                      border: 'border-red-200',
                                      bg: isChecked ? 'bg-red-50' : 'bg-white/40',
                                      icon: 'text-red-600',
                                      indicator: '🔴'
                                    };
                                  default:
                                    return {
                                      border: 'border-gray-200',
                                      bg: isChecked ? 'bg-gray-50' : 'bg-white/40',
                                      icon: 'text-gray-600',
                                      indicator: '⚪'
                                    };
                                }
                              };
                              
                              const colors = getDangerLevelColors(permission.dangerLevel || 'safe');
                              
                              return (
                                <div
                                  key={permission.key}
                                  className={`flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer border ${colors.border} ${colors.bg} hover:bg-white/60`}
                                  onClick={() => handlePermissionChange(permission.key, !isChecked)}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handlePermissionChange(permission.key, !!checked)}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm">{colors.indicator}</span>
                                      <PermissionIcon className={`h-4 w-4 ${colors.icon} flex-shrink-0`} />
                                      <span className="font-medium text-gray-900 text-sm">
                                        {permission.label}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      {permission.description}
                                    </p>
                                    {permission.autoBundles && isChecked && (
                                      <div className="mt-2 text-xs text-gray-500">
                                        <span className="font-medium">Auto-includes:</span> {permission.autoBundles.join(', ')}
                                      </div>
                                    )}
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
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        
        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="font-medium">{selectedPermissions.length}</span> permissions selected
            {selectedRole && (
              <span className="ml-2">
                • Role: <span className="font-medium">{getRoleDisplayName(selectedRole)}</span>
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-[#236383] hover:bg-[#1a4d66]">
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      
      {/* Dangerous Permission Warning Modal */}
      <AlertDialog open={showDangerWarning} onOpenChange={setShowDangerWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Dangerous Permission Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              You are about to grant a permission with <span className="font-semibold text-red-600">ystem-breaking potential</span>.
              <br/><br/>
              {pendingDangerousPermission === 'SYSTEM_ADMINISTRATOR' ? (
                <span className="font-medium">This grants complete system access. Are you sure?</span>
              ) : (
                <span>This permission allows significant control over platform data and user actions.</span>
              )}
              <br/><br/>
              <span className="text-sm text-gray-600">
                Please confirm that this user should have this level of access.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingDangerousPermission(null);
              setShowDangerWarning(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDangerousPermissionConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Grant Permission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}