import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, X, User, Phone, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Driver {
  id: number;
  name: string;
  email: string;
  phone: string;
  availability: string;
  availabilityNotes: string;
  hostLocation: string;
  routeDescription: string;
  vanApproved: boolean;
  vehicleType: string;
}

interface DriverSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDrivers: (drivers: string[]) => void;
  selectedDrivers: string[];
  eventId: number;
  mode?: 'regular' | 'van';
  onVanDriverSelect?: (driverId: string | null, customName: string | null) => void;
  currentVanDriverId?: string | null;
  currentCustomVanDriverName?: string | null;
}

export function DriverSelectionModal({
  isOpen,
  onClose,
  onSelectDrivers,
  selectedDrivers,
  eventId,
  mode = 'regular',
  onVanDriverSelect,
  currentVanDriverId,
  currentCustomVanDriverName
}: DriverSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tempSelectedDrivers, setTempSelectedDrivers] = useState<string[]>(selectedDrivers);
  const [tempVanDriverId, setTempVanDriverId] = useState<string | null>(currentVanDriverId || null);
  const [tempCustomVanDriverName, setTempCustomVanDriverName] = useState<string>(currentCustomVanDriverName || "");
  const [showCustomVanDriverInput, setShowCustomVanDriverInput] = useState(false);

  // Reset temp selection when modal opens
  useEffect(() => {
    setTempSelectedDrivers(selectedDrivers);
    setTempVanDriverId(currentVanDriverId || null);
    setTempCustomVanDriverName(currentCustomVanDriverName || "");
  }, [selectedDrivers, currentVanDriverId, currentCustomVanDriverName, isOpen]);

  // Fetch available drivers
  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/event-requests/drivers/available"],
    enabled: isOpen
  });

  // Filter drivers based on search term and mode
  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone?.includes(searchTerm);
    
    // For van mode, only show van-approved drivers
    if (mode === 'van') {
      return matchesSearch && driver.vanApproved;
    }
    
    return matchesSearch;
  });

  const handleDriverToggle = (driverName: string) => {
    setTempSelectedDrivers(prev => 
      prev.includes(driverName)
        ? prev.filter(d => d !== driverName)
        : [...prev, driverName]
    );
  };

  const handleSave = () => {
    if (mode === 'van' && onVanDriverSelect) {
      onVanDriverSelect(tempVanDriverId, tempCustomVanDriverName || null);
    } else {
      onSelectDrivers(tempSelectedDrivers);
    }
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedDrivers(selectedDrivers);
    setTempVanDriverId(currentVanDriverId || null);
    setTempCustomVanDriverName(currentCustomVanDriverName || "");
    setShowCustomVanDriverInput(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {mode === 'van' ? 'Select Van Driver for Event' : 'Select Drivers for Event'}
            {mode === 'regular' && tempSelectedDrivers.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {tempSelectedDrivers.length} selected
              </Badge>
            )}
            {mode === 'van' && (tempVanDriverId || tempCustomVanDriverName) && (
              <Badge variant="secondary" className="ml-auto">
                1 selected
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search drivers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selected Drivers Summary - Regular Mode */}
        {mode === 'regular' && tempSelectedDrivers.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-blue-700">Selected:</span>
            {tempSelectedDrivers.map(driverName => (
              <Badge key={driverName} variant="secondary" className="flex items-center gap-1">
                {driverName}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-red-600" 
                  onClick={() => handleDriverToggle(driverName)}
                />
              </Badge>
            ))}
          </div>
        )}

        {/* Van Driver Selection Mode */}
        {mode === 'van' && (
          <div className="space-y-3">
            {/* Current Van Driver Selection */}
            {(tempVanDriverId || tempCustomVanDriverName) && (
              <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-blue-700">Selected Van Driver:</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {tempVanDriverId 
                    ? drivers.find(d => d.id.toString() === tempVanDriverId)?.name || tempVanDriverId
                    : tempCustomVanDriverName
                  }
                  {tempCustomVanDriverName && (
                    <span className="ml-1 text-xs bg-blue-200 px-1 rounded">Custom</span>
                  )}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-red-600" 
                    onClick={() => {
                      setTempVanDriverId(null);
                      setTempCustomVanDriverName("");
                    }}
                  />
                </Badge>
              </div>
            )}

            {/* Custom Van Driver Input */}
            <div className="flex items-center gap-2">
              <Button 
                type="button"
                variant="outline" 
                className="text-sm"
                onClick={() => setShowCustomVanDriverInput(!showCustomVanDriverInput)}
              >
                {showCustomVanDriverInput ? "Cancel Custom Entry" : "+ Add Custom Van Driver"}
              </Button>
            </div>

            {showCustomVanDriverInput && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Input
                  placeholder="Enter custom van driver name..."
                  value={tempCustomVanDriverName}
                  onChange={(e) => setTempCustomVanDriverName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (tempCustomVanDriverName.trim()) {
                      setTempVanDriverId(null);
                      setShowCustomVanDriverInput(false);
                    }
                  }}
                  disabled={!tempCustomVanDriverName.trim()}
                  size="sm"
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Driver List */}
        <ScrollArea className="flex-1 max-h-96">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">Loading drivers...</div>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">
                {searchTerm ? "No drivers found matching your search" : "No drivers available"}
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {filteredDrivers.map((driver) => {
                const isSelected = tempSelectedDrivers.includes(driver.name);
                return (
                  <div
                    key={driver.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200" 
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (mode === 'van') {
                        setTempVanDriverId(driver.id.toString());
                        setTempCustomVanDriverName("");
                      } else {
                        handleDriverToggle(driver.name);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        (mode === 'van' ? tempVanDriverId === driver.id.toString() : isSelected) 
                          ? "bg-blue-600 border-blue-600" 
                          : "border-gray-300"
                      }`}>
                        {(mode === 'van' ? tempVanDriverId === driver.id.toString() : isSelected) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{driver.name}</span>
                          {driver.vanApproved && (
                            <Badge variant="secondary" className="text-xs">Van Approved</Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          {driver.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {driver.email}
                            </div>
                          )}
                          {driver.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {driver.phone}
                            </div>
                          )}
                        </div>
                        
                        {(driver.availability || driver.availabilityNotes) && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="font-medium">Availability:</span> {driver.availability}
                            {driver.availabilityNotes && ` - ${driver.availabilityNotes}`}
                          </div>
                        )}
                        
                        {driver.hostLocation && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="font-medium">Host Location:</span> {driver.hostLocation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            {mode === 'van' 
              ? `${filteredDrivers.length} van-approved drivers available`
              : `${filteredDrivers.length} drivers available`
            }
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={mode === 'van' && !tempVanDriverId && !tempCustomVanDriverName.trim()}
            >
              {mode === 'van' 
                ? `Save Van Driver ${(tempVanDriverId || tempCustomVanDriverName) ? '(1)' : ''}`
                : `Save Selection (${tempSelectedDrivers.length})`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}