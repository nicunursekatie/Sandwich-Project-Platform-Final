import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, User, Mail, Phone, Calendar, Search, Filter, Users, MapPin, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Organization {
  name: string;
  contacts: Array<{ 
    name: string; 
    email?: string;
    status?: string;
    latestRequestDate?: string;
    totalRequests?: number;
    hasHostedEvent?: boolean;
  }>;
  totalRequests: number;
  lastRequestDate: string;
  hasHostedEvent: boolean;
}

interface OrganizationContact {
  organizationName: string;
  contactName: string;
  email?: string;
  latestRequestDate: string;
  totalRequests: number;
  status: 'new' | 'contacted' | 'completed' | 'scheduled' | 'past';
  hasHostedEvent: boolean;
}

interface OrganizationsCatalogProps {
  onNavigateToEventPlanning?: () => void;
}

export default function OrganizationsCatalog({ onNavigateToEventPlanning }: OrganizationsCatalogProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("latestRequestDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch organizations data
  const { data: organizationsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/organizations-catalog'],
    queryFn: async () => {
      const response = await fetch('/api/organizations-catalog');
      if (!response.ok) throw new Error('Failed to fetch organizations');
      return response.json();
    }
  });
  
  // Extract and flatten organizations from response
  const rawOrganizations = organizationsResponse?.organizations || [];
  
  // Convert to flat structure for easier filtering and display
  const organizations: OrganizationContact[] = rawOrganizations.flatMap((org: Organization) => 
    org.contacts.map(contact => ({
      organizationName: org.name,
      contactName: contact.name,
      email: contact.email,
      latestRequestDate: contact.latestRequestDate || org.lastRequestDate,
      totalRequests: contact.totalRequests || 1,
      status: contact.status || 'new',
      hasHostedEvent: contact.hasHostedEvent || org.hasHostedEvent
    }))
  );

  // Filter and sort organizations
  const filteredOrganizations = organizations
    .filter((org) => {
      const matchesSearch = 
        org.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.email && org.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || org.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aValue = a[sortBy as keyof OrganizationContact];
      const bValue = b[sortBy as keyof OrganizationContact];
      
      if (sortBy === 'latestRequestDate') {
        const aDate = new Date(aValue as string).getTime();
        const bDate = new Date(bValue as string).getTime();
        return sortOrder === "desc" ? bDate - aDate : aDate - bDate;
      }
      
      if (sortBy === 'totalRequests') {
        return sortOrder === "desc" ? (bValue as number) - (aValue as number) : (aValue as number) - (bValue as number);
      }
      
      // String sorting
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortOrder === "desc" ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">New Request</Badge>;
      case 'contacted':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Contacted</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Upcoming Event</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case 'past':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Past Event</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
            <Building className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organizations Catalog</h1>
            <p className="text-gray-600">Loading organization contacts...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load organizations catalog</p>
          <p className="text-sm text-gray-500 mt-2">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
          <Building className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations Catalog</h1>
          <p className="text-gray-600">Directory of all organizations we've worked with from event requests</p>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search organizations, contacts, emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New Requests</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="scheduled">Upcoming Events</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="past">Past Events</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organizationName">Organization</SelectItem>
                <SelectItem value="contactName">Contact Name</SelectItem>
                <SelectItem value="latestRequestDate">Latest Request</SelectItem>
                <SelectItem value="totalRequests">Total Requests</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-3"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 pt-3 border-t">
          <small className="text-gray-600">
            Showing {filteredOrganizations.length} of {organizations.length} organizations
          </small>
        </div>
      </div>

      {/* Organizations Grid */}
      {filteredOrganizations.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No organizations found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm || statusFilter !== "all" 
              ? "Try adjusting your search or filters" 
              : "Event requests will populate this directory"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrganizations.map((org, index) => (
            <Card key={`${org.organizationName}-${org.contactName}-${index}`} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-[#236383]">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center space-x-3 text-lg mb-3">
                      <Building className="w-5 h-5" style={{ color: '#236383' }} />
                      <span className="text-gray-900">{org.organizationName}</span>
                    </CardTitle>
                    
                    {/* Contact Information - Prominent Display */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" style={{ color: '#236383' }} />
                        <span className="text-base font-semibold" style={{ color: '#236383' }}>
                          {org.contactName}
                        </span>
                      </div>
                      
                      {org.email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4" style={{ color: '#236383' }} />
                          <span className="text-sm font-medium" style={{ color: '#236383' }}>
                            {org.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusBadge(org.status)}
                    <Badge variant="secondary" className="text-xs bg-[#FBAD3F] text-white hover:bg-[#FBAD3F]/90">
                      {org.totalRequests} request{org.totalRequests !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Latest request: {format(new Date(org.latestRequestDate), "PPP")}</span>
                  </div>
                  
                  {/* Hosted Event Status */}
                  <div className="pt-2 border-t">
                    <div className="text-sm mb-3">
                      <strong>Hosted Event with Us?</strong> {
                        org.hasHostedEvent
                          ? <span className="text-green-600 font-semibold">Yes</span>
                          : <span className="text-gray-500">No</span>
                      }
                    </div>
                    
                    {/* View Event Details Button */}
                    <Button 
                      onClick={() => onNavigateToEventPlanning?.()}
                      variant="outline" 
                      size="sm" 
                      className="w-full text-sm bg-[#FBAD3F] hover:bg-[#FBAD3F]/90 text-white border-[#FBAD3F] hover:border-[#FBAD3F]/90"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Event Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}