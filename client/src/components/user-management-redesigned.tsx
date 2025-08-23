import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCelebration, CelebrationToast } from "@/components/celebration-toast";
import { hasPermission, USER_ROLES, PERMISSIONS, getRoleDisplayName } from "@shared/auth-utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Shield, 
  Settings, 
  Search, 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  UserCheck, 
  Activity, 
  Calendar,
  Mail,
  Phone,
  MapPin,
  Clock,
  Filter,
  Download,
  Upload,
  Megaphone,
  Award,
  Bug,
  Eye,
  EyeOff,
  Trophy,
  Building,
  TrendingUp,
  KeyRound
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import EnhancedPermissionsDialog from "@/components/enhanced-permissions-dialog";
import AnnouncementManager from "@/components/announcement-manager";
import AuthDebug from "@/components/auth-debug";
import ShoutoutSystem from "@/components/shoutout-system";
import MeaningfulUserAnalytics from "@/components/meaningful-user-analytics";
import { DetailedActivityAnalytics } from "@/components/detailed-activity-analytics";
import { ButtonTooltip } from "@/components/ui/button-tooltip";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  metadata?: {
    smsConsent?: {
      enabled: boolean;
      phoneNumber?: string;
      displayPhone?: string;
      optInDate?: string;
      optOutDate?: string;
    };
  };
}

const ROLE_COLORS = {
  [USER_ROLES.SUPER_ADMIN]: "bg-red-100 text-red-800 border-red-200",
  [USER_ROLES.ADMIN]: "bg-[#236383] text-white border-[#236383]",
  [USER_ROLES.COMMITTEE_MEMBER]: "bg-blue-100 text-blue-800 border-blue-200",
  [USER_ROLES.CORE_TEAM]: "bg-orange-100 text-orange-800 border-orange-200",
  [USER_ROLES.HOST]: "bg-green-100 text-green-800 border-green-200",
  [USER_ROLES.DEMO_USER]: "bg-purple-100 text-purple-800 border-purple-200",
  [USER_ROLES.VOLUNTEER]: "bg-purple-100 text-purple-800 border-purple-200",
  [USER_ROLES.RECIPIENT]: "bg-teal-100 text-teal-800 border-teal-200",
  [USER_ROLES.DRIVER]: "bg-indigo-100 text-indigo-800 border-indigo-200",
  [USER_ROLES.VIEWER]: "bg-gray-100 text-gray-800 border-gray-200",
  [USER_ROLES.WORK_LOGGER]: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const ROLE_ICONS = {
  [USER_ROLES.SUPER_ADMIN]: Crown,
  [USER_ROLES.ADMIN]: Shield,
  [USER_ROLES.COMMITTEE_MEMBER]: Users,
  [USER_ROLES.CORE_TEAM]: Trophy,
  [USER_ROLES.HOST]: Building,
  [USER_ROLES.VOLUNTEER]: Award,
  [USER_ROLES.RECIPIENT]: UserCheck,
  [USER_ROLES.DRIVER]: MapPin,
  [USER_ROLES.VIEWER]: Eye,
  [USER_ROLES.WORK_LOGGER]: Clock,
};

function Crown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm8 8h4" />
    </svg>
  );
}

