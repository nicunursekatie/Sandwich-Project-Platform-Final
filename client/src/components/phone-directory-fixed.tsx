import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { Phone, User, Users, Search, Edit, Plus, Star, Crown, Mail, MapPin, Building, Calendar, Trash2, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Host {
  id: number;
  name: string;
  address: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
}

interface HostContact {
  id: number;
  hostId: number;
  name: string;
  role: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface HostWithContacts extends Host {
  contacts: HostContact[];
}

interface Recipient {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  region: string | null;
  preferences: string | null;
  status: 'active' | 'inactive';
}

interface Driver {
  id: number;
  name: string;
  phone: string;
  email: string;
  zone: string;
  hostId?: number;
  isActive: boolean;
  notes: string;
  vanApproved: boolean;
  homeAddress?: string;
  availabilityNotes?: string;
}

interface GeneralContact {
  id: number;
  name: string;
  organization?: string;
  role?: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Volunteer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
  vehicleType: string;
  licenseNumber: string;
  availability: string;
  zone: string;
  routeDescription: string;
  hostLocation: string;
  hostId?: number;
  vanApproved: boolean;
  homeAddress?: string;
  availabilityNotes?: string;
  emailAgreementSent: boolean;
  voicemailLeft: boolean;
  inactiveReason?: string;
  volunteerType: string;
  createdAt: Date;
  updatedAt: Date;
}

function PhoneDirectoryFixed() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Contact management states
  const [editingContact, setEditingContact] = useState<any>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    organization: "",
    role: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    category: "general",
    status: "active"
  });

  // Driver management states
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    email: "",
    zone: "",
    homeAddress: "",
    notes: "",
    availabilityNotes: "",
    isActive: true,
    vanApproved: false
  });

  // Volunteer management states
  const [editingVolunteer, setEditingVolunteer] = useState<any>(null);
  const [isAddingVolunteer, setIsAddingVolunteer] = useState(false);
  const [newVolunteer, setNewVolunteer] = useState({
    name: "",
    phone: "",
    email: "",
    zone: "",
    homeAddress: "",
    volunteerType: "collection",
    notes: "",
    availabilityNotes: "",
    isActive: true,
    vanApproved: false
  });

  // Recipient management states
  const [editingRecipient, setEditingRecipient] = useState<any>(null);
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    name: "",
    phone: "",
    email: "",
    contactName: "",
    address: "",
    region: "",
    preferences: "",
    status: "active"
  });

  // Contact assignment states
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningContact, setAssigningContact] = useState<any>(null);
  const [assignmentTarget, setAssignmentTarget] = useState({ type: "", id: "" });
  const { user } = useAuth();
  const { toast } = useToast();

  // Permission checks
  const canViewHosts = hasPermission(user, PERMISSIONS.ACCESS_HOSTS);
  const canViewRecipients = hasPermission(user, PERMISSIONS.ACCESS_RECIPIENTS);
  const canViewDrivers = hasPermission(user, PERMISSIONS.ACCESS_DRIVERS);
  const canViewVolunteers = hasPermission(user, PERMISSIONS.ACCESS_VOLUNTEERS);
  const canEditContacts = hasPermission(user, PERMISSIONS.ADMIN_ACCESS) || 
                         hasPermission(user, PERMISSIONS.MANAGE_USERS) || 
                         hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY);



  // Smart default tab selection: prefer hosts, then other tabs (exclude contacts)
  const getDefaultTab = React.useCallback(() => {
    if (canViewHosts) return "hosts";
    if (canViewRecipients) return "recipients";  
    if (canViewDrivers) return "drivers";
    if (canViewVolunteers) return "volunteers";
    return "contacts"; // fallback if no other permissions
  }, [canViewHosts, canViewRecipients, canViewDrivers, canViewVolunteers]);

  const [activeTab, setActiveTab] = useState(() => getDefaultTab());

  // Data queries
  const { data: hosts = [] } = useQuery<HostWithContacts[]>({
    queryKey: ["/api/hosts-with-contacts"],
  });

  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ["/api/recipients"],
  });

  const { data: contacts = [] } = useQuery<GeneralContact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const { data: volunteers = [] } = useQuery<Volunteer[]>({
    queryKey: ["/api/volunteers"],
  });

  // Available tabs based on permissions
  const availableTabs = [
    { id: 'contacts', label: 'Contacts', icon: Phone, enabled: true },
    { id: 'hosts', label: 'Hosts', icon: Users, enabled: canViewHosts },
    { id: 'recipients', label: 'Recipients', icon: User, enabled: canViewRecipients },
    { id: 'drivers', label: 'Drivers', icon: User, enabled: canViewDrivers },
    { id: 'volunteers', label: 'Volunteers', icon: User, enabled: canViewVolunteers }
  ].filter(tab => tab.enabled);

  // Auto-select appropriate tab based on permissions
  React.useEffect(() => {
    const defaultTab = getDefaultTab();
    if (!availableTabs.find(tab => tab.id === activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [availableTabs, activeTab, getDefaultTab]);

  // Filter data based on search
  const filteredHosts = hosts.filter((host) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return host.name.toLowerCase().includes(searchLower) ||
           (host.address && host.address.toLowerCase().includes(searchLower));
  });

  const filteredRecipients = recipients.filter((recipient) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return recipient.name.toLowerCase().includes(searchLower) ||
           recipient.phone.includes(searchTerm);
  });

  const filteredContacts = contacts.filter((contact) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return contact.name.toLowerCase().includes(searchLower) ||
           contact.phone.includes(searchTerm);
  });

  const filteredDrivers = drivers.filter((driver) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return driver.name.toLowerCase().includes(searchLower) ||
           driver.phone.includes(searchTerm) ||
           driver.zone.toLowerCase().includes(searchLower);
  });

  const filteredVolunteers = volunteers.filter((volunteer) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return volunteer.name.toLowerCase().includes(searchLower) ||
           volunteer.phone.includes(searchTerm) ||
           volunteer.zone.toLowerCase().includes(searchLower) ||
           volunteer.volunteerType.toLowerCase().includes(searchLower);
  });

  // Contact mutations
  const createContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      return await apiRequest('POST', '/api/contacts', contactData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsAddingContact(false);
      setNewContact({
        name: "",
        organization: "",
        role: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
        category: "general",
        status: "active"
      });
      toast({
        title: "Contact Added",
        description: "New contact has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact.",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, ...contactData }: any) => {
      return await apiRequest('PUT', `/api/contacts/${id}`, contactData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setEditingContact(null);
      toast({
        title: "Contact Updated",
        description: "Contact information has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact.",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return await apiRequest('DELETE', `/api/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Contact Deleted",
        description: "Contact has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact.",
        variant: "destructive",
      });
    },
  });

  // Driver mutations
  const createDriverMutation = useMutation({
    mutationFn: async (driverData: any) => {
      return await apiRequest('POST', '/api/drivers', driverData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      setIsAddingDriver(false);
      setNewDriver({
        name: "",
        phone: "",
        email: "",
        zone: "",
        homeAddress: "",
        notes: "",
        availabilityNotes: "",
        isActive: true,
        vanApproved: false
      });
      toast({ title: "Driver Added", description: "New driver has been successfully created." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create driver.", variant: "destructive" });
    },
  });

  const updateDriverMutation = useMutation({
    mutationFn: async ({ id, ...driverData }: any) => {
      return await apiRequest('PUT', `/api/drivers/${id}`, driverData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      setEditingDriver(null);
      toast({ title: "Driver Updated", description: "Driver information has been successfully updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update driver.", variant: "destructive" });
    },
  });

  const deleteDriverMutation = useMutation({
    mutationFn: async (driverId: number) => {
      return await apiRequest('DELETE', `/api/drivers/${driverId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      toast({ title: "Driver Deleted", description: "Driver has been successfully deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete driver.", variant: "destructive" });
    },
  });

  // Volunteer mutations
  const createVolunteerMutation = useMutation({
    mutationFn: async (volunteerData: any) => {
      return await apiRequest('POST', '/api/volunteers', volunteerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/volunteers'] });
      setIsAddingVolunteer(false);
      setNewVolunteer({
        name: "",
        phone: "",
        email: "",
        zone: "",
        homeAddress: "",
        volunteerType: "collection",
        notes: "",
        availabilityNotes: "",
        isActive: true,
        vanApproved: false
      });
      toast({ title: "Volunteer Added", description: "New volunteer has been successfully created." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create volunteer.", variant: "destructive" });
    },
  });

  const updateVolunteerMutation = useMutation({
    mutationFn: async ({ id, ...volunteerData }: any) => {
      return await apiRequest('PUT', `/api/volunteers/${id}`, volunteerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/volunteers'] });
      setEditingVolunteer(null);
      toast({ title: "Volunteer Updated", description: "Volunteer information has been successfully updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update volunteer.", variant: "destructive" });
    },
  });

  const deleteVolunteerMutation = useMutation({
    mutationFn: async (volunteerId: number) => {
      return await apiRequest('DELETE', `/api/volunteers/${volunteerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/volunteers'] });
      toast({ title: "Volunteer Deleted", description: "Volunteer has been successfully deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete volunteer.", variant: "destructive" });
    },
  });

  // Recipient mutations
  const createRecipientMutation = useMutation({
    mutationFn: async (recipientData: any) => {
      return await apiRequest('POST', '/api/recipients', recipientData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      setIsAddingRecipient(false);
      setNewRecipient({
        name: "",
        phone: "",
        email: "",
        contactName: "",
        address: "",
        region: "",
        preferences: "",
        status: "active"
      });
      toast({ title: "Recipient Added", description: "New recipient has been successfully created." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create recipient.", variant: "destructive" });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: async ({ id, ...recipientData }: any) => {
      return await apiRequest('PUT', `/api/recipients/${id}`, recipientData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      setEditingRecipient(null);
      toast({ title: "Recipient Updated", description: "Recipient information has been successfully updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update recipient.", variant: "destructive" });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: async (recipientId: number) => {
      return await apiRequest('DELETE', `/api/recipients/${recipientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      toast({ title: "Recipient Deleted", description: "Recipient has been successfully deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete recipient.", variant: "destructive" });
    },
  });

  // Contact assignment mutation
  const assignContactMutation = useMutation({
    mutationFn: async ({ contactId, targetType, targetId }: any) => {
      return await apiRequest('POST', '/api/contact-assignments', { contactId, targetType, targetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      setShowAssignDialog(false);
      setAssigningContact(null);
      setAssignmentTarget({ type: "", id: "" });
      toast({ title: "Contact Assigned", description: "Contact has been successfully assigned." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign contact.", variant: "destructive" });
    },
  });

  const handleAddContact = () => {
    if (!newContact.name.trim()) return;
    createContactMutation.mutate(newContact);
  };

  const handleUpdateContact = () => {
    if (!editingContact?.name.trim()) return;
    updateContactMutation.mutate(editingContact);
  };

  const handleDeleteContact = (contactId: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const handleAddDriver = () => {
    if (!newDriver.name.trim()) return;
    createDriverMutation.mutate(newDriver);
  };

  const handleUpdateDriver = () => {
    if (!editingDriver?.name.trim()) return;
    updateDriverMutation.mutate(editingDriver);
  };

  const handleDeleteDriver = (driverId: number) => {
    if (confirm("Are you sure you want to delete this driver?")) {
      deleteDriverMutation.mutate(driverId);
    }
  };

  const handleAddVolunteer = () => {
    if (!newVolunteer.name.trim()) return;
    createVolunteerMutation.mutate(newVolunteer);
  };

  const handleUpdateVolunteer = () => {
    if (!editingVolunteer?.name.trim()) return;
    updateVolunteerMutation.mutate(editingVolunteer);
  };

  const handleDeleteVolunteer = (volunteerId: number) => {
    if (confirm("Are you sure you want to delete this volunteer?")) {
      deleteVolunteerMutation.mutate(volunteerId);
    }
  };

  const handleAddRecipient = () => {
    if (!newRecipient.name.trim()) return;
    createRecipientMutation.mutate(newRecipient);
  };

  const handleUpdateRecipient = () => {
    if (!editingRecipient?.name.trim()) return;
    updateRecipientMutation.mutate(editingRecipient);
  };

  const handleDeleteRecipient = (recipientId: number) => {
    if (confirm("Are you sure you want to delete this recipient?")) {
      deleteRecipientMutation.mutate(recipientId);
    }
  };

  const handleAssignContact = (contact: any) => {
    setAssigningContact(contact);
    setShowAssignDialog(true);
  };

  const handleConfirmAssignment = () => {
    if (assigningContact && assignmentTarget.type && assignmentTarget.id) {
      assignContactMutation.mutate({
        contactId: assigningContact.id,
        targetType: assignmentTarget.type,
        targetId: assignmentTarget.id
      });
    }
  };

  return (
    <div className="space-y-8 p-6 font-['Roboto',sans-serif]">
      {/* Header */}
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-primary font-['Roboto',sans-serif]">Phone Directory</h1>
          <p className="text-lg mt-2 text-muted-foreground font-['Roboto',sans-serif]">
            Contact information for team members and organizations
          </p>
        </div>

        {/* Search */}
        <Card className="border-2 border-border">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground"/>
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 text-base border-2 border-primary focus:ring-2 font-['Roboto',sans-serif] bg-background text-foreground"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Directory Tabs - Permission-based visibility */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="w-full overflow-x-auto">
          <TabsList className="flex w-max min-w-full h-14 p-1 rounded-lg bg-muted space-x-1">
          {availableTabs.map(tab => {
            const Icon = tab.icon;
            let count = 0;
            
            if (tab.id === 'contacts') count = filteredContacts.length;
            else if (tab.id === 'hosts') count = filteredHosts.length;
            else if (tab.id === 'recipients') count = filteredRecipients.length;
            else if (tab.id === 'drivers') count = filteredDrivers.length;
            else if (tab.id === 'volunteers') count = filteredVolunteers.length;
            
            return (
              <TabsTrigger 
                key={tab.id}
                value={tab.id} 
                className="flex items-center gap-2 h-12 px-4 text-base font-medium rounded-md transition-all duration-200 data-[state=active]:shadow-sm font-['Roboto',sans-serif] text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap flex-shrink-0">
                <Icon className="w-5 h-5"/>
                <span className="hidden sm:inline">{tab.label} ({count})</span>
                <span className="sm:hidden">{tab.label.substring(0, 1)}</span>
              </TabsTrigger>
            );
          })}
          </TabsList>
        </div>

        <TabsContent value="contacts" className="space-y-6 mt-6">
          <Card className="border-2 shadow-sm border-border">
            <CardHeader className="pb-4 bg-muted">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                    <Phone className="w-6 h-6 text-primary" />
                    General Contacts
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                    Contact information for general contacts and volunteers
                  </CardDescription>
                </div>
                {canEditContacts && (
                  <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Contact
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Contact</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-name">Name *</Label>
                            <Input
                              id="new-name"
                              value={newContact.name}
                              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                              placeholder="Enter full name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-organization">Organization</Label>
                            <Input
                              id="new-organization"
                              value={newContact.organization}
                              onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                              placeholder="Company or organization"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-role">Role</Label>
                            <Input
                              id="new-role"
                              value={newContact.role}
                              onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                              placeholder="Job title or role"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-phone">Phone</Label>
                            <Input
                              id="new-phone"
                              value={newContact.phone}
                              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                              placeholder="Phone number"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="new-email">Email</Label>
                          <Input
                            id="new-email"
                            type="email"
                            value={newContact.email}
                            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                            placeholder="Email address"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-address">Address</Label>
                          <Textarea
                            id="new-address"
                            value={newContact.address}
                            onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
                            placeholder="Street address, city, state, zip"
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-notes">Notes</Label>
                          <Textarea
                            id="new-notes"
                            value={newContact.notes}
                            onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                            placeholder="Additional notes or comments"
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsAddingContact(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleAddContact}
                            disabled={!newContact.name.trim() || createContactMutation.isPending}
                          >
                            {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-base text-muted-foreground font-['Roboto',sans-serif]">
                  {searchTerm ? 'No contacts found matching your search.' : 'No contacts found.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredContacts.map((contact) => (
                    <div key={contact.id} className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">{contact.name}</h3>
                            {contact.organization && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {contact.organization}
                              </Badge>
                            )}
                            {contact.status === 'active' && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Active
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {contact.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="w-4 h-4" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="w-4 h-4" />
                                <span>{contact.email}</span>
                              </div>
                            )}
                            {contact.role && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="w-4 h-4" />
                                <span>{contact.role}</span>
                              </div>
                            )}
                            {contact.address && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                <span>{contact.address}</span>
                              </div>
                            )}
                          </div>
                          
                          {contact.notes && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-md">
                              <p className="text-sm text-muted-foreground">{contact.notes}</p>
                            </div>
                          )}
                          
                          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>Added: {new Date(contact.createdAt).toLocaleDateString()}</span>
                            {contact.updatedAt && new Date(contact.updatedAt).getTime() !== new Date(contact.createdAt).getTime() && (
                              <span>• Updated: {new Date(contact.updatedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        
                        {canEditContacts && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignContact(contact)}
                              className="flex items-center gap-1"
                            >
                              <UserPlus className="w-4 h-4" />
                              Assign
                            </Button>
                            <Dialog open={editingContact?.id === contact.id} onOpenChange={(open) => !open && setEditingContact(null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setEditingContact(contact)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Contact</DialogTitle>
                              </DialogHeader>
                              {editingContact && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="edit-name">Name *</Label>
                                      <Input
                                        id="edit-name"
                                        value={editingContact.name}
                                        onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                                        placeholder="Enter full name"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-organization">Organization</Label>
                                      <Input
                                        id="edit-organization"
                                        value={editingContact.organization || ""}
                                        onChange={(e) => setEditingContact({ ...editingContact, organization: e.target.value })}
                                        placeholder="Company or organization"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="edit-role">Role</Label>
                                      <Input
                                        id="edit-role"
                                        value={editingContact.role || ""}
                                        onChange={(e) => setEditingContact({ ...editingContact, role: e.target.value })}
                                        placeholder="Job title or role"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-phone">Phone</Label>
                                      <Input
                                        id="edit-phone"
                                        value={editingContact.phone}
                                        onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                                        placeholder="Phone number"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-email">Email</Label>
                                    <Input
                                      id="edit-email"
                                      type="email"
                                      value={editingContact.email || ""}
                                      onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                                      placeholder="Email address"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-address">Address</Label>
                                    <Textarea
                                      id="edit-address"
                                      value={editingContact.address || ""}
                                      onChange={(e) => setEditingContact({ ...editingContact, address: e.target.value })}
                                      placeholder="Street address, city, state, zip"
                                      rows={2}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-notes">Notes</Label>
                                    <Textarea
                                      id="edit-notes"
                                      value={editingContact.notes || ""}
                                      onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                                      placeholder="Additional notes or comments"
                                      rows={3}
                                    />
                                  </div>
                                  <div className="flex justify-end space-x-2">
                                    <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={handleUpdateContact}
                                      disabled={!editingContact.name.trim() || updateContactMutation.isPending}
                                    >
                                      {updateContactMutation.isPending ? "Updating..." : "Update Contact"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canViewHosts && <TabsContent value="hosts" className="space-y-6 mt-6">
          <Card className="border-2 shadow-sm border-border">
            <CardHeader className="pb-4 bg-muted">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                <Users className="w-6 h-6 text-primary" />
                Host Directory
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                Contact information for sandwich collection hosts
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {filteredHosts.length === 0 ? (
                <div className="text-center py-12 text-base text-muted-foreground font-['Roboto',sans-serif]">
                  {searchTerm ? 'No hosts found matching your search.' : 'No hosts found.'}
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredHosts.map((host) => (
                    <div key={host.id} className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card">
                      <h3 className="font-bold text-lg mb-3 text-primary font-['Roboto',sans-serif]">{host.name}</h3>
                      {host.address && (
                        <p className="text-base mb-4 text-muted-foreground font-['Roboto',sans-serif]">
                          <span className="font-medium">Address:</span> {host.address}
                        </p>
                      )}
                      {host.contacts && host.contacts.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-base text-primary font-['Roboto',sans-serif]">Contacts:</h4>
                          {host.contacts.map((contact, idx) => (
                            <div key={idx} className="ml-4 p-4 rounded-md bg-muted/50 border border-border">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="font-semibold text-base text-primary font-['Roboto',sans-serif]">{contact.name}</div>
                                    {contact.isPrimary && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                                    {contact.role === 'lead' && <Crown className="w-4 h-4 text-purple-600 fill-current" />}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {contact.phone && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Phone className="w-3 h-3" />
                                        <span>{contact.phone}</span>
                                      </div>
                                    )}
                                    {contact.email && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Mail className="w-3 h-3" />
                                        <span>{contact.email}</span>
                                      </div>
                                    )}
                                    {contact.role && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="w-3 h-3" />
                                        <span>{contact.role}</span>
                                      </div>
                                    )}
                                  </div>
                                  {contact.notes && (
                                    <div className="mt-2 p-2 bg-background rounded text-xs text-muted-foreground">
                                      {contact.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!host.contacts || host.contacts.length === 0) && (
                        <p className="text-base italic text-muted-foreground font-['Roboto',sans-serif]">No contact information available</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {canViewRecipients && <TabsContent value="recipients" className="space-y-6 mt-6">
          <Card className="border-2 shadow-sm border-border">
            <CardHeader className="pb-4 bg-muted">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                    <User className="w-6 h-6 text-primary" />
                    Recipient Directory
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                    Contact information for sandwich delivery recipients
                  </CardDescription>
                </div>
                {canEditContacts && (
                  <Dialog open={isAddingRecipient} onOpenChange={setIsAddingRecipient}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Recipient
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Recipient</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-recipient-name">Name *</Label>
                            <Input
                              id="new-recipient-name"
                              value={newRecipient.name}
                              onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                              placeholder="Organization name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-recipient-contact">Contact Person</Label>
                            <Input
                              id="new-recipient-contact"
                              value={newRecipient.contactName}
                              onChange={(e) => setNewRecipient({ ...newRecipient, contactName: e.target.value })}
                              placeholder="Primary contact name"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-recipient-phone">Phone *</Label>
                            <Input
                              id="new-recipient-phone"
                              value={newRecipient.phone}
                              onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
                              placeholder="Phone number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-recipient-email">Email</Label>
                            <Input
                              id="new-recipient-email"
                              type="email"
                              value={newRecipient.email}
                              onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                              placeholder="Email address"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="new-recipient-address">Address</Label>
                          <Textarea
                            id="new-recipient-address"
                            value={newRecipient.address}
                            onChange={(e) => setNewRecipient({ ...newRecipient, address: e.target.value })}
                            placeholder="Street address, city, state, zip"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-recipient-region">Region</Label>
                            <Input
                              id="new-recipient-region"
                              value={newRecipient.region}
                              onChange={(e) => setNewRecipient({ ...newRecipient, region: e.target.value })}
                              placeholder="Service region"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-recipient-status">Status</Label>
                            <Select value={newRecipient.status} onValueChange={(value) => setNewRecipient({ ...newRecipient, status: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="new-recipient-preferences">Preferences</Label>
                          <Textarea
                            id="new-recipient-preferences"
                            value={newRecipient.preferences}
                            onChange={(e) => setNewRecipient({ ...newRecipient, preferences: e.target.value })}
                            placeholder="Dietary preferences or special requirements"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button 
                            onClick={handleAddRecipient}
                            disabled={createRecipientMutation.isPending}
                            className="flex-1"
                          >
                            {createRecipientMutation.isPending ? "Adding..." : "Add Recipient"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsAddingRecipient(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {filteredRecipients.length === 0 ? (
                <div className="text-center py-12 text-base text-muted-foreground font-['Roboto',sans-serif]">
                  {searchTerm ? 'No recipients found matching your search.' : 'No recipients found.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecipients.map((recipient) => (
                    <div key={recipient.id} className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">{recipient.name}</h3>
                          {recipient.status === 'active' && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          )}
                          {recipient.region && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {recipient.region}
                            </Badge>
                          )}
                        </div>
                        {canEditContacts && (
                          <div className="flex items-center gap-2">
                            <Dialog open={editingRecipient?.id === recipient.id} onOpenChange={(open) => !open && setEditingRecipient(null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setEditingRecipient(recipient)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Recipient</DialogTitle>
                                </DialogHeader>
                                {editingRecipient && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-recipient-name">Name *</Label>
                                        <Input
                                          id="edit-recipient-name"
                                          value={editingRecipient.name}
                                          onChange={(e) => setEditingRecipient({ ...editingRecipient, name: e.target.value })}
                                          placeholder="Organization name"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-recipient-contact">Contact Person</Label>
                                        <Input
                                          id="edit-recipient-contact"
                                          value={editingRecipient.contactName || ""}
                                          onChange={(e) => setEditingRecipient({ ...editingRecipient, contactName: e.target.value })}
                                          placeholder="Primary contact name"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-recipient-phone">Phone *</Label>
                                        <Input
                                          id="edit-recipient-phone"
                                          value={editingRecipient.phone}
                                          onChange={(e) => setEditingRecipient({ ...editingRecipient, phone: e.target.value })}
                                          placeholder="Phone number"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-recipient-email">Email</Label>
                                        <Input
                                          id="edit-recipient-email"
                                          type="email"
                                          value={editingRecipient.email || ""}
                                          onChange={(e) => setEditingRecipient({ ...editingRecipient, email: e.target.value })}
                                          placeholder="Email address"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-recipient-address">Address</Label>
                                      <Textarea
                                        id="edit-recipient-address"
                                        value={editingRecipient.address || ""}
                                        onChange={(e) => setEditingRecipient({ ...editingRecipient, address: e.target.value })}
                                        placeholder="Street address, city, state, zip"
                                        rows={2}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-recipient-region">Region</Label>
                                        <Input
                                          id="edit-recipient-region"
                                          value={editingRecipient.region || ""}
                                          onChange={(e) => setEditingRecipient({ ...editingRecipient, region: e.target.value })}
                                          placeholder="Service region"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-recipient-status">Status</Label>
                                        <Select value={editingRecipient.status} onValueChange={(value) => setEditingRecipient({ ...editingRecipient, status: value })}>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-recipient-preferences">Preferences</Label>
                                      <Textarea
                                        id="edit-recipient-preferences"
                                        value={editingRecipient.preferences || ""}
                                        onChange={(e) => setEditingRecipient({ ...editingRecipient, preferences: e.target.value })}
                                        placeholder="Dietary preferences or special requirements"
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                      <Button 
                                        onClick={handleUpdateRecipient}
                                        disabled={updateRecipientMutation.isPending}
                                        className="flex-1"
                                      >
                                        {updateRecipientMutation.isPending ? "Updating..." : "Update Recipient"}
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        onClick={() => setEditingRecipient(null)}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteRecipient(recipient.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recipient.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{recipient.phone}</span>
                          </div>
                        )}
                        {recipient.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span>{recipient.email}</span>
                          </div>
                        )}
                        {recipient.contactName && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-4 h-4" />
                            <span>Contact: {recipient.contactName}</span>
                          </div>
                        )}
                        {recipient.address && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{recipient.address}</span>
                          </div>
                        )}
                      </div>
                      
                      {recipient.preferences && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-md">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Preferences:</span> {recipient.preferences}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {canViewDrivers && <TabsContent value="drivers" className="space-y-6 mt-6">
          <Card className="border-2 shadow-sm border-border">
            <CardHeader className="pb-4 bg-muted">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                    <User className="w-6 h-6 text-primary" />
                    Driver Directory
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                    Contact information for delivery drivers
                  </CardDescription>
                </div>
                {canEditContacts && (
                  <Dialog open={isAddingDriver} onOpenChange={setIsAddingDriver}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Driver
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Driver</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-driver-name">Name *</Label>
                            <Input
                              id="new-driver-name"
                              value={newDriver.name}
                              onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                              placeholder="Driver name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-driver-phone">Phone *</Label>
                            <Input
                              id="new-driver-phone"
                              value={newDriver.phone}
                              onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                              placeholder="Phone number"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-driver-email">Email</Label>
                            <Input
                              id="new-driver-email"
                              type="email"
                              value={newDriver.email}
                              onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })}
                              placeholder="Email address"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-driver-zone">Zone</Label>
                            <Input
                              id="new-driver-zone"
                              value={newDriver.zone}
                              onChange={(e) => setNewDriver({ ...newDriver, zone: e.target.value })}
                              placeholder="Service zone"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="new-driver-address">Home Address</Label>
                          <Textarea
                            id="new-driver-address"
                            value={newDriver.homeAddress}
                            onChange={(e) => setNewDriver({ ...newDriver, homeAddress: e.target.value })}
                            placeholder="Home address"
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-driver-notes">Notes</Label>
                          <Textarea
                            id="new-driver-notes"
                            value={newDriver.notes}
                            onChange={(e) => setNewDriver({ ...newDriver, notes: e.target.value })}
                            placeholder="Additional notes"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button 
                            onClick={handleAddDriver}
                            disabled={createDriverMutation.isPending}
                            className="flex-1"
                          >
                            {createDriverMutation.isPending ? "Adding..." : "Add Driver"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsAddingDriver(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {filteredDrivers.length === 0 ? (
                <div className="text-center py-12 text-base" style={{ color: '#646464', fontFamily: 'Roboto, sans-serif' }}>
                  {searchTerm ? 'No drivers found matching your search.' : 'No drivers found.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDrivers.map((driver) => (
                    <div key={driver.id} className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">{driver.name}</h3>
                          {driver.isActive && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          )}
                          {driver.vanApproved && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              Van Driver
                            </Badge>
                          )}
                        </div>
                        {canEditContacts && (
                          <div className="flex items-center gap-2">
                            <Dialog open={editingDriver?.id === driver.id} onOpenChange={(open) => !open && setEditingDriver(null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setEditingDriver(driver)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Driver</DialogTitle>
                                </DialogHeader>
                                {editingDriver && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-driver-name">Name *</Label>
                                        <Input
                                          id="edit-driver-name"
                                          value={editingDriver.name}
                                          onChange={(e) => setEditingDriver({ ...editingDriver, name: e.target.value })}
                                          placeholder="Driver name"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-driver-phone">Phone *</Label>
                                        <Input
                                          id="edit-driver-phone"
                                          value={editingDriver.phone}
                                          onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                                          placeholder="Phone number"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-driver-email">Email</Label>
                                        <Input
                                          id="edit-driver-email"
                                          type="email"
                                          value={editingDriver.email || ""}
                                          onChange={(e) => setEditingDriver({ ...editingDriver, email: e.target.value })}
                                          placeholder="Email address"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-driver-zone">Zone</Label>
                                        <Input
                                          id="edit-driver-zone"
                                          value={editingDriver.zone || ""}
                                          onChange={(e) => setEditingDriver({ ...editingDriver, zone: e.target.value })}
                                          placeholder="Service zone"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-driver-address">Home Address</Label>
                                      <Textarea
                                        id="edit-driver-address"
                                        value={editingDriver.homeAddress || ""}
                                        onChange={(e) => setEditingDriver({ ...editingDriver, homeAddress: e.target.value })}
                                        placeholder="Home address"
                                        rows={2}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-driver-notes">Notes</Label>
                                      <Textarea
                                        id="edit-driver-notes"
                                        value={editingDriver.notes || ""}
                                        onChange={(e) => setEditingDriver({ ...editingDriver, notes: e.target.value })}
                                        placeholder="Additional notes"
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                      <Button 
                                        onClick={handleUpdateDriver}
                                        disabled={updateDriverMutation.isPending}
                                        className="flex-1"
                                      >
                                        {updateDriverMutation.isPending ? "Updating..." : "Update Driver"}
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        onClick={() => setEditingDriver(null)}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteDriver(driver.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {driver.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{driver.phone}</span>
                          </div>
                        )}
                        {driver.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span>{driver.email}</span>
                          </div>
                        )}
                        {driver.zone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>Zone: {driver.zone}</span>
                          </div>
                        )}
                        {driver.homeAddress && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building className="w-4 h-4" />
                            <span>{driver.homeAddress}</span>
                          </div>
                        )}
                      </div>
                      
                      {(driver.notes || driver.availabilityNotes) && (
                        <div className="mt-3 space-y-2">
                          {driver.notes && (
                            <div className="p-3 bg-muted/50 rounded-md">
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">Notes:</span> {driver.notes}
                              </p>
                            </div>
                          )}
                          {driver.availabilityNotes && (
                            <div className="p-3 bg-blue-50 rounded-md">
                              <p className="text-sm text-blue-700">
                                <span className="font-medium">Availability:</span> {driver.availabilityNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {canViewVolunteers && <TabsContent value="volunteers" className="space-y-6 mt-6">
          <Card className="border-2 shadow-sm border-border">
            <CardHeader className="pb-4 bg-muted">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                    <User className="w-6 h-6 text-primary" />
                    Volunteer Directory
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                    Contact information for volunteers
                  </CardDescription>
                </div>
                {canEditContacts && (
                  <Dialog open={isAddingVolunteer} onOpenChange={setIsAddingVolunteer}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Volunteer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Volunteer</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-volunteer-name">Name *</Label>
                            <Input
                              id="new-volunteer-name"
                              value={newVolunteer.name}
                              onChange={(e) => setNewVolunteer({ ...newVolunteer, name: e.target.value })}
                              placeholder="Volunteer name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-volunteer-phone">Phone *</Label>
                            <Input
                              id="new-volunteer-phone"
                              value={newVolunteer.phone}
                              onChange={(e) => setNewVolunteer({ ...newVolunteer, phone: e.target.value })}
                              placeholder="Phone number"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-volunteer-email">Email</Label>
                            <Input
                              id="new-volunteer-email"
                              type="email"
                              value={newVolunteer.email}
                              onChange={(e) => setNewVolunteer({ ...newVolunteer, email: e.target.value })}
                              placeholder="Email address"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-volunteer-type">Type</Label>
                            <Select value={newVolunteer.volunteerType} onValueChange={(value) => setNewVolunteer({ ...newVolunteer, volunteerType: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="collection">Collection</SelectItem>
                                <SelectItem value="distribution">Distribution</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="new-volunteer-address">Home Address</Label>
                          <Textarea
                            id="new-volunteer-address"
                            value={newVolunteer.homeAddress}
                            onChange={(e) => setNewVolunteer({ ...newVolunteer, homeAddress: e.target.value })}
                            placeholder="Home address"
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-volunteer-notes">Notes</Label>
                          <Textarea
                            id="new-volunteer-notes"
                            value={newVolunteer.notes}
                            onChange={(e) => setNewVolunteer({ ...newVolunteer, notes: e.target.value })}
                            placeholder="Additional notes"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button 
                            onClick={handleAddVolunteer}
                            disabled={createVolunteerMutation.isPending}
                            className="flex-1"
                          >
                            {createVolunteerMutation.isPending ? "Adding..." : "Add Volunteer"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsAddingVolunteer(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {filteredVolunteers.length === 0 ? (
                <div className="text-center py-12 text-base" style={{ color: '#646464', fontFamily: 'Roboto, sans-serif' }}>
                  {searchTerm ? 'No volunteers found matching your search.' : 'No volunteers found.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredVolunteers.map((volunteer) => (
                    <div key={volunteer.id} className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">{volunteer.name}</h3>
                          {volunteer.isActive && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          )}
                          {volunteer.vanApproved && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              Van Approved
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            {volunteer.volunteerType}
                          </Badge>
                        </div>
                        {canEditContacts && (
                          <div className="flex items-center gap-2">
                            <Dialog open={editingVolunteer?.id === volunteer.id} onOpenChange={(open) => !open && setEditingVolunteer(null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setEditingVolunteer(volunteer)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Volunteer</DialogTitle>
                                </DialogHeader>
                                {editingVolunteer && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-volunteer-name">Name *</Label>
                                        <Input
                                          id="edit-volunteer-name"
                                          value={editingVolunteer.name}
                                          onChange={(e) => setEditingVolunteer({ ...editingVolunteer, name: e.target.value })}
                                          placeholder="Volunteer name"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-volunteer-phone">Phone *</Label>
                                        <Input
                                          id="edit-volunteer-phone"
                                          value={editingVolunteer.phone}
                                          onChange={(e) => setEditingVolunteer({ ...editingVolunteer, phone: e.target.value })}
                                          placeholder="Phone number"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-volunteer-email">Email</Label>
                                        <Input
                                          id="edit-volunteer-email"
                                          type="email"
                                          value={editingVolunteer.email || ""}
                                          onChange={(e) => setEditingVolunteer({ ...editingVolunteer, email: e.target.value })}
                                          placeholder="Email address"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-volunteer-type">Type</Label>
                                        <Select 
                                          value={editingVolunteer.volunteerType} 
                                          onValueChange={(value) => setEditingVolunteer({ ...editingVolunteer, volunteerType: value })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="collection">Collection</SelectItem>
                                            <SelectItem value="distribution">Distribution</SelectItem>
                                            <SelectItem value="both">Both</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-volunteer-address">Home Address</Label>
                                      <Textarea
                                        id="edit-volunteer-address"
                                        value={editingVolunteer.homeAddress || ""}
                                        onChange={(e) => setEditingVolunteer({ ...editingVolunteer, homeAddress: e.target.value })}
                                        placeholder="Home address"
                                        rows={2}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-volunteer-notes">Notes</Label>
                                      <Textarea
                                        id="edit-volunteer-notes"
                                        value={editingVolunteer.notes || ""}
                                        onChange={(e) => setEditingVolunteer({ ...editingVolunteer, notes: e.target.value })}
                                        placeholder="Additional notes"
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                      <Button 
                                        onClick={handleUpdateVolunteer}
                                        disabled={updateVolunteerMutation.isPending}
                                        className="flex-1"
                                      >
                                        {updateVolunteerMutation.isPending ? "Updating..." : "Update Volunteer"}
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        onClick={() => setEditingVolunteer(null)}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteVolunteer(volunteer.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {volunteer.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{volunteer.phone}</span>
                          </div>
                        )}
                        {volunteer.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span>{volunteer.email}</span>
                          </div>
                        )}
                        {volunteer.zone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>Zone: {volunteer.zone}</span>
                          </div>
                        )}
                        {volunteer.address && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building className="w-4 h-4" />
                            <span>{volunteer.address}</span>
                          </div>
                        )}
                      </div>
                      
                      {(volunteer.vehicleType || volunteer.availability) && (
                        <div className="mt-3 space-y-2">
                          {volunteer.vehicleType && (
                            <div className="p-3 bg-purple-50 rounded-md">
                              <p className="text-sm text-purple-700">
                                <span className="font-medium">Vehicle:</span> {volunteer.vehicleType}
                              </p>
                            </div>
                          )}
                          {volunteer.availability && (
                            <div className="p-3 bg-blue-50 rounded-md">
                              <p className="text-sm text-blue-700">
                                <span className="font-medium">Availability:</span> {volunteer.availability}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {volunteer.notes && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-md">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Notes:</span> {volunteer.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

      </Tabs>

      {/* Contact Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contact</DialogTitle>
          </DialogHeader>
          {assigningContact && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Assign <strong>{assigningContact.name}</strong> to a host location or recipient organization:
              </p>
              
              <div className="space-y-3">
                <Label>Assignment Target</Label>
                <Select 
                  value={assignmentTarget.type} 
                  onValueChange={(value) => setAssignmentTarget({ ...assignmentTarget, type: value, id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="host">Host Location</SelectItem>
                    <SelectItem value="recipient">Recipient Organization</SelectItem>
                  </SelectContent>
                </Select>

                {assignmentTarget.type && (
                  <Select 
                    value={assignmentTarget.id} 
                    onValueChange={(value) => setAssignmentTarget({ ...assignmentTarget, id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${assignmentTarget.type}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignmentTarget.type === "host" && hostsWithContactsData?.map((host: any) => (
                        <SelectItem key={host.id} value={host.id.toString()}>
                          {host.name}
                        </SelectItem>
                      ))}
                      {assignmentTarget.type === "recipient" && recipientsData?.map((recipient: any) => (
                        <SelectItem key={recipient.id} value={recipient.id.toString()}>
                          {recipient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleConfirmAssignment}
                  disabled={!assignmentTarget.type || !assignmentTarget.id || assignContactMutation.isPending}
                  className="flex-1"
                >
                  {assignContactMutation.isPending ? "Assigning..." : "Assign Contact"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAssignDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PhoneDirectoryFixed;