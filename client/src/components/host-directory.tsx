import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Mail, User, Users, Search, Filter, Building } from "lucide-react";

interface Host {
  id: number;
  name: string;
  address: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  hostLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HostWithContacts extends Host {
  contacts: HostContact[];
}

export default function HostDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Fetch hosts with their contacts
  const { data: hostsData, isLoading } = useQuery({
    queryKey: ["/api/hosts-with-contacts"],
  });

  const hosts = hostsData as HostWithContacts[] || [];

  // Get unique roles for filtering
  const uniqueRoles = useMemo(() => {
    const roles = hosts.flatMap(host => host.contacts.map(contact => contact.role)).filter(Boolean);
    return Array.from(new Set(roles)).sort();
  }, [hosts]);

  // Filter and search logic
  const filteredHosts = useMemo(() => {
    return hosts.filter(host => {
      // Status filter
      if (statusFilter !== "all" && host.status !== statusFilter) {
        return false;
      }

      // Role filter - check if any contact has the selected role
      if (roleFilter !== "all") {
        const hasRole = host.contacts.some(contact => contact.role === roleFilter);
        if (!hasRole) return false;
      }

      // Search filter - search across host name, address, contact names, emails, and phones
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const hostMatch = 
          host.name.toLowerCase().includes(searchLower) ||
          (host.address && host.address.toLowerCase().includes(searchLower)) ||
          (host.notes && host.notes.toLowerCase().includes(searchLower));

        const contactMatch = host.contacts.some(contact =>
          contact.name.toLowerCase().includes(searchLower) ||
          contact.phone.toLowerCase().includes(searchLower) ||
          (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
          contact.role.toLowerCase().includes(searchLower) ||
          (contact.notes && contact.notes.toLowerCase().includes(searchLower))
        );

        if (!hostMatch && !contactMatch) {
          return false;
        }
      }

      return true;
    });
  }, [hosts, searchTerm, statusFilter, roleFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "inactive":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "lead":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "host":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "alternate":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "volunteer":
        return "bg-green-100 text-green-800 border-green-200";
      case "head of school":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading host directory...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold text-gray-900">Host Directory</h1>
        <Badge variant="outline" className="ml-auto">
          {filteredHosts.length} locations
        </Badge>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search hosts, contacts, addresses, phone numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Summary */}
          {(searchTerm || statusFilter !== "all" || roleFilter !== "all") && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <span>Active filters:</span>
              {searchTerm && (
                <Badge variant="secondary">Search: "{searchTerm}"</Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary">Status: {statusFilter}</Badge>
              )}
              {roleFilter !== "all" && (
                <Badge variant="secondary">Role: {roleFilter}</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                }}
                className="ml-2 h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredHosts.length} of {hosts.length} host locations
      </div>

      {/* Host Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredHosts.map((host) => (
          <Card key={host.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-teal-600" />
                  <div>
                    <CardTitle className="text-lg">{host.name}</CardTitle>
                    {host.address && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                        <MapPin className="h-3 w-3" />
                        <span>{host.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge className={getStatusColor(host.status)}>
                  {host.status}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Host Notes */}
              {host.notes && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{host.notes}</p>
                </div>
              )}

              {/* Contacts */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contacts ({host.contacts.length})
                </h4>
                
                {host.contacts.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No contacts listed</p>
                ) : (
                  <div className="space-y-3">
                    {host.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`p-3 rounded-lg border ${
                          contact.isPrimary ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {contact.name}
                              {contact.isPrimary && (
                                <Badge className="ml-2 bg-blue-100 text-blue-800 border-blue-200 text-xs">
                                  Primary
                                </Badge>
                              )}
                            </p>
                            <Badge className={`${getRoleColor(contact.role)} text-xs mt-1`}>
                              {contact.role}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Phone */}
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <a
                              href={`tel:${contact.phone}`}
                              className="text-blue-600 hover:underline"
                            >
                              {contact.phone}
                            </a>
                          </div>

                          {/* Email */}
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {contact.email}
                              </a>
                            </div>
                          )}

                          {/* Contact Notes */}
                          {contact.notes && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              {contact.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredHosts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hosts found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || statusFilter !== "all" || roleFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "No host locations have been added yet."}
            </p>
            {(searchTerm || statusFilter !== "all" || roleFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                }}
              >
                Clear all filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}