export default function UserManagementRedesigned() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { celebration, triggerCelebration, hideCelebration } = useCelebration();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "activity" | "announcements" | "shoutouts" | "debug">("overview");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "volunteer",
    password: ""
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [smsUser, setSmsUser] = useState<User | null>(null);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState("");

  // Check permissions
  if (!hasPermission(currentUser, PERMISSIONS.MANAGE_USERS)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">Access Restricted</CardTitle>
            <CardDescription>
              You don't have permission to manage users. Contact an administrator if you need access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: hasPermission(currentUser, PERMISSIONS.MANAGE_USERS),
  });

  // User management mutations
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, role, permissions }: { userId: string; role: string; permissions: string[] }) => {
      return apiRequest("PATCH", `/api/users/${userId}`, { role, permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setSelectedUser(null);
      toast({
        title: "User Updated",
        description: "User permissions have been successfully updated.",
      });
      triggerCelebration("User permissions updated!");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user permissions.",
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/users/${userId}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Status Updated",
        description: "User status has been successfully changed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user status.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been successfully removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user.",
        variant: "destructive",
      });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (userData: { email: string; firstName: string; lastName: string; role: string }) => {
      return apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Added",
        description: "New user has been successfully added.",
      });
      setShowAddUserDialog(false);
      setNewUser({ email: "", firstName: "", lastName: "", role: "volunteer" });
    },
    onError: (error: any) => {
      toast({
        title: "Add User Failed",
        description: error.message || "Failed to add user.",
        variant: "destructive",
      });
    },
  });

  const handleAddUser = () => {
    if (!newUser.email || !newUser.firstName || !newUser.lastName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    addUserMutation.mutate(newUser);
  };

  const setPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/password`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Password Set",
        description: "User password has been successfully updated.",
      });
      setShowPasswordDialog(false);
      setPasswordUser(null);
      setNewPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Password Update Failed",
        description: error.message || "Failed to update user password.",
        variant: "destructive",
      });
    },
  });

  const updateSMSConsentMutation = useMutation({
    mutationFn: async ({ userId, phoneNumber, enabled }: { userId: string; phoneNumber?: string; enabled: boolean }) => {
      // Get current user data from the existing users query
      const currentUsers = queryClient.getQueryData(["/api/users"]) as User[];
      const currentUser = currentUsers?.find(u => u.id === userId);
      
      if (!currentUser) {
        throw new Error("User not found");
      }
      
      const existingMetadata = currentUser.metadata || {};
      
      let smsConsent;
      if (enabled && phoneNumber) {
        // Opt in
        smsConsent = {
          enabled: true,
          phoneNumber: phoneNumber.startsWith('+1') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`,
          displayPhone: phoneNumber,
          optInDate: new Date().toISOString(),
          consent: true
        };
      } else {
        // Opt out
        smsConsent = {
          enabled: false,
          phoneNumber: null,
          displayPhone: null,
          optOutDate: new Date().toISOString(),
          consent: false
        };
      }

      const updatedMetadata = {
        ...existingMetadata,
        smsConsent
      };

      // Send ALL current user data plus the updated metadata to prevent overwriting other fields
      return apiRequest("PATCH", `/api/users/${userId}`, {
        role: currentUser.role,
        permissions: currentUser.permissions,
        metadata: updatedMetadata
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "SMS Preferences Updated",
        description: "User SMS preferences have been successfully updated.",
      });
      setShowSMSDialog(false);
      setSmsUser(null);
      setSmsPhoneNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "SMS Update Failed",
        description: error.message || "Failed to update SMS preferences.",
        variant: "destructive",
      });
    },
  });

  const handleSetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (passwordUser) {
      setPasswordMutation.mutate({ userId: passwordUser.id, password: newPassword });
    }
  };

  const handleManageSMS = (user: User) => {
    setSmsUser(user);
    setSmsPhoneNumber(user.metadata?.smsConsent?.displayPhone || "");
    setShowSMSDialog(true);
  };

  const handleUpdateSMS = (enabled: boolean) => {
    if (enabled && !smsPhoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to enable SMS notifications.",
        variant: "destructive",
      });
      return;
    }

    updateSMSConsentMutation.mutate({
      userId: smsUser!.id,
      phoneNumber: smsPhoneNumber,
      enabled
    });
  };

  // Filter users
  const filteredUsers = (users as User[]).filter((user: User) => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // User statistics
  const userStats = {
    total: (users as User[]).length,
    active: (users as User[]).filter((u: User) => u.isActive).length,
    inactive: (users as User[]).filter((u: User) => !u.isActive).length,
    byRole: Object.values(USER_ROLES).reduce((acc, role) => {
      acc[role] = (users as User[]).filter((u: User) => u.role === role).length;
      return acc;
    }, {} as Record<string, number>),
  };

  const formatLastLogin = (lastLoginAt: string | null) => {
    if (!lastLoginAt) return "Never";
    const date = new Date(lastLoginAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#236383]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage user accounts, permissions, and system access</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <ButtonTooltip 
            text="Open form to add a new user to the platform"
          >
            <Button 
              className="bg-[#236383] hover:bg-[#1a4d66]"
              onClick={() => setShowAddUserDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </ButtonTooltip>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="user-activity" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Impact</span>
          </TabsTrigger>
          <TabsTrigger value="announcements" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Announce</span>
          </TabsTrigger>
          <TabsTrigger value="shoutouts" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Shoutouts</span>
          </TabsTrigger>
          <TabsTrigger value="debug" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            <span className="hidden sm:inline">Debug</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {userStats.active} active, {userStats.inactive} inactive
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Administrators</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(userStats.byRole[USER_ROLES.SUPER_ADMIN] || 0) + (userStats.byRole[USER_ROLES.ADMIN] || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Super admins & admins
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Volunteers</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(userStats.byRole[USER_ROLES.VOLUNTEER] || 0) + (userStats.byRole[USER_ROLES.HOST] || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Hosts & volunteers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recipients</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats.byRole[USER_ROLES.RECIPIENT] || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Community members
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Distribution</CardTitle>
                <CardDescription>Breakdown of users by role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(userStats.byRole)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([role, count]) => {
                      const RoleIcon = ROLE_ICONS[role as keyof typeof ROLE_ICONS] || Users;
                      return (
                        <div key={role} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${ROLE_COLORS[role as keyof typeof ROLE_COLORS] || 'bg-gray-100'}`}>
                              <RoleIcon className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{getRoleDisplayName(role)}</span>
                          </div>
                          <Badge variant="outline" className="bg-[#236383] text-white border-[#236383]">{count}</Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest user logins and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {(users as User[])
                      .filter((user: User) => user.lastLoginAt)
                      .sort((a: User, b: User) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())
                      .slice(0, 10)
                      .map((user: User) => (
                        <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(user.firstName, user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Last login: {formatLastLogin(user.lastLoginAt)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {getRoleDisplayName(user.role)}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="all">All Roles</option>
                    {Object.entries(USER_ROLES).map(([key, value]) => (
                      <option key={key} value={value}>
                        {getRoleDisplayName(value)}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Users ({filteredUsers.length})</CardTitle>
                  <CardDescription>Manage user accounts and permissions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SMS Notifications</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No users found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user: User) => {
                        const RoleIcon = ROLE_ICONS[user.role as keyof typeof ROLE_ICONS] || Users;
                        return (
                          <TableRow key={user.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>
                                    {getInitials(user.firstName, user.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {user.firstName} {user.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${ROLE_COLORS[user.role as keyof typeof ROLE_COLORS] || 'bg-gray-100'}`}>
                                <RoleIcon className="h-3 w-3 mr-1" />
                                {getRoleDisplayName(user.role)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.isActive ? "default" : "secondary"}>
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.metadata?.smsConsent?.enabled ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <Phone className="h-3 w-3 mr-1" />
                                    Opted In
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {user.metadata.smsConsent.displayPhone || user.metadata.smsConsent.phoneNumber}
                                  </span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600">
                                  <Phone className="h-3 w-3 mr-1" />
                                  Not Opted In
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {formatLastLogin(user.lastLoginAt)}
                            </TableCell>
                            <TableCell>
                              <ButtonTooltip explanation="Shows how many specific permissions this user has been granted. Click the menu to edit their permissions.">
                                <Badge variant="outline">
                                  {user.permissions?.length || 0} permissions
                                </Badge>
                              </ButtonTooltip>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Permissions
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setPasswordUser(user);
                                    setShowPasswordDialog(true);
                                  }}>
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Set Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleManageSMS(user)}>
                                    <Phone className="h-4 w-4 mr-2" />
                                    Manage SMS
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => toggleUserStatusMutation.mutate({ 
                                      userId: user.id, 
                                      isActive: !user.isActive 
                                    })}
                                  >
                                    {user.isActive ? (
                                      <>
                                        <EyeOff className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => deleteUserMutation.mutate(user.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Activity Tab */}
        <TabsContent value="user-activity">
          <DetailedActivityAnalytics />
        </TabsContent>

        {/* Impact Tab */}
        <TabsContent value="activity">
          <MeaningfulUserAnalytics />
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements">
          <AnnouncementManager />
        </TabsContent>

        {/* Shoutouts Tab */}
        <TabsContent value="shoutouts">
          <ShoutoutSystem />
        </TabsContent>

        {/* Debug Tab */}
        <TabsContent value="debug">
          <AuthDebug />
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. They will receive login instructions via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="host">Host</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="core_team">Core Team</SelectItem>
                  <SelectItem value="committee_member">Committee Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Leave blank for no password"
              />
              <p className="text-xs text-gray-500 mt-1">
                If no password is set, user will need to use email login or reset password
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddUserDialog(false);
                  setNewUser({ email: "", firstName: "", lastName: "", role: "volunteer", password: "" });
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddUser}
                disabled={addUserMutation.isPending}
                className="bg-[#236383] hover:bg-[#1a4d66]"
              >
                {addUserMutation.isPending ? "Adding..." : "Add User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password for {passwordUser?.firstName} {passwordUser?.lastName}</DialogTitle>
            <DialogDescription>
              Set a new password for this user. They can use this password to log in directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (minimum 6 characters)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setPasswordUser(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetPassword}
              disabled={setPasswordMutation.isPending}
              className="bg-[#236383] hover:bg-[#1a4d66]"
            >
              {setPasswordMutation.isPending ? "Setting..." : "Set Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Management Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage SMS Notifications for {smsUser?.firstName} {smsUser?.lastName}</DialogTitle>
            <DialogDescription>
              Update SMS notification preferences for this user. Users can also manage their own preferences in their profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-[#236383]" />
                <div>
                  <p className="font-medium">Current Status</p>
                  <p className="text-sm text-gray-600">
                    {smsUser?.metadata?.smsConsent?.enabled ? (
                      <span className="text-green-700">Opted in to SMS notifications</span>
                    ) : (
                      <span className="text-gray-500">Not opted in to SMS notifications</span>
                    )}
                  </p>
                  {smsUser?.metadata?.smsConsent?.phoneNumber && (
                    <p className="text-sm text-gray-500">
                      Phone: {smsUser.metadata.smsConsent.displayPhone || smsUser.metadata.smsConsent.phoneNumber}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="sms-phone">Phone Number</Label>
                <Input
                  id="sms-phone"
                  type="tel"
                  value={smsPhoneNumber}
                  onChange={(e) => setSmsPhoneNumber(e.target.value)}
                  placeholder="(555) 123-4567"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for SMS notifications. Include area code.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleUpdateSMS(true)}
                disabled={updateSMSConsentMutation.isPending || !smsPhoneNumber}
                className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
              >
                <Phone className="h-4 w-4 mr-2" />
                {updateSMSConsentMutation.isPending ? "Updating..." : "Enable SMS"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleUpdateSMS(false)}
                disabled={updateSMSConsentMutation.isPending}
                className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
              >
                {updateSMSConsentMutation.isPending ? "Updating..." : "Disable SMS"}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setShowSMSDialog(false);
                setSmsUser(null);
                setSmsPhoneNumber("");
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Permissions Dialog */}
      <EnhancedPermissionsDialog
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
          }
        }}
        onSave={(userId, role, permissions) => {
          updateUserMutation.mutate({ userId, role, permissions });
        }}
      />

      {/* Celebration Toast */}
      <CelebrationToast
        isVisible={celebration.isVisible}
        onClose={hideCelebration}
        taskTitle={celebration.taskTitle}
        emoji={celebration.emoji}
        onSendThanks={(message: string) => {
          toast({
            title: "Thank you sent!",
            description: "Your appreciation message has been recorded.",
          });
        }}
      />
    </div>
  );
}