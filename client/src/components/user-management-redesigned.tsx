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
import { StandardFilterBar } from '@/components/ui/standard-filter-bar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/useResourcePermissions';
import { useCelebration, CelebrationToast } from '@/components/celebration-toast';
import { USER_ROLES, PERMISSIONS, getRoleDisplayName } from '@shared/auth-utils';
import {
  Users,
  Shield,
  Search,
  Plus,
  UserCheck,
  Filter,
  Download,
  Upload,
  Award,
  TrendingUp,
  MessageCircle,
  CheckSquare,
} from 'lucide-react';
import CleanPermissionsEditor from '@/components/clean-permissions-editor';
import BulkPermissionsManager from '@/components/bulk-permissions-manager';
import MeaningfulUserAnalytics from '@/components/meaningful-user-analytics';
import { ButtonTooltip } from '@/components/ui/button-tooltip';
import { useToast } from '@/hooks/use-toast';

// Import streamlined components
import { UserAvatar } from '@/components/user-management';
import { ComprehensiveUserDialog } from '@/components/user-management/ComprehensiveUserDialog';
import { PasswordDialog } from '@/components/user-management/PasswordDialog';
import { SMSDialog } from '@/components/user-management/SMSDialog';
import { SimplifiedUserTableRow } from '@/components/user-management/SimplifiedUserTableRow';
import { IndividualUserActivity } from '@/components/individual-user-activity';

// Import custom hooks
import { useUserManagement } from '@/hooks/useUserManagement';
import { useUserFilters } from '@/hooks/useUserFilters';
import { useUserStats } from '@/hooks/useUserStats';
import type { User } from '@/types/user';

/**
 * Streamlined User Management
 *
 * 3 Tabs Only:
 * 1. Users - Simplified table with inline summary stats
 * 2. Permissions - Users View for per-user assignments
 * 3. Impact - Contribution metrics that matter
 */
