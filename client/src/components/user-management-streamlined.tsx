import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useCelebration, CelebrationToast } from '@/components/celebration-toast';
import { hasPermission, USER_ROLES, PERMISSIONS, getRoleDisplayName } from '@shared/auth-utils';
import {
  Users,
  Shield,
  Search,
  Plus,
  UserCheck,
  Activity,
  Filter,
  Download,
  Upload,
  Award,
  BarChart3,
} from 'lucide-react';
import ModernPermissionsEditor from '@/components/modern-permissions-editor';
import BulkPermissionsManager from '@/components/bulk-permissions-manager';
import { ButtonTooltip } from '@/components/ui/button-tooltip';
import { useToast } from '@/hooks/use-toast';

// Import streamlined components
import { UserAvatar, ROLE_ICONS } from '@/components/user-management';
import { UserFormDialog } from '@/components/user-management/UserFormDialog';
import { PasswordDialog } from '@/components/user-management/PasswordDialog';
import { SMSDialog } from '@/components/user-management/SMSDialog';
import { SimplifiedUserTableRow } from '@/components/user-management/SimplifiedUserTableRow';
import { UnifiedAnalytics } from '@/components/user-management/UnifiedAnalytics';

// Import custom hooks
import { useUserManagement } from '@/hooks/useUserManagement';
import { useUserFilters } from '@/hooks/useUserFilters';
import { useUserStats } from '@/hooks/useUserStats';
import { formatLastLogin } from '@/lib/userHelpers';
import type { User } from '@/types/user';

