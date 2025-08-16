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
import { Phone, User, Users, Search, Edit, Plus, Star, Crown, Mail, MapPin, Building, Calendar } from "lucide-react";
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

function PhoneDirectoryFixed() {
  const [searchTerm, setSearchTerm] = useState("");
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
  const { user } = useAuth();
  const { toast } = useToast();

  // Permission checks
  const canViewHosts = hasPermission(user, PERMISSIONS.ACCESS_HOSTS);
  const canViewRecipients = hasPermission(user, PERMISSIONS.ACCESS_RECIPIENTS);
  const canViewDrivers = hasPermission(user, PERMISSIONS.ACCESS_DRIVERS);
  const canEditContacts = hasPermission(user, PERMISSIONS.ADMIN_ACCESS) || 
                         hasPermission(user, PERMISSIONS.MANAGE_USERS) || 
                         hasPermission(user, PERMISSIONS.EDIT_DATA);

  // Smart default tab selection: prefer hosts, then other tabs (exclude contacts)
  const getDefaultTab = React.useCallback(() => {
    if (canViewHosts) return "hosts";
    if (canViewRecipients) return "recipients";  
    if (canViewDrivers) return "drivers";
    return "contacts"; // fallback if no other permissions
  }, [canViewHosts, canViewRecipients, canViewDrivers]);

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

  // Available tabs based on permissions
  const availableTabs = [
    { id: 'contacts', label: 'Contacts', icon: Phone, enabled: true },
    { id: 'hosts', label: 'Hosts', icon: Users, enabled: canViewHosts },
    { id: 'recipients', label: 'Recipients', icon: User, enabled: canViewRecipients },
    { id: 'drivers', label: 'Drivers', icon: User, enabled: canViewDrivers }
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

  // Create contact mutation
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

  const handleAddContact = () => {
    if (!newContact.name.trim()) return;
    createContactMutation.mutate(newContact);
  };

  const handleUpdateContact = () => {
    if (!editingContact?.name.trim()) return;
    updateContactMutation.mutate(editingContact);
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
        <TabsList className={`grid w-full h-14 p-1 rounded-lg bg-muted ${
          availableTabs.length === 1 ? 'grid-cols-1' :
          availableTabs.length === 2 ? 'grid-cols-2' :
          availableTabs.length === 3 ? 'grid-cols-3' :
          'grid-cols-4'
        }`}>
          {availableTabs.map(tab => {
            const Icon = tab.icon;
            let count = 0;
            
            if (tab.id === 'contacts') count = filteredContacts.length;
            else if (tab.id === 'hosts') count = filteredHosts.length;
            else if (tab.id === 'recipients') count = filteredRecipients.length;
            else if (tab.id === 'drivers') count = filteredDrivers.length;
            
            return (
              <TabsTrigger 
                key={tab.id}
                value={tab.id} 
                className="flex items-center gap-2 h-12 text-base font-medium rounded-md transition-all duration-200 data-[state=active]:shadow-sm font-['Roboto',sans-serif] text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon className="w-5 h-5"/>
                {tab.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

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
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                <User className="w-6 h-6 text-primary" />
                Recipient Directory
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                Contact information for sandwich delivery recipients
              </CardDescription>
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
                      <div className="flex items-center gap-3 mb-3">
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
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                <User className="w-6 h-6 text-primary" />
                Driver Directory
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                Contact information for delivery drivers
              </CardDescription>
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

      </Tabs>
    </div>
  );
}

export default PhoneDirectoryFixed;