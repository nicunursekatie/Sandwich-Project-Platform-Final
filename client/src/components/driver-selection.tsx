import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  User,
  Phone,
  Mail,
  Truck,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Search,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Driver {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  availability: string;
  availabilityNotes?: string;
  hostLocation?: string;
  routeDescription?: string;
  vanApproved: boolean;
  vehicleType?: string;
}

interface DriverSelectionProps {
  eventId: number;
  currentDrivers?: string[];
  currentDriverDetails?: string;
  currentDriversArranged?: boolean;
  currentDriverPickupTime?: string;
  currentDriverNotes?: string;
  onDriversUpdate?: () => void;
}

export function DriverSelection({
  eventId,
  currentDrivers = [],
  currentDriverDetails,
  currentDriversArranged = false,
  currentDriverPickupTime,
  currentDriverNotes,
  onDriversUpdate,
}: DriverSelectionProps) {
  const [selectedDriverIds, setSelectedDriverIds] = useState<number[]>([]);
  const [pickupTime, setPickupTime] = useState(currentDriverPickupTime || '');
  const [driverNotes, setDriverNotes] = useState(currentDriverNotes || '');
  const [driversArranged, setDriversArranged] = useState(
    currentDriversArranged
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available drivers
  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['/api/event-requests/drivers/available'],
    enabled: true,
  });

  // Initialize selected drivers from current assignments
  useEffect(() => {
    if (currentDrivers && currentDrivers.length > 0) {
      const driverIds = currentDrivers
        .map((id) => parseInt(id.toString()))
        .filter((id) => !isNaN(id));
      setSelectedDriverIds(driverIds);
    }
  }, [currentDrivers]);

  // Update driver assignments mutation
  const updateDriversMutation = useMutation({
    mutationFn: async (data: {
      assignedDriverIds: number[];
      driverPickupTime?: string;
      driverNotes?: string;
      driversArranged: boolean;
    }) => {
      const response = await fetch(`/api/event-requests/${eventId}/drivers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update driver assignments');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Driver assignments updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      onDriversUpdate?.();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update driver assignments',
        variant: 'destructive',
      });
    },
  });

  // Filter drivers based on search and availability
  const filteredDrivers = (drivers as Driver[]).filter((driver: Driver) => {
    const matchesSearch =
      !searchTerm ||
      driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone?.includes(searchTerm) ||
      driver.hostLocation?.toLowerCase().includes(searchTerm.toLowerCase());

    const isAvailable =
      !showAvailableOnly ||
      driver.availability === 'available' ||
      selectedDriverIds.includes(driver.id);

    return matchesSearch && isAvailable;
  });

  // Handle driver selection
  const toggleDriverSelection = (driverId: number) => {
    setSelectedDriverIds((prev) =>
      prev.includes(driverId)
        ? prev.filter((id) => id !== driverId)
        : [...prev, driverId]
    );
  };

  // Get selected drivers info
  const selectedDrivers = (drivers as Driver[]).filter((driver: Driver) =>
    selectedDriverIds.includes(driver.id)
  );

  // Handle save
  const handleSave = () => {
    updateDriversMutation.mutate({
      assignedDriverIds: selectedDriverIds,
      driverPickupTime: pickupTime,
      driverNotes: driverNotes,
      driversArranged: driversArranged,
    });
  };

  // Get availability badge color
  const getAvailabilityBadge = (availability: string) => {
    switch (availability) {
      case 'available':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Available
          </Badge>
        );
      case 'busy':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Busy
          </Badge>
        );
      case 'off-duty':
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Off-duty
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (driversLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Driver Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading drivers...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Driver Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drivers Arranged Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Drivers Arranged</Label>
            <p className="text-xs text-muted-foreground">
              Mark as arranged when drivers are confirmed
            </p>
          </div>
          <Switch
            checked={driversArranged}
            onCheckedChange={setDriversArranged}
          />
        </div>

        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers by name, email, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="available-only"
              checked={showAvailableOnly}
              onCheckedChange={(checked) =>
                setShowAvailableOnly(checked === true)
              }
            />
            <Label htmlFor="available-only" className="text-sm">
              Show available drivers only
            </Label>
          </div>
        </div>

        {/* Selected Drivers Summary */}
        {selectedDrivers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              Selected Drivers ({selectedDrivers.length})
            </h4>
            <div className="space-y-2">
              {selectedDrivers.map((driver: Driver) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between bg-white rounded px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-brand-primary" />
                    <div>
                      <span className="font-medium">{driver.name}</span>
                      {driver.hostLocation && (
                        <span className="text-xs text-muted-foreground ml-2">
                          • {driver.hostLocation}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDriverSelection(driver.id)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Driver List */}
        <div className="space-y-3">
          <h4 className="font-medium">
            Available Drivers ({filteredDrivers.length})
          </h4>

          {filteredDrivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No drivers found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredDrivers.map((driver: Driver) => {
                const isSelected = selectedDriverIds.includes(driver.id);

                return (
                  <div
                    key={driver.id}
                    className={cn(
                      'border rounded-lg p-4 cursor-pointer transition-colors',
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    onClick={() => toggleDriverSelection(driver.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-gray-600" />
                          <span className="font-medium">{driver.name}</span>
                          {getAvailabilityBadge(driver.availability)}
                          {driver.vanApproved && (
                            <Badge variant="outline" className="text-xs">
                              Van Approved
                            </Badge>
                          )}
                        </div>

                        {driver.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {driver.email}
                          </div>
                        )}

                        {driver.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {driver.phone}
                          </div>
                        )}

                        {driver.hostLocation && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {driver.hostLocation}
                          </div>
                        )}

                        {driver.routeDescription && (
                          <div className="text-sm text-muted-foreground">
                            Route: {driver.routeDescription}
                          </div>
                        )}

                        {driver.vehicleType && (
                          <div className="text-sm text-muted-foreground">
                            Vehicle: {driver.vehicleType}
                          </div>
                        )}

                        {driver.availabilityNotes && (
                          <div className="text-sm text-muted-foreground bg-gray-50 rounded p-2">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            {driver.availabilityNotes}
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        {isSelected ? (
                          <CheckCircle2 className="h-5 w-5 text-brand-primary" />
                        ) : (
                          <Plus className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pickup Time */}
        <div className="space-y-2">
          <Label htmlFor="pickup-time" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pickup Time
          </Label>
          <Input
            id="pickup-time"
            type="time"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            placeholder="e.g., 10:00 AM"
          />
        </div>

        {/* Driver Notes */}
        <div className="space-y-2">
          <Label htmlFor="driver-notes">Driver Notes & Instructions</Label>
          <Textarea
            id="driver-notes"
            value={driverNotes}
            onChange={(e) => setDriverNotes(e.target.value)}
            placeholder="Special instructions for drivers, pickup location details, contact information, etc."
            rows={3}
          />
        </div>

        {/* Legacy Driver Details */}
        {currentDriverDetails && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">
              Legacy Driver Details
            </h4>
            <p className="text-sm text-amber-800">{currentDriverDetails}</p>
            <p className="text-xs text-amber-700 mt-1">
              This information was entered before the new driver selection
              system. Please review and update using the driver selection above.
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={updateDriversMutation.isPending}
            className="min-w-[120px]"
          >
            {updateDriversMutation.isPending
              ? 'Saving...'
              : 'Save Driver Assignment'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
