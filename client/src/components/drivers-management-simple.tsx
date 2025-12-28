import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Car,
  Plus,
  Phone,
  Mail,
  Edit2,
  CheckCircle,
  XCircle,
  Download,
  Truck,
  FileCheck,
  AlertTriangle,
  Trash2,
  Search,
  Filter,
  X,
  Clock,
  MapPin,
  Loader2,
  ExternalLink,
  Copy,
  Calendar,
  MessageSquare,
  Smartphone,
  PauseCircle,
  Package,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { useResourcePermissions } from '@/hooks/useResourcePermissions';
import type { Driver, Host, DriverVehicle } from '@shared/schema';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';

function getDriverLocationValue(driver: Driver): string {
  // Prefer the most specific address fields if present.
  // (Some datasets may still use legacy `homeAddress`)
  const anyDriver = driver as any;
  return (
    driver.hostLocation ||
    driver.area ||
    anyDriver.homeAddress ||
    driver.address ||
    ''
  ).trim();
}

function abbreviateLocation(value: string): { short: string; isFullAddress: boolean } {
  const s = (value || '').trim();
  if (!s) return { short: '', isFullAddress: false };

  // Most common shape: "street..., City, ST 12345"
  const parts = s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const city = parts[parts.length - 2];
    const stateZip = parts[parts.length - 1];
    return { short: `${city}, ${stateZip}`, isFullAddress: parts.length >= 3 };
  }

  // Fallback: attempt to extract "City, ST ZIP" from tail
  const m = s.match(/([A-Za-z .'-]+),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  if (m) {
    const city = m[1].trim();
    const state = m[2].trim();
    const zip = m[3]?.trim();
    return { short: `${city}, ${state}${zip ? ` ${zip}` : ''}`, isFullAddress: s !== m[0] };
  }

  // If we can't confidently abbreviate, return as-is
  return { short: s, isFullAddress: false };
}

function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getCoolerStatusDisplay(status: string | null | undefined): { label: string; color: string } | null {
  if (!status) return null;
  const statusMap: Record<string, { label: string; color: string }> = {
    'has_tsp_coolers': { label: 'Has TSP Coolers', color: 'bg-green-100 text-green-800 border-green-200' },
    'would_hold_tsp_coolers': { label: 'Would Hold TSP Coolers', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    'would_buy_coolers': { label: 'Would Buy Coolers', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    'has_own_coolers': { label: 'Has Own Coolers', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    'cannot_hold_coolers': { label: 'Cannot Hold Coolers', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  };
  return statusMap[status] || null;
}

export default function DriversManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = useResourcePermissions('DRIVERS');
  const isAdmin = hasPermission(user, PERMISSIONS.ADMIN_PANEL_ACCESS);
  const canExport = hasPermission(user, PERMISSIONS.DATA_EXPORT);
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [addressDialogDriver, setAddressDialogDriver] = useState<Driver | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agreementFilter, setAgreementFilter] = useState<string>('all');
  const [vanFilter, setVanFilter] = useState<string>('all');
  const [weeklyDriverFilter, setWeeklyDriverFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [newDriver, setNewDriver] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    licenseNumber: '',
    hostLocation: '',
    availability: '',
    emailAgreementSent: false,
    vanApproved: false,
    isWeeklyDriver: false,
    willingToSpeak: false,
    isActive: true,
    // New fields
    isEventDriver: false,
    wantsAppWalkthrough: false,
    wantsTextAlerts: false,
    temporarilyUnavailable: false,
    unavailableNote: '',
    unavailableUntil: '',
    coolerStatus: '',
    agreementInDatabase: false,
    notes: '',
  });

  // State for vehicle management in edit mode
  const [editingDriverVehicles, setEditingDriverVehicles] = useState<DriverVehicle[]>([]);
  const [newVehicle, setNewVehicle] = useState({ make: '', model: '', coolerCapacity: '' });

  // Fetch drivers
  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
  });

  // Fetch hosts for route assignments
  const { data: hosts = [] } = useQuery<Host[]>({
    queryKey: ['/api/hosts'],
  });

  // Filtered and searched drivers
  const filteredDrivers = useMemo(() => {
    let filtered = drivers;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (driver) =>
          driver.name?.toLowerCase().includes(term) ||
          driver.email?.toLowerCase().includes(term) ||
          driver.phone?.toLowerCase().includes(term) ||
          driver.hostLocation?.toLowerCase().includes(term) ||
          driver.availability?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter((driver) => driver.isActive === true);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((driver) => driver.isActive === false);
    }

    // Apply agreement filter
    if (agreementFilter === 'sent') {
      filtered = filtered.filter(
        (driver) => driver.emailAgreementSent === true
      );
    } else if (agreementFilter === 'missing') {
      filtered = filtered.filter((driver) => !driver.emailAgreementSent);
    }

    // Apply van filter
    if (vanFilter === 'approved') {
      filtered = filtered.filter((driver) => driver.vanApproved === true);
    } else if (vanFilter === 'not_approved') {
      filtered = filtered.filter((driver) => !driver.vanApproved);
    }

    // Apply weekly driver filter
    if (weeklyDriverFilter === 'weekly') {
      filtered = filtered.filter((driver) => driver.isWeeklyDriver === true);
    } else if (weeklyDriverFilter === 'not_weekly') {
      filtered = filtered.filter((driver) => !driver.isWeeklyDriver);
    }

    return filtered;
  }, [drivers, searchTerm, statusFilter, agreementFilter, vanFilter, weeklyDriverFilter]);

  // Add driver mutation
  const addDriverMutation = useMutation({
    mutationFn: (driverData: any) =>
      apiRequest('POST', '/api/drivers', driverData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      setIsAddModalOpen(false);
      resetNewDriver();
      toast({ title: 'Driver added successfully' });
    },
    onError: (error) => {
      logger.error('Driver addition error:', error);
      toast({ title: 'Error adding driver', variant: 'destructive' });
    },
  });

  // Update driver mutation
  const updateDriverMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      // Clean the data to remove timestamp fields that cause issues
      const cleanData = {
        ...data,
        createdAt: undefined,
        updatedAt: undefined,
      };
      return apiRequest('PUT', `/api/drivers/${id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      setEditingDriver(null);
      toast({ title: 'Driver updated successfully' });
    },
    onError: (error) => {
      logger.error('Driver update error:', error);
      toast({ title: 'Error updating driver', variant: 'destructive' });
    },
  });

  // Delete driver mutation
  const deleteDriverMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/drivers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      toast({ title: 'Driver deleted successfully' });
    },
    onError: (error) => {
      logger.error('Driver delete error:', error);
      toast({ title: 'Error deleting driver', variant: 'destructive' });
    },
  });

  const resetNewDriver = () => {
    setNewDriver({
      name: '',
      phone: '',
      email: '',
      address: '',
      licenseNumber: '',
      hostLocation: '',
      availability: '',
      emailAgreementSent: false,
      vanApproved: false,
      isWeeklyDriver: false,
      willingToSpeak: false,
      isActive: true,
      isEventDriver: false,
      wantsAppWalkthrough: false,
      wantsTextAlerts: false,
      temporarilyUnavailable: false,
      unavailableNote: '',
      unavailableUntil: '',
      coolerStatus: '',
      agreementInDatabase: false,
      notes: '',
    });
  };

  // Fetch vehicles when editing a driver
  const fetchDriverVehicles = async (driverId: number) => {
    try {
      const vehicles = await apiRequest('GET', `/api/drivers/${driverId}/vehicles`);
      setEditingDriverVehicles(Array.isArray(vehicles) ? vehicles : []);
    } catch (error) {
      logger.error('Failed to fetch driver vehicles', error);
      setEditingDriverVehicles([]);
    }
  };

  // Handle opening edit dialog - also fetch vehicles
  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    fetchDriverVehicles(driver.id);
    setNewVehicle({ make: '', model: '', coolerCapacity: '' });
  };

  // Add vehicle mutation
  const addVehicleMutation = useMutation({
    mutationFn: async ({ driverId, vehicle }: { driverId: number; vehicle: { make: string; model: string; coolerCapacity: number | null } }) => {
      const newVehicle = await apiRequest('POST', `/api/drivers/${driverId}/vehicles`, vehicle);
      return newVehicle;
    },
    onSuccess: (newVehicle) => {
      setEditingDriverVehicles(prev => [...prev, newVehicle]);
      setNewVehicle({ make: '', model: '', coolerCapacity: '' });
      toast({ title: 'Vehicle added successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to add vehicle', variant: 'destructive' });
    },
  });

  // Delete vehicle mutation
  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      await apiRequest('DELETE', `/api/drivers/vehicles/${vehicleId}`);
      return vehicleId;
    },
    onSuccess: (vehicleId) => {
      setEditingDriverVehicles(prev => prev.filter(v => v.id !== vehicleId));
      toast({ title: 'Vehicle removed' });
    },
    onError: () => {
      toast({ title: 'Failed to remove vehicle', variant: 'destructive' });
    },
  });

  const handleAddVehicle = () => {
    if (!editingDriver || !newVehicle.make || !newVehicle.model) {
      toast({ title: 'Please enter make and model', variant: 'destructive' });
      return;
    }
    addVehicleMutation.mutate({
      driverId: editingDriver.id,
      vehicle: {
        make: newVehicle.make,
        model: newVehicle.model,
        coolerCapacity: newVehicle.coolerCapacity ? parseInt(newVehicle.coolerCapacity) : null,
      },
    });
  };

  const handleAddDriver = async () => {
    if (!newDriver.name || !newDriver.phone) {
      toast({
        title: 'Please fill in required fields',
        variant: 'destructive',
      });
      return;
    }

    addDriverMutation.mutate(newDriver);
  };

  const handleUpdateDriver = () => {
    if (!editingDriver) return;
    updateDriverMutation.mutate({
      id: editingDriver.id,
      data: editingDriver,
    });
  };

  const handleDeleteDriver = (driver: Driver) => {
    if (
      window.confirm(
        `Are you sure you want to delete ${driver.name}? This action cannot be undone.`
      )
    ) {
      deleteDriverMutation.mutate(driver.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/drivers/export', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drivers-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Export completed successfully' });
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const handleBatchGeocode = async () => {
    setIsGeocoding(true);
    try {
      const response = await fetch('/api/drivers/batch-geocode', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Geocoding failed');

      const data = await response.json();
      toast({
        title: 'Geocoding complete',
        description: `${data.success} updated, ${data.failed} failed`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
    } catch (error) {
      logger.error('Batch geocode failed', error);
      toast({
        title: 'Geocoding failed',
        description: 'Check your connection or try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading drivers...</div>;
  }

  const activeDrivers = filteredDrivers.filter((driver) => driver.isActive);
  const inactiveDrivers = filteredDrivers.filter((driver) => !driver.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
              <Car className="text-blue-500 mr-2 sm:mr-3 w-5 h-5 sm:w-6 sm:h-6" />
              <span className="hidden sm:inline">Drivers Management</span>
              <span className="sm:hidden">Drivers</span>
            </h1>
            <div className="flex flex-col sm:flex-row gap-2">
              {isAdmin && (
                <Button
                  variant="secondary"
                  onClick={handleBatchGeocode}
                  disabled={isGeocoding}
                  className="text-xs sm:text-sm"
                >
                  {isGeocoding ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">
                    {isGeocoding ? 'Geocoding...' : 'Geocode Missing Drivers'}
                  </span>
                  <span className="sm:hidden">
                    {isGeocoding ? 'Geocoding' : 'Geocode'}
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!canExport || !drivers || drivers.length === 0}
                className="text-xs sm:text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!canEdit} className="text-xs sm:text-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Add Driver</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Driver</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={newDriver.name}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, name: e.target.value })
                        }
                        placeholder="Enter driver name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        value={newDriver.phone}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, phone: e.target.value })
                        }
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newDriver.email}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, email: e.target.value })
                        }
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Home Address</Label>
                      <Input
                        id="address"
                        value={newDriver.address}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, address: e.target.value })
                        }
                        placeholder="Street address, city, state, zip"
                        data-testid="input-driver-address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="licenseNumber">
                        Driver's License Number
                      </Label>
                      <Input
                        id="licenseNumber"
                        value={newDriver.licenseNumber}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            licenseNumber: e.target.value,
                          })
                        }
                        placeholder="Enter license number (optional)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hostLocation">Driver Location</Label>
                      <Input
                        id="hostLocation"
                        value={newDriver.hostLocation}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            hostLocation: e.target.value,
                          })
                        }
                        placeholder="Enter driver location (e.g., Alpharetta, Roswell, North Atlanta)"
                        list="host-locations"
                      />
                      <datalist id="host-locations">
                        {hosts.map((host) => (
                          <option key={host.id} value={host.name} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <Label htmlFor="availability">Availability Notes</Label>
                      <Input
                        id="availability"
                        value={newDriver.availability}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            availability: e.target.value,
                          })
                        }
                        placeholder="Enter availability notes (e.g., weekends only, mornings, etc.)"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="emailAgreementSent"
                        checked={newDriver.emailAgreementSent}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            emailAgreementSent: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="emailAgreementSent">
                        Agreement Signed
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isWeeklyDriver"
                        checked={newDriver.isWeeklyDriver}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            isWeeklyDriver: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="isWeeklyDriver">
                        Weekly Driver
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="willingToSpeak"
                        checked={newDriver.willingToSpeak}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            willingToSpeak: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="willingToSpeak">
                        Willing to Speak at Events
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="vanApproved"
                        checked={newDriver.vanApproved}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            vanApproved: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="vanApproved">Van Approved</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isEventDriver"
                        checked={newDriver.isEventDriver}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            isEventDriver: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="isEventDriver">Event Driver</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="wantsAppWalkthrough"
                        checked={newDriver.wantsAppWalkthrough}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            wantsAppWalkthrough: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="wantsAppWalkthrough">Wants App Walkthrough</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="wantsTextAlerts"
                        checked={newDriver.wantsTextAlerts}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            wantsTextAlerts: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="wantsTextAlerts">Wants Text Alerts</Label>
                    </div>
                    <div>
                      <Label htmlFor="coolerStatus">Cooler Status</Label>
                      <Select
                        value={newDriver.coolerStatus}
                        onValueChange={(value) =>
                          setNewDriver({ ...newDriver, coolerStatus: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select cooler status..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="has_tsp_coolers">Has TSP Coolers</SelectItem>
                          <SelectItem value="would_hold_tsp_coolers">Would Hold TSP Coolers at Home</SelectItem>
                          <SelectItem value="would_buy_coolers">Would Buy Coolers (Tax Receipt)</SelectItem>
                          <SelectItem value="has_own_coolers">Has Own Coolers for Review</SelectItem>
                          <SelectItem value="cannot_hold_coolers">Cannot Hold Coolers at Home</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="agreementInDatabase"
                        checked={newDriver.agreementInDatabase}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            agreementInDatabase: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="agreementInDatabase">Agreement Located in Database</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="temporarilyUnavailable"
                        checked={newDriver.temporarilyUnavailable}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            temporarilyUnavailable: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="temporarilyUnavailable">Temporarily Unavailable</Label>
                    </div>
                    {newDriver.temporarilyUnavailable && (
                      <>
                        <div>
                          <Label htmlFor="unavailableUntil">Available Again On</Label>
                          <Input
                            id="unavailableUntil"
                            type="date"
                            value={newDriver.unavailableUntil}
                            onChange={(e) =>
                              setNewDriver({
                                ...newDriver,
                                unavailableUntil: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="unavailableNote">Unavailability Note</Label>
                          <Textarea
                            id="unavailableNote"
                            value={newDriver.unavailableNote}
                            onChange={(e) =>
                              setNewDriver({
                                ...newDriver,
                                unavailableNote: e.target.value,
                              })
                            }
                            placeholder="Reason for temporary unavailability"
                            rows={2}
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={newDriver.notes}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            notes: e.target.value,
                          })
                        }
                        placeholder="General notes about this driver"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={newDriver.isActive}
                        onChange={(e) =>
                          setNewDriver({
                            ...newDriver,
                            isActive: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="isActive">Active Driver</Label>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddDriver}
                        disabled={addDriverMutation.isPending}
                      >
                        {addDriverMutation.isPending
                          ? 'Adding...'
                          : 'Add Driver'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="space-y-3 p-4 bg-slate-50 rounded-lg border-t border-slate-200">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search drivers by name, email, phone, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle Button */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {(statusFilter !== 'all' ||
                agreementFilter !== 'all' ||
                vanFilter !== 'all') && (
                <Badge variant="secondary" className="ml-1">
                  {
                    [
                      statusFilter !== 'all' && 'Status',
                      agreementFilter !== 'all' && 'Agreement',
                      vanFilter !== 'all' && 'Van',
                    ].filter(Boolean).length
                  }
                </Badge>
              )}
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-slate-200">
              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Agreement
                </Label>
                <Select
                  value={agreementFilter}
                  onValueChange={setAgreementFilter}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agreements</SelectItem>
                    <SelectItem value="sent">Agreement Signed</SelectItem>
                    <SelectItem value="missing">Missing Agreement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Van Status
                </Label>
                <Select value={vanFilter} onValueChange={setVanFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Van Status</SelectItem>
                    <SelectItem value="approved">Van Approved</SelectItem>
                    <SelectItem value="not_approved">
                      Not Van Approved
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="weeklyFilter">Weekly Driver</Label>
                <Select value={weeklyDriverFilter} onValueChange={setWeeklyDriverFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    <SelectItem value="weekly">Weekly Only</SelectItem>
                    <SelectItem value="not_weekly">
                      Non-Weekly Only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setAgreementFilter('all');
                    setVanFilter('all');
                    setWeeklyDriverFilter('all');
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="text-sm text-slate-600">
            Showing {filteredDrivers.length} of {drivers.length} drivers
            {searchTerm && <span> • Search: "{searchTerm}"</span>}
            {statusFilter !== 'all' && <span> • {statusFilter}</span>}
            {agreementFilter !== 'all' && <span> • {agreementFilter}</span>}
            {vanFilter !== 'all' && <span> • {vanFilter}</span>}
          </div>
        </div>
      </div>

      {/* Edit Driver Dialog */}
      <Dialog
        open={!!editingDriver}
        onOpenChange={() => setEditingDriver(null)}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogHeader>
          {editingDriver && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editingDriver.name}
                  onChange={(e) =>
                    setEditingDriver({ ...editingDriver, name: e.target.value })
                  }
                  placeholder="Enter driver name"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editingDriver.phone || ''}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      phone: e.target.value,
                    })
                  }
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingDriver.email || ''}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      email: e.target.value,
                    })
                  }
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Home Address</Label>
                <Input
                  id="edit-address"
                  value={editingDriver.address || ''}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      address: e.target.value,
                    })
                  }
                  placeholder="Street address, city, state, zip"
                  data-testid="input-edit-driver-address"
                />
              </div>
              <div>
                <Label htmlFor="edit-licenseNumber">
                  Driver's License Number
                </Label>
                <Input
                  id="edit-licenseNumber"
                  value={editingDriver.licenseNumber || ''}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      licenseNumber: e.target.value,
                    })
                  }
                  placeholder="Enter license number (optional)"
                />
              </div>
              <div>
                <Label htmlFor="edit-hostLocation">Driver Location</Label>
                <Input
                  id="edit-hostLocation"
                  value={editingDriver.hostLocation || ''}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      hostLocation: e.target.value,
                    })
                  }
                  placeholder="Enter driver location (e.g., Alpharetta, Roswell, North Atlanta)"
                  list="edit-host-locations"
                />
                <datalist id="edit-host-locations">
                  {hosts.map((host) => (
                    <option key={host.id} value={host.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label htmlFor="edit-availability">Availability Notes</Label>
                <Input
                  id="edit-availability"
                  value={editingDriver.availability || ''}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      availability: e.target.value,
                    })
                  }
                  placeholder="Enter availability notes (e.g., weekends only, mornings, etc.)"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-emailAgreementSent"
                  checked={editingDriver.emailAgreementSent || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      emailAgreementSent: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-emailAgreementSent">
                  Agreement Signed
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isWeeklyDriver"
                  checked={editingDriver.isWeeklyDriver || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      isWeeklyDriver: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-isWeeklyDriver">Weekly Driver</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-willingToSpeak"
                  checked={editingDriver.willingToSpeak || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      willingToSpeak: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-willingToSpeak">Willing to Speak at Events</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-vanApproved"
                  checked={editingDriver.vanApproved || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      vanApproved: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-vanApproved">Van Approved</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isEventDriver"
                  checked={editingDriver.isEventDriver || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      isEventDriver: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-isEventDriver">Event Driver</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-wantsAppWalkthrough"
                  checked={editingDriver.wantsAppWalkthrough || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      wantsAppWalkthrough: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-wantsAppWalkthrough">Wants App Walkthrough</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-wantsTextAlerts"
                  checked={editingDriver.wantsTextAlerts || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      wantsTextAlerts: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-wantsTextAlerts">Wants Text Alerts</Label>
              </div>
              <div>
                <Label htmlFor="edit-coolerStatus">Cooler Status</Label>
                <Select
                  value={editingDriver.coolerStatus || ''}
                  onValueChange={(value) =>
                    setEditingDriver({ ...editingDriver, coolerStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cooler status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="has_tsp_coolers">Has TSP Coolers</SelectItem>
                    <SelectItem value="would_hold_tsp_coolers">Would Hold TSP Coolers at Home</SelectItem>
                    <SelectItem value="would_buy_coolers">Would Buy Coolers (Tax Receipt)</SelectItem>
                    <SelectItem value="has_own_coolers">Has Own Coolers for Review</SelectItem>
                    <SelectItem value="cannot_hold_coolers">Cannot Hold Coolers at Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-agreementInDatabase"
                  checked={editingDriver.agreementInDatabase || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      agreementInDatabase: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-agreementInDatabase">Agreement Located in Database</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-temporarilyUnavailable"
                  checked={editingDriver.temporarilyUnavailable || false}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      temporarilyUnavailable: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-temporarilyUnavailable">Temporarily Unavailable</Label>
              </div>
              {editingDriver.temporarilyUnavailable && (
                <>
                  <div>
                    <Label htmlFor="edit-unavailableUntil">Available Again On</Label>
                    <Input
                      id="edit-unavailableUntil"
                      type="date"
                      value={editingDriver.unavailableUntil ? new Date(editingDriver.unavailableUntil).toISOString().split('T')[0] : ''}
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
                          unavailableUntil: e.target.value ? new Date(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-unavailableNote">Unavailability Note</Label>
                    <Textarea
                      id="edit-unavailableNote"
                      value={editingDriver.unavailableNote || ''}
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
                          unavailableNote: e.target.value,
                        })
                      }
                      placeholder="Reason for temporary unavailability"
                      rows={2}
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editingDriver.notes || ''}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      notes: e.target.value,
                    })
                  }
                  placeholder="General notes about this driver"
                  rows={3}
                />
              </div>

              {/* Vehicles Section */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-base font-semibold">Vehicles</Label>
                <p className="text-sm text-muted-foreground mb-3">Add vehicles with cooler capacity</p>

                {/* Existing vehicles */}
                {editingDriverVehicles.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {editingDriverVehicles.map((vehicle) => (
                      <div key={vehicle.id} className="flex items-center justify-between bg-muted p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4" />
                          <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                          {vehicle.coolerCapacity && (
                            <Badge variant="outline">{vehicle.coolerCapacity} coolers</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteVehicleMutation.mutate(vehicle.id)}
                          disabled={deleteVehicleMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new vehicle form */}
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Make"
                    value={newVehicle.make}
                    onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                  />
                  <Input
                    placeholder="Model"
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Coolers"
                    value={newVehicle.coolerCapacity}
                    onChange={(e) => setNewVehicle({ ...newVehicle, coolerCapacity: e.target.value })}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleAddVehicle}
                  disabled={addVehicleMutation.isPending || !newVehicle.make || !newVehicle.model}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Vehicle
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={editingDriver.isActive}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      isActive: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-isActive">Active Driver</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingDriver(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateDriver}
                  disabled={updateDriverMutation.isPending}
                >
                  {updateDriverMutation.isPending
                    ? 'Updating...'
                    : 'Update Driver'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Address viewer dialog */}
      <Dialog
        open={!!addressDialogDriver}
        onOpenChange={(open) => {
          if (!open) setAddressDialogDriver(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Driver Address</DialogTitle>
          </DialogHeader>
          {addressDialogDriver && (() => {
            const fullLocation = getDriverLocationValue(addressDialogDriver);
            const mapsUrl = googleMapsSearchUrl(fullLocation);

            return (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-900">{addressDialogDriver.name}</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {fullLocation || 'No address on file.'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(fullLocation);
                        toast({ title: 'Address copied' });
                      } catch (e) {
                        toast({ title: 'Failed to copy address', variant: 'destructive' });
                      }
                    }}
                    disabled={!fullLocation}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>

                  <Button type="button" variant="default" size="sm" asChild disabled={!fullLocation}>
                    <a href={mapsUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Google Maps
                    </a>
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Drivers List */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Active Drivers ({activeDrivers.length})
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive Drivers ({inactiveDrivers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeDrivers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Car className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No active drivers
                </h3>
                <p className="text-gray-500">
                  Add your first driver to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeDrivers.map((driver) => (
                <Card key={driver.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Vehicle Icon */}
                        <div className="flex-shrink-0 bg-[#47B3CB]/20 rounded-lg p-3">
                          {driver.vehicleType?.toLowerCase().includes('van') ? (
                            <Truck className="w-8 h-8 text-[#007E8C]" />
                          ) : (
                            <Car className="w-8 h-8 text-[#007E8C]" />
                          )}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Name and Status Badges */}
                          <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gray-900">
                              {driver.name}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                              {driver.temporarilyUnavailable && (
                                <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                  <PauseCircle className="w-3 h-3 mr-1" />
                                  Temporarily Unavailable
                                </Badge>
                              )}
                              {driver.isWeeklyDriver && (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  Weekly Driver
                                </Badge>
                              )}
                              {driver.isEventDriver && (
                                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs">
                                  <Truck className="w-3 h-3 mr-1" />
                                  Event Driver
                                </Badge>
                              )}
                              {driver.emailAgreementSent ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                  <FileCheck className="w-3 h-3 mr-1" />
                                  Agreement Signed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Missing Agreement
                                </Badge>
                              )}
                              {driver.agreementInDatabase && (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                                  <Database className="w-3 h-3 mr-1" />
                                  Agreement in DB
                                </Badge>
                              )}
                              {driver.vanApproved && (
                                <Badge className="bg-brand-primary-light text-brand-primary-dark border-brand-primary text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Van Approved
                                </Badge>
                              )}
                              {driver.licenseNumber && driver.licenseNumber.trim().length > 0 && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-xs" data-testid={`badge-dl-on-file-${driver.id}`}>
                                  <FileCheck className="w-3 h-3 mr-1" />
                                  DL# on file
                                </Badge>
                              )}
                              {driver.wantsTextAlerts && (
                                <Badge variant="outline" className="border-cyan-300 text-cyan-700 bg-cyan-50 text-xs">
                                  <Smartphone className="w-3 h-3 mr-1" />
                                  Text Alerts
                                </Badge>
                              )}
                              {driver.wantsAppWalkthrough && (
                                <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-xs">
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  Needs Walkthrough
                                </Badge>
                              )}
                              {getCoolerStatusDisplay(driver.coolerStatus) && (
                                <Badge className={`${getCoolerStatusDisplay(driver.coolerStatus)!.color} text-xs`}>
                                  <Package className="w-3 h-3 mr-1" />
                                  {getCoolerStatusDisplay(driver.coolerStatus)!.label}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Location (abbreviated by default) */}
                          {(driver.hostLocation || driver.area || driver.homeAddress || driver.address) && (() => {
                            const fullLocation = getDriverLocationValue(driver);
                            const { short, isFullAddress } = abbreviateLocation(fullLocation);
                            const mapsUrl = googleMapsSearchUrl(fullLocation);

                            return (
                              <div className="bg-gradient-to-r from-brand-primary-lighter to-brand-primary-lighter/50 border-l-4 border-brand-primary rounded-md px-4 py-3 shadow-sm">
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-brand-primary-dark uppercase tracking-wide">
                                      Location
                                    </div>
                                    <div className="text-sm font-normal text-gray-900 break-words">
                                      {short}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      <a
                                        href={mapsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-medium text-brand-primary-dark hover:underline inline-flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Maps
                                      </a>
                                      {isFullAddress && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={() => setAddressDialogDriver(driver)}
                                        >
                                          View full address
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Contact Info - Styled Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {driver.phone && (
                              <div className="bg-[#47B3CB]/10 rounded-lg px-3 py-2.5 border border-[#47B3CB]/30">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-[#007E8C] flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs text-[#236383] font-medium">Phone</div>
                                    <a href={`tel:${driver.phone}`} className="text-sm font-semibold text-gray-900 hover:text-[#007E8C]">
                                      {driver.phone}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}
                            {driver.email && (
                              <div className="bg-[#47B3CB]/10 rounded-lg px-3 py-2.5 border border-[#47B3CB]/30">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-[#007E8C] flex-shrink-0" />
                                  <div className="min-w-0 overflow-hidden">
                                    <div className="text-xs text-[#236383] font-medium">Email</div>
                                    <a href={`mailto:${driver.email}`} className="text-sm font-semibold text-gray-900 hover:text-[#007E8C] truncate block">
                                      {driver.email}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Availability */}
                          {driver.availability && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              <div className="flex items-start gap-2">
                                <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs font-medium text-amber-800">Availability</div>
                                  <div className="text-sm text-amber-900">{driver.availability}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Temporarily Unavailable Details */}
                          {driver.temporarilyUnavailable && (driver.unavailableUntil || driver.unavailableNote) && (
                            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              <div className="flex items-start gap-2">
                                <PauseCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs font-medium text-red-800">Temporarily Unavailable</div>
                                  {driver.unavailableUntil && (
                                    <div className="text-sm text-red-900">
                                      Available again: {new Date(driver.unavailableUntil).toLocaleDateString()}
                                    </div>
                                  )}
                                  {driver.unavailableNote && (
                                    <div className="text-sm text-red-800 mt-1">{driver.unavailableNote}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDriver(driver)}
                          disabled={!canEdit}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDriver(driver)}
                          disabled={!canEdit || deleteDriverMutation.isPending}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inactive" className="space-y-4">
          {inactiveDrivers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No inactive drivers
                </h3>
                <p className="text-gray-500">
                  All drivers are currently active.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {inactiveDrivers.map((driver) => (
                <Card key={driver.id} className="opacity-75 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Vehicle Icon */}
                        <div className="flex-shrink-0 bg-slate-200 rounded-lg p-3">
                          <Car className="w-8 h-8 text-slate-500" />
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Name and Status Badges */}
                          <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gray-500">
                              {driver.name}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                <XCircle className="w-3 h-3 mr-1" />
                                Inactive
                              </Badge>
                              {driver.temporarilyUnavailable && (
                                <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 text-xs">
                                  <PauseCircle className="w-3 h-3 mr-1" />
                                  Temporarily Unavailable
                                </Badge>
                              )}
                              {driver.isWeeklyDriver && (
                                <Badge variant="outline" className="border-purple-200 text-purple-600 bg-purple-50 text-xs">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  Weekly Driver
                                </Badge>
                              )}
                              {driver.isEventDriver && (
                                <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50 text-xs">
                                  <Truck className="w-3 h-3 mr-1" />
                                  Event Driver
                                </Badge>
                              )}
                              {driver.emailAgreementSent ? (
                                <Badge variant="outline" className="border-green-200 text-green-600 bg-green-50 text-xs">
                                  <FileCheck className="w-3 h-3 mr-1" />
                                  Agreement Signed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-orange-200 text-orange-600 bg-orange-50 text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Missing Agreement
                                </Badge>
                              )}
                              {driver.agreementInDatabase && (
                                <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 text-xs">
                                  <Database className="w-3 h-3 mr-1" />
                                  Agreement in DB
                                </Badge>
                              )}
                              {driver.licenseNumber && driver.licenseNumber.trim().length > 0 && (
                                <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 text-xs" data-testid={`badge-dl-on-file-${driver.id}`}>
                                  <FileCheck className="w-3 h-3 mr-1" />
                                  DL# on file
                                </Badge>
                              )}
                              {driver.wantsTextAlerts && (
                                <Badge variant="outline" className="border-cyan-200 text-cyan-600 bg-cyan-50 text-xs">
                                  <Smartphone className="w-3 h-3 mr-1" />
                                  Text Alerts
                                </Badge>
                              )}
                              {driver.wantsAppWalkthrough && (
                                <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50 text-xs">
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  Needs Walkthrough
                                </Badge>
                              )}
                              {getCoolerStatusDisplay(driver.coolerStatus) && (
                                <Badge variant="outline" className="border-gray-200 text-gray-600 bg-gray-50 text-xs">
                                  <Package className="w-3 h-3 mr-1" />
                                  {getCoolerStatusDisplay(driver.coolerStatus)!.label}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Location (abbreviated by default) */}
                          {(driver.hostLocation || driver.area || driver.homeAddress || driver.address) && (() => {
                            const fullLocation = getDriverLocationValue(driver);
                            const { short, isFullAddress } = abbreviateLocation(fullLocation);
                            const mapsUrl = googleMapsSearchUrl(fullLocation);

                            return (
                              <div className="bg-gray-100 border-l-4 border-gray-400 rounded-md px-4 py-3">
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                      Location
                                    </div>
                                    <div className="text-sm font-normal text-gray-700 break-words">
                                      {short}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      <a
                                        href={mapsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-medium text-gray-700 hover:underline inline-flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Maps
                                      </a>
                                      {isFullAddress && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={() => setAddressDialogDriver(driver)}
                                        >
                                          View full address
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Contact Info - Styled Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {driver.phone && (
                              <div className="bg-slate-100 rounded-lg px-3 py-2.5 border border-slate-300">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-slate-600 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs text-slate-600 font-medium">Phone</div>
                                    <a href={`tel:${driver.phone}`} className="text-sm font-semibold text-slate-700 hover:text-gray-900">
                                      {driver.phone}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}
                            {driver.email && (
                              <div className="bg-slate-100 rounded-lg px-3 py-2.5 border border-slate-300">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-slate-600 flex-shrink-0" />
                                  <div className="min-w-0 overflow-hidden">
                                    <div className="text-xs text-slate-600 font-medium">Email</div>
                                    <a href={`mailto:${driver.email}`} className="text-sm font-semibold text-slate-700 hover:text-gray-900 truncate block">
                                      {driver.email}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Availability */}
                          {driver.availability && (
                            <div className="bg-[#A31C41]/10 border border-[#A31C41]/30 rounded-lg px-3 py-2">
                              <div className="flex items-start gap-2">
                                <Clock className="w-4 h-4 text-[#A31C41] mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs font-medium text-[#A31C41]">Availability</div>
                                  <div className="text-sm text-gray-900">{driver.availability}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Temporarily Unavailable Details */}
                          {driver.temporarilyUnavailable && (driver.unavailableUntil || driver.unavailableNote) && (
                            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              <div className="flex items-start gap-2">
                                <PauseCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs font-medium text-red-700">Temporarily Unavailable</div>
                                  {driver.unavailableUntil && (
                                    <div className="text-sm text-red-800">
                                      Available again: {new Date(driver.unavailableUntil).toLocaleDateString()}
                                    </div>
                                  )}
                                  {driver.unavailableNote && (
                                    <div className="text-sm text-red-700 mt-1">{driver.unavailableNote}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDriver(driver)}
                          disabled={!canEdit}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDriver(driver)}
                          disabled={!canEdit || deleteDriverMutation.isPending}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
