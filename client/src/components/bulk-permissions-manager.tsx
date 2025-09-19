import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  Search,
  Filter,
  Eye,
  Edit,
  Shield,
  Crown,
  Settings,
  Check,
  X,
  AlertCircle,
  Download,
  Upload,
} from 'lucide-react';
import { PERMISSIONS, USER_ROLES, getRoleDisplayName } from '@shared/auth-utils';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import ModernPermissionsEditor from '@/components/modern-permissions-editor';

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
}

interface PermissionStats {
  permission: string;
  userCount: number;
  percentage: number;
  users: { id: string; name: string; email: string }[];
}

export default function BulkPermissionsManager() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [permissionFilter, setPermissionFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [viewMode, setViewMode] = useState<'users' | 'permissions'>('users');

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 30000,
  });

  // Calculate permission statistics
  const permissionStats = useMemo(() => {
    if (!users.length) return [];

    const stats: PermissionStats[] = [];
    const allPermissions = Object.values(PERMISSIONS);

    allPermissions.forEach(permission => {
      const usersWithPermission = users.filter(user => 
        user.permissions?.includes(permission) || user.role === 'super_admin'
      );

      stats.push({
        permission,
        userCount: usersWithPermission.length,
        percentage: Math.round((usersWithPermission.length / users.length) * 100),
        users: usersWithPermission.map(user => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email
        }))
      });
    });

    return stats.sort((a, b) => b.userCount - a.userCount);
  }, [users]);

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchQuery || 
        `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase()
          .includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      
      const matchesPermission = permissionFilter === 'all' || 
        user.permissions?.includes(permissionFilter) ||
        (user.role === 'super_admin' && permissionFilter !== 'none');

      return matchesSearch && matchesRole && matchesPermission;
    });
  }, [users, searchQuery, roleFilter, permissionFilter]);

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { userId: string; permissions: string[] }[]) => {
      const promises = updates.map(update =>
        apiRequest('PATCH', `/api/users/${update.userId}`, {
          permissions: update.permissions
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setSelectedUsers([]);
      toast({
        title: 'Bulk Update Complete',
        description: `Updated permissions for ${selectedUsers.length} users.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk Update Failed',
        description: error.message || 'Failed to update user permissions.',
        variant: 'destructive',
      });
    },
  });

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const addPermissionToSelected = (permission: string) => {
    const updates = selectedUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      if (!user) return null;
      
      const newPermissions = [...(user.permissions || [])];
      if (!newPermissions.includes(permission)) {
        newPermissions.push(permission);
      }
      
      return { userId, permissions: newPermissions };
    }).filter(Boolean) as { userId: string; permissions: string[] }[];

    bulkUpdateMutation.mutate(updates);
  };

  const removePermissionFromSelected = (permission: string) => {
    const updates = selectedUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      if (!user) return null;
      
      const newPermissions = (user.permissions || []).filter(p => p !== permission);
      
      return { userId, permissions: newPermissions };
    }).filter(Boolean) as { userId: string; permissions: string[] }[];

    bulkUpdateMutation.mutate(updates);
  };

  const getPermissionDisplayName = (permission: string) => {
    return permission.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Users...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bulk Permissions Manager</h2>
          <p className="text-gray-600">Manage permissions for multiple users at once</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'users' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('users')}
          >
            <Users className="h-4 w-4 mr-2" />
            Users View
          </Button>
          <Button
            variant={viewMode === 'permissions' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('permissions')}
          >
            <Shield className="h-4 w-4 mr-2" />
            Permissions View
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Object.values(USER_ROLES).map(role => (
                  <SelectItem key={role} value={role}>
                    {getRoleDisplayName(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={permissionFilter} onValueChange={setPermissionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by permission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Permissions</SelectItem>
                <SelectItem value="none">No Permissions</SelectItem>
                {Object.values(PERMISSIONS).slice(0, 20).map(permission => (
                  <SelectItem key={permission} value={permission}>
                    {getPermissionDisplayName(permission)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {filteredUsers.length} of {users.length} users
              </Badge>
              {selectedUsers.length > 0 && (
                <Badge variant="default">
                  {selectedUsers.length} selected
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Bulk Actions ({selectedUsers.length} users selected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Select onValueChange={addPermissionToSelected}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Add permission to all" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PERMISSIONS).map(permission => (
                    <SelectItem key={permission} value={permission}>
                      + {getPermissionDisplayName(permission)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select onValueChange={removePermissionFromSelected}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Remove permission from all" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PERMISSIONS).map(permission => (
                    <SelectItem key={permission} value={permission}>
                      - {getPermissionDisplayName(permission)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSelectedUsers([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {viewMode === 'users' ? (
        /* Users View */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Users & Permissions</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id} className={selectedUsers.includes(user.id) ? 'bg-blue-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => handleUserSelect(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {user.role === 'super_admin' ? (
                            <Badge className="bg-red-100 text-red-800">
                              <Crown className="h-3 w-3 mr-1" />
                              All Permissions
                            </Badge>
                          ) : (
                            <>
                              {(user.permissions || []).slice(0, 3).map(permission => (
                                <TooltipProvider key={permission}>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="secondary" className="text-xs">
                                        {getPermissionDisplayName(permission)}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{permission}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ))}
                              {(user.permissions || []).length > 3 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="text-xs">
                                        +{(user.permissions || []).length - 3} more
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="max-w-xs">
                                        <p className="font-semibold mb-2">All Permissions:</p>
                                        <div className="space-y-1">
                                          {(user.permissions || []).map(perm => (
                                            <div key={perm} className="text-xs">
                                              {getPermissionDisplayName(perm)}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        /* Permissions View */
        <Card>
          <CardHeader>
            <CardTitle>Permission Distribution Analysis</CardTitle>
            <CardDescription>
              See which permissions are assigned to how many users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>User List</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionStats
                    .filter(stat => stat.userCount > 0 || permissionFilter === 'all')
                    .map(stat => (
                    <TableRow key={stat.permission}>
                      <TableCell>
                        <div className="font-medium">
                          {getPermissionDisplayName(stat.permission)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stat.permission}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stat.userCount > 0 ? 'default' : 'outline'}>
                          {stat.userCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${stat.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm">{stat.percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {stat.users.slice(0, 3).map(user => (
                            <TooltipProvider key={user.id}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-xs">
                                    {user.name.split(' ').map(n => n[0]).join('')}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                          {stat.users.length > 3 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-xs">
                                    +{stat.users.length - 3}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="max-w-xs">
                                    <p className="font-semibold mb-2">All Users:</p>
                                    <div className="space-y-1">
                                      {stat.users.map(user => (
                                        <div key={user.id} className="text-xs">
                                          {user.name} ({user.email})
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Individual User Permissions Editor */}
      <ModernPermissionsEditor
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
          }
        }}
        onSave={(userId, role, permissions) => {
          // Use existing mutation from parent component
          const updateUserMutation = {
            mutate: ({ userId, role, permissions }: any) => {
              apiRequest('PATCH', `/api/users/${userId}`, { role, permissions })
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                  setSelectedUser(null);
                  toast({
                    title: 'User Updated',
                    description: 'User permissions have been successfully updated.',
                  });
                })
                .catch((error: any) => {
                  toast({
                    title: 'Update Failed',
                    description: error.message || 'Failed to update user permissions.',
                    variant: 'destructive',
                  });
                });
            }
          };
          updateUserMutation.mutate({ userId, role, permissions });
        }}
      />
    </div>
  );
}
