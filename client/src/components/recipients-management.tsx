import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Plus, Edit, Trash2, Phone, Mail, MapPin, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import type { Recipient } from "@shared/schema";

export default function RecipientsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.MANAGE_RECIPIENTS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number } | null>(null);
  const [newRecipient, setNewRecipient] = useState({
    name: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    region: "",
    preferences: "", // Legacy field - keeping for backward compatibility
    status: "active" as const,
    contactPersonName: "",
    contactPersonPhone: "",
    contactPersonEmail: "",
    contactPersonRole: "",
    // New enhanced fields
    reportingGroup: "",
    estimatedSandwiches: "",
    sandwichType: "",
    tspContact: "",
    tspContactUserId: "",
    contractSigned: false,
    contractSignedDate: ""
  });

  const { data: recipients = [], isLoading } = useQuery<Recipient[]>({
    queryKey: ["/api/recipients"],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const createRecipientMutation = useMutation({
    mutationFn: (recipient: any) => apiRequest('POST', '/api/recipients', recipient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setIsAddModalOpen(false);
      setNewRecipient({
        name: "",
        phone: "",
        email: "",
        website: "",
        address: "",
        region: "",
        preferences: "",
        status: "active",
        contactPersonName: "",
        contactPersonPhone: "",
        contactPersonEmail: "",
        contactPersonRole: "",
        // Reset new enhanced fields
        reportingGroup: "",
        estimatedSandwiches: "",
        sandwichType: "",
        tspContact: "",
        tspContactUserId: "",
        contractSigned: false,
        contractSignedDate: ""
      });
      toast({
        title: "Success",
        description: "Recipient added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add recipient",
        variant: "destructive",
      });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: ({ id, ...updates }: any) => apiRequest('PUT', `/api/recipients/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setEditingRecipient(null);
      toast({
        title: "Success",
        description: "Recipient updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recipient",
        variant: "destructive",
      });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/recipients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      toast({
        title: "Success",
        description: "Recipient deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete recipient",
        variant: "destructive",
      });
    },
  });

  const importRecipientsMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch('/api/recipients/import', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setImportResults(data);
      setImportFile(null);
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.imported} recipients`,
      });
    },
    onError: () => {
      toast({
        title: "Import Error",
        description: "Failed to import recipients",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.name || !newRecipient.phone) {
      toast({
        title: "Validation Error",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }
    createRecipientMutation.mutate(newRecipient);
  };

  const handleEdit = (recipient: Recipient) => {
    setEditingRecipient(recipient);
  };

  const handleUpdate = () => {
    if (!editingRecipient) return;
    updateRecipientMutation.mutate(editingRecipient);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this recipient?")) {
      deleteRecipientMutation.mutate(id);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResults(null);
    }
  };

  const handleImport = () => {
    if (importFile) {
      importRecipientsMutation.mutate(importFile);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading recipients...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Users className="text-blue-500 mr-3 w-6 h-6" />
            Recipients Management
          </h1>
          <div className="flex gap-2">
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import CSV/XLSX
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="import-recipients-description">
                <DialogHeader>
                  <DialogTitle>Import Recipients from CSV/XLSX</DialogTitle>
                </DialogHeader>
                <p id="import-recipients-description" className="text-sm text-slate-600 mb-4">
                  Upload a CSV or Excel file with recipient data. Required columns: name, phone. Optional: email, address, preferences, status.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Select File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="mt-1"
                    />
                    {importFile && (
                      <p className="text-sm text-green-600 mt-2">
                        Selected: {importFile.name}
                      </p>
                    )}
                  </div>

                  {importResults && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800">Import Results</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Successfully imported {importResults.imported} recipients
                        {importResults.skipped > 0 && `, skipped ${importResults.skipped} duplicates`}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsImportModalOpen(false);
                        setImportFile(null);
                        setImportResults(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={!importFile || importRecipientsMutation.isPending}
                    >
                      {importRecipientsMutation.isPending ? "Importing..." : "Import"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canEdit} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Recipient
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="add-recipient-description">
                <DialogHeader>
                  <DialogTitle>Add New Recipient</DialogTitle>
                </DialogHeader>
                <p id="add-recipient-description" className="text-sm text-slate-600 mb-4">
                  Add a new recipient to the system for sandwich deliveries.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newRecipient.name}
                      onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                      placeholder="Enter recipient name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={newRecipient.phone}
                      onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newRecipient.email}
                      onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={newRecipient.website}
                      onChange={(e) => setNewRecipient({ ...newRecipient, website: e.target.value })}
                      placeholder="https://www.organization.org"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={newRecipient.address}
                      onChange={(e) => setNewRecipient({ ...newRecipient, address: e.target.value })}
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="region">Region/Area</Label>
                    <Input
                      id="region"
                      value={newRecipient.region}
                      onChange={(e) => setNewRecipient({ ...newRecipient, region: e.target.value })}
                      placeholder="Downtown, Sandy Springs, Buckhead, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferences">Preferences</Label>
                    <Input
                      id="preferences"
                      value={newRecipient.preferences}
                      onChange={(e) => setNewRecipient({ ...newRecipient, preferences: e.target.value })}
                      placeholder="Dietary restrictions or preferences"
                    />
                  </div>
                  
                  {/* Contact Person Section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-sm text-slate-700 mb-3">Contact Person Information</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="contactPersonName">Contact Name</Label>
                        <Input
                          id="contactPersonName"
                          value={newRecipient.contactPersonName}
                          onChange={(e) => setNewRecipient({ ...newRecipient, contactPersonName: e.target.value })}
                          placeholder="John Smith"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactPersonRole">Role/Title</Label>
                        <Input
                          id="contactPersonRole"
                          value={newRecipient.contactPersonRole}
                          onChange={(e) => setNewRecipient({ ...newRecipient, contactPersonRole: e.target.value })}
                          placeholder="Program Director, Manager, etc."
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactPersonPhone">Contact Phone</Label>
                        <Input
                          id="contactPersonPhone"
                          value={newRecipient.contactPersonPhone}
                          onChange={(e) => setNewRecipient({ ...newRecipient, contactPersonPhone: e.target.value })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactPersonEmail">Contact Email</Label>
                        <Input
                          id="contactPersonEmail"
                          type="email"
                          value={newRecipient.contactPersonEmail}
                          onChange={(e) => setNewRecipient({ ...newRecipient, contactPersonEmail: e.target.value })}
                          placeholder="john@organization.org"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Operational Fields */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-sm text-slate-700 mb-3">Operational Details</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="reportingGroup">Reporting Group</Label>
                        <Input
                          id="reportingGroup"
                          value={newRecipient.reportingGroup}
                          onChange={(e) => setNewRecipient({ ...newRecipient, reportingGroup: e.target.value })}
                          placeholder="Corresponds to host locations"
                        />
                      </div>
                      <div>
                        <Label htmlFor="estimatedSandwiches">Estimated Sandwiches</Label>
                        <Input
                          id="estimatedSandwiches"
                          type="number"
                          value={newRecipient.estimatedSandwiches}
                          onChange={(e) => setNewRecipient({ ...newRecipient, estimatedSandwiches: e.target.value })}
                          placeholder="Number of sandwiches needed"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sandwichType">Sandwich Type</Label>
                        <Input
                          id="sandwichType"
                          value={newRecipient.sandwichType}
                          onChange={(e) => setNewRecipient({ ...newRecipient, sandwichType: e.target.value })}
                          placeholder="Type preferred (e.g., PB&J, Deli, Mixed)"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tspContact">TSP Contact</Label>
                        <Input
                          id="tspContact"
                          value={newRecipient.tspContact}
                          onChange={(e) => setNewRecipient({ ...newRecipient, tspContact: e.target.value })}
                          placeholder="TSP team member name"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="contractSigned"
                            checked={newRecipient.contractSigned}
                            onChange={(e) => setNewRecipient({ ...newRecipient, contractSigned: e.target.checked })}
                            className="h-4 w-4 text-[#236383] focus:ring-[#236383] border-gray-300 rounded"
                          />
                          <Label htmlFor="contractSigned" className="text-sm">Contract Signed</Label>
                        </div>
                      </div>
                      {newRecipient.contractSigned && (
                        <div>
                          <Label htmlFor="contractSignedDate">Contract Signed Date</Label>
                          <Input
                            id="contractSignedDate"
                            type="date"
                            value={newRecipient.contractSignedDate}
                            onChange={(e) => setNewRecipient({ ...newRecipient, contractSignedDate: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRecipientMutation.isPending}>
                      {createRecipientMutation.isPending ? "Adding..." : "Add Recipient"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Recipients List */}
      <div className="grid gap-4">
        {recipients.map((recipient) => (
          <Card key={recipient.id} className="border border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{recipient.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={recipient.status === "active" ? "default" : "secondary"}>
                      {recipient.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => handleEdit(recipient)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => handleDelete(recipient.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4" />
                <span>{recipient.phone}</span>
              </div>
              {recipient.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4" />
                  <span>{recipient.email}</span>
                </div>
              )}
              {(recipient as any).website && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                  </svg>
                  <a href={(recipient as any).website} target="_blank" rel="noopener noreferrer" className="hover:text-[#236383] underline">
                    {(recipient as any).website}
                  </a>
                </div>
              )}
              {recipient.address && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{recipient.address}</span>
                </div>
              )}
              {recipient.region && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">Region:</span> <span>{recipient.region}</span>
                </div>
              )}
              {recipient.preferences && (
                <div className="text-sm text-slate-600">
                  <strong>Preferences:</strong> {recipient.preferences}
                </div>
              )}

              {/* Enhanced Operational Information */}
              {(recipient.reportingGroup || recipient.estimatedSandwiches || recipient.sandwichType || recipient.tspContact || recipient.contractSigned) && (
                <div className="border-t pt-3 mt-3">
                  <div className="text-sm font-medium text-slate-700 mb-2">Operational Details</div>
                  <div className="grid grid-cols-2 gap-2">
                    {recipient.reportingGroup && (
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">Reporting Group:</span> {recipient.reportingGroup}
                      </div>
                    )}
                    {recipient.estimatedSandwiches && (
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">Estimated:</span> {recipient.estimatedSandwiches} sandwiches
                      </div>
                    )}
                    {recipient.sandwichType && (
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">Type:</span> {recipient.sandwichType}
                      </div>
                    )}
                    {recipient.tspContact && (
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">TSP Contact:</span> {recipient.tspContact}
                      </div>
                    )}
                    <div className="col-span-2 flex items-center gap-2">
                      {recipient.contractSigned ? (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                          Contract Signed
                          {recipient.contractSignedDate && (
                            <span className="ml-1">({new Date(recipient.contractSignedDate).toLocaleDateString()})</span>
                          )}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Contract Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Contact Person Information */}
              {(recipient.contactPersonName || recipient.contactPersonPhone || recipient.contactPersonEmail) && (
                <div className="border-t pt-3 mt-3">
                  <div className="text-sm font-medium text-slate-700 mb-2">Contact Person</div>
                  {recipient.contactPersonName && (
                    <div className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="font-medium">Name:</span> 
                      <span>{recipient.contactPersonName}</span>
                      {recipient.contactPersonRole && (
                        <Badge variant="outline" className="text-xs">
                          {recipient.contactPersonRole}
                        </Badge>
                      )}
                    </div>
                  )}
                  {recipient.contactPersonPhone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <Phone className="w-4 h-4" />
                      <span>{recipient.contactPersonPhone}</span>
                    </div>
                  )}
                  {recipient.contactPersonEmail && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <Mail className="w-4 h-4" />
                      <span>{recipient.contactPersonEmail}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {recipients.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No recipients found. Add a new recipient to get started.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRecipient && (
        <Dialog open={!!editingRecipient} onOpenChange={() => setEditingRecipient(null)}>
          <DialogContent aria-describedby="edit-recipient-description" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Recipient</DialogTitle>
            </DialogHeader>
            <p id="edit-recipient-description" className="text-sm text-slate-600 mb-4">
              Update recipient information.
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editingRecipient.name}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editingRecipient.phone}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingRecipient.email || ""}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-website">Website</Label>
                <Input
                  id="edit-website"
                  type="url"
                  value={(editingRecipient as any).website || ""}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, website: e.target.value })}
                  placeholder="https://www.organization.org"
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Street Address</Label>
                <Input
                  id="edit-address"
                  value={editingRecipient.address || ""}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-region">Region/Area</Label>
                <Input
                  id="edit-region"
                  value={editingRecipient.region || ""}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, region: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-preferences">Preferences</Label>
                <Input
                  id="edit-preferences"
                  value={editingRecipient.preferences || ""}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, preferences: e.target.value })}
                />
              </div>
              
              {/* Contact Person Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-sm text-slate-700 mb-3">Contact Person Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-contactPersonName">Contact Name</Label>
                    <Input
                      id="edit-contactPersonName"
                      value={editingRecipient.contactPersonName || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, contactPersonName: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-contactPersonRole">Role/Title</Label>
                    <Input
                      id="edit-contactPersonRole"
                      value={editingRecipient.contactPersonRole || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, contactPersonRole: e.target.value })}
                      placeholder="Program Director, Manager, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-contactPersonPhone">Contact Phone</Label>
                    <Input
                      id="edit-contactPersonPhone"
                      value={editingRecipient.contactPersonPhone || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, contactPersonPhone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-contactPersonEmail">Contact Email</Label>
                    <Input
                      id="edit-contactPersonEmail"
                      type="email"
                      value={editingRecipient.contactPersonEmail || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, contactPersonEmail: e.target.value })}
                      placeholder="john@organization.org"
                    />
                  </div>
                </div>
              </div>

              {/* Enhanced Operational Fields */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-sm text-slate-700 mb-3">Operational Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-reportingGroup">Reporting Group</Label>
                    <Input
                      id="edit-reportingGroup"
                      value={editingRecipient.reportingGroup || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, reportingGroup: e.target.value })}
                      placeholder="Corresponds to host locations"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-estimatedSandwiches">Estimated Sandwiches</Label>
                    <Input
                      id="edit-estimatedSandwiches"
                      type="number"
                      value={editingRecipient.estimatedSandwiches || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, estimatedSandwiches: parseInt(e.target.value) || null })}
                      placeholder="Number of sandwiches needed"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sandwichType">Sandwich Type</Label>
                    <Input
                      id="edit-sandwichType"
                      value={editingRecipient.sandwichType || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, sandwichType: e.target.value })}
                      placeholder="Type preferred (e.g., PB&J, Deli, Mixed)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-tspContact">TSP Contact</Label>
                    <Input
                      id="edit-tspContact"
                      value={editingRecipient.tspContact || ""}
                      onChange={(e) => setEditingRecipient({ ...editingRecipient, tspContact: e.target.value })}
                      placeholder="TSP team member name"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-contractSigned"
                        checked={editingRecipient.contractSigned || false}
                        onChange={(e) => setEditingRecipient({ ...editingRecipient, contractSigned: e.target.checked })}
                        className="h-4 w-4 text-[#236383] focus:ring-[#236383] border-gray-300 rounded"
                      />
                      <Label htmlFor="edit-contractSigned" className="text-sm">Contract Signed</Label>
                    </div>
                  </div>
                  {editingRecipient.contractSigned && (
                    <div>
                      <Label htmlFor="edit-contractSignedDate">Contract Signed Date</Label>
                      <Input
                        id="edit-contractSignedDate"
                        type="date"
                        value={editingRecipient.contractSignedDate ? (typeof editingRecipient.contractSignedDate === 'string' ? editingRecipient.contractSignedDate.split('T')[0] : new Date(editingRecipient.contractSignedDate).toISOString().split('T')[0]) : ""}
                        onChange={(e) => setEditingRecipient({ ...editingRecipient, contractSignedDate: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingRecipient(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateRecipientMutation.isPending}>
                  {updateRecipientMutation.isPending ? "Updating..." : "Update Recipient"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}