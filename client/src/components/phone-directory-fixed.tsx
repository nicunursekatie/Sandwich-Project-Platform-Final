import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import {
  Phone,
  User,
  Users,
  Search,
  Edit,
  Plus,
  Star,
  Crown,
  Mail,
  MapPin,
  Building,
  Trash2,
  UserPlus,
  Copy,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

/* =========================
   Types
   ========================= */

interface Host {
  id: number;
  name: string;
  address: string | null;
  status: "active" | "inactive";
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
  status: "active" | "inactive";
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

/* =========================
   Component
   ========================= */

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
    status: "active",
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
    vanApproved: false,
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
    notes: "",
    volunteerType: "General",
    isActive: true,
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
    status: "active",
  });

  // Contact assignment states
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningContact, setAssigningContact] = useState<any>(null);
  const [assignmentTarget, setAssignmentTarget] = useState({
    type: "",
    id: "",
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Permissions
  const canViewHosts = hasPermission(user, PERMISSIONS.ACCESS_HOSTS);
  const canViewRecipients = hasPermission(user, PERMISSIONS.ACCESS_RECIPIENTS);
  const canViewDrivers = hasPermission(user, PERMISSIONS.ACCESS_DRIVERS);
  const canViewVolunteers = hasPermission(user, PERMISSIONS.ACCESS_VOLUNTEERS);
  const canEditContacts =
    hasPermission(user, PERMISSIONS.ADMIN_ACCESS) ||
    hasPermission(user, PERMISSIONS.MANAGE_USERS) ||
    hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY) ||
    hasPermission(user, PERMISSIONS.EDIT_ALL_COLLECTIONS) ||
    hasPermission(user, PERMISSIONS.ACCESS_VOLUNTEERS) ||
    hasPermission(user, PERMISSIONS.VIEW_HOSTS);

  // Tabs
  const [activeTab, setActiveTab] = useState<string>("directory");

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

  // Available tabs
  const availableTabs = [
    { id: "directory", label: "Directory", icon: Phone, enabled: true },
    { id: "hosts", label: "Hosts", icon: Users, enabled: canViewHosts },
    {
      id: "recipients",
      label: "Recipients",
      icon: User,
      enabled: canViewRecipients,
    },
    {
      id: "volunteers",
      label: "Volunteers",
      icon: User,
      enabled: canViewVolunteers,
    },
    { id: "drivers", label: "Drivers", icon: User, enabled: canViewDrivers },
  ].filter((tab) => tab.enabled);

  // Keep activeTab valid if permissions change
  React.useEffect(() => {
    if (!availableTabs.find((t) => t.id === activeTab))
      setActiveTab("directory");
  }, [availableTabs, activeTab]);

  // Filters
  const filteredHosts = hosts.filter((host) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      host.name.toLowerCase().includes(s) ||
      (host.address && host.address.toLowerCase().includes(s)) ||
      (host.contacts &&
        host.contacts.some(
          (contact) =>
            contact.name.toLowerCase().includes(s) ||
            contact.phone.includes(searchTerm) ||
            (contact.email && contact.email.toLowerCase().includes(s)),
        ))
    );
  });

  const filteredRecipients = recipients.filter((r) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return r.name.toLowerCase().includes(s) || r.phone.includes(searchTerm);
  });

  const filteredVolunteers = volunteers.filter((v) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      v.name.toLowerCase().includes(s) ||
      v.phone.includes(searchTerm) ||
      (v.email && v.email.toLowerCase().includes(s)) ||
      (v.zone && v.zone.toLowerCase().includes(s))
    );
  });

  const filteredDrivers = drivers.filter((d) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(s) ||
      d.phone.includes(searchTerm) ||
      (d.email && d.email.toLowerCase().includes(s)) ||
      (d.zone && d.zone.toLowerCase().includes(s))
    );
  });

  // Unified directory
  const unifiedDirectory = React.useMemo(() => {
    const all: any[] = [];

    hosts.forEach((host) => {
      host.contacts?.forEach((contact) => {
        all.push({
          id: `host-${contact.id}`,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          organization: host.name,
          role: contact.role,
          type: "Host Contact",
          address: host.address,
          notes: contact.notes,
          isPrimary: contact.isPrimary,
          source: "host_contacts",
        });
      });
    });

    recipients.forEach((recipient) => {
      all.push({
        id: `recipient-${recipient.id}`,
        name: recipient.name,
        phone: recipient.phone,
        email: recipient.email,
        organization: recipient.name,
        role: "Recipient Organization",
        type: "Recipient",
        address: recipient.address,
        notes: recipient.preferences,
        source: "recipients",
      });
    });

    drivers.forEach((driver) => {
      all.push({
        id: `driver-${driver.id}`,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        organization: "",
        role: "Driver",
        type: "Driver",
        address: driver.homeAddress,
        notes: `Zone: ${driver.zone}${driver.notes ? ` - ${driver.notes}` : ""}`,
        zone: driver.zone,
        vanApproved: driver.vanApproved,
        source: "drivers",
      });
    });

    volunteers.forEach((volunteer) => {
      all.push({
        id: `volunteer-${volunteer.id}`,
        name: volunteer.name,
        phone: volunteer.phone,
        email: volunteer.email,
        organization: "",
        role: volunteer.volunteerType || "Volunteer",
        type: "Volunteer",
        address: volunteer.homeAddress,
        notes: `Zone: ${volunteer.zone}${volunteer.notes ? ` - ${volunteer.notes}` : ""}`,
        zone: volunteer.zone,
        volunteerType: volunteer.volunteerType,
        source: "volunteers",
      });
    });

    // Remove duplicates based on normalized phone number
    const normalizePhone = (phone: string): string => {
      return phone.replace(/\D/g, ''); // Remove all non-digits
    };

    const deduplicatedAll: any[] = [];
    const seenPhones = new Set<string>();

    all.forEach((contact) => {
      const normalizedPhone = normalizePhone(contact.phone || '');
      
      if (!normalizedPhone || !seenPhones.has(normalizedPhone)) {
        if (normalizedPhone) seenPhones.add(normalizedPhone);
        deduplicatedAll.push(contact);
      } else {
        // If duplicate found, log it for debugging
        console.log(`Duplicate contact found and removed: ${contact.name} (${contact.phone}) - ${contact.source}`);
      }
    });

    return deduplicatedAll.sort((a, b) => a.name.localeCompare(b.name));
  }, [hosts, recipients, drivers, volunteers]);

  const filteredDirectory = unifiedDirectory.filter((c) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.organization && c.organization.toLowerCase().includes(s)) ||
      (c.type && c.type.toLowerCase().includes(s)) ||
      (c.role && c.role.toLowerCase().includes(s))
    );
  });

  /* =========================
     Mutations
     ========================= */

  const createContactMutation = useMutation({
    mutationFn: async (contactData: any) =>
      apiRequest("POST", "/api/contacts", contactData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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
        status: "active",
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

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, ...contactData }: any) =>
      apiRequest("PUT", `/api/contacts/${id}`, contactData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) =>
      apiRequest("DELETE", `/api/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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

  const createDriverMutation = useMutation({
    mutationFn: async (driverData: any) =>
      apiRequest("POST", "/api/drivers", driverData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
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
        vanApproved: false,
      });
      toast({
        title: "Driver Added",
        description: "New driver has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create driver.",
        variant: "destructive",
      });
    },
  });

  const updateDriverMutation = useMutation({
    mutationFn: async ({ id, ...driverData }: any) =>
      apiRequest("PUT", `/api/drivers/${id}`, driverData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setEditingDriver(null);
      toast({
        title: "Driver Updated",
        description: "Driver information has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update driver.",
        variant: "destructive",
      });
    },
  });

  const deleteDriverMutation = useMutation({
    mutationFn: async (driverId: number) =>
      apiRequest("DELETE", `/api/drivers/${driverId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Driver Deleted",
        description: "Driver has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete driver.",
        variant: "destructive",
      });
    },
  });

  const createVolunteerMutation = useMutation({
    mutationFn: async (volunteerData: any) =>
      apiRequest("POST", "/api/volunteers", volunteerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
      setIsAddingVolunteer(false);
      setNewVolunteer({
        name: "",
        phone: "",
        email: "",
        zone: "",
        homeAddress: "",
        notes: "",
        volunteerType: "General",
        isActive: true,
      });
      toast({
        title: "Volunteer Added",
        description: "New volunteer has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create volunteer.",
        variant: "destructive",
      });
    },
  });

  const updateVolunteerMutation = useMutation({
    mutationFn: async ({ id, ...volunteerData }: any) =>
      apiRequest("PUT", `/api/volunteers/${id}`, volunteerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
      setEditingVolunteer(null);
      toast({
        title: "Volunteer Updated",
        description: "Volunteer information has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update volunteer.",
        variant: "destructive",
      });
    },
  });

  const deleteVolunteerMutation = useMutation({
    mutationFn: async (volunteerId: number) =>
      apiRequest("DELETE", `/api/volunteers/${volunteerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });
      toast({
        title: "Volunteer Deleted",
        description: "Volunteer has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete volunteer.",
        variant: "destructive",
      });
    },
  });

  const createRecipientMutation = useMutation({
    mutationFn: async (recipientData: any) =>
      apiRequest("POST", "/api/recipients", recipientData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setIsAddingRecipient(false);
      setNewRecipient({
        name: "",
        phone: "",
        email: "",
        contactName: "",
        address: "",
        region: "",
        preferences: "",
        status: "active",
      });
      toast({
        title: "Recipient Added",
        description: "New recipient has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create recipient.",
        variant: "destructive",
      });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: async ({ id, ...recipientData }: any) =>
      apiRequest("PUT", `/api/recipients/${id}`, recipientData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setEditingRecipient(null);
      toast({
        title: "Recipient Updated",
        description: "Recipient information has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update recipient.",
        variant: "destructive",
      });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: async (recipientId: number) =>
      apiRequest("DELETE", `/api/recipients/${recipientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      toast({
        title: "Recipient Deleted",
        description: "Recipient has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete recipient.",
        variant: "destructive",
      });
    },
  });

  const assignContactMutation = useMutation({
    mutationFn: async ({ contactId, targetType, targetId }: any) =>
      apiRequest("POST", "/api/contact-assignments", {
        contactId,
        targetType,
        targetId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setShowAssignDialog(false);
      setAssigningContact(null);
      setAssignmentTarget({ type: "", id: "" });
      toast({
        title: "Contact Assigned",
        description: "Contact has been successfully assigned.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign contact.",
        variant: "destructive",
      });
    },
  });

  /* =========================
     Handlers
     ========================= */

  const handleAddContact = () => {
    if (!newContact.name.trim()) return;
    createContactMutation.mutate(newContact);
  };
  const handleUpdateContact = () => {
    if (!editingContact?.name.trim()) return;
    updateContactMutation.mutate(editingContact);
  };
  const handleDeleteContact = (id: number) => {
    if (confirm("Delete this contact?")) deleteContactMutation.mutate(id);
  };

  const handleAddDriver = () => {
    if (!newDriver.name.trim()) return;
    createDriverMutation.mutate(newDriver);
  };
  const handleUpdateDriver = () => {
    if (!editingDriver?.name.trim()) return;
    updateDriverMutation.mutate(editingDriver);
  };
  const handleDeleteDriver = (id: number) => {
    if (confirm("Delete this driver?")) deleteDriverMutation.mutate(id);
  };

  const handleAddVolunteer = () => {
    if (!newVolunteer.name.trim() || !newVolunteer.phone.trim()) return;
    createVolunteerMutation.mutate(newVolunteer);
  };
  const handleUpdateVolunteer = () => {
    if (!editingVolunteer?.name.trim()) return;
    updateVolunteerMutation.mutate(editingVolunteer);
  };
  const handleDeleteVolunteer = (id: number) => {
    if (confirm("Delete this volunteer?")) deleteVolunteerMutation.mutate(id);
  };

  const handleAddRecipient = () => {
    if (!newRecipient.name.trim()) return;
    createRecipientMutation.mutate(newRecipient);
  };
  const handleUpdateRecipient = () => {
    if (!editingRecipient?.name.trim()) return;
    updateRecipientMutation.mutate(editingRecipient);
  };
  const handleDeleteRecipient = (id: number) => {
    if (confirm("Delete this recipient?")) deleteRecipientMutation.mutate(id);
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
        targetId: assignmentTarget.id,
      });
    }
  };

  const handleUniversalContactUpdate = async () => {
    if (!editingContact) return;
    try {
      const updateData = {
        name: editingContact.name,
        phone: editingContact.phone,
        email: editingContact.email,
        address: editingContact.address,
        notes: editingContact.notes,
        newRoleType: editingContact.newRoleType || editingContact.source,
        assignedHostId: editingContact.assignedHostId,
        volunteerType: editingContact.volunteerType,
        zone: editingContact.zone,
        vanApproved: editingContact.vanApproved,
      };

      await apiRequest(
        "PUT",
        `/api/contacts/universal/${editingContact.id.replace(/^(host|recipient|driver|volunteer)-/, "")}`,
        { ...updateData, originalSource: editingContact.source },
      );

      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/volunteers"] });

      toast({
        title: "Contact Updated",
        description: `${editingContact.name} has been updated and their role changed successfully.`,
      });
      setEditingContact(null);
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    }
  };

  /* =========================
     Render
     ========================= */

  return (
    <div className="space-y-8 p-6 font-['Roboto',sans-serif]">
      {/* Header */}
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-primary font-['Roboto',sans-serif]">
            Phone Directory
          </h1>
          <p className="text-lg mt-2 text-muted-foreground font-['Roboto',sans-serif]">
            Contact information for team members and organizations
          </p>
        </div>

        {/* Search */}
        <Card className="border-2 border-border">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="w-full overflow-x-auto">
          <TabsList
            className="flex w-max min-w-full h-14 p-1 rounded-lg space-x-1"
            style={{ backgroundColor: "#FBAD3F" }}
          >
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              let count = 0;
              if (tab.id === "directory") count = filteredDirectory.length;
              else if (tab.id === "hosts") count = filteredHosts.length;
              else if (tab.id === "recipients")
                count = filteredRecipients.length;
              else if (tab.id === "drivers") count = filteredDrivers.length;
              else if (tab.id === "volunteers")
                count = filteredVolunteers.length;

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 h-12 px-4 text-base font-medium rounded-md transition-all duration-200 data-[state=active]:shadow-sm font-['Roboto',sans-serif] text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap flex-shrink-0"
                >
                  <Icon className="w-5 h-5" />
                  <span className="hidden sm:inline">
                    {tab.label} ({count})
                  </span>
                  <span className="sm:hidden">{tab.label.substring(0, 1)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Directory */}
        <TabsContent value="directory" className="space-y-6 mt-6">
          <Card className="border-2 shadow-sm border-border">
            <CardHeader className="pb-4 bg-muted">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                    <Phone className="w-6 h-6 text-primary" />
                    Unified Directory
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                    All contacts from hosts, recipients, drivers, and volunteers
                    in one view
                  </CardDescription>
                </div>
                {canEditContacts && (
                  <Button
                    className="flex items-center gap-2"
                    onClick={() => setIsAddingContact(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Add New Contact
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {filteredDirectory.length === 0 ? (
                <div className="text-center py-12 text-base text-muted-foreground font-['Roboto',sans-serif]">
                  {searchTerm
                    ? "No contacts found matching your search."
                    : "No contacts found."}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDirectory.map((contact) => (
                    <div
                      key={contact.id}
                      className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">
                              {contact.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {contact.type}
                            </Badge>
                            {contact.organization && (
                              <Badge
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                <Building className="w-3 h-3" />
                                {contact.organization}
                              </Badge>
                            )}
                            {contact.isPrimary && (
                              <Badge
                                variant="default"
                                className="bg-blue-100 text-blue-800"
                              >
                                Primary Contact
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

                            {contact.address && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                <span>{contact.address}</span>
                              </div>
                            )}
                          </div>

                          {contact.notes && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-md">
                              <p className="text-sm text-muted-foreground">
                                {contact.notes}
                              </p>
                            </div>
                          )}

                          <div className="mt-3 flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              Source: {contact.source.replace("_", " ")}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContact(contact);
                              }}
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                            >
                              <Edit className="w-4 h-4" />
                              Edit & Reassign
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hosts */}
        {canViewHosts && (
          <TabsContent value="hosts" className="space-y-6 mt-6">
            <Card className="border-2 shadow-sm border-border">
              <CardHeader className="pb-4 bg-muted">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-primary font-['Roboto',sans-serif]">
                      <Users className="w-6 h-6 text-primary" />
                      Host Directory
                    </CardTitle>
                    <CardDescription className="text-base text-muted-foreground font-['Roboto',sans-serif]">
                      Contact information for sandwich collection hosts
                    </CardDescription>
                  </div>
                  {canEditContacts && (
                    <Button className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Host Contact
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {filteredHosts.length === 0 ? (
                  <div className="text-center py-12 text-base text-muted-foreground font-['Roboto',sans-serif]">
                    {searchTerm
                      ? "No hosts found matching your search."
                      : "No hosts found."}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredHosts.map((host) => (
                      <div
                        key={host.id}
                        className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">
                            {host.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {host.contacts?.length || 0} contacts
                          </Badge>
                        </div>

                        {host.address ? (
                          <div className="flex items-start gap-2 mb-4 p-3 bg-muted/30 rounded-lg border border-muted">
                            <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-primary font-['Roboto',sans-serif] mb-1">
                                Location:
                              </p>
                              <p className="text-sm text-foreground font-['Roboto',sans-serif] leading-relaxed">
                                {host.address}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(host.address!);
                                toast({
                                  title: "Address Copied",
                                  description:
                                    "Location address has been copied to clipboard.",
                                });
                              }}
                              className="ml-2 text-muted-foreground hover:text-primary"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 mb-4 p-3 bg-muted/20 rounded-lg border border-dashed border-muted">
                            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-muted-foreground italic font-['Roboto',sans-serif]">
                              Location information not available
                            </p>
                          </div>
                        )}

                        {host.contacts && host.contacts.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-base text-primary font-['Roboto',sans-serif]">
                              Contacts:
                            </h4>
                            {host.contacts.map((contact, idx) => (
                              <div
                                key={idx}
                                className="ml-4 p-4 rounded-md bg-muted/50 border border-border"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="font-semibold text-base text-primary font-['Roboto',sans-serif]">
                                        {contact.name}
                                      </div>
                                      {contact.isPrimary && (
                                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                      )}
                                      {(contact.role === "Lead" ||
                                        contact.role === "lead") && (
                                        <Crown className="w-4 h-4 text-yellow-500 fill-current" />
                                      )}
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

                                  {canEditContacts && (
                                    <div className="flex items-center gap-2 ml-4">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleAssignContact(contact)
                                        }
                                      >
                                        <UserPlus className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          console.log("Edit contact:", contact)
                                        }
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              `Delete contact ${contact.name}?`,
                                            )
                                          ) {
                                            console.log(
                                              "Delete contact:",
                                              contact,
                                            );
                                          }
                                        }}
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
                        ) : (
                          <p className="text-base italic text-muted-foreground font-['Roboto',sans-serif]">
                            No contact information available
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Recipients */}
        {canViewRecipients && (
          <TabsContent value="recipients" className="space-y-6 mt-6">
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
                    <Dialog
                      open={isAddingRecipient}
                      onOpenChange={setIsAddingRecipient}
                    >
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
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Organization name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-recipient-contact">
                                Contact Person
                              </Label>
                              <Input
                                id="new-recipient-contact"
                                value={newRecipient.contactName}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    contactName: e.target.value,
                                  })
                                }
                                placeholder="Primary contact name"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="new-recipient-phone">
                                Phone *
                              </Label>
                              <Input
                                id="new-recipient-phone"
                                value={newRecipient.phone}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    phone: e.target.value,
                                  })
                                }
                                placeholder="Phone number"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-recipient-email">Email</Label>
                              <Input
                                id="new-recipient-email"
                                type="email"
                                value={newRecipient.email}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    email: e.target.value,
                                  })
                                }
                                placeholder="Email address"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="new-recipient-address">
                              Address
                            </Label>
                            <Textarea
                              id="new-recipient-address"
                              value={newRecipient.address}
                              onChange={(e) =>
                                setNewRecipient({
                                  ...newRecipient,
                                  address: e.target.value,
                                })
                              }
                              placeholder="Street address, city, state, zip"
                              rows={2}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="new-recipient-region">
                                Region
                              </Label>
                              <Input
                                id="new-recipient-region"
                                value={newRecipient.region}
                                onChange={(e) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    region: e.target.value,
                                  })
                                }
                                placeholder="Service region"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-recipient-status">
                                Status
                              </Label>
                              <Select
                                value={newRecipient.status}
                                onValueChange={(value) =>
                                  setNewRecipient({
                                    ...newRecipient,
                                    status: value,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">
                                    Inactive
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="new-recipient-preferences">
                              Preferences
                            </Label>
                            <Textarea
                              id="new-recipient-preferences"
                              value={newRecipient.preferences}
                              onChange={(e) =>
                                setNewRecipient({
                                  ...newRecipient,
                                  preferences: e.target.value,
                                })
                              }
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
                              {createRecipientMutation.isPending
                                ? "Adding..."
                                : "Add Recipient"}
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
                    {searchTerm
                      ? "No recipients found matching your search."
                      : "No recipients found."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredRecipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">
                              {recipient.name}
                            </h3>
                            {recipient.status === "active" && (
                              <Badge
                                variant="default"
                                className="bg-green-100 text-green-800"
                              >
                                Active
                              </Badge>
                            )}
                            {recipient.region && (
                              <Badge
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3" />
                                {recipient.region}
                              </Badge>
                            )}
                          </div>
                          {canEditContacts && (
                            <div className="flex items-center gap-2">
                              <Dialog
                                open={editingRecipient?.id === recipient.id}
                                onOpenChange={(open) =>
                                  !open && setEditingRecipient(null)
                                }
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setEditingRecipient(recipient)
                                    }
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
                                          <Label htmlFor="edit-recipient-name">
                                            Name *
                                          </Label>
                                          <Input
                                            id="edit-recipient-name"
                                            value={editingRecipient.name}
                                            onChange={(e) =>
                                              setEditingRecipient({
                                                ...editingRecipient,
                                                name: e.target.value,
                                              })
                                            }
                                            placeholder="Organization name"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-recipient-contact">
                                            Contact Person
                                          </Label>
                                          <Input
                                            id="edit-recipient-contact"
                                            value={
                                              editingRecipient.contactName || ""
                                            }
                                            onChange={(e) =>
                                              setEditingRecipient({
                                                ...editingRecipient,
                                                contactName: e.target.value,
                                              })
                                            }
                                            placeholder="Primary contact name"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label htmlFor="edit-recipient-phone">
                                            Phone *
                                          </Label>
                                          <Input
                                            id="edit-recipient-phone"
                                            value={editingRecipient.phone}
                                            onChange={(e) =>
                                              setEditingRecipient({
                                                ...editingRecipient,
                                                phone: e.target.value,
                                              })
                                            }
                                            placeholder="Phone number"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-recipient-email">
                                            Email
                                          </Label>
                                          <Input
                                            id="edit-recipient-email"
                                            type="email"
                                            value={editingRecipient.email || ""}
                                            onChange={(e) =>
                                              setEditingRecipient({
                                                ...editingRecipient,
                                                email: e.target.value,
                                              })
                                            }
                                            placeholder="Email address"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-recipient-address">
                                          Address
                                        </Label>
                                        <Textarea
                                          id="edit-recipient-address"
                                          value={editingRecipient.address || ""}
                                          onChange={(e) =>
                                            setEditingRecipient({
                                              ...editingRecipient,
                                              address: e.target.value,
                                            })
                                          }
                                          placeholder="Street address, city, state, zip"
                                          rows={2}
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label htmlFor="edit-recipient-region">
                                            Region
                                          </Label>
                                          <Input
                                            id="edit-recipient-region"
                                            value={
                                              editingRecipient.region || ""
                                            }
                                            onChange={(e) =>
                                              setEditingRecipient({
                                                ...editingRecipient,
                                                region: e.target.value,
                                              })
                                            }
                                            placeholder="Service region"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-recipient-status">
                                            Status
                                          </Label>
                                          <Select
                                            value={editingRecipient.status}
                                            onValueChange={(value) =>
                                              setEditingRecipient({
                                                ...editingRecipient,
                                                status: value,
                                              })
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="active">
                                                Active
                                              </SelectItem>
                                              <SelectItem value="inactive">
                                                Inactive
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-recipient-preferences">
                                          Preferences
                                        </Label>
                                        <Textarea
                                          id="edit-recipient-preferences"
                                          value={
                                            editingRecipient.preferences || ""
                                          }
                                          onChange={(e) =>
                                            setEditingRecipient({
                                              ...editingRecipient,
                                              preferences: e.target.value,
                                            })
                                          }
                                          placeholder="Dietary preferences or special requirements"
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex gap-3 pt-4">
                                        <Button
                                          onClick={handleUpdateRecipient}
                                          disabled={
                                            updateRecipientMutation.isPending
                                          }
                                          className="flex-1"
                                        >
                                          {updateRecipientMutation.isPending
                                            ? "Updating..."
                                            : "Update Recipient"}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            setEditingRecipient(null)
                                          }
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
                                onClick={() =>
                                  handleDeleteRecipient(recipient.id)
                                }
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
                              <span className="font-medium">Preferences:</span>{" "}
                              {recipient.preferences}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Volunteers (ONLY this one, the fuller section) */}
        {canViewVolunteers && (
          <TabsContent value="volunteers" className="space-y-6 mt-6">
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
                    <Dialog
                      open={isAddingVolunteer}
                      onOpenChange={setIsAddingVolunteer}
                    >
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
                                onChange={(e) =>
                                  setNewVolunteer({
                                    ...newVolunteer,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Volunteer name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-volunteer-phone">
                                Phone *
                              </Label>
                              <Input
                                id="new-volunteer-phone"
                                value={newVolunteer.phone}
                                onChange={(e) =>
                                  setNewVolunteer({
                                    ...newVolunteer,
                                    phone: e.target.value,
                                  })
                                }
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
                                onChange={(e) =>
                                  setNewVolunteer({
                                    ...newVolunteer,
                                    email: e.target.value,
                                  })
                                }
                                placeholder="Email address"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-volunteer-zone">Zone</Label>
                              <Input
                                id="new-volunteer-zone"
                                value={newVolunteer.zone}
                                onChange={(e) =>
                                  setNewVolunteer({
                                    ...newVolunteer,
                                    zone: e.target.value,
                                  })
                                }
                                placeholder="Service zone"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="new-volunteer-type">
                              Volunteer Type
                            </Label>
                            <Select
                              value={newVolunteer.volunteerType}
                              onValueChange={(value) =>
                                setNewVolunteer({
                                  ...newVolunteer,
                                  volunteerType: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select volunteer type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="General">General</SelectItem>
                                <SelectItem value="Driver">Driver</SelectItem>
                                <SelectItem value="Host">Host</SelectItem>
                                <SelectItem value="Coordinator">
                                  Coordinator
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="new-volunteer-address">
                              Home Address
                            </Label>
                            <Textarea
                              id="new-volunteer-address"
                              value={newVolunteer.homeAddress}
                              onChange={(e) =>
                                setNewVolunteer({
                                  ...newVolunteer,
                                  homeAddress: e.target.value,
                                })
                              }
                              placeholder="Home address"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-volunteer-notes">Notes</Label>
                            <Textarea
                              id="new-volunteer-notes"
                              value={newVolunteer.notes}
                              onChange={(e) =>
                                setNewVolunteer({
                                  ...newVolunteer,
                                  notes: e.target.value,
                                })
                              }
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
                              {createVolunteerMutation.isPending
                                ? "Adding..."
                                : "Add Volunteer"}
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
                  <div className="text-center py-12 text-base text-muted-foreground font-['Roboto',sans-serif]">
                    {searchTerm
                      ? "No volunteers found matching your search."
                      : "No volunteers found."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredVolunteers.map((volunteer) => (
                      <div
                        key={volunteer.id}
                        className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">
                              {volunteer.name}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {volunteer.volunteerType || "General"}
                            </Badge>
                            {volunteer.isActive && (
                              <Badge
                                variant="default"
                                className="bg-green-100 text-green-800"
                              >
                                Active
                              </Badge>
                            )}
                          </div>
                          {canEditContacts && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const contactData = {
                                    id: volunteer.id,
                                    name: volunteer.name,
                                    phone: volunteer.phone,
                                    email: volunteer.email,
                                    address: volunteer.homeAddress,
                                    notes: volunteer.notes,
                                    zone: volunteer.zone,
                                    volunteerType: volunteer.volunteerType,
                                    type: "Volunteer",
                                    source: "volunteers",
                                  };
                                  setEditingContact(contactData);
                                }}
                                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                              >
                                <Edit className="w-4 h-4" />
                                Edit & Reassign
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {volunteer.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span>{volunteer.phone}</span>
                            </div>
                          )}
                          {volunteer.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <span>{volunteer.email}</span>
                            </div>
                          )}
                          {volunteer.zone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>Zone: {volunteer.zone}</span>
                            </div>
                          )}
                          {volunteer.homeAddress && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building className="w-3 h-3" />
                              <span>{volunteer.homeAddress}</span>
                            </div>
                          )}
                        </div>

                        {volunteer.notes && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-md">
                            <p className="text-sm text-muted-foreground">
                              {volunteer.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Drivers */}
        {canViewDrivers && (
          <TabsContent value="drivers" className="space-y-6 mt-6">
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
                    <Dialog
                      open={isAddingDriver}
                      onOpenChange={setIsAddingDriver}
                    >
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
                                onChange={(e) =>
                                  setNewDriver({
                                    ...newDriver,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Driver name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-driver-phone">Phone *</Label>
                              <Input
                                id="new-driver-phone"
                                value={newDriver.phone}
                                onChange={(e) =>
                                  setNewDriver({
                                    ...newDriver,
                                    phone: e.target.value,
                                  })
                                }
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
                                onChange={(e) =>
                                  setNewDriver({
                                    ...newDriver,
                                    email: e.target.value,
                                  })
                                }
                                placeholder="Email address"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-driver-zone">Zone</Label>
                              <Input
                                id="new-driver-zone"
                                value={newDriver.zone}
                                onChange={(e) =>
                                  setNewDriver({
                                    ...newDriver,
                                    zone: e.target.value,
                                  })
                                }
                                placeholder="Service zone"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="new-driver-address">
                              Home Address
                            </Label>
                            <Textarea
                              id="new-driver-address"
                              value={newDriver.homeAddress}
                              onChange={(e) =>
                                setNewDriver({
                                  ...newDriver,
                                  homeAddress: e.target.value,
                                })
                              }
                              placeholder="Home address"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-driver-notes">Notes</Label>
                            <Textarea
                              id="new-driver-notes"
                              value={newDriver.notes}
                              onChange={(e) =>
                                setNewDriver({
                                  ...newDriver,
                                  notes: e.target.value,
                                })
                              }
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
                              {createDriverMutation.isPending
                                ? "Adding..."
                                : "Add Driver"}
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
                  <div
                    className="text-center py-12 text-base"
                    style={{
                      color: "#646464",
                      fontFamily: "Roboto, sans-serif",
                    }}
                  >
                    {searchTerm
                      ? "No drivers found matching your search."
                      : "No drivers found."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDrivers.map((driver) => (
                      <div
                        key={driver.id}
                        className="p-5 border-2 rounded-lg hover:shadow-md transition-shadow duration-200 border-border bg-card"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-primary font-['Roboto',sans-serif]">
                              {driver.name}
                            </h3>
                            {driver.isActive && (
                              <Badge
                                variant="default"
                                className="bg-green-100 text-green-800"
                              >
                                Active
                              </Badge>
                            )}
                            {driver.vanApproved && (
                              <Badge
                                variant="secondary"
                                className="bg-orange-100 text-orange-800"
                              >
                                Van Driver
                              </Badge>
                            )}
                          </div>
                          {canEditContacts && (
                            <div className="flex items-center gap-2">
                              <Dialog
                                open={editingDriver?.id === driver.id}
                                onOpenChange={(open) =>
                                  !open && setEditingDriver(null)
                                }
                              >
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
                                          <Label htmlFor="edit-driver-name">
                                            Name *
                                          </Label>
                                          <Input
                                            id="edit-driver-name"
                                            value={editingDriver.name}
                                            onChange={(e) =>
                                              setEditingDriver({
                                                ...editingDriver,
                                                name: e.target.value,
                                              })
                                            }
                                            placeholder="Driver name"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-driver-phone">
                                            Phone *
                                          </Label>
                                          <Input
                                            id="edit-driver-phone"
                                            value={editingDriver.phone}
                                            onChange={(e) =>
                                              setEditingDriver({
                                                ...editingDriver,
                                                phone: e.target.value,
                                              })
                                            }
                                            placeholder="Phone number"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label htmlFor="edit-driver-email">
                                            Email
                                          </Label>
                                          <Input
                                            id="edit-driver-email"
                                            type="email"
                                            value={editingDriver.email || ""}
                                            onChange={(e) =>
                                              setEditingDriver({
                                                ...editingDriver,
                                                email: e.target.value,
                                              })
                                            }
                                            placeholder="Email address"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="edit-driver-zone">
                                            Zone
                                          </Label>
                                          <Input
                                            id="edit-driver-zone"
                                            value={editingDriver.zone || ""}
                                            onChange={(e) =>
                                              setEditingDriver({
                                                ...editingDriver,
                                                zone: e.target.value,
                                              })
                                            }
                                            placeholder="Service zone"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-driver-address">
                                          Home Address
                                        </Label>
                                        <Textarea
                                          id="edit-driver-address"
                                          value={
                                            editingDriver.homeAddress || ""
                                          }
                                          onChange={(e) =>
                                            setEditingDriver({
                                              ...editingDriver,
                                              homeAddress: e.target.value,
                                            })
                                          }
                                          placeholder="Home address"
                                          rows={2}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-driver-notes">
                                          Notes
                                        </Label>
                                        <Textarea
                                          id="edit-driver-notes"
                                          value={editingDriver.notes || ""}
                                          onChange={(e) =>
                                            setEditingDriver({
                                              ...editingDriver,
                                              notes: e.target.value,
                                            })
                                          }
                                          placeholder="Additional notes"
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex gap-3 pt-4">
                                        <Button
                                          onClick={handleUpdateDriver}
                                          disabled={
                                            updateDriverMutation.isPending
                                          }
                                          className="flex-1"
                                        >
                                          {updateDriverMutation.isPending
                                            ? "Updating..."
                                            : "Update Driver"}
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
                                  <span className="font-medium">Notes:</span>{" "}
                                  {driver.notes}
                                </p>
                              </div>
                            )}
                            {driver.availabilityNotes && (
                              <div className="p-3 bg-blue-50 rounded-md">
                                <p className="text-sm text-blue-700">
                                  <span className="font-medium">
                                    Availability:
                                  </span>{" "}
                                  {driver.availabilityNotes}
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
          </TabsContent>
        )}
      </Tabs>

      {/* ===== Universal Contact Edit Dialog (keep this one) ===== */}
      <Dialog
        open={!!editingContact}
        onOpenChange={(open) => {
          if (!open) setEditingContact(null);
        }}
      >
        {editingContact && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Contact & Change Role</DialogTitle>
              <DialogDescription>
                Edit contact information and change their role/assignment across
                the platform
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Current Status */}
              <div className="p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">Current Status:</span>
                  <Badge variant="outline">{editingContact.type}</Badge>
                  <Badge variant="secondary">
                    {editingContact.source.replace("_", " ")}
                  </Badge>
                </div>
                {editingContact.organization && (
                  <p className="text-sm text-muted-foreground">
                    Role Type - Location Designation: {editingContact.type} - {editingContact.organization}
                  </p>
                )}
                {!editingContact.organization && (
                  <p className="text-sm text-muted-foreground">
                    Role Type: {editingContact.type}
                  </p>
                )}
              </div>

              {/* Basic Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingContact.name}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        name: e.target.value,
                      })
                    }
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingContact.phone || ""}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        phone: e.target.value,
                      })
                    }
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
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      email: e.target.value,
                    })
                  }
                  placeholder="Email address"
                />
              </div>

              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  value={editingContact.address || ""}
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      address: e.target.value,
                    })
                  }
                  placeholder="Street address, city, state, zip"
                  rows={2}
                />
              </div>

              {/* Role Assignment */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Change Role & Assignment</h4>
                <div className="space-y-4">
                  <div>
                    <Label>New Role Type</Label>
                    <Select
                      value={
                        editingContact.newRoleType || editingContact.source
                      }
                      onValueChange={(value) =>
                        setEditingContact({
                          ...editingContact,
                          newRoleType: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select new role type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="volunteers">Volunteer</SelectItem>
                        <SelectItem value="host_contacts">
                          Host Contact
                        </SelectItem>
                        <SelectItem value="recipients">
                          Recipient Organization Contact
                        </SelectItem>
                        <SelectItem value="drivers">Driver</SelectItem>
                        <SelectItem value="contacts">General Contact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Host Assignment */}
                  {editingContact.newRoleType === "host_contacts" && (
                    <div>
                      <Label>Assign to Host Location</Label>
                      <Select
                        value={editingContact.assignedHostId || ""}
                        onValueChange={(value) =>
                          setEditingContact({
                            ...editingContact,
                            assignedHostId: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select host location" />
                        </SelectTrigger>
                        <SelectContent>
                          {hosts.map((host) => (
                            <SelectItem
                              key={host.id}
                              value={host.id.toString()}
                            >
                              {host.name} - {host.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        This person will become a contact for the selected host
                        location
                      </p>
                    </div>
                  )}

                  {/* Recipient Organization Assignment */}
                  {editingContact.newRoleType === "recipients" && (
                    <div>
                      <Label>Assign to Recipient Organization</Label>
                      <Select
                        value={editingContact.assignedRecipientId || ""}
                        onValueChange={(value) =>
                          setEditingContact({
                            ...editingContact,
                            assignedRecipientId: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select recipient organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {recipients.map((recipient) => (
                            <SelectItem
                              key={recipient.id}
                              value={recipient.id.toString()}
                            >
                              {recipient.name} - {recipient.contactName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        This person will become a contact for the selected recipient organization
                      </p>
                    </div>
                  )}

                  {/* Volunteer Assignment */}
                  {editingContact.newRoleType === "volunteers" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Volunteer Type</Label>
                        <Select
                          value={editingContact.volunteerType || ""}
                          onValueChange={(value) =>
                            setEditingContact({
                              ...editingContact,
                              volunteerType: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select volunteer type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="General">General</SelectItem>
                            <SelectItem value="Driver">Driver</SelectItem>
                            <SelectItem value="Host">Host</SelectItem>
                            <SelectItem value="Coordinator">
                              Coordinator
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Zone</Label>
                        <Input
                          value={editingContact.zone || ""}
                          onChange={(e) =>
                            setEditingContact({
                              ...editingContact,
                              zone: e.target.value,
                            })
                          }
                          placeholder="Service zone"
                        />
                      </div>
                    </div>
                  )}

                  {/* Driver Specific */}
                  {editingContact.newRoleType === "drivers" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Zone</Label>
                        <Input
                          value={editingContact.zone || ""}
                          onChange={(e) =>
                            setEditingContact({
                              ...editingContact,
                              zone: e.target.value,
                            })
                          }
                          placeholder="Service zone"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="van-approved"
                          checked={editingContact.vanApproved || false}
                          onCheckedChange={(checked) =>
                            setEditingContact({
                              ...editingContact,
                              vanApproved: !!checked,
                            })
                          }
                        />
                        <Label htmlFor="van-approved">Van Approved</Label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingContact(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUniversalContactUpdate}
                  disabled={!editingContact.name?.trim()}
                >
                  Save Changes & Update Role
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export default PhoneDirectoryFixed;
