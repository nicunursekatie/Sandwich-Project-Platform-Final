import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

// Enhanced permission organization with visual grouping
const PERMISSION_CATEGORIES = [
  {
    id: "access",
    label: "Platform Access",
    description: "Basic access to different sections of the platform",
    icon: Globe,
    color: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-600",
    permissions: [
      { key: PERMISSIONS.ACCESS_DIRECTORY, label: "Directory", icon: Users, description: "View contact directory" },
      { key: PERMISSIONS.ACCESS_HOSTS, label: "Hosts", icon: Building, description: "View host information" },
      { key: PERMISSIONS.ACCESS_RECIPIENTS, label: "Recipients", icon: UserCheck, description: "View recipient information" },
      { key: PERMISSIONS.ACCESS_DRIVERS, label: "Drivers", icon: Truck, description: "View driver information" },
      { key: PERMISSIONS.ACCESS_COLLECTIONS, label: "Collections", icon: Database, description: "View sandwich collections" },
      { key: PERMISSIONS.ACCESS_CHAT, label: "Team Chat", icon: MessageCircle, description: "Access team chat system" },
      { key: PERMISSIONS.ACCESS_MESSAGES, label: "Messaging", icon: Mail, description: "Access messaging system" },
      { key: PERMISSIONS.ACCESS_TOOLKIT, label: "Toolkit", icon: Wrench, description: "Access resource toolkit" },
    ]
  },
  {
    id: "operations",
    label: "Operations & Management",
    description: "Access to operational tools and management features",
    icon: Settings,
    color: "bg-green-50 border-green-200",
    iconColor: "text-green-600",
    permissions: [
      { key: PERMISSIONS.ACCESS_MEETINGS, label: "Meetings", icon: Calendar, description: "Access meeting management" },
      { key: PERMISSIONS.ACCESS_ANALYTICS, label: "Analytics", icon: TrendingUp, description: "View analytics and insights" },
      { key: PERMISSIONS.ACCESS_REPORTS, label: "Reports", icon: FileText, description: "Generate and view reports" },
      { key: PERMISSIONS.ACCESS_PROJECTS, label: "Projects", icon: FolderOpen, description: "Access project management" },
      { key: PERMISSIONS.ACCESS_SUGGESTIONS, label: "Suggestions", icon: Lightbulb, description: "Access suggestion portal" },
      { key: PERMISSIONS.ACCESS_WORK_LOGS, label: "Work Logs", icon: Clock, description: "Access work time tracking" },
      { key: PERMISSIONS.ACCESS_GOVERNANCE, label: "Governance", icon: Shield, description: "Access governance documents" },
    ]
  },
  {
    id: "data_entry",
    label: "Data Entry & Creation",
    description: "Ability to create and submit new content",
    icon: Edit,
    color: "bg-purple-50 border-purple-200",
    iconColor: "text-purple-600",
    permissions: [
      { key: PERMISSIONS.CREATE_COLLECTIONS, label: "Create Collections", icon: Database, description: "Submit sandwich collection data" },
      { key: PERMISSIONS.USE_COLLECTION_WALKTHROUGH, label: "Collection Walkthrough", icon: FormInput, description: "Use simplified collection entry form" },
      { key: PERMISSIONS.CREATE_PROJECTS, label: "Create Projects", icon: FolderOpen, description: "Create new projects" },
      { key: PERMISSIONS.CREATE_SUGGESTIONS, label: "Submit Suggestions", icon: Lightbulb, description: "Submit suggestions and feedback" },
      { key: PERMISSIONS.CREATE_WORK_LOGS, label: "Log Work Hours", icon: Clock, description: "Track and log work time" },
    ]
  },
  {
    id: "management",
    label: "Content Management",
    description: "Manage and moderate content created by others",
    icon: Shield,
    color: "bg-orange-50 border-orange-200",
    iconColor: "text-orange-600",
    permissions: [
      { key: PERMISSIONS.MANAGE_HOSTS, label: "Manage Hosts", icon: Building, description: "Edit host information" },
      { key: PERMISSIONS.MANAGE_RECIPIENTS, label: "Manage Recipients", icon: UserCheck, description: "Edit recipient information" },
      { key: PERMISSIONS.MANAGE_DRIVERS, label: "Manage Drivers", icon: Truck, description: "Edit driver information" },
      { key: PERMISSIONS.MANAGE_MEETINGS, label: "Manage Meetings", icon: Calendar, description: "Schedule and manage meetings" },
      { key: PERMISSIONS.MANAGE_SUGGESTIONS, label: "Manage Suggestions", icon: Lightbulb, description: "Review and respond to suggestions" },
      { key: PERMISSIONS.EDIT_ALL_COLLECTIONS, label: "Edit All Collections", icon: Database, description: "Edit any collection record" },
      { key: PERMISSIONS.DELETE_ALL_COLLECTIONS, label: "Delete Collections", icon: Database, description: "Delete collection records" },
    ]
  },
  {
    id: "admin",
    label: "Administration",
    description: "Full administrative privileges and system control",
    icon: Lock,
    color: "bg-red-50 border-red-200",
    iconColor: "text-red-600",
    permissions: [
      { key: PERMISSIONS.ADMIN_ACCESS, label: "Admin Panel", icon: Settings, description: "Access admin control panel" },
      { key: PERMISSIONS.MANAGE_USERS, label: "Manage Users", icon: Users, description: "Manage user accounts and permissions" },
      { key: PERMISSIONS.MANAGE_ANNOUNCEMENTS, label: "Announcements", icon: Send, description: "Create and manage announcements" },
      { key: PERMISSIONS.VIEW_ALL_WORK_LOGS, label: "View All Work Logs", icon: Eye, description: "View everyone's work logs" },
      { key: PERMISSIONS.EDIT_ALL_WORK_LOGS, label: "Edit All Work Logs", icon: Edit, description: "Edit any work log entry" },
      { key: PERMISSIONS.DELETE_ALL_WORK_LOGS, label: "Delete Work Logs", icon: Shield, description: "Delete work log entries" },
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
    role: USER_ROLES.VOLUNTEER,
    label: "Volunteer",
    description: "Basic access with collection submission capabilities",
    icon: Heart,
    color: "text-purple-600 bg-purple-50 border-purple-200"
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
        selectedPermissions.filter((p) => p !== permission),
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
            <ScrollArea className="h-[500px]">
              <div className="space-y-6 p-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Individual Permissions</h3>
                    <p className="text-sm text-gray-600">
                      Fine-tune access by selecting specific permissions. 
                      {selectedPermissions.length} permissions currently selected.
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
                  {PERMISSION_CATEGORIES.map((category) => {
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
                            {category.permissions.map((permission) => {
                              const PermissionIcon = permission.icon;
                              const isChecked = isPermissionChecked(permission.key);
                              
                              return (
                                <div
                                  key={permission.key}
                                  className={`flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                                    isChecked 
                                      ? 'bg-white/90 shadow-sm border border-white/50' 
                                      : 'bg-white/40 hover:bg-white/60'
                                  }`}
                                  onClick={() => handlePermissionChange(permission.key, !isChecked)}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handlePermissionChange(permission.key, !!checked)}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <PermissionIcon className="h-4 w-4 text-gray-600 flex-shrink-0" />
                                      <span className="font-medium text-gray-900 text-sm">
                                        {permission.label}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      {permission.description}
                                    </p>
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
    </Dialog>
  );
}