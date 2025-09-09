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
}

export function DriverSelectionModal({
  isOpen,
  onClose,
  onSelectDrivers,
  selectedDrivers,
  eventId
}: DriverSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tempSelectedDrivers, setTempSelectedDrivers] = useState<string[]>(selectedDrivers);

  // Reset temp selection when modal opens
  useEffect(() => {
    setTempSelectedDrivers(selectedDrivers);
  }, [selectedDrivers, isOpen]);

  // Fetch available drivers
  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/event-requests/drivers/available"],
    enabled: isOpen
  });

  // Filter drivers based on search term
  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.phone.includes(searchTerm)
  );

  const handleDriverToggle = (driverName: string) => {
    setTempSelectedDrivers(prev => 
      prev.includes(driverName)
        ? prev.filter(d => d !== driverName)
        : [...prev, driverName]
    );
  };

  const handleSave = () => {
    onSelectDrivers(tempSelectedDrivers);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedDrivers(selectedDrivers);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Select Drivers for Event
            {tempSelectedDrivers.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {tempSelectedDrivers.length} selected
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

        {/* Selected Drivers Summary */}
        {tempSelectedDrivers.length > 0 && (
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
                    onClick={() => handleDriverToggle(driver.name)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
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
            {filteredDrivers.length} drivers available
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              Save Selection ({tempSelectedDrivers.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}