import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Upload,
  Search,
  Filter,
  X,
  Download,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import TSPContactManager from './tsp-contact-manager';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { useResourcePermissions } from '@/hooks/useResourcePermissions';
import type { Recipient } from '@shared/schema';
import { logger } from '@/lib/logger';

export default function RecipientsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = useResourcePermissions('RECIPIENTS');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(
    null
  );

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // Default to active only
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [tspContactFilter, setTspContactFilter] = useState<string>('all');
  const [sandwichTypeFilter, setSandwichTypeFilter] = useState<string>('all');
  const [focusAreaFilter, setFocusAreaFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [customFocusArea, setCustomFocusArea] = useState('');
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  // Collapsible section states - consolidated into single state object
  const [sections, setSections] = useState({
    basicInfo: true,
    contact: true,
    secondContact: false,
    operational: false,
    socialMedia: false,
    peopleServed: false,
    partnership: false,
    fruitSnacks: false,
    seasonalChanges: false,
    communicationPreferences: false,
    impactStories: false,
    editBasicInfo: true,
    editContact: true,
    editSecondContact: false,
    editOperational: false,
    editSocialMedia: false,
    editPeopleServed: false,
    editPartnership: false,
    editFruitSnacks: false,
    editSeasonalChanges: false,
    editCommunicationPreferences: false,
    editImpactStories: false,
  });

  const updateSection = (section: keyof typeof sections, open: boolean) => {
    setSections(prev => ({ ...prev, [section]: open }));
  };
  const [newRecipient, setNewRecipient] = useState({
    name: '',
    phone: '',
    email: '',
    website: '',
    instagramHandle: '',
    address: '',
    region: '',
    preferences: '', // Legacy field - keeping for backward compatibility
    status: 'active' as const,
    contactPersonName: '',
    contactPersonPhone: '',
    contactPersonEmail: '',
    contactPersonRole: '',
    // Second contact person fields
    secondContactPersonName: '',
    secondContactPersonPhone: '',
    secondContactPersonEmail: '',
    secondContactPersonRole: '',
    // New enhanced fields
    reportingGroup: '',
    estimatedSandwiches: '',
    sandwichType: '',
    focusAreas: [] as string[], // Multiple focus areas
    tspContact: '',
    tspContactUserId: '',
    contractSigned: false,
    contractSignedDate: '',
    // Collection and feeding schedule fields
    collectionDay: '',
    collectionTime: '',
    feedingDay: '',
    feedingTime: '',
    // Social media post tracking fields
    hasSharedPost: false,
    sharedPostDate: '',
    // People Served fields
    averagePeopleServed: '',
    peopleServedFrequency: '',
    // Partnership fields
    partnershipStartDate: '',
    partnershipYears: '',
    // Fruit/Snacks Program fields
    receivingFruit: false,
    receivingSnacks: false,
    wantsFruit: false,
    wantsSnacks: false,
    fruitSnacksNotes: '',
    // Seasonal Changes fields
    hasSeasonalChanges: false,
    seasonalChangesDescription: '',
    summerNeeds: '',
    winterNeeds: '',
    // Communication Preferences fields
    preferredContactMethod: '',
    allowedContactMethods: [] as string[],
    doNotContact: false,
    contactMethodNotes: '',
    // Impact Stories field
    impactStories: [] as Array<{ story: string; date: string; source: string }>,
  });

  const { data: recipients = [], isLoading } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients'],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Fetch users for TSP contact selection
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
  });

  // Filtered and searched recipients
  const filteredRecipients = useMemo(() => {
    let filtered = recipients;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (recipient) =>
          recipient.name?.toLowerCase().includes(term) ||
          recipient.email?.toLowerCase().includes(term) ||
          recipient.phone?.toLowerCase().includes(term) ||
          recipient.address?.toLowerCase().includes(term) ||
          recipient.region?.toLowerCase().includes(term) ||
          recipient.contactPersonName?.toLowerCase().includes(term) ||
          recipient.contactPersonEmail?.toLowerCase().includes(term) ||
          (recipient as any).secondContactPersonName
            ?.toLowerCase()
            .includes(term) ||
          (recipient as any).secondContactPersonEmail
            ?.toLowerCase()
            .includes(term) ||
          recipient.reportingGroup?.toLowerCase().includes(term) ||
          (() => {
            // Handle both new focusAreas array and legacy focusArea string
            const areas = Array.isArray((recipient as any).focusAreas)
              ? (recipient as any).focusAreas
              : (recipient as any).focusArea
                ? [(recipient as any).focusArea]
                : [];
            return areas.some((area: string) => area.toLowerCase().includes(term));
          })() ||
          (recipient as any).instagramHandle?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (recipient) => recipient.status === statusFilter
      );
    }

    // Apply contract filter
    if (contractFilter === 'signed') {
      filtered = filtered.filter(
        (recipient) => recipient.contractSigned === true
      );
    } else if (contractFilter === 'unsigned') {
      filtered = filtered.filter((recipient) => !recipient.contractSigned);
    }

    // Apply region filter
    if (regionFilter !== 'all') {
      filtered = filtered.filter(
        (recipient) => recipient.region === regionFilter
      );
    }

    // Apply TSP contact filter
    if (tspContactFilter !== 'all') {
      filtered = filtered.filter(
        (recipient) =>
          recipient.tspContact &&
          recipient.tspContact
            .toLowerCase()
            .includes(tspContactFilter.toLowerCase())
      );
    }

    // Apply sandwich type filter
    if (sandwichTypeFilter !== 'all') {
      filtered = filtered.filter(
        (recipient) => recipient.sandwichType === sandwichTypeFilter
      );
    }

    // Apply focus area filter
    if (focusAreaFilter !== 'all') {
      filtered = filtered.filter((recipient) => {
        // Handle both new focusAreas array and legacy focusArea string
        const areas = Array.isArray((recipient as any).focusAreas)
          ? (recipient as any).focusAreas
          : (recipient as any).focusArea
            ? [(recipient as any).focusArea]
            : [];
        return areas.includes(focusAreaFilter);
      });
    }

    return filtered;
  }, [
    recipients,
    searchTerm,
    statusFilter,
    contractFilter,
    regionFilter,
    tspContactFilter,
    sandwichTypeFilter,
    focusAreaFilter,
  ]);

  // Separate list for inactive recipients (always filtered, no other filters applied)
  const inactiveRecipients = useMemo(() => {
    return recipients.filter((r) => r.status === 'inactive');
  }, [recipients]);

  // Get unique values for filter dropdowns
  const uniqueRegions = useMemo(() => {
    const regions = recipients.map((r) => r.region).filter(Boolean);
    return [...new Set(regions)].sort();
  }, [recipients]);

  const uniqueTspContacts = useMemo(() => {
    const allContacts = recipients
      .map((r) => r.tspContact)
      .filter(Boolean)
      .flatMap((contact) =>
        // Split contacts by common separators (/, &, and, comma)
        contact.split(/[/&,]|and/i).map((c) => c.trim())
      )
      .filter((contact) => contact.length > 0);

    return [...new Set(allContacts)].sort();
  }, [recipients]);

  const uniqueSandwichTypes = useMemo(() => {
    const types = recipients.map((r) => r.sandwichType).filter(Boolean);
    return [...new Set(types)].sort();
  }, [recipients]);

  const uniqueFocusAreas = useMemo(() => {
    const allAreas = recipients.flatMap((r) => {
      // Handle both new focusAreas array and legacy focusArea string
      if (Array.isArray((r as any).focusAreas) && (r as any).focusAreas.length > 0) {
        return (r as any).focusAreas;
      } else if ((r as any).focusArea) {
        return [(r as any).focusArea];
      }
      return [];
    });
    return [...new Set(allAreas)].sort();
  }, [recipients]);

  const createRecipientMutation = useMutation({
    mutationFn: (recipient: any) => {
      logger.log('[CREATE RECIPIENT] Sending data:', recipient);
      return apiRequest('POST', '/api/recipients', recipient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      setIsAddModalOpen(false);
      setNewRecipient({
        name: '',
        phone: '',
        email: '',
        website: '',
        instagramHandle: '',
        address: '',
        region: '',
        preferences: '',
        status: 'active',
        contactPersonName: '',
        contactPersonPhone: '',
        contactPersonEmail: '',
        contactPersonRole: '',
        secondContactPersonName: '',
        secondContactPersonPhone: '',
        secondContactPersonEmail: '',
        secondContactPersonRole: '',
        // Reset new enhanced fields
        reportingGroup: '',
        estimatedSandwiches: '',
        sandwichType: '',
        focusAreas: [], // Reset focus areas field
        tspContact: '',
        tspContactUserId: '',
        contractSigned: false,
        contractSignedDate: '',
        // Reset collection and feeding schedule fields
        collectionDay: '',
        collectionTime: '',
        feedingDay: '',
        feedingTime: '',
        // Reset social media post tracking fields
        hasSharedPost: false,
        sharedPostDate: '',
        // Reset People Served fields
        averagePeopleServed: '',
        peopleServedFrequency: '',
        // Reset Partnership fields
        partnershipStartDate: '',
        partnershipYears: '',
        // Reset Fruit/Snacks Program fields
        receivingFruit: false,
        receivingSnacks: false,
        wantsFruit: false,
        wantsSnacks: false,
        fruitSnacksNotes: '',
        // Reset Seasonal Changes fields
        hasSeasonalChanges: false,
        seasonalChangesDescription: '',
        summerNeeds: '',
        winterNeeds: '',
        // Reset Communication Preferences fields
        preferredContactMethod: '',
        allowedContactMethods: [],
        doNotContact: false,
        contactMethodNotes: '',
        // Reset Impact Stories field
        impactStories: [],
      });
      toast({
        title: 'Success',
        description: 'Recipient added successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add recipient',
        variant: 'destructive',
      });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: ({ id, ...updates }: any) =>
      apiRequest('PUT', `/api/recipients/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      setEditingRecipient(null);
      toast({
        title: 'Success',
        description: 'Recipient updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update recipient',
        variant: 'destructive',
      });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/recipients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      toast({
        title: 'Success',
        description: 'Recipient deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete recipient',
        variant: 'destructive',
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
      }).then((res) => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      setImportResults(data);
      setImportFile(null);
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${data.imported} recipients`,
      });
    },
    onError: () => {
      toast({
        title: 'Import Error',
        description: 'Failed to import recipients',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.name) {
      toast({
        title: 'Validation Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }

    // Convert data types to match schema expectations
    const submissionData = {
      ...newRecipient,
      // Convert estimatedSandwiches from string to number (or null if empty)
      estimatedSandwiches: newRecipient.estimatedSandwiches
        ? parseInt(newRecipient.estimatedSandwiches, 10)
        : null,
      // Convert contractSignedDate from string to Date (or null if empty)
      contractSignedDate: newRecipient.contractSignedDate
        ? new Date(newRecipient.contractSignedDate)
        : null,
      // Convert sharedPostDate from string to Date (or null if empty)
      sharedPostDate: (newRecipient as any).sharedPostDate
        ? new Date((newRecipient as any).sharedPostDate)
        : null,
      // Convert averagePeopleServed from string to number (or null if empty)
      averagePeopleServed: newRecipient.averagePeopleServed
        ? parseInt(newRecipient.averagePeopleServed, 10)
        : null,
      // Convert partnershipStartDate from string to Date (or null if empty)
      partnershipStartDate: newRecipient.partnershipStartDate
        ? new Date(newRecipient.partnershipStartDate)
        : null,
      // Convert partnershipYears from string to number (or null if empty)
      partnershipYears: newRecipient.partnershipYears
        ? parseInt(newRecipient.partnershipYears, 10)
        : null,
    };

    createRecipientMutation.mutate(submissionData);
  };

  const handleEdit = (recipient: Recipient) => {
    // Normalize focusAreas to always be an array
    // Handle both new focusAreas array and legacy focusArea string
    let focusAreas: string[] = [];

    if (Array.isArray((recipient as any).focusAreas) && (recipient as any).focusAreas.length > 0) {
      focusAreas = (recipient as any).focusAreas;
    } else if ((recipient as any).focusArea && typeof (recipient as any).focusArea === 'string') {
      // Migrate old single focusArea to array
      focusAreas = [(recipient as any).focusArea];
    }

    const normalizedRecipient = {
      ...recipient,
      focusAreas,
      // Normalize allowedContactMethods - default to email and phone_call if not set
      allowedContactMethods: Array.isArray((recipient as any).allowedContactMethods) 
        ? (recipient as any).allowedContactMethods 
        : ['email', 'phone_call'],
      // Normalize impactStories - default to empty array if not set
      impactStories: Array.isArray((recipient as any).impactStories) 
        ? (recipient as any).impactStories 
        : [],
    };
    setEditingRecipient(normalizedRecipient as Recipient);
  };

  const handleUpdate = () => {
    if (!editingRecipient) return;

    // Convert data types to match schema expectations for update
    const updateData = {
      ...editingRecipient,
      // Convert estimatedSandwiches from string to number (or null if empty)
      estimatedSandwiches: (editingRecipient as any).estimatedSandwiches
        ? parseInt((editingRecipient as any).estimatedSandwiches, 10)
        : null,
      // Convert contractSignedDate from string to Date (or null if empty)
      contractSignedDate: (editingRecipient as any).contractSignedDate
        ? new Date((editingRecipient as any).contractSignedDate)
        : null,
      // Convert averagePeopleServed from string to number (or null if empty)
      averagePeopleServed: (editingRecipient as any).averagePeopleServed
        ? parseInt((editingRecipient as any).averagePeopleServed, 10)
        : null,
      // Convert partnershipStartDate from string to Date (or null if empty)
      partnershipStartDate: (editingRecipient as any).partnershipStartDate
        ? new Date((editingRecipient as any).partnershipStartDate)
        : null,
      // Convert partnershipYears from string to number (or null if empty)
      partnershipYears: (editingRecipient as any).partnershipYears
        ? parseInt((editingRecipient as any).partnershipYears, 10)
        : null,
    };

    updateRecipientMutation.mutate(updateData);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this recipient?')) {
      deleteRecipientMutation.mutate(id);
    }
  };

  const handleToggleStatus = (recipient: Recipient) => {
    const newStatus = recipient.status === 'active' ? 'inactive' : 'active';
    const updateData = {
      ...recipient,
      status: newStatus
    };
    updateRecipientMutation.mutate(updateData);
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

  const handleExport = async () => {
    try {
      const response = await fetch('/api/recipients/export-csv', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recipients-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: 'Export completed successfully',
        description: `Exported ${filteredRecipients.length} recipients to CSV`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export recipients data',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading recipients...</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-blue-500 w-6 h-6" />
              Recipients Management
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-teal-600 hover:text-teal-800 transition-colors">
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Recipients Management Help</p>
                  <p className="text-sm">Manage individuals and organizations who receive sandwiches. Track contact information, delivery addresses, and special requirements.</p>
                </TooltipContent>
              </Tooltip>
            </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Dialog
              open={isImportModalOpen}
              onOpenChange={setIsImportModalOpen}
            >
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
                <p
                  id="import-recipients-description"
                  className="text-sm text-slate-600 mb-4"
                >
                  Upload a CSV or Excel file with recipient data. Required
                  columns: name, phone. Optional: email, address, preferences,
                  status.
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
                      <h4 className="font-medium text-green-800">
                        Import Results
                      </h4>
                      <p className="text-sm text-green-700 mt-1">
                        Successfully imported {importResults.imported}{' '}
                        recipients
                        {importResults.skipped > 0 &&
                          `, skipped ${importResults.skipped} duplicates`}
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
                      disabled={
                        !importFile || importRecipientsMutation.isPending
                      }
                    >
                      {importRecipientsMutation.isPending
                        ? 'Importing...'
                        : 'Import'}
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
              <DialogContent
                aria-describedby="add-recipient-description"
                className="max-h-[90vh] flex flex-col"
              >
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Add New Recipient</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-1">
                  <p
                    id="add-recipient-description"
                    className="text-sm text-slate-600 mb-4"
                  >
                    Add a new recipient to the system for sandwich deliveries.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Information Section */}
                    <Collapsible
                      open={sections.basicInfo}
                      onOpenChange={(open) => updateSection('basicInfo', open)}
                    >
                      <div>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Basic Information
                            </h4>
                            {sections.basicInfo ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="name">Name *</Label>
                              <Input
                                id="name"
                                value={newRecipient.name}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Enter recipient name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="phone">Phone Number *</Label>
                              <Input
                                id="phone"
                                value={newRecipient.phone}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    phone: e.target.value,
                                  })
                                }
                                placeholder="(555) 123-4567"
                              />
                            </div>
                            <div>
                              <Label htmlFor="email">Email</Label>
                              <Input
                                id="email"
                                type="email"
                                value={newRecipient.email}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    email: e.target.value,
                                  })
                                }
                                placeholder="email@example.com"
                              />
                            </div>
                            <div>
                              <Label htmlFor="website">Website</Label>
                              <Input
                                id="website"
                                type="text"
                                value={newRecipient.website}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    website: e.target.value,
                                  })
                                }
                                placeholder="www.organization.org or https://organization.org"
                              />
                            </div>

                            <div>
                              <Label htmlFor="instagramHandle">
                                Instagram Handle
                              </Label>
                              <Input
                                id="instagramHandle"
                                type="text"
                                value={newRecipient.instagramHandle}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    instagramHandle: e.target.value,
                                  })
                                }
                                placeholder="@organizationhandle"
                              />
                            </div>
                            <div>
                              <Label htmlFor="address">Street Address</Label>
                              <Input
                                id="address"
                                value={newRecipient.address}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    address: e.target.value,
                                  })
                                }
                                placeholder="123 Main St, City, State 12345"
                              />
                            </div>
                            <div>
                              <Label htmlFor="region">Region/Area</Label>
                              <Input
                                id="region"
                                value={newRecipient.region}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    region: e.target.value,
                                  })
                                }
                                placeholder="Downtown, Sandy Springs, Buckhead, etc."
                              />
                            </div>
                            <div>
                              <Label htmlFor="preferences">Preferences</Label>
                              <Input
                                id="preferences"
                                value={newRecipient.preferences}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    preferences: e.target.value,
                                  })
                                }
                                placeholder="Dietary restrictions or preferences"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Contact Person Section */}
                    <Collapsible
                      open={sections.contact}
                      onOpenChange={(open) => updateSection('contact', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Contact Person Information
                            </h4>
                            {sections.contact ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="contactPersonName">
                                Contact Name
                              </Label>
                              <Input
                                id="contactPersonName"
                                value={newRecipient.contactPersonName}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    contactPersonName: e.target.value,
                                  })
                                }
                                placeholder="John Smith"
                              />
                            </div>
                            <div>
                              <Label htmlFor="contactPersonRole">
                                Role/Title
                              </Label>
                              <Input
                                id="contactPersonRole"
                                value={newRecipient.contactPersonRole}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    contactPersonRole: e.target.value,
                                  })
                                }
                                placeholder="Program Director, Manager, etc."
                              />
                            </div>
                            <div>
                              <Label htmlFor="contactPersonPhone">
                                Contact Phone
                              </Label>
                              <Input
                                id="contactPersonPhone"
                                value={newRecipient.contactPersonPhone}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    contactPersonPhone: e.target.value,
                                  })
                                }
                                placeholder="(555) 123-4567"
                              />
                            </div>
                            <div>
                              <Label htmlFor="contactPersonEmail">
                                Contact Email
                              </Label>
                              <Input
                                id="contactPersonEmail"
                                type="email"
                                value={newRecipient.contactPersonEmail}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    contactPersonEmail: e.target.value,
                                  })
                                }
                                placeholder="john@organization.org"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Second Contact Person Section */}
                    <Collapsible
                      open={sections.secondContact}
                      onOpenChange={(open) => updateSection('secondContact', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Second Contact Person (Optional)
                            </h4>
                            {sections.secondContact ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="secondContactPersonName">
                                Contact Name
                              </Label>
                              <Input
                                id="secondContactPersonName"
                                value={newRecipient.secondContactPersonName}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    secondContactPersonName: e.target.value,
                                  })
                                }
                                placeholder="Jane Doe"
                              />
                            </div>
                            <div>
                              <Label htmlFor="secondContactPersonRole">
                                Role/Title
                              </Label>
                              <Input
                                id="secondContactPersonRole"
                                value={newRecipient.secondContactPersonRole}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    secondContactPersonRole: e.target.value,
                                  })
                                }
                                placeholder="Assistant Manager, etc."
                              />
                            </div>
                            <div>
                              <Label htmlFor="secondContactPersonPhone">
                                Contact Phone
                              </Label>
                              <Input
                                id="secondContactPersonPhone"
                                value={newRecipient.secondContactPersonPhone}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    secondContactPersonPhone: e.target.value,
                                  })
                                }
                                placeholder="(555) 987-6543"
                              />
                            </div>
                            <div>
                              <Label htmlFor="secondContactPersonEmail">
                                Contact Email
                              </Label>
                              <Input
                                id="secondContactPersonEmail"
                                type="email"
                                value={newRecipient.secondContactPersonEmail}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    secondContactPersonEmail: e.target.value,
                                  })
                                }
                                placeholder="jane@organization.org"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Enhanced Operational Fields */}
                    <Collapsible
                      open={sections.operational}
                      onOpenChange={(open) => updateSection('operational', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Operational Details
                            </h4>
                            {sections.operational ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="reportingGroup">
                                Reporting Group
                              </Label>
                              <Input
                                id="reportingGroup"
                                value={newRecipient.reportingGroup}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    reportingGroup: e.target.value,
                                  })
                                }
                                placeholder="Corresponds to host locations"
                              />
                            </div>
                            <div>
                              <Label htmlFor="estimatedSandwiches">
                                Estimated Sandwiches
                              </Label>
                              <Input
                                id="estimatedSandwiches"
                                type="number"
                                value={newRecipient.estimatedSandwiches}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    estimatedSandwiches: e.target.value,
                                  })
                                }
                                placeholder="Number of sandwiches needed"
                              />
                            </div>
                            <div>
                              <Label htmlFor="sandwichType">
                                Sandwich Type
                              </Label>
                              <Input
                                id="sandwichType"
                                value={newRecipient.sandwichType}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    sandwichType: e.target.value,
                                  })
                                }
                                placeholder="Type preferred (e.g., PB&J, Deli, Mixed)"
                              />
                            </div>
                            <div>
                              <Label htmlFor="focusAreas">Focus Areas</Label>
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {/* Predefined options */}
                                  {['Youth', 'Veterans', 'Seniors', 'Families', 'Unhoused', 'Refugees', 'Disabilities', 'Other'].map((area) => (
                                    <Badge
                                      key={area}
                                      variant={newRecipient.focusAreas.includes(area) ? "default" : "outline"}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const updated = newRecipient.focusAreas.includes(area)
                                          ? newRecipient.focusAreas.filter(a => a !== area)
                                          : [...newRecipient.focusAreas, area];
                                        setNewRecipient({ ...newRecipient, focusAreas: updated });
                                      }}
                                    >
                                      {area}
                                    </Badge>
                                  ))}

                                  {/* Custom focus areas */}
                                  {newRecipient.focusAreas
                                    .filter((area) => !['Youth', 'Veterans', 'Seniors', 'Families', 'Unhoused', 'Refugees', 'Disabilities', 'Other'].includes(area))
                                    .map((area) => (
                                      <Badge
                                        key={area}
                                        variant="default"
                                        className="cursor-pointer"
                                        onClick={() => {
                                          const updated = newRecipient.focusAreas.filter(a => a !== area);
                                          setNewRecipient({ ...newRecipient, focusAreas: updated });
                                        }}
                                      >
                                        {area} ×
                                      </Badge>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Add custom focus area..."
                                    value={customFocusArea}
                                    onChange={(e) => setCustomFocusArea(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && customFocusArea.trim()) {
                                        e.preventDefault();
                                        const trimmed = customFocusArea.trim();
                                        if (!newRecipient.focusAreas.includes(trimmed)) {
                                          setNewRecipient({
                                            ...newRecipient,
                                            focusAreas: [...newRecipient.focusAreas, trimmed]
                                          });
                                        }
                                        setCustomFocusArea('');
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const trimmed = customFocusArea.trim();
                                      if (trimmed && !newRecipient.focusAreas.includes(trimmed)) {
                                        setNewRecipient({
                                          ...newRecipient,
                                          focusAreas: [...newRecipient.focusAreas, trimmed]
                                        });
                                        setCustomFocusArea('');
                                      }
                                    }}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="tspContact">TSP Contact</Label>
                              <Input
                                id="tspContact"
                                value={newRecipient.tspContact}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    tspContact: e.target.value,
                                  })
                                }
                                placeholder="TSP team member name"
                              />
                            </div>
                            <div className="col-span-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="contractSigned"
                                  checked={newRecipient.contractSigned}
                                  onChange={(e) =>
                                    setNewRecipient({
                                      ...newRecipient,
                                      contractSigned: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                                />
                                <Label
                                  htmlFor="contractSigned"
                                  className="text-sm"
                                >
                                  Contract Signed
                                </Label>
                              </div>
                            </div>
                            {newRecipient.contractSigned && (
                              <div>
                                <Label htmlFor="contractSignedDate">
                                  Contract Signed Date
                                </Label>
                                <Input
                                  id="contractSignedDate"
                                  type="date"
                                  value={newRecipient.contractSignedDate}
                                  onChange={(e) =>
                                    setNewRecipient({
                                      ...newRecipient,
                                      contractSignedDate: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            )}
                            
                            {/* Collection and Feeding Schedule Fields */}
                            <div className="col-span-2 border-t pt-3 mt-3">
                              <h5 className="font-medium text-sm text-slate-700 mb-3">
                                Collection & Feeding Schedule
                              </h5>
                            </div>
                            <div>
                              <Label htmlFor="collectionDay">
                                Collection Day
                              </Label>
                              <Input
                                id="collectionDay"
                                type="text"
                                value={newRecipient.collectionDay}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    collectionDay: e.target.value,
                                  })
                                }
                                placeholder="Monday"
                                data-testid="input-collection-day"
                              />
                            </div>
                            <div>
                              <Label htmlFor="collectionTime">
                                Collection Time
                              </Label>
                              <Input
                                id="collectionTime"
                                type="text"
                                value={newRecipient.collectionTime}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    collectionTime: e.target.value,
                                  })
                                }
                                placeholder="9:00 AM"
                                data-testid="input-collection-time"
                              />
                            </div>
                            <div>
                              <Label htmlFor="feedingDay">
                                Feeding Day
                              </Label>
                              <Input
                                id="feedingDay"
                                type="text"
                                value={newRecipient.feedingDay}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    feedingDay: e.target.value,
                                  })
                                }
                                placeholder="Wednesday"
                                data-testid="input-feeding-day"
                              />
                            </div>
                            <div>
                              <Label htmlFor="feedingTime">
                                Feeding Time
                              </Label>
                              <Input
                                id="feedingTime"
                                type="text"
                                value={newRecipient.feedingTime}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    feedingTime: e.target.value,
                                  })
                                }
                                placeholder="12:00 PM"
                                data-testid="input-feeding-time"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Social Media Tracking */}
                    <Collapsible
                      open={sections.socialMedia}
                      onOpenChange={(open) => updateSection('socialMedia', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Social Media Tracking
                            </h4>
                            {sections.socialMedia ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="hasSharedPost"
                                checked={newRecipient.hasSharedPost}
                                onCheckedChange={(checked) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    hasSharedPost: !!checked,
                                  })
                                }
                                data-testid="checkbox-shared-post"
                              />
                              <Label
                                htmlFor="hasSharedPost"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Has shared a post about us on social media
                              </Label>
                            </div>
                            {newRecipient.hasSharedPost && (
                              <div>
                                <Label htmlFor="sharedPostDate">
                                  Date post was shared
                                </Label>
                                <Input
                                  id="sharedPostDate"
                                  type="date"
                                  value={newRecipient.sharedPostDate}
                                  onChange={(e) =>
                                    setNewRecipient({
                                      ...newRecipient,
                                      sharedPostDate: e.target.value,
                                    })
                                  }
                                  data-testid="input-shared-post-date"
                                />
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* People Served Section */}
                    <Collapsible
                      open={sections.peopleServed}
                      onOpenChange={(open) => updateSection('peopleServed', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              People Served
                            </h4>
                            {sections.peopleServed ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="averagePeopleServed">
                                Average # of people served
                              </Label>
                              <Input
                                id="averagePeopleServed"
                                type="number"
                                value={newRecipient.averagePeopleServed}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    averagePeopleServed: e.target.value,
                                  })
                                }
                                placeholder="Enter number"
                                data-testid="input-average-people-served"
                              />
                            </div>
                            <div>
                              <Label htmlFor="peopleServedFrequency">
                                How often
                              </Label>
                              <Select
                                value={newRecipient.peopleServedFrequency}
                                onValueChange={(value) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    peopleServedFrequency: value,
                                  })
                                }
                              >
                                <SelectTrigger data-testid="select-people-served-frequency">
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Partnership Section */}
                    <Collapsible
                      open={sections.partnership}
                      onOpenChange={(open) => updateSection('partnership', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Partnership
                            </h4>
                            {sections.partnership ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="partnershipStartDate">
                                Partnership start date
                              </Label>
                              <Input
                                id="partnershipStartDate"
                                type="date"
                                value={newRecipient.partnershipStartDate}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    partnershipStartDate: e.target.value,
                                  })
                                }
                                data-testid="input-partnership-start-date"
                              />
                            </div>
                            <div>
                              <Label htmlFor="partnershipYears">
                                Years partnered
                              </Label>
                              <Input
                                id="partnershipYears"
                                type="number"
                                value={newRecipient.partnershipYears}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    partnershipYears: e.target.value,
                                  })
                                }
                                placeholder="Number of years"
                                data-testid="input-partnership-years"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Fruit/Snacks Program Section */}
                    <Collapsible
                      open={sections.fruitSnacks}
                      onOpenChange={(open) => updateSection('fruitSnacks', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Fruit/Snacks Program
                            </h4>
                            {sections.fruitSnacks ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="receivingFruit"
                                  checked={newRecipient.receivingFruit}
                                  onCheckedChange={(checked) =>
                                    setNewRecipient({
                                      ...newRecipient,
                                      receivingFruit: !!checked,
                                    })
                                  }
                                  data-testid="checkbox-receiving-fruit"
                                />
                                <Label htmlFor="receivingFruit" className="text-sm">
                                  Currently receiving fruit
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="receivingSnacks"
                                  checked={newRecipient.receivingSnacks}
                                  onCheckedChange={(checked) =>
                                    setNewRecipient({
                                      ...newRecipient,
                                      receivingSnacks: !!checked,
                                    })
                                  }
                                  data-testid="checkbox-receiving-snacks"
                                />
                                <Label htmlFor="receivingSnacks" className="text-sm">
                                  Currently receiving snacks
                                </Label>
                              </div>
                            </div>
                            {!newRecipient.receivingFruit && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="wantsFruit"
                                  checked={newRecipient.wantsFruit}
                                  onCheckedChange={(checked) =>
                                    setNewRecipient({
                                      ...newRecipient,
                                      wantsFruit: !!checked,
                                    })
                                  }
                                  data-testid="checkbox-wants-fruit"
                                />
                                <Label htmlFor="wantsFruit" className="text-sm">
                                  Interested in receiving fruit
                                </Label>
                              </div>
                            )}
                            {!newRecipient.receivingSnacks && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="wantsSnacks"
                                  checked={newRecipient.wantsSnacks}
                                  onCheckedChange={(checked) =>
                                    setNewRecipient({
                                      ...newRecipient,
                                      wantsSnacks: !!checked,
                                    })
                                  }
                                  data-testid="checkbox-wants-snacks"
                                />
                                <Label htmlFor="wantsSnacks" className="text-sm">
                                  Interested in receiving snacks
                                </Label>
                              </div>
                            )}
                            <div>
                              <Label htmlFor="fruitSnacksNotes">
                                Fruit/snacks notes
                              </Label>
                              <Textarea
                                id="fruitSnacksNotes"
                                value={newRecipient.fruitSnacksNotes}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    fruitSnacksNotes: e.target.value,
                                  })
                                }
                                placeholder="Additional notes about fruit/snacks preferences..."
                                rows={2}
                                data-testid="textarea-fruit-snacks-notes"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Seasonal Changes Section */}
                    <Collapsible
                      open={sections.seasonalChanges}
                      onOpenChange={(open) => updateSection('seasonalChanges', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Seasonal Changes
                            </h4>
                            {sections.seasonalChanges ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="hasSeasonalChanges"
                                checked={newRecipient.hasSeasonalChanges}
                                onCheckedChange={(checked) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    hasSeasonalChanges: !!checked,
                                  })
                                }
                                data-testid="checkbox-has-seasonal-changes"
                              />
                              <Label htmlFor="hasSeasonalChanges" className="text-sm">
                                Has seasonal changes
                              </Label>
                            </div>
                            {newRecipient.hasSeasonalChanges && (
                              <>
                                <div>
                                  <Label htmlFor="seasonalChangesDescription">
                                    Describe seasonal changes
                                  </Label>
                                  <Textarea
                                    id="seasonalChangesDescription"
                                    value={newRecipient.seasonalChangesDescription}
                                    onChange={(e) =>
                                      setNewRecipient({
                                        ...newRecipient,
                                        seasonalChangesDescription: e.target.value,
                                      })
                                    }
                                    placeholder="Describe how needs change seasonally..."
                                    rows={2}
                                    data-testid="textarea-seasonal-changes-description"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="summerNeeds">
                                    Summer needs
                                  </Label>
                                  <Textarea
                                    id="summerNeeds"
                                    value={newRecipient.summerNeeds}
                                    onChange={(e) =>
                                      setNewRecipient({
                                        ...newRecipient,
                                        summerNeeds: e.target.value,
                                      })
                                    }
                                    placeholder="Specific needs during summer months..."
                                    rows={2}
                                    data-testid="textarea-summer-needs"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="winterNeeds">
                                    Winter needs
                                  </Label>
                                  <Textarea
                                    id="winterNeeds"
                                    value={newRecipient.winterNeeds}
                                    onChange={(e) =>
                                      setNewRecipient({
                                        ...newRecipient,
                                        winterNeeds: e.target.value,
                                      })
                                    }
                                    placeholder="Specific needs during winter months..."
                                    rows={2}
                                    data-testid="textarea-winter-needs"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Communication Preferences Section */}
                    <Collapsible
                      open={sections.communicationPreferences}
                      onOpenChange={(open) => updateSection('communicationPreferences', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Communication Preferences
                            </h4>
                            {sections.communicationPreferences ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="preferredContactMethod">
                                Preferred contact method
                              </Label>
                              <Select
                                value={newRecipient.preferredContactMethod}
                                onValueChange={(value) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    preferredContactMethod: value,
                                  })
                                }
                              >
                                <SelectTrigger data-testid="select-preferred-contact-method">
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="email">Email</SelectItem>
                                  <SelectItem value="sms">SMS/Text</SelectItem>
                                  <SelectItem value="phone_call">Phone Call</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm font-medium mb-2 block">
                                Allowed contact methods
                              </Label>
                              <div className="flex flex-wrap gap-4">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="allowEmail"
                                    checked={newRecipient.allowedContactMethods.includes('email')}
                                    onCheckedChange={(checked) => {
                                      const methods = checked
                                        ? [...newRecipient.allowedContactMethods, 'email']
                                        : newRecipient.allowedContactMethods.filter(m => m !== 'email');
                                      setNewRecipient({ ...newRecipient, allowedContactMethods: methods });
                                    }}
                                    data-testid="checkbox-allow-email"
                                  />
                                  <Label htmlFor="allowEmail" className="text-sm">Email</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="allowSms"
                                    checked={newRecipient.allowedContactMethods.includes('sms')}
                                    onCheckedChange={(checked) => {
                                      const methods = checked
                                        ? [...newRecipient.allowedContactMethods, 'sms']
                                        : newRecipient.allowedContactMethods.filter(m => m !== 'sms');
                                      setNewRecipient({ ...newRecipient, allowedContactMethods: methods });
                                    }}
                                    data-testid="checkbox-allow-sms"
                                  />
                                  <Label htmlFor="allowSms" className="text-sm">SMS/Text</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="allowPhoneCall"
                                    checked={newRecipient.allowedContactMethods.includes('phone_call')}
                                    onCheckedChange={(checked) => {
                                      const methods = checked
                                        ? [...newRecipient.allowedContactMethods, 'phone_call']
                                        : newRecipient.allowedContactMethods.filter(m => m !== 'phone_call');
                                      setNewRecipient({ ...newRecipient, allowedContactMethods: methods });
                                    }}
                                    data-testid="checkbox-allow-phone-call"
                                  />
                                  <Label htmlFor="allowPhoneCall" className="text-sm">Phone Call</Label>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="doNotContact"
                                checked={newRecipient.doNotContact}
                                onCheckedChange={(checked) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    doNotContact: !!checked,
                                  })
                                }
                                data-testid="checkbox-do-not-contact"
                              />
                              <Label htmlFor="doNotContact" className="text-sm text-red-600">
                                Do not contact
                              </Label>
                            </div>
                            <div>
                              <Label htmlFor="contactMethodNotes">
                                Contact notes
                              </Label>
                              <Textarea
                                id="contactMethodNotes"
                                value={newRecipient.contactMethodNotes}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    contactMethodNotes: e.target.value,
                                  })
                                }
                                placeholder="E.g., Only call before 2pm, Best reached on Tuesdays..."
                                rows={2}
                                data-testid="textarea-contact-method-notes"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Impact Stories Section */}
                    <Collapsible
                      open={sections.impactStories}
                      onOpenChange={(open) => updateSection('impactStories', open)}
                    >
                      <div className="border-t pt-4 mt-4">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto"
                          >
                            <h4 className="font-medium text-sm text-slate-700">
                              Impact Stories
                            </h4>
                            {sections.impactStories ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="space-y-4">
                            {newRecipient.impactStories.map((story, index) => (
                              <div key={index} className="border rounded-lg p-3 space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-slate-600">
                                    Story {index + 1}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = newRecipient.impactStories.filter((_, i) => i !== index);
                                      setNewRecipient({ ...newRecipient, impactStories: updated });
                                    }}
                                    className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                                    data-testid={`button-remove-story-${index}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div>
                                  <Label htmlFor={`story-${index}`}>Story</Label>
                                  <Textarea
                                    id={`story-${index}`}
                                    value={story.story}
                                    onChange={(e) => {
                                      const updated = [...newRecipient.impactStories];
                                      updated[index] = { ...updated[index], story: e.target.value };
                                      setNewRecipient({ ...newRecipient, impactStories: updated });
                                    }}
                                    placeholder="Share an impact story..."
                                    rows={3}
                                    data-testid={`textarea-story-${index}`}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label htmlFor={`story-date-${index}`}>Date collected</Label>
                                    <Input
                                      id={`story-date-${index}`}
                                      type="date"
                                      value={story.date}
                                      onChange={(e) => {
                                        const updated = [...newRecipient.impactStories];
                                        updated[index] = { ...updated[index], date: e.target.value };
                                        setNewRecipient({ ...newRecipient, impactStories: updated });
                                      }}
                                      data-testid={`input-story-date-${index}`}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`story-source-${index}`}>Source</Label>
                                    <Input
                                      id={`story-source-${index}`}
                                      value={story.source}
                                      onChange={(e) => {
                                        const updated = [...newRecipient.impactStories];
                                        updated[index] = { ...updated[index], source: e.target.value };
                                        setNewRecipient({ ...newRecipient, impactStories: updated });
                                      }}
                                      placeholder="Who provided this story"
                                      data-testid={`input-story-source-${index}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewRecipient({
                                  ...newRecipient,
                                  impactStories: [
                                    ...newRecipient.impactStories,
                                    { story: '', date: '', source: '' }
                                  ]
                                });
                              }}
                              className="w-full"
                              data-testid="button-add-impact-story"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Impact Story
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    <div className="flex justify-end space-x-2 mt-6 pt-4 border-t bg-white sticky bottom-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createRecipientMutation.isPending}
                      >
                        {createRecipientMutation.isPending
                          ? 'Adding...'
                          : 'Add Recipient'}
                      </Button>
                    </div>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search recipients by name, email, phone, address, region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Toggle Button */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            {(statusFilter !== 'all' ||
              contractFilter !== 'all' ||
              regionFilter !== 'all' ||
              tspContactFilter !== 'all' ||
              sandwichTypeFilter !== 'all') && (
              <Badge variant="secondary" className="ml-1">
                {
                  [
                    statusFilter !== 'all' && 'Status',
                    contractFilter !== 'all' && 'Contract',
                    regionFilter !== 'all' && 'Region',
                    tspContactFilter !== 'all' && 'TSP Contact',
                    sandwichTypeFilter !== 'all' && 'Sandwich Type',
                  ].filter(Boolean).length
                }
              </Badge>
            )}
          </Button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="space-y-3 pt-3 border-t border-slate-200">
            {/* First row of filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Contract
                </Label>
                <Select
                  value={contractFilter}
                  onValueChange={setContractFilter}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contracts</SelectItem>
                    <SelectItem value="signed">Contract Signed</SelectItem>
                    <SelectItem value="unsigned">Contract Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Region
                </Label>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {uniqueRegions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second row of filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  TSP Contact
                </Label>
                <Select
                  value={tspContactFilter}
                  onValueChange={setTspContactFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All TSP Contacts</SelectItem>
                    {uniqueTspContacts.map((contact) => (
                      <SelectItem key={contact} value={contact}>
                        {contact}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Sandwich Type
                </Label>
                <Select
                  value={sandwichTypeFilter}
                  onValueChange={setSandwichTypeFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sandwich Types</SelectItem>
                    {uniqueSandwichTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-2">
                <Label className="text-xs font-medium text-slate-600">
                  Focus Area
                </Label>
                <Select
                  value={focusAreaFilter}
                  onValueChange={setFocusAreaFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Focus Areas</SelectItem>
                    {uniqueFocusAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setContractFilter('all');
                    setRegionFilter('all');
                    setTspContactFilter('all');
                    setSandwichTypeFilter('all');
                    setFocusAreaFilter('all');
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="text-sm text-slate-600">
          Showing {filteredRecipients.length} of {recipients.length} recipients
          {searchTerm && <span> • Search: "{searchTerm}"</span>}
          {statusFilter !== 'all' && <span> • {statusFilter}</span>}
          {contractFilter !== 'all' && <span> • {contractFilter}</span>}
          {regionFilter !== 'all' && <span> • Region: {regionFilter}</span>}
          {tspContactFilter !== 'all' && (
            <span> • TSP Contact: {tspContactFilter}</span>
          )}
          {sandwichTypeFilter !== 'all' && (
            <span> • Type: {sandwichTypeFilter}</span>
          )}
        </div>
      </div>

      {/* Recipients List */}
      <div className="grid gap-4">
        {filteredRecipients.map((recipient) => {
          // Debug: Log each recipient being rendered
          if (
            recipient.name.includes('Boys') ||
            recipient.id === 19 ||
            recipient.id === 36
          ) {
            logger.log('Recipients Debug - Rendering:', {
              id: recipient.id,
              name: recipient.name,
              isBoysAndGirls: recipient.name.includes('Boys'),
              isZaban: recipient.name.includes('Zaban'),
            });
          }
          return (
            <Card key={recipient.id} className="border border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">
                        {recipient.name}
                      </CardTitle>
                      {(() => {
                        // Handle both new focusAreas array and legacy focusArea string
                        const areas = Array.isArray((recipient as any).focusAreas) && (recipient as any).focusAreas.length > 0
                          ? (recipient as any).focusAreas
                          : (recipient as any).focusArea
                            ? [(recipient as any).focusArea]
                            : [];

                        return areas.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {areas.map((area: string) => (
                              <Badge
                                key={area}
                                variant="outline"
                                className="bg-brand-primary-lighter text-brand-primary border-brand-primary-border text-xs"
                              >
                                {area}
                              </Badge>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          recipient.status === 'active'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {recipient.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit}
                            onClick={() => handleToggleStatus(recipient)}
                            className={recipient.status === 'active' ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-gray-600'}
                          >
                            {recipient.status === 'active' ? (
                              <ToggleRight className="w-4 h-4" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {recipient.status === 'active' ? 'Mark as Inactive' : 'Mark as Active'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
                      />
                    </svg>
                    <a
                      href={(recipient as any).website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-brand-primary underline"
                    >
                      {(recipient as any).website}
                    </a>
                  </div>
                )}
                {(recipient as any).instagramHandle && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    <a
                      href={`https://instagram.com/${(recipient as any).instagramHandle.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-brand-primary underline"
                    >
                      {(recipient as any).instagramHandle}
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
                    <span className="font-medium">Region:</span>{' '}
                    <span>{recipient.region}</span>
                  </div>
                )}
                {recipient.preferences && (
                  <div className="text-sm text-slate-600">
                    <strong>Preferences:</strong> {recipient.preferences}
                  </div>
                )}

                {/* Enhanced Operational Information */}
                {(recipient.reportingGroup ||
                  (recipient as any).estimatedSandwiches ||
                  (recipient as any).weeklyEstimate ||
                  (recipient as any).estimated_sandwiches ||
                  (recipient as any).weekly_estimate ||
                  recipient.sandwichType ||
                  recipient.tspContact ||
                  recipient.contractSigned ||
                  (recipient as any).collectionDay ||
                  (recipient as any).feedingDay) && (
                  <div className="border-t pt-3 mt-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      Operational Details
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {recipient.reportingGroup && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Reporting Group:</span>{' '}
                          {recipient.reportingGroup}
                        </div>
                      )}
                      {((recipient as any).estimatedSandwiches ||
                        (recipient as any).weeklyEstimate ||
                        (recipient as any).estimated_sandwiches ||
                        (recipient as any).weekly_estimate) && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Estimated Sandwiches:</span>{' '}
                          {(recipient as any).estimatedSandwiches ||
                            (recipient as any).weeklyEstimate ||
                            (recipient as any).estimated_sandwiches ||
                            (recipient as any).weekly_estimate}{' '}
                          sandwiches
                        </div>
                      )}
                      {recipient.sandwichType && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Sandwich Type:</span>{' '}
                          {recipient.sandwichType}
                        </div>
                      )}

                      {/* Collection Schedule */}
                      {((recipient as any).collectionDay || (recipient as any).collectionTime) && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Collection:</span>{' '}
                          {(recipient as any).collectionDay && (
                            <span>{(recipient as any).collectionDay}</span>
                          )}
                          {(recipient as any).collectionTime && (
                            <span> at {(recipient as any).collectionTime}</span>
                          )}
                        </div>
                      )}

                      {/* Feeding Schedule */}
                      {((recipient as any).feedingDay || (recipient as any).feedingTime) && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Feeding:</span>{' '}
                          {(recipient as any).feedingDay && (
                            <span>{(recipient as any).feedingDay}</span>
                          )}
                          {(recipient as any).feedingTime && (
                            <span> at {(recipient as any).feedingTime}</span>
                          )}
                        </div>
                      )}

                      <div className="col-span-2 flex items-center gap-2">
                        {recipient.contractSigned ? (
                          <Badge
                            variant="default"
                            className="text-xs bg-green-100 text-green-800"
                          >
                            Contract Signed
                            {recipient.contractSignedDate && (
                              <span className="ml-1">
                                (
                                {new Date(
                                  recipient.contractSignedDate
                                ).toLocaleDateString()}
                                )
                              </span>
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

                {/* Social Media Tracking */}
                {((recipient as any).hasSharedPost || (recipient as any).sharedPostDate) && (
                  <div className="border-t pt-3 mt-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      Social Media Engagement
                    </div>
                    <div className="flex items-center gap-2">
                      {(recipient as any).hasSharedPost && (
                        <Badge
                          variant="default"
                          className="text-xs bg-purple-100 text-purple-800"
                        >
                          Shared Post
                          {(recipient as any).sharedPostDate && (
                            <span className="ml-1">
                              (
                              {new Date(
                                (recipient as any).sharedPostDate
                              ).toLocaleDateString()}
                              )
                            </span>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Person Information */}
                {(recipient.contactPersonName ||
                  recipient.contactPersonPhone ||
                  recipient.contactPersonEmail) && (
                  <div className="border-t pt-3 mt-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      Contact Person
                    </div>
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

                {/* Second Contact Person Information */}
                {((recipient as any).secondContactPersonName ||
                  (recipient as any).secondContactPersonPhone ||
                  (recipient as any).secondContactPersonEmail) && (
                  <div className="border-t pt-3 mt-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      Second Contact Person
                    </div>
                    {(recipient as any).secondContactPersonName && (
                      <div className="text-sm text-slate-600 flex items-center gap-2">
                        <span className="font-medium">Name:</span>
                        <span>
                          {(recipient as any).secondContactPersonName}
                        </span>
                        {(recipient as any).secondContactPersonRole && (
                          <Badge variant="outline" className="text-xs">
                            {(recipient as any).secondContactPersonRole}
                          </Badge>
                        )}
                      </div>
                    )}
                    {(recipient as any).secondContactPersonPhone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Phone className="w-4 h-4" />
                        <span>
                          {(recipient as any).secondContactPersonPhone}
                        </span>
                      </div>
                    )}
                    {(recipient as any).secondContactPersonEmail && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Mail className="w-4 h-4" />
                        <span>
                          {(recipient as any).secondContactPersonEmail}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* TSP Contacts - Integrated */}
                <TSPContactManager
                  recipientId={recipient.id}
                  recipientName={recipient.name}
                  compact={true}
                />
              </CardContent>
            </Card>
          );
        })}

        {filteredRecipients.length === 0 && recipients.length > 0 && (
          <div className="text-center py-12 text-slate-500">
            No recipients match your current filters. Try adjusting your search
            or filter criteria.
          </div>
        )}

        {recipients.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No recipients found. Add a new recipient to get started.
          </div>
        )}
      </div>

      {/* Inactive Recipients Section */}
      {inactiveRecipients.length > 0 && (
        <div className="mt-8">
          <Collapsible open={showInactive} onOpenChange={setShowInactive}>
            <div className="flex items-center justify-between mb-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-slate-600">
                  {showInactive ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    Inactive Recipients ({inactiveRecipients.length})
                  </span>
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <div className="grid gap-2 opacity-60">
                {inactiveRecipients.map((recipient) => (
                  <Card key={recipient.id} className="border border-slate-200 bg-slate-50">
                    <CardHeader className="py-2 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <CardTitle className="text-sm font-normal text-slate-600">
                            {recipient.name}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            inactive
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!canEdit}
                                  onClick={() => handleToggleStatus(recipient)}
                                  className="text-gray-500 hover:text-green-600 h-7 w-7 p-0"
                                >
                                  <ToggleLeft className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reactivate</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canEdit}
                            onClick={() => handleEdit(recipient)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Edit Modal */}
      {editingRecipient && (
        <Dialog
          open={!!editingRecipient}
          onOpenChange={() => setEditingRecipient(null)}
        >
          <DialogContent
            aria-describedby="edit-recipient-description"
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <DialogHeader>
              <DialogTitle>Edit Recipient</DialogTitle>
            </DialogHeader>
            <p
              id="edit-recipient-description"
              className="text-sm text-slate-600 mb-4"
            >
              Update recipient information.
            </p>
            <div className="space-y-4">
              {/* Basic Information Section */}
              <Collapsible
                open={sections.editBasicInfo}
                onOpenChange={(open) => updateSection('editBasicInfo', open)}
              >
                <div>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Basic Information
                      </h4>
                      {sections.editBasicInfo ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                          id="edit-name"
                          value={editingRecipient.name}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-phone">Phone</Label>
                        <Input
                          id="edit-phone"
                          value={editingRecipient.phone}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              phone: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-email">Email</Label>
                        <Input
                          id="edit-email"
                          type="email"
                          value={editingRecipient.email || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-website">Website</Label>
                        <Input
                          id="edit-website"
                          type="text"
                          value={(editingRecipient as any).website || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              website: e.target.value,
                            })
                          }
                          placeholder="www.organization.org or https://organization.org"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-instagramHandle">
                          Instagram Handle
                        </Label>
                        <Input
                          id="edit-instagramHandle"
                          type="text"
                          value={
                            (editingRecipient as any).instagramHandle || ''
                          }
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              instagramHandle: e.target.value,
                            })
                          }
                          placeholder="@organizationhandle"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-address">Street Address</Label>
                        <Input
                          id="edit-address"
                          value={editingRecipient.address || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              address: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-region">Region/Area</Label>
                        <Input
                          id="edit-region"
                          value={editingRecipient.region || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              region: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-preferences">Preferences</Label>
                        <Input
                          id="edit-preferences"
                          value={editingRecipient.preferences || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              preferences: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Contact Person Section */}
              <Collapsible
                open={sections.editContact}
                onOpenChange={(open) => updateSection('editContact', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Contact Person Information
                      </h4>
                      {sections.editContact ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-contactPersonName">
                          Contact Name
                        </Label>
                        <Input
                          id="edit-contactPersonName"
                          value={editingRecipient.contactPersonName || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              contactPersonName: e.target.value,
                            })
                          }
                          placeholder="John Smith"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-contactPersonRole">
                          Role/Title
                        </Label>
                        <Input
                          id="edit-contactPersonRole"
                          value={editingRecipient.contactPersonRole || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              contactPersonRole: e.target.value,
                            })
                          }
                          placeholder="Program Director, Manager, etc."
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-contactPersonPhone">
                          Contact Phone
                        </Label>
                        <Input
                          id="edit-contactPersonPhone"
                          value={editingRecipient.contactPersonPhone || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              contactPersonPhone: e.target.value,
                            })
                          }
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-contactPersonEmail">
                          Contact Email
                        </Label>
                        <Input
                          id="edit-contactPersonEmail"
                          type="email"
                          value={editingRecipient.contactPersonEmail || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              contactPersonEmail: e.target.value,
                            })
                          }
                          placeholder="john@organization.org"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Second Contact Person Section */}
              <Collapsible
                open={sections.editSecondContact}
                onOpenChange={(open) => updateSection('editSecondContact', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Second Contact Person (Optional)
                      </h4>
                      {sections.editSecondContact ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-secondContactPersonName">
                          Contact Name
                        </Label>
                        <Input
                          id="edit-secondContactPersonName"
                          value={
                            (editingRecipient as any).secondContactPersonName ||
                            ''
                          }
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              secondContactPersonName: e.target.value,
                            })
                          }
                          placeholder="Jane Doe"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-secondContactPersonRole">
                          Role/Title
                        </Label>
                        <Input
                          id="edit-secondContactPersonRole"
                          value={
                            (editingRecipient as any).secondContactPersonRole ||
                            ''
                          }
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              secondContactPersonRole: e.target.value,
                            })
                          }
                          placeholder="Assistant Manager, etc."
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-secondContactPersonPhone">
                          Contact Phone
                        </Label>
                        <Input
                          id="edit-secondContactPersonPhone"
                          value={
                            (editingRecipient as any)
                              .secondContactPersonPhone || ''
                          }
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              secondContactPersonPhone: e.target.value,
                            })
                          }
                          placeholder="(555) 987-6543"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-secondContactPersonEmail">
                          Contact Email
                        </Label>
                        <Input
                          id="edit-secondContactPersonEmail"
                          type="email"
                          value={
                            (editingRecipient as any)
                              .secondContactPersonEmail || ''
                          }
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              secondContactPersonEmail: e.target.value,
                            })
                          }
                          placeholder="jane@organization.org"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Enhanced Operational Fields */}
              <Collapsible
                open={sections.editOperational}
                onOpenChange={(open) => updateSection('editOperational', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Operational Details
                      </h4>
                      {sections.editOperational ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-reportingGroup">
                          Reporting Group
                        </Label>
                        <Input
                          id="edit-reportingGroup"
                          value={editingRecipient.reportingGroup || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              reportingGroup: e.target.value,
                            })
                          }
                          placeholder="Corresponds to host locations"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-estimatedSandwiches">
                          Estimated Sandwiches
                        </Label>
                        <Input
                          id="edit-estimatedSandwiches"
                          type="number"
                          value={editingRecipient.estimatedSandwiches || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              estimatedSandwiches:
                                parseInt(e.target.value) || null,
                            })
                          }
                          placeholder="Number of sandwiches needed"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-sandwichType">Sandwich Type</Label>
                        <Input
                          id="edit-sandwichType"
                          value={editingRecipient.sandwichType || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              sandwichType: e.target.value,
                            })
                          }
                          placeholder="Type preferred (e.g., PB&J, Deli, Mixed)"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-focusAreas">Focus Areas</Label>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {/* Predefined options */}
                            {['Youth', 'Veterans', 'Seniors', 'Families', 'Unhoused', 'Refugees', 'Disabilities', 'Other'].map((area) => (
                              <Badge
                                key={area}
                                variant={((editingRecipient as any).focusAreas || []).includes(area) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => {
                                  const currentAreas = (editingRecipient as any).focusAreas || [];
                                  const updated = currentAreas.includes(area)
                                    ? currentAreas.filter((a: string) => a !== area)
                                    : [...currentAreas, area];
                                  setEditingRecipient({ ...editingRecipient, focusAreas: updated });
                                }}
                              >
                                {area}
                              </Badge>
                            ))}

                            {/* Custom focus areas */}
                            {((editingRecipient as any).focusAreas || [])
                              .filter((area: string) => !['Youth', 'Veterans', 'Seniors', 'Families', 'Unhoused', 'Refugees', 'Disabilities', 'Other'].includes(area))
                              .map((area: string) => (
                                <Badge
                                  key={area}
                                  variant="default"
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const currentAreas = (editingRecipient as any).focusAreas || [];
                                    const updated = currentAreas.filter((a: string) => a !== area);
                                    setEditingRecipient({ ...editingRecipient, focusAreas: updated });
                                  }}
                                >
                                  {area} ×
                                </Badge>
                              ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add custom focus area..."
                              value={customFocusArea}
                              onChange={(e) => setCustomFocusArea(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && customFocusArea.trim()) {
                                  e.preventDefault();
                                  const trimmed = customFocusArea.trim();
                                  const currentAreas = (editingRecipient as any).focusAreas || [];
                                  if (!currentAreas.includes(trimmed)) {
                                    setEditingRecipient({
                                      ...editingRecipient,
                                      focusAreas: [...currentAreas, trimmed]
                                    });
                                  }
                                  setCustomFocusArea('');
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const trimmed = customFocusArea.trim();
                                const currentAreas = (editingRecipient as any).focusAreas || [];
                                if (trimmed && !currentAreas.includes(trimmed)) {
                                  setEditingRecipient({
                                    ...editingRecipient,
                                    focusAreas: [...currentAreas, trimmed]
                                  });
                                  setCustomFocusArea('');
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-tspContact">TSP Contact</Label>
                        <Input
                          id="edit-tspContact"
                          value={editingRecipient.tspContact || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              tspContact: e.target.value,
                            })
                          }
                          placeholder="TSP team member name"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="edit-contractSigned"
                            checked={editingRecipient.contractSigned || false}
                            onChange={(e) =>
                              setEditingRecipient({
                                ...editingRecipient,
                                contractSigned: e.target.checked,
                              })
                            }
                            className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                          />
                          <Label
                            htmlFor="edit-contractSigned"
                            className="text-sm"
                          >
                            Contract Signed
                          </Label>
                        </div>
                      </div>
                      {editingRecipient.contractSigned && (
                        <div>
                          <Label htmlFor="edit-contractSignedDate">
                            Contract Signed Date
                          </Label>
                          <Input
                            id="edit-contractSignedDate"
                            type="date"
                            value={
                              editingRecipient.contractSignedDate
                                ? typeof editingRecipient.contractSignedDate ===
                                  'string'
                                  ? editingRecipient.contractSignedDate
                                      .includes &&
                                    editingRecipient.contractSignedDate.includes(
                                      'T'
                                    )
                                    ? editingRecipient.contractSignedDate.split(
                                        'T'
                                      )[0]
                                    : editingRecipient.contractSignedDate
                                  : new Date(
                                      editingRecipient.contractSignedDate
                                    )
                                      .toISOString()
                                      .split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              setEditingRecipient({
                                ...editingRecipient,
                                contractSignedDate: e.target.value as any,
                              })
                            }
                          />
                        </div>
                      )}
                      
                      {/* Collection and Feeding Schedule Fields */}
                      <div className="col-span-2 border-t pt-3 mt-3">
                        <h5 className="font-medium text-sm text-slate-700 mb-3">
                          Collection & Feeding Schedule
                        </h5>
                      </div>
                      <div>
                        <Label htmlFor="edit-collectionDay">
                          Collection Day
                        </Label>
                        <Input
                          id="edit-collectionDay"
                          type="text"
                          value={(editingRecipient as any).collectionDay || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              collectionDay: e.target.value,
                            })
                          }
                          placeholder="Monday"
                          data-testid="input-edit-collection-day"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-collectionTime">
                          Collection Time
                        </Label>
                        <Input
                          id="edit-collectionTime"
                          type="text"
                          value={(editingRecipient as any).collectionTime || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              collectionTime: e.target.value,
                            })
                          }
                          placeholder="9:00 AM"
                          data-testid="input-edit-collection-time"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-feedingDay">
                          Feeding Day
                        </Label>
                        <Input
                          id="edit-feedingDay"
                          type="text"
                          value={(editingRecipient as any).feedingDay || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              feedingDay: e.target.value,
                            })
                          }
                          placeholder="Wednesday"
                          data-testid="input-edit-feeding-day"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-feedingTime">
                          Feeding Time
                        </Label>
                        <Input
                          id="edit-feedingTime"
                          type="text"
                          value={(editingRecipient as any).feedingTime || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              feedingTime: e.target.value,
                            })
                          }
                          placeholder="12:00 PM"
                          data-testid="input-edit-feeding-time"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Social Media Tracking */}
              <Collapsible
                open={sections.editSocialMedia}
                onOpenChange={(open) => updateSection('editSocialMedia', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Social Media Tracking
                      </h4>
                      {sections.editSocialMedia ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-hasSharedPost"
                          checked={(editingRecipient as any).hasSharedPost || false}
                          onCheckedChange={(checked) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              hasSharedPost: !!checked,
                            })
                          }
                          data-testid="checkbox-shared-post"
                        />
                        <Label
                          htmlFor="edit-hasSharedPost"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Has shared a post about us on social media
                        </Label>
                      </div>
                      {(editingRecipient as any).hasSharedPost && (
                        <div>
                          <Label htmlFor="edit-sharedPostDate">
                            Date post was shared
                          </Label>
                          <Input
                            id="edit-sharedPostDate"
                            type="date"
                            value={(editingRecipient as any).sharedPostDate || ''}
                            onChange={(e) =>
                              setEditingRecipient({
                                ...editingRecipient,
                                sharedPostDate: e.target.value,
                              })
                            }
                            data-testid="input-shared-post-date"
                          />
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* People Served Section */}
              <Collapsible
                open={sections.editPeopleServed}
                onOpenChange={(open) => updateSection('editPeopleServed', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        People Served
                      </h4>
                      {sections.editPeopleServed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-averagePeopleServed">
                          Average # of people served
                        </Label>
                        <Input
                          id="edit-averagePeopleServed"
                          type="number"
                          value={(editingRecipient as any).averagePeopleServed || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              averagePeopleServed: e.target.value,
                            })
                          }
                          placeholder="Enter number"
                          data-testid="input-edit-average-people-served"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-peopleServedFrequency">
                          How often
                        </Label>
                        <Select
                          value={(editingRecipient as any).peopleServedFrequency || ''}
                          onValueChange={(value) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              peopleServedFrequency: value,
                            })
                          }
                        >
                          <SelectTrigger data-testid="select-edit-people-served-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Partnership Section */}
              <Collapsible
                open={sections.editPartnership}
                onOpenChange={(open) => updateSection('editPartnership', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Partnership
                      </h4>
                      {sections.editPartnership ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-partnershipStartDate">
                          Partnership start date
                        </Label>
                        <Input
                          id="edit-partnershipStartDate"
                          type="date"
                          value={(editingRecipient as any).partnershipStartDate || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              partnershipStartDate: e.target.value,
                            })
                          }
                          data-testid="input-edit-partnership-start-date"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-partnershipYears">
                          Years partnered
                        </Label>
                        <Input
                          id="edit-partnershipYears"
                          type="number"
                          value={(editingRecipient as any).partnershipYears || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              partnershipYears: e.target.value,
                            })
                          }
                          placeholder="Number of years"
                          data-testid="input-edit-partnership-years"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Fruit/Snacks Program Section */}
              <Collapsible
                open={sections.editFruitSnacks}
                onOpenChange={(open) => updateSection('editFruitSnacks', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Fruit/Snacks Program
                      </h4>
                      {sections.editFruitSnacks ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-receivingFruit"
                            checked={(editingRecipient as any).receivingFruit || false}
                            onCheckedChange={(checked) =>
                              setEditingRecipient({
                                ...editingRecipient,
                                receivingFruit: !!checked,
                              })
                            }
                            data-testid="checkbox-edit-receiving-fruit"
                          />
                          <Label htmlFor="edit-receivingFruit" className="text-sm">
                            Currently receiving fruit
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-receivingSnacks"
                            checked={(editingRecipient as any).receivingSnacks || false}
                            onCheckedChange={(checked) =>
                              setEditingRecipient({
                                ...editingRecipient,
                                receivingSnacks: !!checked,
                              })
                            }
                            data-testid="checkbox-edit-receiving-snacks"
                          />
                          <Label htmlFor="edit-receivingSnacks" className="text-sm">
                            Currently receiving snacks
                          </Label>
                        </div>
                      </div>
                      {!(editingRecipient as any).receivingFruit && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-wantsFruit"
                            checked={(editingRecipient as any).wantsFruit || false}
                            onCheckedChange={(checked) =>
                              setEditingRecipient({
                                ...editingRecipient,
                                wantsFruit: !!checked,
                              })
                            }
                            data-testid="checkbox-edit-wants-fruit"
                          />
                          <Label htmlFor="edit-wantsFruit" className="text-sm">
                            Interested in receiving fruit
                          </Label>
                        </div>
                      )}
                      {!(editingRecipient as any).receivingSnacks && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-wantsSnacks"
                            checked={(editingRecipient as any).wantsSnacks || false}
                            onCheckedChange={(checked) =>
                              setEditingRecipient({
                                ...editingRecipient,
                                wantsSnacks: !!checked,
                              })
                            }
                            data-testid="checkbox-edit-wants-snacks"
                          />
                          <Label htmlFor="edit-wantsSnacks" className="text-sm">
                            Interested in receiving snacks
                          </Label>
                        </div>
                      )}
                      <div>
                        <Label htmlFor="edit-fruitSnacksNotes">
                          Fruit/snacks notes
                        </Label>
                        <Textarea
                          id="edit-fruitSnacksNotes"
                          value={(editingRecipient as any).fruitSnacksNotes || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              fruitSnacksNotes: e.target.value,
                            })
                          }
                          placeholder="Additional notes about fruit/snacks preferences..."
                          rows={2}
                          data-testid="textarea-edit-fruit-snacks-notes"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Seasonal Changes Section */}
              <Collapsible
                open={sections.editSeasonalChanges}
                onOpenChange={(open) => updateSection('editSeasonalChanges', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Seasonal Changes
                      </h4>
                      {sections.editSeasonalChanges ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-hasSeasonalChanges"
                          checked={(editingRecipient as any).hasSeasonalChanges || false}
                          onCheckedChange={(checked) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              hasSeasonalChanges: !!checked,
                            })
                          }
                          data-testid="checkbox-edit-has-seasonal-changes"
                        />
                        <Label htmlFor="edit-hasSeasonalChanges" className="text-sm">
                          Has seasonal changes
                        </Label>
                      </div>
                      {(editingRecipient as any).hasSeasonalChanges && (
                        <>
                          <div>
                            <Label htmlFor="edit-seasonalChangesDescription">
                              Describe seasonal changes
                            </Label>
                            <Textarea
                              id="edit-seasonalChangesDescription"
                              value={(editingRecipient as any).seasonalChangesDescription || ''}
                              onChange={(e) =>
                                setEditingRecipient({
                                  ...editingRecipient,
                                  seasonalChangesDescription: e.target.value,
                                })
                              }
                              placeholder="Describe how needs change seasonally..."
                              rows={2}
                              data-testid="textarea-edit-seasonal-changes-description"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-summerNeeds">
                              Summer needs
                            </Label>
                            <Textarea
                              id="edit-summerNeeds"
                              value={(editingRecipient as any).summerNeeds || ''}
                              onChange={(e) =>
                                setEditingRecipient({
                                  ...editingRecipient,
                                  summerNeeds: e.target.value,
                                })
                              }
                              placeholder="Specific needs during summer months..."
                              rows={2}
                              data-testid="textarea-edit-summer-needs"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-winterNeeds">
                              Winter needs
                            </Label>
                            <Textarea
                              id="edit-winterNeeds"
                              value={(editingRecipient as any).winterNeeds || ''}
                              onChange={(e) =>
                                setEditingRecipient({
                                  ...editingRecipient,
                                  winterNeeds: e.target.value,
                                })
                              }
                              placeholder="Specific needs during winter months..."
                              rows={2}
                              data-testid="textarea-edit-winter-needs"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Communication Preferences Section */}
              <Collapsible
                open={sections.editCommunicationPreferences}
                onOpenChange={(open) => updateSection('editCommunicationPreferences', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Communication Preferences
                      </h4>
                      {sections.editCommunicationPreferences ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="edit-preferredContactMethod">
                          Preferred contact method
                        </Label>
                        <Select
                          value={(editingRecipient as any).preferredContactMethod || ''}
                          onValueChange={(value) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              preferredContactMethod: value,
                            })
                          }
                        >
                          <SelectTrigger data-testid="select-edit-preferred-contact-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS/Text</SelectItem>
                            <SelectItem value="phone_call">Phone Call</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          Allowed contact methods
                        </Label>
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="edit-allowEmail"
                              checked={((editingRecipient as any).allowedContactMethods || []).includes('email')}
                              onCheckedChange={(checked) => {
                                const methods = (editingRecipient as any).allowedContactMethods || [];
                                const updated = checked
                                  ? [...methods, 'email']
                                  : methods.filter((m: string) => m !== 'email');
                                setEditingRecipient({ ...editingRecipient, allowedContactMethods: updated });
                              }}
                              data-testid="checkbox-edit-allow-email"
                            />
                            <Label htmlFor="edit-allowEmail" className="text-sm">Email</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="edit-allowSms"
                              checked={((editingRecipient as any).allowedContactMethods || []).includes('sms')}
                              onCheckedChange={(checked) => {
                                const methods = (editingRecipient as any).allowedContactMethods || [];
                                const updated = checked
                                  ? [...methods, 'sms']
                                  : methods.filter((m: string) => m !== 'sms');
                                setEditingRecipient({ ...editingRecipient, allowedContactMethods: updated });
                              }}
                              data-testid="checkbox-edit-allow-sms"
                            />
                            <Label htmlFor="edit-allowSms" className="text-sm">SMS/Text</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="edit-allowPhoneCall"
                              checked={((editingRecipient as any).allowedContactMethods || []).includes('phone_call')}
                              onCheckedChange={(checked) => {
                                const methods = (editingRecipient as any).allowedContactMethods || [];
                                const updated = checked
                                  ? [...methods, 'phone_call']
                                  : methods.filter((m: string) => m !== 'phone_call');
                                setEditingRecipient({ ...editingRecipient, allowedContactMethods: updated });
                              }}
                              data-testid="checkbox-edit-allow-phone-call"
                            />
                            <Label htmlFor="edit-allowPhoneCall" className="text-sm">Phone Call</Label>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-doNotContact"
                          checked={(editingRecipient as any).doNotContact || false}
                          onCheckedChange={(checked) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              doNotContact: !!checked,
                            })
                          }
                          data-testid="checkbox-edit-do-not-contact"
                        />
                        <Label htmlFor="edit-doNotContact" className="text-sm text-red-600">
                          Do not contact
                        </Label>
                      </div>
                      <div>
                        <Label htmlFor="edit-contactMethodNotes">
                          Contact notes
                        </Label>
                        <Textarea
                          id="edit-contactMethodNotes"
                          value={(editingRecipient as any).contactMethodNotes || ''}
                          onChange={(e) =>
                            setEditingRecipient({
                              ...editingRecipient,
                              contactMethodNotes: e.target.value,
                            })
                          }
                          placeholder="E.g., Only call before 2pm, Best reached on Tuesdays..."
                          rows={2}
                          data-testid="textarea-edit-contact-method-notes"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Impact Stories Section */}
              <Collapsible
                open={sections.editImpactStories}
                onOpenChange={(open) => updateSection('editImpactStories', open)}
              >
                <div className="border-t pt-4 mt-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 h-auto"
                    >
                      <h4 className="font-medium text-sm text-slate-700">
                        Impact Stories
                      </h4>
                      {sections.editImpactStories ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-4">
                      {((editingRecipient as any).impactStories || []).map((story: { story: string; date: string; source: string }, index: number) => (
                        <div key={index} className="border rounded-lg p-3 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-600">
                              Story {index + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = ((editingRecipient as any).impactStories || []).filter((_: any, i: number) => i !== index);
                                setEditingRecipient({ ...editingRecipient, impactStories: updated });
                              }}
                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                              data-testid={`button-edit-remove-story-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div>
                            <Label htmlFor={`edit-story-${index}`}>Story</Label>
                            <Textarea
                              id={`edit-story-${index}`}
                              value={story.story}
                              onChange={(e) => {
                                const updated = [...((editingRecipient as any).impactStories || [])];
                                updated[index] = { ...updated[index], story: e.target.value };
                                setEditingRecipient({ ...editingRecipient, impactStories: updated });
                              }}
                              placeholder="Share an impact story..."
                              rows={3}
                              data-testid={`textarea-edit-story-${index}`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`edit-story-date-${index}`}>Date collected</Label>
                              <Input
                                id={`edit-story-date-${index}`}
                                type="date"
                                value={story.date}
                                onChange={(e) => {
                                  const updated = [...((editingRecipient as any).impactStories || [])];
                                  updated[index] = { ...updated[index], date: e.target.value };
                                  setEditingRecipient({ ...editingRecipient, impactStories: updated });
                                }}
                                data-testid={`input-edit-story-date-${index}`}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-story-source-${index}`}>Source</Label>
                              <Input
                                id={`edit-story-source-${index}`}
                                value={story.source}
                                onChange={(e) => {
                                  const updated = [...((editingRecipient as any).impactStories || [])];
                                  updated[index] = { ...updated[index], source: e.target.value };
                                  setEditingRecipient({ ...editingRecipient, impactStories: updated });
                                }}
                                placeholder="Who provided this story"
                                data-testid={`input-edit-story-source-${index}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRecipient({
                            ...editingRecipient,
                            impactStories: [
                              ...((editingRecipient as any).impactStories || []),
                              { story: '', date: '', source: '' }
                            ]
                          });
                        }}
                        className="w-full"
                        data-testid="button-edit-add-impact-story"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Impact Story
                      </Button>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingRecipient(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updateRecipientMutation.isPending}
                >
                  {updateRecipientMutation.isPending
                    ? 'Updating...'
                    : 'Update Recipient'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </TooltipProvider>
  );
}