export default function UserManagementFinal() {
  const { user: currentUser } = useAuth();
  const { USERS_EDIT } = usePermissions(['USERS_EDIT']);
  const { toast } = useToast();
  const { celebration, triggerCelebration, hideCelebration } = useCelebration();

  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'impact'>('users');
  const [viewingActivityFor, setViewingActivityFor] = useState<User | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    role: '',
    status: [] as string[],
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditDialog] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [smsUser, setSmsUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isSendingSMSInstructions, setIsSendingSMSInstructions] = useState(false);

  // Check permissions
  if (!USERS_EDIT) {
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
    enabled: USERS_EDIT,
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

  const { searchQuery, setSearchQuery, roleFilter, setRoleFilter, filteredUsers: baseFilteredUsers } =
    useUserFilters(users as User[]);

  // Apply additional filters from StandardFilterBar
  const filteredUsers = useMemo(() => {
    let result = baseFilteredUsers;

    // Role filter from StandardFilterBar (overrides old filter if set)
    if (filters.role) {
      result = result.filter(u => u.role === filters.role);
    }

    // Status filter (active/inactive)
    if (filters.status.length > 0) {
      result = result.filter(u =>
        (filters.status.includes('active') && u.isActive) ||
        (filters.status.includes('inactive') && !u.isActive)
      );
    }

    return result;
  }, [baseFilteredUsers, filters]);

  const userStats = useUserStats(users as User[]);

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
      onSuccess: (newUser: any) => {
        // If password was provided, set it immediately after user creation
        if (formData.password && formData.password.trim()) {
          setPasswordMutation.mutate(
            {
              userId: newUser.id,
              password: formData.password,
            },
            {
              onSuccess: () => {
                setShowAddUserDialog(false);
                toast({
                  title: 'User Created',
                  description: `User ${formData.firstName} ${formData.lastName} created with password successfully.`,
                });
              },
              onError: () => {
                setShowAddUserDialog(false);
                toast({
                  title: 'Password Warning',
                  description: `User created but password failed to set. Please set password manually.`,
                  variant: 'destructive',
                });
              },
            }
          );
        } else {
          setShowAddUserDialog(false);
          toast({
            title: 'User Created',
            description: `User ${formData.firstName} ${formData.lastName} created. Remember to set their password!`,
            variant: 'default',
          });
        }
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

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSendSMSInstructions = async () => {
    if (selectedUsers.size === 0) {
      toast({
        title: 'No Users Selected',
        description: 'Please select at least one user to send SMS instructions.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingSMSInstructions(true);
    try {
      const response = await fetch('/api/users/send-sms-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds: Array.from(selectedUsers) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send emails');
      }

      toast({
        title: 'SMS Instructions Sent',
        description: data.message || `Instructions sent to ${data.details?.successful || selectedUsers.size} user(s)`,
      });

      setSelectedUsers(new Set());
    } catch (error: any) {
      toast({
        title: 'Failed to Send',
        description: error.message || 'Could not send SMS opt-in instructions',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSMSInstructions(false);
    }
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
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="impact" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Impact
          </TabsTrigger>
        </TabsList>

        {/* Users Tab - Simplified with inline summary */}
        <TabsContent value="users" className="space-y-6">
          {/* Inline Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold">{userStats.total}</p>
                  </div>
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {userStats.active} active, {userStats.inactive} inactive
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Admins</p>
                    <p className="text-2xl font-bold">
                      {(userStats.byRole[USER_ROLES.SUPER_ADMIN] || 0) +
                        (userStats.byRole[USER_ROLES.ADMIN] || 0)}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Super admins & admins</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Volunteers</p>
                    <p className="text-2xl font-bold">
                      {(userStats.byRole[USER_ROLES.VOLUNTEER] || 0) +
                        (userStats.byRole[USER_ROLES.HOST] || 0)}
                    </p>
                  </div>
                  <Award className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Hosts & volunteers</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Recipients</p>
                    <p className="text-2xl font-bold">
                      {userStats.byRole[USER_ROLES.RECIPIENT] || 0}
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Community members</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <Card>
            <CardContent className="pt-6">
              <StandardFilterBar
                searchPlaceholder="Search users by name, email, or phone..."
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                filters={[
                  {
                    id: 'role',
                    label: 'Role',
                    type: 'select',
                    options: Object.entries(USER_ROLES).map(([key, value]) => ({
                      value,
                      label: getRoleDisplayName(value),
                      count: users.filter((u: any) => u.role === value).length,
                    })),
                  },
                  {
                    id: 'status',
                    label: 'Status',
                    type: 'multi-select',
                    options: [
                      {
                        value: 'active',
                        label: 'Active',
                        count: users.filter((u: any) => u.isActive).length,
                      },
                      {
                        value: 'inactive',
                        label: 'Inactive',
                        count: users.filter((u: any) => !u.isActive).length,
                      },
                    ],
                  },
                ]}
                filterValues={filters}
                onFilterChange={(id, value) => setFilters({ ...filters, [id]: value })}
                showActiveFilters
                onClearAll={() => {
                  setSearchQuery('');
                  setFilters({ role: '', status: [] });
                }}
              />
                
                {selectedUsers.size > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2 text-sm text-blue-900">
                      <CheckSquare className="h-4 w-4" />
                      <span className="font-medium">{selectedUsers.size} user(s) selected</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUsers(new Set())}
                      >
                        Clear Selection
                      </Button>
                      <ButtonTooltip explanation="Send email with step-by-step SMS opt-in instructions">
                        <Button
                          size="sm"
                          onClick={handleSendSMSInstructions}
                          disabled={isSendingSMSInstructions}
                          className="bg-brand-primary hover:bg-brand-primary-dark"
                          data-testid="button-send-sms-instructions"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          {isSendingSMSInstructions ? 'Sending...' : 'Send SMS Opt-In Instructions'}
                        </Button>
                      </ButtonTooltip>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Users Table - Simplified (removed SMS, Last Login count from visible columns) */}
          <Card>
            <CardHeader>
              <CardTitle>{filteredUsers.length} Users</CardTitle>
              <CardDescription>Click a row to edit user details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={filteredUsers.length > 0 && filteredUsers.every((u: User) => selectedUsers.has(u.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers(new Set(filteredUsers.map((u: User) => u.id)));
                            } else {
                              setSelectedUsers(new Set());
                            }
                          }}
                          className="cursor-pointer"
                          data-testid="checkbox-select-all-users"
                        />
                      </TableHead>
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
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
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
                            setViewingActivityFor(u);
                            setActiveTab('impact');
                          }}
                          isSelected={selectedUsers.has(user.id)}
                          onToggleSelection={toggleUserSelection}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab - Users View Only (default) */}
        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Permissions</CardTitle>
              <CardDescription>
                Manage roles and permissions for individual users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BulkPermissionsManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Impact Tab - Contribution Metrics */}
        <TabsContent value="impact">
          {viewingActivityFor ? (
            <IndividualUserActivity
              user={viewingActivityFor}
              onBack={() => setViewingActivityFor(null)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Team Impact & Contributions</CardTitle>
                <CardDescription>
                  Track meaningful metrics: data entries, volunteers coordinated, active contributors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MeaningfulUserAnalytics />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ComprehensiveUserDialog
        mode="add"
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        onSubmit={handleAddUser}
        isPending={addUserMutation.isPending}
      />

      <ComprehensiveUserDialog
        mode="edit"
        user={editUser || undefined}
        open={showEditUserDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={handleEditUserSubmit}
        onUpdatePermissions={(userId, role, permissions) => {
          updateUserMutation.mutate(
            { userId, role, permissions },
            {
              onSuccess: () => {
                triggerCelebration('User permissions updated!');
              },
            }
          );
        }}
        onSetPassword={(userId, password) => {
          setPasswordMutation.mutate(
            { userId, password },
            {
              onSuccess: () => {
                triggerCelebration('Password set successfully!');
              },
            }
          );
        }}
        onManageSMS={(user) => {
          setSmsUser(user);
          setShowSMSDialog(true);
        }}
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

      {/* Clean Permissions Editor */}
      <CleanPermissionsEditor
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
