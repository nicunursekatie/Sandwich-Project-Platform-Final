import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, User, ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RecipientTspContact, User as AppUser } from "@shared/schema";

interface TSPContactManagerProps {
  recipientId: number;
  recipientName: string;
}

interface ContactFormData {
  recipientId: number;
  userId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  isPrimary: boolean;
}

export default function TSPContactManager({ recipientId, recipientName }: TSPContactManagerProps) {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<RecipientTspContact | null>(null);
  const [isUserContact, setIsUserContact] = useState(true); // Toggle between user and external contact
  const [newContact, setNewContact] = useState<ContactFormData>({
    recipientId,
    isPrimary: false,
  });

  // Fetch TSP contacts for this recipient
  const { data: tspContacts = [], isLoading, refetch } = useQuery<RecipientTspContact[]>({
    queryKey: ["/api/recipient-tsp-contacts", recipientId],
    staleTime: 0, // Always fresh data for immediate updates
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Clear cache and refetch on mount
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ["/api/recipient-tsp-contacts", recipientId] });
    setTimeout(() => {
      refetch();
    }, 100);
  }, [recipientId, refetch]);

  // Debug logging
  console.log('TSP Contact Manager Debug:', {
    recipientId,
    recipientName,
    tspContactsLength: tspContacts.length,
    tspContacts,
    isLoading,
    queryKey: ["/api/recipient-tsp-contacts", recipientId]
  });

  // Fetch users for selection dropdown
  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    staleTime: 10 * 60 * 1000,
  });

  const createContactMutation = useMutation({
    mutationFn: (contact: ContactFormData) => apiRequest('POST', '/api/recipient-tsp-contacts', contact),
    onSuccess: () => {
      // Invalidate and immediately refetch to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/recipient-tsp-contacts", recipientId] });
      refetch();
      setIsAddModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "TSP contact added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add TSP contact",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, ...contact }: { id: number } & Partial<ContactFormData>) => 
      apiRequest('PATCH', `/api/recipient-tsp-contacts/${id}`, contact),
    onSuccess: () => {
      // Invalidate and immediately refetch to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/recipient-tsp-contacts", recipientId] });
      refetch();
      setEditingContact(null);
      toast({
        title: "Success",
        description: "TSP contact updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update TSP contact",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/recipient-tsp-contacts/${id}`),
    onSuccess: () => {
      // Invalidate and immediately refetch to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/recipient-tsp-contacts", recipientId] });
      refetch();
      toast({
        title: "Success",
        description: "TSP contact removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove TSP contact",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNewContact({
      recipientId,
      isPrimary: false,
    });
    setIsUserContact(true);
  };

  const handleAdd = () => {
    createContactMutation.mutate(newContact);
  };

  const handleUpdate = () => {
    if (!editingContact) return;
    updateContactMutation.mutate({
      id: editingContact.id,
      ...newContact,
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to remove this TSP contact?")) {
      deleteContactMutation.mutate(id);
    }
  };

  const startEdit = (contact: RecipientTspContact) => {
    setEditingContact(contact);
    setIsUserContact(!!contact.userId);
    setNewContact({
      recipientId: contact.recipientId,
      userId: contact.userId || undefined,
      contactName: contact.contactName || "",
      contactEmail: contact.contactEmail || "",
      contactPhone: contact.contactPhone || "",
      notes: contact.notes || "",
      isPrimary: contact.isPrimary,
    });
  };

  // Simple TSP contact badge styling
  const getTspContactColor = () => {
    return "bg-teal-100 text-teal-800";
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading TSP contacts...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">TSP Contacts for {recipientName}</h3>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add TSP Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add TSP Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Contact Type Toggle */}
              <div className="flex items-center space-x-4">
                <Label>Contact Type:</Label>
                <div className="flex space-x-2">
                  <Button
                    variant={isUserContact ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsUserContact(true)}
                  >
                    App User
                  </Button>
                  <Button
                    variant={!isUserContact ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsUserContact(false)}
                  >
                    External Contact
                  </Button>
                </div>
              </div>

              {/* User Selection or External Contact Fields */}
              {isUserContact ? (
                <div>
                  <Label htmlFor="userId">Select App User</Label>
                  <Select
                    value={newContact.userId || ""}
                    onValueChange={(value) => setNewContact({ ...newContact, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="contactName">Name</Label>
                    <Input
                      id="contactName"
                      value={newContact.contactName || ""}
                      onChange={(e) => setNewContact({ ...newContact, contactName: e.target.value })}
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={newContact.contactEmail || ""}
                      onChange={(e) => setNewContact({ ...newContact, contactEmail: e.target.value })}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input
                      id="contactPhone"
                      value={newContact.contactPhone || ""}
                      onChange={(e) => setNewContact({ ...newContact, contactPhone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              )}

              {/* Notes field - no role selection needed */}

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newContact.notes || ""}
                  onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={newContact.isPrimary}
                  onChange={(e) => setNewContact({ ...newContact, isPrimary: e.target.checked })}
                  className="h-4 w-4 text-[#236383] focus:ring-[#236383] border-gray-300 rounded"
                />
                <Label htmlFor="isPrimary" className="text-sm">Set as Primary Contact</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={createContactMutation.isPending}>
                  {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contact List */}
      <div className="space-y-3">
        {tspContacts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-gray-500">
              No TSP contacts assigned yet. Add one to get started.
            </CardContent>
          </Card>
        ) : (
          tspContacts.map((contact) => (
            <Card key={contact.id} className={contact.isPrimary ? "border-blue-300 bg-blue-50" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {contact.isPrimary && <Star className="h-4 w-4 text-blue-600 fill-current" />}
                      <Badge className={getTspContactColor()}>TSP Contact</Badge>
                      {contact.userId ? (
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          <User className="h-3 w-3 mr-1" />
                          App User
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-700 border-gray-300">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          External
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="font-medium">
                        {contact.userName || contact.contactName}
                      </div>
                      
                      {(contact.userEmail || contact.contactEmail) && (
                        <div className="text-sm text-gray-600">
                          📧 {contact.userEmail || contact.contactEmail}
                        </div>
                      )}
                      
                      {contact.contactPhone && (
                        <div className="text-sm text-gray-600">
                          📞 {contact.contactPhone}
                        </div>
                      )}
                      
                      {contact.notes && (
                        <div className="text-sm text-gray-600 italic">
                          "{contact.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(contact)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(contact.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingContact && (
        <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit TSP Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Same form fields as add modal */}
              <div className="flex items-center space-x-4">
                <Label>Contact Type:</Label>
                <div className="flex space-x-2">
                  <Button
                    variant={isUserContact ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsUserContact(true)}
                  >
                    App User
                  </Button>
                  <Button
                    variant={!isUserContact ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsUserContact(false)}
                  >
                    External Contact
                  </Button>
                </div>
              </div>

              {isUserContact ? (
                <div>
                  <Label htmlFor="edit-userId">Select App User</Label>
                  <Select
                    value={newContact.userId || ""}
                    onValueChange={(value) => setNewContact({ ...newContact, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-contactName">Name</Label>
                    <Input
                      id="edit-contactName"
                      value={newContact.contactName || ""}
                      onChange={(e) => setNewContact({ ...newContact, contactName: e.target.value })}
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-contactEmail">Email</Label>
                    <Input
                      id="edit-contactEmail"
                      type="email"
                      value={newContact.contactEmail || ""}
                      onChange={(e) => setNewContact({ ...newContact, contactEmail: e.target.value })}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-contactPhone">Phone</Label>
                    <Input
                      id="edit-contactPhone"
                      value={newContact.contactPhone || ""}
                      onChange={(e) => setNewContact({ ...newContact, contactPhone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              )}

              {/* Role field removed - all contacts are TSP contacts */}

              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={newContact.notes || ""}
                  onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isPrimary"
                  checked={newContact.isPrimary}
                  onChange={(e) => setNewContact({ ...newContact, isPrimary: e.target.checked })}
                  className="h-4 w-4 text-[#236383] focus:ring-[#236383] border-gray-300 rounded"
                />
                <Label htmlFor="edit-isPrimary" className="text-sm">Set as Primary Contact</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingContact(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateContactMutation.isPending}>
                  {updateContactMutation.isPending ? "Updating..." : "Update Contact"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}