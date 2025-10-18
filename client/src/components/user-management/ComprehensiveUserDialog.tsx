import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User as UserIcon,
  Shield,
  Calendar,
  ClipboardList,
  Users,
  MapPin,
  Package,
  Phone,
  KeyRound,
  BarChart3,
} from 'lucide-react';
import type { User, UserFormData } from '@/types/user';
import CleanPermissionsEditor from '@/components/clean-permissions-editor';
import TeamBoard from '@/pages/TeamBoard';
import MyAvailability from '@/pages/my-availability';
import TeamAvailability from '@/pages/team-availability';
import GoogleCalendarAvailability from '@/pages/google-calendar-availability';
import RouteMapView from '@/pages/route-map';
import CoolerTrackingPage from '@/pages/cooler-tracking';
import { PasswordDialog } from './PasswordDialog';
import { SMSDialog } from './SMSDialog';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { useAuth } from '@/hooks/useAuth';

interface ComprehensiveUserDialogProps {
  mode: 'add' | 'edit';
  user?: Partial<User>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UserFormData & { id?: string }) => void;
  onUpdatePermissions?: (userId: string, role: string, permissions: string[]) => void;
  onSetPassword?: (userId: string, password: string) => void;
  onManageSMS?: (user: User) => void;
  isPending?: boolean;
}

const defaultFormData: UserFormData = {
  email: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  preferredEmail: '',
  role: 'volunteer',
  isActive: true,
  password: '',
};

