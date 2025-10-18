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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Shield, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { USER_ROLES, getDefaultPermissionsForRole, getRoleDisplayName } from '@shared/auth-utils';
import { PERMISSION_GROUPS, getPermissionLabel } from '@shared/permission-config';
import type { User } from '@/types/user';

interface StreamlinedPermissionsEditorProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: string, permissions: string[]) => void;
}

export default function StreamlinedPermissionsEditor({
  user,
  open,
  onOpenChange,
  onSave,
}: StreamlinedPermissionsEditorProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedPermissions(new Set(user.permissions || []));
    } else {
      setSelectedRole('');
      setSelectedPermissions(new Set());
    }
    setSearchQuery('');
  }, [user, open]);

  const defaultPermissions = useMemo(() => {
    return new Set(getDefaultPermissionsForRole(selectedRole));
  }, [selectedRole]);

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    // Reset to default permissions for the new role
    setSelectedPermissions(new Set(getDefaultPermissionsForRole(newRole)));
  };

  const togglePermission = (permission: string) => {
    const newPermissions = new Set(selectedPermissions);
    if (newPermissions.has(permission)) {
      newPermissions.delete(permission);
    } else {
      newPermissions.add(permission);
    }
    setSelectedPermissions(newPermissions);
  };

  const handleSave = () => {
    if (user) {
      onSave(user.id, selectedRole, Array.from(selectedPermissions));
    }
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return Object.entries(PERMISSION_GROUPS);

    const query = searchQuery.toLowerCase();
    return Object.entries(PERMISSION_GROUPS).filter(([groupKey, group]) => {
      // Check if group label matches
      if (group.label.toLowerCase().includes(query)) return true;

      // Check if any permission in the group matches
      return group.permissions.some(perm =>
        getPermissionLabel(perm).toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const hasChanges = useMemo(() => {
    if (!user) return false;
    if (selectedRole !== user.role) return true;

    const current = new Set(user.permissions || []);
    if (current.size !== selectedPermissions.size) return true;

    const selectedArray = Array.from(selectedPermissions);
    for (const perm of selectedArray) {
      if (!current.has(perm)) return true;
    }
    return false;
  }, [user, selectedRole, selectedPermissions]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Permissions for {user.firstName} {user.lastName}
          </DialogTitle>
          <DialogDescription>
            Assign a role and customize permissions for this user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Role Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Role</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_ROLES).map(([key, value]) => (
                    <SelectItem key={value} value={value}>
                      {getRoleDisplayName(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-2">
                {selectedPermissions.size} permissions selected
                {defaultPermissions.size > 0 && ` (${defaultPermissions.size} from role)`}
              </p>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Permissions Groups */}
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <div className="space-y-6">
              {filteredGroups.map(([groupKey, group]) => {
                const groupPermissions = group.permissions.filter(perm => {
                  if (!searchQuery) return true;
                  return getPermissionLabel(perm).toLowerCase().includes(searchQuery.toLowerCase());
                });

                if (groupPermissions.length === 0) return null;

                const selectedCount = groupPermissions.filter(p => selectedPermissions.has(p)).length;
                const allSelected = selectedCount === groupPermissions.length;
                const someSelected = selectedCount > 0 && !allSelected;

                return (
                  <div key={groupKey} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        {group.label}
                        {selectedCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {selectedCount}/{groupPermissions.length}
                          </Badge>
                        )}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newPermissions = new Set(selectedPermissions);
                          if (allSelected) {
                            // Deselect all
                            groupPermissions.forEach(p => newPermissions.delete(p));
                          } else {
                            // Select all
                            groupPermissions.forEach(p => newPermissions.add(p));
                          }
                          setSelectedPermissions(newPermissions);
                        }}
                        className="text-xs"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {groupPermissions.map((permission) => {
                        const isSelected = selectedPermissions.has(permission);
                        const isDefault = defaultPermissions.has(permission);

                        return (
                          <div
                            key={permission}
                            className={`flex items-start space-x-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer ${
                              isSelected ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => togglePermission(permission)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePermission(permission)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {getPermissionLabel(permission)}
                                </span>
                                {isDefault && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Separator />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="bg-brand-primary hover:bg-brand-primary-dark"
          >
            <Check className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