export default function UserManagementStreamlined() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { celebration, triggerCelebration, hideCelebration } = useCelebration();

  // Only 4 tabs now: overview, users, roles-permissions, analytics
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'roles-permissions' | 'analytics'>('overview');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditDialog] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [smsUser, setSmsUser] = useState<User | null>(null);

  // Check permissions
  if (!hasPermission(currentUser, PERMISSIONS.USERS_EDIT)) {
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
    queryKey: ['/api/users'],
    enabled: hasPermission(currentUser, PERMISSIONS.USERS_EDIT),
  });

  // Use custom hooks
  const {
    toggleUserStatusMutation,
    deleteUserMutation,
    addUserMutation,
    editUserMutation,
    setPasswordMutation,
    updateSMSConsentMutation,
    updateUserMutation,
  } = useUserManagement();

  const { searchQuery, setSearchQuery, roleFilter, setRoleFilter, filteredUsers } =
    useUserFilters(users as User[]);

  const userStats = useUserStats(users as User[]);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    (users as User[]).forEach((userRecord) => {
      map.set(userRecord.id, userRecord);
    });
    return map;
  }, [users]);

  // Handlers
  const handleEditUser = (user: User) => {
    setEditUser(user);
    setShowEditDialog(true);
  };

  const handleManageSMS = (user: User) => {
    setSmsUser(user);
    setShowSMSDialog(true);
  };

  const handleAddUser = (formData: any) => {
    addUserMutation.mutate(formData, {
      onSuccess: () => {
        setShowAddUserDialog(false);
      },
    });
  };

  const handleEditUserSubmit = (formData: any) => {
    if (formData.id) {
      editUserMutation.mutate(
        {
          userId: formData.id,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          preferredEmail: formData.preferredEmail,
          role: formData.role,
          isActive: formData.isActive,
        },
        {
          onSuccess: () => {
            setShowEditDialog(false);
            setEditUser(null);
          },
        }
      );
    }
  };

  const handleSetPassword = (userId: string, password: string) => {
    if (password.length < 6) {
      toast({
        title: 'Invalid Password',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setPasswordMutation.mutate(
      { userId, password },
      {
        onSuccess: () => {
          setShowPasswordDialog(false);
          setPasswordUser(null);
        },
      }
    );
  };

  const handleUpdateSMS = (userId: string, phoneNumber: string, enabled: boolean) => {
    if (enabled && !phoneNumber) {
      toast({
        title: 'Phone Number Required',
        description: 'Please enter a phone number to enable SMS notifications.',
        variant: 'destructive',
      });
      return;
    }

    updateSMSConsentMutation.mutate(
      { userId, phoneNumber, enabled },
      {
        onSuccess: () => {
          setShowSMSDialog(false);
          setSmsUser(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage user accounts, roles, and permissions
          </p>
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
          <ButtonTooltip explanation="Add a new user to the platform">
            <Button
              className="bg-brand-primary hover:bg-brand-primary-dark"
              onClick={() => setShowAddUserDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </ButtonTooltip>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles-permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
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
                  {(userStats.byRole[USER_ROLES.SUPER_ADMIN] || 0) +
                    (userStats.byRole[USER_ROLES.ADMIN] || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Super admins & admins</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Volunteers</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(userStats.byRole[USER_ROLES.VOLUNTEER] || 0) +
                    (userStats.byRole[USER_ROLES.HOST] || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Hosts & volunteers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recipients</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userStats.byRole[USER_ROLES.RECIPIENT] || 0}
                </div>
                <p className="text-xs text-muted-foreground">Community members</p>
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
                            <span className="font-medium">{getRoleDisplayName(role)}</span>
                          </div>
                          <Badge variant="outline" className="bg-brand-primary text-white border-brand-primary">
                            {count}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest user logins</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {(users as User[])
                      .filter((user: User) => user.lastLoginAt)
                      .sort(
                        (a: User, b: User) =>
                          new Date(b.lastLoginAt!).getTime() -
                          new Date(a.lastLoginAt!).getTime()
                      )
                      .slice(0, 10)
                      .map((user: User) => (
                        <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                          <UserAvatar firstName={user.firstName} lastName={user.lastName} className="h-8 w-8" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatLastLogin(user.lastLoginAt)}
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

        {/* Users Tab - Simplified */}
        <TabsContent value="users" className="space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <CardDescription>Click a row to edit user details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role & Permissions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No users found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user: User) => (
                        <SimplifiedUserTableRow
                          key={user.id}
                          user={user}
                          onEditUser={handleEditUser}
                          onToggleStatus={(userId, isActive) =>
                            toggleUserStatusMutation.mutate({ userId, isActive })
                          }
                          onDeleteUser={(userId) => deleteUserMutation.mutate(userId)}
                          onSetPassword={(u) => {
                            setPasswordUser(u);
                            setShowPasswordDialog(true);
                          }}
                          onManageSMS={handleManageSMS}
                          onViewActivity={(u) => {
                            // Navigate to analytics tab with user filter
                            setActiveTab('analytics');
                          }}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles & Permissions Tab */}
        <TabsContent value="roles-permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Roles & Permissions Manager</CardTitle>
              <CardDescription>
                Assign roles and permissions to users, or audit permission distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BulkPermissionsManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab - Unified */}
        <TabsContent value="analytics">
          <UnifiedAnalytics />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <UserFormDialog
        mode="add"
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        onSubmit={handleAddUser}
        isPending={addUserMutation.isPending}
      />

      <UserFormDialog
        mode="edit"
        user={editUser || undefined}
        open={showEditUserDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={handleEditUserSubmit}
        isPending={editUserMutation.isPending}
      />

      <PasswordDialog
        user={passwordUser}
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSetPassword={handleSetPassword}
        isPending={setPasswordMutation.isPending}
      />

      <SMSDialog
        user={smsUser}
        open={showSMSDialog}
        onOpenChange={setShowSMSDialog}
        onUpdateSMS={handleUpdateSMS}
        isPending={updateSMSConsentMutation.isPending}
      />

      {/* Modern Permissions Editor */}
      <ModernPermissionsEditor
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
          }
        }}
        onSave={(userId, role, permissions) => {
          updateUserMutation.mutate(
            { userId, role, permissions },
            {
              onSuccess: () => {
                setSelectedUser(null);
                triggerCelebration('User permissions updated!');
              },
            }
          );
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
            title: 'Thank you sent!',
            description: 'Your appreciation message has been recorded.',
          });
        }}
      />
    </div>
  );
}
