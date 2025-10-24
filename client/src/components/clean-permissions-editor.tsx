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
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, ChevronDown, ChevronRight, Check, Shield, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { USER_ROLES, getDefaultPermissionsForRole, getRoleDisplayName, applyPermissionDependencies, PERMISSION_DEPENDENCIES } from '@shared/auth-utils';
import { PERMISSION_GROUPS, getPermissionLabel, getPermissionDescription } from '@shared/permission-config';
import type { User } from '@/types/user';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CleanPermissionsEditorProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: string, permissions: string[]) => void;
  embedded?: boolean; // If true, renders without Dialog wrapper
}

// Commonly adjusted permissions (show these prominently)
const COMMON_PERMISSIONS = new Set([
  'USERS_EDIT',
  'HOSTS_EDIT',
  'RECIPIENTS_EDIT',
  'DRIVERS_EDIT',
  'EVENT_REQUESTS_EDIT',
  'EVENT_REQUESTS_ASSIGN_OTHERS',
  'COLLECTIONS_EDIT_ALL',
  'PROJECTS_EDIT_ALL',
]);

export default function CleanPermissionsEditor({
  user,
  open,
  onOpenChange,
  onSave,
  embedded = false,
}: CleanPermissionsEditorProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedPermissions(new Set(user.permissions || []));
      // Start with common groups expanded
      setExpandedGroups(new Set(['USERS', 'EVENT_REQUESTS']));
    } else {
      setSelectedRole('');
      setSelectedPermissions(new Set());
      setExpandedGroups(new Set());
    }
    setSearchQuery('');
    setShowAdvanced(false);
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
      // Auto-add dependencies when enabling a permission
      const dependencies = PERMISSION_DEPENDENCIES[permission];
      if (dependencies) {
        dependencies.forEach(dep => newPermissions.add(dep));
      }
    }
    setSelectedPermissions(newPermissions);
  };

  const toggleGroupPermissions = (groupPermissions: string[], enable: boolean) => {
    const newPermissions = new Set(selectedPermissions);
    groupPermissions.forEach(perm => {
      if (enable) {
        newPermissions.add(perm);
        // Auto-add dependencies when enabling permissions
        const dependencies = PERMISSION_DEPENDENCIES[perm];
        if (dependencies) {
          dependencies.forEach(dep => newPermissions.add(dep));
        }
      } else {
        newPermissions.delete(perm);
      }
    });
    setSelectedPermissions(newPermissions);
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSave = () => {
    if (user) {
      // Apply permission dependencies before saving to ensure completeness
      const permissionsWithDeps = applyPermissionDependencies(Array.from(selectedPermissions));
      onSave(user.id, selectedRole, permissionsWithDeps);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return Object.entries(PERMISSION_GROUPS);

    const query = searchQuery.toLowerCase();
    return Object.entries(PERMISSION_GROUPS).filter(([groupKey, group]) => {
      if (group.label.toLowerCase().includes(query)) return true;
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

  // Auto-expand groups when searching
  const groupsToShow = searchQuery ? new Set(filteredGroups.map(([key]) => key)) : expandedGroups;

  // Shared content component
  const permissionsContent = (
    <div className="space-y-4">
          {/* Role Template Selector - PROMINENT */}
          <Card className="border-2 border-brand-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role Template
              </CardTitle>
              <CardDescription>
                Start with a pre-configured role. Most users only need this step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_ROLES).map(([key, value]) => (
                    <SelectItem key={value} value={value} className="py-3">
                      <div>
                        <div className="font-medium">{getRoleDisplayName(value)}</div>
                        <div className="text-xs text-gray-500">
                          {defaultPermissions.size} permissions included
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPermissions.size !== defaultPermissions.size && (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Custom permissions active ({selectedPermissions.size} total)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPermissions(new Set(getDefaultPermissionsForRole(selectedRole)))}
                    className="ml-auto text-xs"
                  >
                    Reset to Role Default
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search - PROMINENT */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search permissions (e.g., 'volunteer', 'edit', 'messages')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 text-base"
            />
          </div>

          {/* Permissions Groups - COLLAPSIBLE */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Custom Permissions</CardTitle>
                  <CardDescription className="text-xs">
                    {showAdvanced ? 'Showing all permissions' : 'Showing commonly adjusted permissions'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs"
                >
                  {showAdvanced ? 'Show Common Only' : 'Show All Permissions'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <TooltipProvider>
                  <div className="space-y-2">
                    {filteredGroups.map(([groupKey, group]) => {
                      // Filter permissions based on showAdvanced
                      const groupPermissions = showAdvanced
                        ? group.permissions
                        : group.permissions.filter(p => COMMON_PERMISSIONS.has(p.split('.').pop() || p));

                      if (groupPermissions.length === 0) return null;

                      // Filter by search
                      const visiblePermissions = groupPermissions.filter(perm => {
                        if (!searchQuery) return true;
                        return getPermissionLabel(perm).toLowerCase().includes(searchQuery.toLowerCase());
                      });

                      if (visiblePermissions.length === 0) return null;

                      const selectedCount = visiblePermissions.filter(p => selectedPermissions.has(p)).length;
                      const allSelected = selectedCount === visiblePermissions.length;
                      const isExpanded = searchQuery ? true : groupsToShow.has(groupKey);

                      return (
                        <Collapsible key={groupKey} open={isExpanded} onOpenChange={() => !searchQuery && toggleGroup(groupKey)}>
                          <div className="border rounded-lg">
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3 hover:bg-gray-50">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                  )}
                                  <span className="font-medium text-sm">{group.label}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {selectedCount}/{visiblePermissions.length}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleGroupPermissions(visiblePermissions, !allSelected)}
                                    className="text-xs h-7"
                                  >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="px-3 pb-3 space-y-2 border-t">
                                {visiblePermissions.map((permission) => {
                                  const isSelected = selectedPermissions.has(permission);
                                  const isDefault = defaultPermissions.has(permission);
                                  const label = getPermissionLabel(permission);

                                  return (
                                    <div
                                      key={permission}
                                      className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2"
                                    >
                                      <div className="flex items-center gap-3 flex-1">
                                        <Switch
                                          checked={isSelected}
                                          onCheckedChange={() => togglePermission(permission)}
                                          id={permission}
                                        />
                                        <Label
                                          htmlFor={permission}
                                          className="cursor-pointer text-sm flex items-center gap-2"
                                        >
                                          {label}
                                          {isDefault && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                              From Role
                                            </Badge>
                                          )}
                                        </Label>
                                      </div>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            <AlertCircle className="h-3 w-3 text-gray-400" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="max-w-xs">
                                          <p className="text-xs">{getPermissionDescription(permission)}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
  );

  const saveButton = (
    <div className="flex items-center justify-between w-full pt-4 border-t">
      <span className="text-sm text-gray-500">
        {selectedPermissions.size} permissions selected
      </span>
      <div className="flex gap-2">
        {!embedded && (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="bg-brand-primary hover:bg-brand-primary-dark"
        >
          <Check className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );

  // If embedded, render without Dialog wrapper
  if (embedded) {
    return (
      <div className="space-y-4">
        {permissionsContent}
        {saveButton}
      </div>
    );
  }

  // Default: render with Dialog wrapper
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-primary" />
            Permissions for {user.firstName} {user.lastName}
          </DialogTitle>
          <DialogDescription>
            Choose a role template or customize specific permissions
          </DialogDescription>
        </DialogHeader>

        {permissionsContent}

        <DialogFooter>
          {saveButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
