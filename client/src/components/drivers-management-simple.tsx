import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import type { Driver, Host } from "@shared/schema";

export default function DriversManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_ALL_COLLECTIONS);
  const canExport = hasPermission(user, PERMISSIONS.EXPORT_DATA);
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    email: "",
    vehicleType: "",
    licenseNumber: "",
    zone: "",
    routeDescription: "",
    isActive: true,
  });

  // Fetch drivers
  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  // Fetch hosts for route assignments
  const { data: hosts = [] } = useQuery<Host[]>({
    queryKey: ["/api/hosts"],
  });

  // Add driver mutation
  const addDriverMutation = useMutation({
    mutationFn: (driverData: any) =>
      apiRequest("/api/drivers", "POST", driverData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setIsAddModalOpen(false);
      resetNewDriver();
      toast({ title: "Driver added successfully" });
    },
    onError: () => {
      toast({ title: "Error adding driver", variant: "destructive" });
    },
  });

  // Update driver mutation
  const updateDriverMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/drivers/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setEditingDriver(null);
      toast({ title: "Driver updated successfully" });
    },
    onError: () => {
      toast({ title: "Error updating driver", variant: "destructive" });
    },
  });

  const resetNewDriver = () => {
    setNewDriver({
      name: "",
      phone: "",
      email: "",
      vehicleType: "",
      licenseNumber: "",
      zone: "",
      routeDescription: "",
      isActive: true,
    });
  };

  const handleAddDriver = async () => {
    if (!newDriver.name || !newDriver.phone) {
      toast({
        title: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    addDriverMutation.mutate(newDriver);
  };

  const handleUpdateDriver = (driver: Driver) => {
    if (!editingDriver) return;
    updateDriverMutation.mutate({
      id: editingDriver.id,
      data: driver,
    });
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/drivers/export", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drivers-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Export completed successfully" });
    } catch (error) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading drivers...</div>;
  }

  const activeDrivers = drivers.filter(driver => driver.isActive);
  const inactiveDrivers = drivers.filter(driver => !driver.isActive);

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
                <DialogContent className="max-w-md">
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
                      <Label htmlFor="vehicleType">Vehicle Type</Label>
                      <Input
                        id="vehicleType"
                        value={newDriver.vehicleType}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, vehicleType: e.target.value })
                        }
                        placeholder="e.g., Car, Van, Truck"
                      />
                    </div>
                    <div>
                      <Label htmlFor="zone">Zone</Label>
                      <Input
                        id="zone"
                        value={newDriver.zone}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, zone: e.target.value })
                        }
                        placeholder="Enter zone assignment"
                      />
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
                        {addDriverMutation.isPending ? "Adding..." : "Add Driver"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

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
                <Card key={driver.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {driver.vehicleType?.toLowerCase().includes("van") ? (
                            <Truck className="w-8 h-8 text-blue-500" />
                          ) : (
                            <Car className="w-8 h-8 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {driver.name}
                            </h3>
                            <Badge variant="secondary">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            {driver.phone && (
                              <div className="flex items-center text-xs text-gray-500">
                                <Phone className="w-3 h-3 mr-1" />
                                {driver.phone}
                              </div>
                            )}
                            {driver.email && (
                              <div className="flex items-center text-xs text-gray-500">
                                <Mail className="w-3 h-3 mr-1" />
                                {driver.email}
                              </div>
                            )}
                          </div>
                          {driver.zone && (
                            <div className="text-xs text-gray-500 mt-1">
                              Zone: {driver.zone}
                            </div>
                          )}
                          {driver.vehicleType && (
                            <div className="text-xs text-gray-500">
                              Vehicle: {driver.vehicleType}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingDriver(driver)}
                        disabled={!canEdit}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
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
                <Card key={driver.id} className="opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Car className="w-8 h-8 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-gray-500 truncate">
                              {driver.name}
                            </h3>
                            <Badge variant="outline">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            {driver.phone && (
                              <div className="flex items-center text-xs text-gray-400">
                                <Phone className="w-3 h-3 mr-1" />
                                {driver.phone}
                              </div>
                            )}
                            {driver.email && (
                              <div className="flex items-center text-xs text-gray-400">
                                <Mail className="w-3 h-3 mr-1" />
                                {driver.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingDriver(driver)}
                        disabled={!canEdit}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
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