export function ComprehensiveUserDialog({
  mode,
  user,
  open,
  onOpenChange,
  onSubmit,
  onUpdatePermissions,
  onSetPassword,
  onManageSMS,
  isPending = false,
}: ComprehensiveUserDialogProps) {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);

  // Check permissions for tabs
  const canViewMyAvailability = hasPermission(currentUser, PERMISSIONS.NAV_MY_AVAILABILITY);
  const canViewTeamAvailability = hasPermission(currentUser, PERMISSIONS.NAV_TEAM_AVAILABILITY);
  const canViewVolunteerCalendar = hasPermission(currentUser, PERMISSIONS.NAV_VOLUNTEER_CALENDAR);
  const canViewTeamBoard = true; // Team board doesn't have a specific permission yet
  const canViewCoolers = true; // Cooler tracking doesn't have a specific permission yet
  const canViewLocations = true; // Route map doesn't have a specific permission yet

  useEffect(() => {
    if (mode === 'edit' && user) {
      setFormData({
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
        preferredEmail: user.preferredEmail || '',
        role: user.role || 'volunteer',
        isActive: user.isActive ?? true,
        password: '',
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [mode, user, open]);

  useEffect(() => {
    // Reset to profile tab when dialog opens
    if (open) {
      setActiveTab('profile');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      return;
    }

    if (mode === 'edit' && user?.id) {
      onSubmit({ ...formData, id: user.id });
    } else {
      onSubmit(formData);
    }
  };

  const handleClose = () => {
    setFormData(defaultFormData);
    setActiveTab('profile');
    onOpenChange(false);
  };

  // For Add mode, only show the profile tab
  if (mode === 'add') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Add New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="user@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="host">Host</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="core_team">Core Team</SelectItem>
                  <SelectItem value="committee_member">
                    Committee Member
                  </SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password || ''}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Leave blank for no password"
              />
              <p className="text-xs text-gray-500 mt-1">
                If no password is set, user will need to use email login or
                reset password
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isPending ||
                  !formData.email ||
                  !formData.firstName ||
                  !formData.lastName
                }
                className="bg-brand-primary hover:bg-brand-primary-dark"
              >
                {isPending ? 'Adding...' : 'Add User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit mode - full tabbed interface
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              {user?.firstName} {user?.lastName}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${2 + (canViewMyAvailability ? 1 : 0) + (canViewTeamAvailability ? 1 : 0) + (canViewVolunteerCalendar ? 1 : 0) + (canViewTeamBoard ? 1 : 0) + (canViewLocations ? 1 : 0) + (canViewCoolers ? 1 : 0) + 1}, minmax(0, 1fr))` }}>
              <TabsTrigger value="profile" className="flex items-center gap-1 text-xs">
                <UserIcon className="h-3 w-3" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-1 text-xs">
                <Shield className="h-3 w-3" />
                Permissions
              </TabsTrigger>
              {canViewMyAvailability && (
                <TabsTrigger value="my-availability" className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  My Availability
                </TabsTrigger>
              )}
              {canViewTeamAvailability && (
                <TabsTrigger value="team-availability" className="flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  Team Availability
                </TabsTrigger>
              )}
              {canViewVolunteerCalendar && (
                <TabsTrigger value="volunteer-calendar" className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  Volunteer Calendar
                </TabsTrigger>
              )}
              {canViewTeamBoard && (
                <TabsTrigger value="team-board" className="flex items-center gap-1 text-xs">
                  <ClipboardList className="h-3 w-3" />
                  Team Board
                </TabsTrigger>
              )}
              {canViewLocations && (
                <TabsTrigger value="locations" className="flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3" />
                  Host Locations
                </TabsTrigger>
              )}
              {canViewCoolers && (
                <TabsTrigger value="coolers" className="flex items-center gap-1 text-xs">
                  <Package className="h-3 w-3" />
                  Coolers
                </TabsTrigger>
              )}
              <TabsTrigger value="activity" className="flex items-center gap-1 text-xs">
                <BarChart3 className="h-3 w-3" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="flex-1 overflow-y-auto space-y-4 p-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, phoneNumber: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferredEmail">Preferred Email</Label>
                    <Input
                      id="preferredEmail"
                      type="email"
                      value={formData.preferredEmail || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, preferredEmail: e.target.value })
                      }
                      placeholder="preferred@example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volunteer">Volunteer</SelectItem>
                      <SelectItem value="host">Host</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="core_team">Core Team</SelectItem>
                      <SelectItem value="committee_member">
                        Committee Member
                      </SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="super_admin">
                        Super Administrator
                      </SelectItem>
                      <SelectItem value="recipient">Recipient</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="work_logger">Work Logger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-brand-primary border-slate-300 rounded focus:ring-brand-primary"
                  />
                  <Label htmlFor="isActive">User is active</Label>
                </div>

                {/* Quick Actions */}
                <div className="border-t pt-4 space-y-2">
                  <h3 className="text-sm font-medium mb-2">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordDialog(true)}
                      className="flex items-center gap-2"
                    >
                      <KeyRound className="h-4 w-4" />
                      Set Password
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSMSDialog(true)}
                      className="flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      Manage SMS
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      isPending ||
                      !formData.email ||
                      !formData.firstName ||
                      !formData.lastName
                    }
                    className="bg-brand-primary hover:bg-brand-primary-dark"
                  >
                    {isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="flex-1 overflow-y-auto p-4">
              {user && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Manage detailed permissions for {user.firstName} {user.lastName}
                  </p>
                  <CleanPermissionsEditor
                    user={user as User}
                    open={true}
                    onOpenChange={() => {}}
                    onSave={(userId, role, permissions) => {
                      if (onUpdatePermissions) {
                        onUpdatePermissions(userId, role, permissions);
                      }
                    }}
                    embedded={true}
                  />
                </div>
              )}
            </TabsContent>

            {/* My Availability Tab */}
            {canViewMyAvailability && (
              <TabsContent value="my-availability" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">My Availability</h3>
                    <p className="text-sm text-gray-600">
                      View and manage availability for {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <MyAvailability />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Team Availability Tab */}
            {canViewTeamAvailability && (
              <TabsContent value="team-availability" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Team Availability</h3>
                    <p className="text-sm text-gray-600">
                      View availability across the entire team
                    </p>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <TeamAvailability />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Volunteer Calendar Tab */}
            {canViewVolunteerCalendar && (
              <TabsContent value="volunteer-calendar" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Volunteer Calendar</h3>
                    <p className="text-sm text-gray-600">
                      TSP volunteer availability calendar
                    </p>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <GoogleCalendarAvailability />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Team Board Tab */}
            {canViewTeamBoard && (
              <TabsContent value="team-board" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Team Board</h3>
                    <p className="text-sm text-gray-600">
                      Collaborative team board for tasks, notes, and ideas
                    </p>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <TeamBoard />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Host Locations Map Tab */}
            {canViewLocations && (
              <TabsContent value="locations" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Host Locations Map</h3>
                    <p className="text-sm text-gray-600">
                      Interactive map showing all host locations
                    </p>
                  </div>
                  <div className="border rounded-lg overflow-hidden h-[600px]">
                    <RouteMapView />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Cooler Tracking Tab */}
            {canViewCoolers && (
              <TabsContent value="coolers" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Cooler Tracking</h3>
                    <p className="text-sm text-gray-600">
                      Track and manage cooler inventory and locations
                    </p>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <CoolerTrackingPage />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Activity Tab */}
            <TabsContent value="activity" className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">User Activity</h3>
                  <p className="text-sm text-gray-600">
                    Activity history and analytics for {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Activity tracking coming soon</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      {user && (
        <PasswordDialog
          user={user as User}
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          onSetPassword={(userId, password) => {
            if (onSetPassword) {
              onSetPassword(userId, password);
            }
            setShowPasswordDialog(false);
          }}
          isPending={false}
        />
      )}

      {/* SMS Dialog */}
      {user && (
        <SMSDialog
          user={user as User}
          open={showSMSDialog}
          onOpenChange={setShowSMSDialog}
          onUpdateSMS={(userId, consent) => {
            if (onManageSMS) {
              onManageSMS(user as User);
            }
            setShowSMSDialog(false);
          }}
          isPending={false}
        />
      )}
    </>
  );
}
