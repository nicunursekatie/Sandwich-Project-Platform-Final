import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Users, 
  Plus, 
  Edit3, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  FileText,
  AlertCircle,
  Trash2,
  Building2,
  ArrowRight
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { apiRequest } from "@/lib/queryClient";

export default function VolunteerManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for filters and search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // State for form dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    skills: "",
    availability: "",
    notes: "",
    status: "active"
  });

  // Host designation state
  const [showHostDesignation, setShowHostDesignation] = useState(false);
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [hostRole, setHostRole] = useState("volunteer");
  const [hostNotes, setHostNotes] = useState("");

  // Check permissions
  const canManage = hasPermission(user, PERMISSIONS.MANAGE_VOLUNTEERS);
  const canAdd = hasPermission(user, PERMISSIONS.ADD_VOLUNTEERS);
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_VOLUNTEERS);
  const canView = hasPermission(user, PERMISSIONS.VIEW_VOLUNTEERS);

  if (!canView) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Access Denied
              </h3>
              <div className="mt-2 text-sm text-red-700">
                You don't have permission to view volunteer information.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch volunteers (using drivers table for now - will be transitioned to volunteers)
  const { data: volunteers = [], isLoading } = useQuery({
    queryKey: ['/api/drivers'],
    queryFn: () => apiRequest('GET', '/api/drivers')
  });

  // Fetch hosts for designation dropdown
  const { data: hosts = [] } = useQuery({
    queryKey: ['/api/hosts'],
    queryFn: () => apiRequest('GET', '/api/hosts')
  });

  // Create/Update volunteer mutation
  const { mutate: saveVolunteer, isPending: isSaving } = useMutation({
    mutationFn: async (volunteerData: any) => {
      if (editingVolunteer) {
        return apiRequest('PATCH', `/api/drivers/${editingVolunteer.id}`, volunteerData);
      } else {
        return apiRequest('POST', '/api/drivers', volunteerData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      toast({
        title: "Success",
        description: `Volunteer ${editingVolunteer ? 'updated' : 'added'} successfully`,
      });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editingVolunteer ? 'update' : 'add'} volunteer`,
        variant: "destructive",
      });
    }
  });

  // Designate as host mutation
  const { mutate: designateAsHost, isPending: isDesignating } = useMutation({
    mutationFn: async ({ volunteerData, hostContactData }: { volunteerData: any; hostContactData: any }) => {
      // First update the volunteer's hostId
      await apiRequest('PATCH', `/api/drivers/${editingVolunteer.id}`, {
        hostId: hostContactData.hostId,
        notes: volunteerData.notes
      });
      
      // Then create a host contact entry
      return await apiRequest('POST', '/api/host-contacts', hostContactData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      toast({
        title: "Success",
        description: `${editingVolunteer.firstName} ${editingVolunteer.lastName} has been designated as a host contact`,
      });
      resetForm();
      setShowAddDialog(false);
      setShowHostDesignation(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to designate as host: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete volunteer mutation
  const { mutate: deleteVolunteer } = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/drivers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      toast({
        title: "Success",
        description: "Volunteer deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete volunteer",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      skills: "",
      availability: "",
      notes: "",
      status: "active"
    });
    setEditingVolunteer(null);
    setShowHostDesignation(false);
    setSelectedHostId(null);
    setHostRole("volunteer");
    setHostNotes("");
  };

  const handleEdit = (volunteer: any) => {
    if (!canEdit) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to edit volunteers",
        variant: "destructive",
      });
      return;
    }

    setFormData({
      firstName: volunteer.firstName || "",
      lastName: volunteer.lastName || "",
      email: volunteer.email || "",
      phone: volunteer.phone || "",
      address: volunteer.address || "",
      skills: volunteer.skills || "",
      availability: volunteer.availability || "",
      notes: volunteer.notes || "",
      status: volunteer.status || "active"
    });
    setEditingVolunteer(volunteer);
    setShowAddDialog(true);
  };

  const handleAdd = () => {
    if (!canAdd) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to add volunteers",
        variant: "destructive",
      });
      return;
    }

    resetForm();
    setShowAddDialog(true);
  };

  const handleDelete = (volunteer: any) => {
    if (!canManage) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to delete volunteers",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${volunteer.firstName} ${volunteer.lastName}?`)) {
      deleteVolunteer(volunteer.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const volunteerData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      skills: formData.skills,
      availability: formData.availability,
      notes: formData.notes,
      status: formData.status
    };

    saveVolunteer(volunteerData);
  };

  const handleHostDesignation = () => {
    if (!selectedHostId || !editingVolunteer) {
      toast({
        title: "Error",
        description: "Please select a host location",
        variant: "destructive",
      });
      return;
    }

    const volunteerData = {
      notes: formData.notes + (hostNotes ? `\n\nDesignated as host: ${hostNotes}` : "")
    };

    const hostContactData = {
      hostId: selectedHostId,
      name: `${formData.firstName} ${formData.lastName}`,
      role: hostRole,
      phone: formData.phone || "",
      email: formData.email || "",
      notes: hostNotes,
      isPrimary: hostRole === "primary"
    };

    designateAsHost({ volunteerData, hostContactData });
  };

  // Filter volunteers
  const filteredVolunteers = volunteers.filter((volunteer: any) => {
    const matchesSearch = !searchTerm || 
      `${volunteer.firstName} ${volunteer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      volunteer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      volunteer.phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === "all" || volunteer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Volunteer Management</h1>
          <p className="text-gray-600">Manage volunteer information and coordination</p>
        </div>
        {canAdd && (
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Volunteer
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search volunteers by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Volunteers List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading volunteers...</div>
          </div>
        ) : filteredVolunteers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No volunteers found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search criteria" 
                    : "Get started by adding a volunteer"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredVolunteers.map((volunteer: any) => (
            <Card key={volunteer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {volunteer.firstName} {volunteer.lastName}
                      </h3>
                      <Badge variant={volunteer.status === 'active' ? 'default' : 'secondary'}>
                        {volunteer.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {volunteer.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <a href={`mailto:${volunteer.email}`} className="text-blue-600 hover:underline">
                            {volunteer.email}
                          </a>
                        </div>
                      )}
                      
                      {volunteer.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <a href={`tel:${volunteer.phone}`} className="text-blue-600 hover:underline">
                            {volunteer.phone}
                          </a>
                        </div>
                      )}
                      
                      {volunteer.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{volunteer.address}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          Added {format(new Date(volunteer.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    {volunteer.skills && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Skills</span>
                        </div>
                        <p className="text-sm text-gray-600 pl-6">{volunteer.skills}</p>
                      </div>
                    )}

                    {volunteer.notes && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Notes</span>
                        </div>
                        <p className="text-sm text-gray-600 pl-6">{volunteer.notes}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(volunteer)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(volunteer)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Volunteer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingVolunteer ? 'Edit Volunteer' : 'Add New Volunteer'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="skills">Skills/Expertise</Label>
                <Textarea
                  id="skills"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="List any relevant skills, expertise, or areas of interest..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="availability">Availability</Label>
                <Textarea
                  id="availability"
                  value={formData.availability}
                  onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                  placeholder="When are they available to volunteer?"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes about this volunteer..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Host Designation Section */}
              {editingVolunteer && canManage && (
                <div className="border-t pt-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-medium text-gray-900">Designate as Host</h3>
                    </div>
                    
                    {!showHostDesignation ? (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-800 mb-3">
                          Promote this volunteer to be a host contact at a specific location. They will appear in the host management section.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowHostDesignation(true)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-100"
                        >
                          <Building2 className="w-4 h-4 mr-2" />
                          Designate as Host
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-amber-50 rounded-lg p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="hostLocation">Host Location</Label>
                            <Select value={selectedHostId?.toString() || ""} onValueChange={(value) => setSelectedHostId(parseInt(value))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a location" />
                              </SelectTrigger>
                              <SelectContent>
                                {hosts.map((host: any) => (
                                  <SelectItem key={host.id} value={host.id.toString()}>
                                    {host.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hostRole">Role at Location</Label>
                            <Select value={hostRole} onValueChange={setHostRole}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="volunteer">Volunteer</SelectItem>
                                <SelectItem value="coordinator">Coordinator</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="primary">Primary Contact</SelectItem>
                                <SelectItem value="backup">Backup Contact</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="hostNotes">Host Assignment Notes</Label>
                          <Textarea
                            id="hostNotes"
                            value={hostNotes}
                            onChange={(e) => setHostNotes(e.target.value)}
                            placeholder="Any notes about their role at this location..."
                            rows={2}
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowHostDesignation(false)}
                            size="sm"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleHostDesignation}
                            disabled={isDesignating || !selectedHostId}
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            {isDesignating ? 'Designating...' : (
                              <>
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Designate as Host
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : (editingVolunteer ? 'Save Changes' : 'Add Volunteer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}