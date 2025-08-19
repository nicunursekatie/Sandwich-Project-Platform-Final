import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Plus, Edit, Trash2, Phone, Mail, User, AlertCircle, MapPin, Star, Building2, UserPlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import type { Host, InsertHost, HostContact, InsertHostContact, Recipient } from "@shared/schema";

interface HostWithContacts extends Host {
  contacts: HostContact[];
}

interface ExtendedHostContact extends HostContact {
  newRoleType?: string;
  newAssignmentId?: number;
}

export default function HostsManagementConsolidated() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_ALL_COLLECTIONS);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [selectedHost, setSelectedHost] = useState<HostWithContacts | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<ExtendedHostContact | null>(null);
  const [expandedContacts, setExpandedContacts] = useState<Set<number>>(new Set());

  // Helper function to sort contacts by priority (leads first, then primary contacts)
  const sortContactsByPriority = (contacts: HostContact[]) => {
    return [...contacts].sort((a, b) => {
      // First priority: leads
      if (a.role === 'lead' && b.role !== 'lead') return -1;
      if (b.role === 'lead' && a.role !== 'lead') return 1;
      
      // Second priority: primary contacts
      if (a.isPrimary && !b.isPrimary) return -1;
      if (b.isPrimary && !a.isPrimary) return 1;
      
      // Third priority: primary role contacts
      if (a.role === 'primary' && b.role !== 'primary') return -1;
      if (b.role === 'primary' && a.role !== 'primary') return 1;
      
      // Default: alphabetical by name
      return a.name.localeCompare(b.name);
    });
  };

  const toggleContactExpansion = (hostId: number) => {
    setExpandedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hostId)) {
        newSet.delete(hostId);
      } else {
        newSet.add(hostId);
      }
      return newSet;
    });
  };

  const [newHost, setNewHost] = useState<InsertHost>({
    name: "",
    address: "",
    status: "active",
    notes: ""
  });
  const [newContact, setNewContact] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    isPrimary: false,
    notes: ""
  });

  const { data: hostsWithContacts = [], isLoading } = useQuery<HostWithContacts[]>({
    queryKey: ['/api/hosts-with-contacts'],
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache data
  });

  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients']
  });

  // Alias for backward compatibility
  const hosts = hostsWithContacts;

  const createHostMutation = useMutation({
    mutationFn: async (data: InsertHost) => {
      return await apiRequest('POST', '/api/hosts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      setNewHost({ name: "", address: "", status: "active", notes: "" });
      setIsAddModalOpen(false);
      toast({
        title: "Host added",
        description: "New host has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to add host: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const updateHostMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Host> }) => {
      return await apiRequest('PATCH', `/api/hosts/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      setEditingHost(null);
      toast({
        title: "Host updated",
        description: "Host has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update host: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const deleteHostMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/hosts/${id}`);
    },
    onSuccess: (_, hostId) => {
      // Immediately update cache to remove deleted host
      queryClient.setQueryData(['/api/hosts-with-contacts'], (oldData: HostWithContacts[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(host => host.id !== hostId);
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
      toast({
        title: "Host deleted",
        description: "Host has been deleted successfully.",
      });
    },
    onError: async (error: any, hostId) => {
      const errorMessage = error?.message || "Failed to delete host";
      
      // Check if it's a constraint violation (409) - host has associated data
      if (error?.status === 409 || errorMessage.includes("associated collection")) {
        toast({
          title: "Cannot delete host",
          description: "This host has collection records and cannot be deleted. Please remove or reassign the collection data first.",
          variant: "destructive",
        });
      }
      // Check if it's a 404 error (host not found)
      else if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        // Force a complete data refresh to sync with the database
        await queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
        await queryClient.refetchQueries({ queryKey: ['/api/hosts-with-contacts'] });
        
        toast({
          title: "Data refreshed",
          description: "Host data has been synchronized with the database.",
        });
      } else {
        toast({
          title: "Cannot delete host",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: InsertHostContact) => {
      return await apiRequest('POST', '/api/host-contacts', data);
    },
    onSuccess: async () => {
      // Invalidate and refetch the hosts data
      await queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      await queryClient.refetchQueries({ queryKey: ['/api/hosts-with-contacts'] });
      
      // Update the selected host with fresh data
      if (selectedHost) {
        const freshHosts = queryClient.getQueryData(['/api/hosts-with-contacts']) as HostWithContacts[];
        const freshHost = freshHosts?.find(h => h.id === selectedHost.id);
        if (freshHost) {
          setSelectedHost(freshHost);
        }
      }
      
      setNewContact({ name: "", role: "", phone: "", email: "", isPrimary: false, notes: "" });
      setIsAddingContact(false);
      toast({
        title: "Contact added",
        description: "New contact has been added successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.message || "Unknown error";
      
      // Handle specific duplicate contact error
      if (error?.status === 409 || errorMessage.includes("already exists")) {
        toast({
          title: "Duplicate Contact",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to add contact: ${errorMessage}`,
          variant: "destructive",
        });
      }
    }
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<HostContact> }) => {
      console.log('PATCH request data:', data);
      return await apiRequest('PATCH', `/api/host-contacts/${data.id}`, data.updates);
    },
    onSuccess: (updatedContact, { id, updates }) => {
      // Update the cache immediately with the new contact data
      queryClient.setQueryData(['/api/hosts-with-contacts'], (oldData: HostWithContacts[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(host => ({
          ...host,
          contacts: host.contacts.map(contact => 
            contact.id === id 
              ? { ...contact, ...updates }
              : contact
          )
        }));
      });
      
      // Update selectedHost immediately if this contact belongs to it
      if (selectedHost) {
        const updatedContacts = selectedHost.contacts.map(contact => 
          contact.id === id 
            ? { ...contact, ...updates }
            : contact
        );
        setSelectedHost({
          ...selectedHost,
          contacts: updatedContacts
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      setEditingContact(null);
      toast({
        title: "Contact updated",
        description: "Contact has been updated successfully.",
      });
    },
    onError: async (error: any) => {
      const errorMessage = error.message || "Unknown error occurred";
      
      // Check if it's a 404 error (contact not found)
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        // Force a complete data refresh to sync with the database
        await queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
        await queryClient.refetchQueries({ queryKey: ['/api/hosts-with-contacts'] });
        
        // Get fresh data after refetch
        const freshHosts = queryClient.getQueryData(['/api/hosts-with-contacts']) as HostWithContacts[];
        if (selectedHost && freshHosts) {
          const freshHost = freshHosts.find(h => h.id === selectedHost.id);
          if (freshHost) {
            setSelectedHost(freshHost);
          }
        }
        
        setEditingContact(null);
        toast({
          title: "Data refreshed",
          description: "Contact data has been synchronized with the database.",
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to update contact: ${errorMessage}`,
          variant: "destructive",
        });
      }
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/host-contacts/${id}`);
    },
    onSuccess: (_, deletedContactId) => {
      // Remove the deleted contact from all queries immediately to prevent 404s
      queryClient.setQueryData(['/api/hosts-with-contacts'], (oldData: HostWithContacts[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(host => ({
          ...host,
          contacts: host.contacts.filter(contact => contact.id !== deletedContactId)
        }));
      });
      
      // Invalidate multiple related queries to ensure UI refresh
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/host-contacts'] });
      
      // Update selectedHost immediately to show the contact is gone
      if (selectedHost && !editingHost) {
        const updatedContacts = selectedHost.contacts.filter(contact => contact.id !== deletedContactId);
        setSelectedHost({
          ...selectedHost,
          contacts: updatedContacts
        });
      }
      
      // Force a refetch in the background for data consistency
      queryClient.refetchQueries({ queryKey: ['/api/hosts-with-contacts'] });
      
      toast({
        title: "Contact deleted",
        description: "Contact has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete contact: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleAddHost = () => {
    if (!newHost.name.trim()) return;
    createHostMutation.mutate(newHost);
  };

  const handleUpdateHost = () => {
    if (!editingHost) return;
    updateHostMutation.mutate({
      id: editingHost.id,
      updates: {
        name: editingHost.name,
        address: editingHost.address,
        status: editingHost.status,
        notes: editingHost.notes
      }
    });
  };

  const handleDeleteHost = (id: number) => {
    const host = hosts.find(h => h.id === id);
    if (confirm(`Are you sure you want to hide "${host?.name}" from this list? It will be completely hidden but data will be preserved.`)) {
      // Set status to hidden to completely remove from display
      updateHostMutation.mutate({
        id: id,
        updates: { status: "hidden" }
      });
    }
  };

  const handleAddContact = () => {
    if (!selectedHost || !newContact.name.trim()) return;
    createContactMutation.mutate({
      ...newContact,
      hostId: selectedHost.id
    });
  };

  const handleUpdateContact = () => {
    if (!editingContact) return;
    
    console.log('Updating contact:', editingContact.id, editingContact);
    
    // Clean the updates object to only include valid HostContact fields - exclude timestamps and IDs
    const updates = {
      name: editingContact.name?.trim(),
      role: editingContact.role?.trim(),
      phone: editingContact.phone?.trim(),
      email: editingContact.email?.trim(),
      notes: editingContact.notes?.trim() || ""
    };
    
    updateContactMutation.mutate({
      id: editingContact.id,
      updates: updates
    });
  };

  const handleDeleteContact = (id: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate(id);
    }
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading hosts...</div>
      </div>
    );
  }

  // Filter hosts by status - only show active and inactive, completely hide "hidden" hosts
  const visibleHosts = hosts.filter(host => host.status !== 'hidden');
  const activeHosts = visibleHosts.filter(host => host.status === 'active');
  const inactiveHosts = visibleHosts.filter(host => host.status === 'inactive');

  // Render host grid component
  const HostGrid = ({ hostList }: { hostList: HostWithContacts[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {hostList.map((host) => (
        <Card 
          key={host.id} 
          className={`hover:shadow-md transition-shadow ${
            host.status === 'inactive' 
              ? 'bg-gray-100 border-gray-400 opacity-70' 
              : ''
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2 flex-1 min-w-0">
                <Building2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${host.status === 'inactive' ? 'text-gray-400' : 'text-slate-600'}`} />
                <CardTitle className={`text-base leading-tight ${host.status === 'inactive' ? 'text-gray-600' : ''}`}>
                  {host.name.split('/').map((part, index, array) => (
                    <span key={index}>
                      {part.trim()}
                      {index < array.length - 1 && <span className="text-slate-400">/</span>}
                      {index < array.length - 1 && <wbr />}
                    </span>
                  ))}
                </CardTitle>
              </div>
              <Badge 
                variant={host.status === "active" ? "default" : "secondary"}
                className={host.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
              >
                {host.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {host.address && (
              <div className="flex items-center text-sm text-slate-600">
                <MapPin className="w-4 h-4 mr-2" />
                <span className="truncate">{host.address}</span>
              </div>
            )}
            
            {/* Display contacts */}
            {host.contacts && host.contacts.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">Contacts:</div>
                {(() => {
                  const sortedContacts = sortContactsByPriority(host.contacts);
                  const isExpanded = expandedContacts.has(host.id);
                  const contactsToShow = isExpanded ? sortedContacts : sortedContacts.slice(0, 2);
                  
                  return (
                    <>
                      {contactsToShow.map((contact) => (
                        <div key={contact.id} className="space-y-1 border-l-2 border-blue-200 pl-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">{contact.name}</span>
                            <div className="flex items-center space-x-1">
                              {contact.role === 'lead' && <Crown className="w-3 h-3 text-purple-600 fill-current" />}
                              {contact.isPrimary && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                            </div>
                          </div>
                          {contact.role && (
                            <div className="text-xs text-slate-600">
                              {contact.role === 'lead' ? 'Lead' : contact.role}
                            </div>
                          )}
                          <div className="flex items-center text-xs text-slate-600">
                            <Phone className="w-3 h-3 mr-1" />
                            {contact.phone}
                          </div>
                          {contact.email && (
                            <div className="flex items-center text-xs text-slate-600">
                              <Mail className="w-3 h-3 mr-1" />
                              {contact.email}
                            </div>
                          )}
                        </div>
                      ))}
                      {sortedContacts.length > 2 && (
                        <button
                          onClick={() => toggleContactExpansion(host.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {isExpanded 
                            ? "Show less" 
                            : `+${sortedContacts.length - 2} more contacts`
                          }
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            
            {host.notes && (
              <div className="flex items-start text-sm text-slate-600">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5" />
                <span className="text-xs">{host.notes}</span>
              </div>
            )}
            
            <div className="flex flex-col space-y-2 pt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  // Force fresh data when opening host details
                  await queryClient.refetchQueries({ queryKey: ['/api/hosts-with-contacts'] });
                  // Get the refreshed host data
                  const freshHosts = queryClient.getQueryData(['/api/hosts-with-contacts']) as HostWithContacts[];
                  const freshHost = freshHosts?.find(h => h.id === host.id);
                  setSelectedHost(freshHost || host);
                }}
                className="w-full"
              >
                <Users className="w-3 h-3 mr-1" />
                Manage Contacts
              </Button>
              <div className="flex space-x-2">
                <Dialog 
                  open={editingHost?.id === host.id} 
                  onOpenChange={(open) => {
                    if (!open) {
                      setEditingHost(null);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={!canEdit}
                      onClick={() => setEditingHost(host)}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">Edit Host</DialogTitle>
                    </DialogHeader>
                    {editingHost && (
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleUpdateHost();
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="edit-name">Host Location Name *</Label>
                          <Input
                            id="edit-name"
                            value={editingHost.name}
                            onChange={(e) => {
                              e.stopPropagation();
                              setEditingHost({ ...editingHost, name: e.target.value });
                            }}
                            placeholder="Enter host location name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-status">Status</Label>
                          <Select value={editingHost.status} onValueChange={(value) => setEditingHost({ ...editingHost, status: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="edit-notes">Notes</Label>
                          <Textarea
                            id="edit-notes"
                            value={editingHost.notes || ""}
                            onChange={(e) => {
                              e.stopPropagation();
                              setEditingHost({ ...editingHost, notes: e.target.value });
                            }}
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setEditingHost(null)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            disabled={!editingHost.name.trim() || updateHostMutation.isPending}
                          >
                            {updateHostMutation.isPending ? "Updating..." : "Update Host"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => handleDeleteHost(host.id)}
                  className="flex-1 text-orange-600 hover:text-orange-700"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Hide
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <Building2 className="w-6 h-6 mr-2" />
            Host Management
          </h2>
          <p className="text-slate-600 mt-1">Manage collection hosts and their contact information</p>
        </div>

        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canEdit}>
              <Plus className="w-4 h-4 mr-2" />
              Add Host
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Add New Host</DialogTitle>
            </DialogHeader>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleAddHost();
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="name">Host Location Name *</Label>
                <Input
                  id="name"
                  value={newHost.name}
                  onChange={(e) => {
                    e.stopPropagation();
                    setNewHost({ ...newHost, name: e.target.value });
                  }}
                  placeholder="Enter host location name (e.g., Alpharetta, Dunwoody/PTC)"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={newHost.status} onValueChange={(value) => setNewHost({ ...newHost, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newHost.notes || ""}
                  onChange={(e) => {
                    e.stopPropagation();
                    setNewHost({ ...newHost, notes: e.target.value });
                  }}
                  placeholder="Enter any additional notes"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={!newHost.name.trim() || createHostMutation.isPending}
                >
                  {createHostMutation.isPending ? "Adding..." : "Add Host"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Active Locations ({activeHosts.length})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Inactive Locations ({inactiveHosts.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          {activeHosts.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No active hosts found</h3>
              <p className="text-slate-500">Add a new host to get started.</p>
            </div>
          ) : (
            <HostGrid hostList={activeHosts} />
          )}
        </TabsContent>
        
        <TabsContent value="inactive" className="mt-6">
          {inactiveHosts.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No inactive hosts</h3>
              <p className="text-slate-500">All host locations are currently active.</p>
            </div>
          ) : (
            <HostGrid hostList={inactiveHosts} />
          )}
        </TabsContent>
      </Tabs>

      {/* Host Details Dialog */}
      <Dialog 
        open={!!selectedHost} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedHost(null);
          }
          // Remove automatic refresh on modal open to prevent form interference
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Building2 className="w-5 h-5 mr-2" />
              {selectedHost?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedHost && (
            <Tabs defaultValue="contacts" className="w-full">
              <TabsList>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="contacts" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Contacts for {selectedHost.name}</h3>
                    <p className="text-sm text-slate-600">Manage contact information for this host</p>
                  </div>
                  <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={!canEdit}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Contact
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Contact</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddContact();
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="contact-name">Name *</Label>
                          <Input
                            id="contact-name"
                            value={newContact.name}
                            onChange={(e) => {
                              e.stopPropagation();
                              setNewContact({ ...newContact, name: e.target.value });
                            }}
                            placeholder="Enter contact name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contact-role">Role</Label>
                          <Input
                            id="contact-role"
                            value={newContact.role}
                            onChange={(e) => {
                              e.stopPropagation();
                              setNewContact({ ...newContact, role: e.target.value });
                            }}
                            placeholder="e.g., Manager, Coordinator, Lead, Volunteer"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contact-phone">Phone</Label>
                          <Input
                            id="contact-phone"
                            value={newContact.phone}
                            onChange={(e) => {
                              e.stopPropagation();
                              setNewContact({ ...newContact, phone: e.target.value });
                            }}
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contact-email">Email</Label>
                          <Input
                            id="contact-email"
                            type="email"
                            value={newContact.email}
                            onChange={(e) => {
                              e.stopPropagation();
                              setNewContact({ ...newContact, email: e.target.value });
                            }}
                            placeholder="Enter email address"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="contact-primary"
                            checked={newContact.isPrimary}
                            onCheckedChange={(checked) => setNewContact({ ...newContact, isPrimary: checked })}
                          />
                          <Label htmlFor="contact-primary">Primary Contact</Label>
                        </div>
                        <div>
                          <Label htmlFor="contact-notes">Notes</Label>
                          <Textarea
                            id="contact-notes"
                            value={newContact.notes}
                            onChange={(e) => {
                              e.stopPropagation();
                              setNewContact({ ...newContact, notes: e.target.value });
                            }}
                            placeholder="Additional notes"
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsAddingContact(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            disabled={!newContact.name.trim() || createContactMutation.isPending}
                          >
                            {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortContactsByPriority(selectedHost.contacts).map((contact) => (
                    <Card key={contact.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">{contact.name}</h4>
                              <div className="flex items-center space-x-1">
                                {contact.role === 'lead' && <Crown className="w-3 h-3 text-purple-600 fill-current" />}
                                {contact.isPrimary && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                              </div>
                            </div>
                            {contact.role && (
                              <div className="text-sm text-slate-600">
                                {contact.role === 'lead' ? 'Lead' : contact.role}
                              </div>
                            )}
                            <div className="flex items-center text-sm text-slate-600">
                              <Phone className="w-4 h-4 mr-2" />
                              {contact.phone}
                            </div>
                            {contact.email && (
                              <div className="flex items-center text-sm text-slate-600">
                                <Mail className="w-4 h-4 mr-2" />
                                {contact.email}
                              </div>
                            )}
                            {contact.notes && (
                              <p className="text-sm text-slate-600 mt-2">{contact.notes}</p>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            <Dialog open={editingContact?.id === contact.id} onOpenChange={(open) => !open && setEditingContact(null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  disabled={!canEdit}
                                  onClick={async () => {
                                    console.log('Edit button clicked for contact:', contact.id, contact.name);
                                    
                                    // Force fresh data before editing to ensure contact IDs are correct
                                    await queryClient.refetchQueries({ queryKey: ['/api/hosts-with-contacts'] });
                                    const freshHosts = queryClient.getQueryData(['/api/hosts-with-contacts']) as HostWithContacts[];
                                    const freshHost = freshHosts?.find(h => h.id === selectedHost?.id);
                                    const freshContact = freshHost?.contacts?.find(c => c.id === contact.id);
                                    
                                    console.log('Fresh contact found:', freshContact);
                                    
                                    if (freshContact) {
                                      setEditingContact(freshContact);
                                    } else {
                                      console.error('Could not find fresh contact data for ID:', contact.id, 'Contact:', contact.name);
                                      setEditingContact(contact);
                                    }
                                  }}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Contact</DialogTitle>
                                </DialogHeader>
                                {editingContact && (
                                  <div className="space-y-4">


                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        handleUpdateContact();
                                      }}
                                      className="space-y-4"
                                    >
                                      <div>
                                        <Label htmlFor="edit-contact-name">Name *</Label>
                                        <Input
                                          id="edit-contact-name"
                                          value={editingContact.name}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setEditingContact({ ...editingContact, name: e.target.value });
                                          }}
                                        />
                                      </div>
                                      


                                      <div>
                                        <Label htmlFor="edit-contact-role">Role</Label>
                                        <Input
                                          id="edit-contact-role"
                                          value={editingContact.role || ''}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setEditingContact({ ...editingContact, role: e.target.value });
                                          }}
                                          placeholder="e.g., Manager, Coordinator, Lead"
                                        />
                                      </div>
                                    <div>
                                      <Label htmlFor="edit-contact-phone">Phone *</Label>
                                      <Input
                                        id="edit-contact-phone"
                                        value={editingContact.phone}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setEditingContact({ ...editingContact, phone: e.target.value });
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-contact-email">Email</Label>
                                      <Input
                                        id="edit-contact-email"
                                        type="email"
                                        value={editingContact.email || ""}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setEditingContact({ ...editingContact, email: e.target.value });
                                        }}
                                      />
                                    </div>

                                    <div>
                                      <Label htmlFor="edit-contact-notes">Notes</Label>
                                      <Textarea
                                        id="edit-contact-notes"
                                        value={editingContact.notes || ""}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setEditingContact({ ...editingContact, notes: e.target.value });
                                        }}
                                        rows={3}
                                      />
                                    </div>

                                      {/* Change Role & Assignment Section */}
                                      <div className="border-t pt-4">
                                        <h3 className="font-medium text-sm text-slate-700 mb-3">Contact Settings</h3>
                                        <div className="flex items-center space-x-2">
                                          <Switch
                                            id="edit-contact-lead"
                                            checked={editingContact.role === 'lead'}
                                            onCheckedChange={(checked) => {
                                              setEditingContact({ 
                                                ...editingContact, 
                                                role: checked ? 'lead' : ''
                                              });
                                            }}
                                          />
                                          <Label htmlFor="edit-contact-lead" className="text-sm">
                                            Mark as Location Lead
                                            <span className="block text-xs text-slate-500">
                                              Leads will be highlighted with a star in the main view
                                            </span>
                                          </Label>
                                        </div>
                                      </div>

                                    <div className="flex justify-end space-x-2">
                                      <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="submit"
                                        disabled={!editingContact.name.trim() || !editingContact.phone.trim() || updateContactMutation.isPending}
                                      >
                                        {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
                                      </Button>
                                    </div>
                                  </form>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={!canEdit}
                              onClick={() => handleDeleteContact(contact.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {selectedHost.contacts.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-600">No contacts found for this host.</p>
                      <p className="text-sm text-slate-500">Add a contact to get started.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Host Name</Label>
                    <p className="text-slate-900">{selectedHost.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Status</Label>
                    <Badge 
                      variant={selectedHost.status === "active" ? "default" : "secondary"}
                      className={selectedHost.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                    >
                      {selectedHost.status}
                    </Badge>
                  </div>
                  {selectedHost.address && (
                    <div className="col-span-2">
                      <Label className="text-sm font-medium text-slate-700">Host Location</Label>
                      <p className="text-slate-900">{selectedHost.address}</p>
                    </div>
                  )}
                  {selectedHost.notes && (
                    <div className="col-span-2">
                      <Label className="text-sm font-medium text-slate-700">Notes</Label>
                      <p className="text-slate-900">{selectedHost.notes}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}