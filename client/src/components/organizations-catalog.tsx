import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, User, Mail, Phone, Calendar, Search, Filter, Users, MapPin, ExternalLink } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";

interface Organization {
  name: string;
  contacts: Array<{ 
    name: string; 
    email?: string;
    status?: string;
    latestRequestDate?: string;
    totalRequests?: number;
    hasHostedEvent?: boolean;
    eventDate?: string | null;
  }>;
  totalRequests: number;
  lastRequestDate: string;
  hasHostedEvent: boolean;
}

interface OrganizationContact {
  organizationName: string;
  contactName: string;
  email?: string;
  department?: string;
  latestRequestDate: string;
  totalRequests: number;
  status: 'new' | 'contacted' | 'completed' | 'scheduled' | 'past';
  hasHostedEvent: boolean;
  eventDate?: string | null;
}

interface OrganizationsCatalogProps {
  onNavigateToEventPlanning?: () => void;
}

export default function OrganizationsCatalog({ onNavigateToEventPlanning }: OrganizationsCatalogProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("eventDate");
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
      department: contact.department,
      latestRequestDate: contact.latestRequestDate || org.lastRequestDate,
      totalRequests: contact.totalRequests || 1,
      status: contact.status || 'new',
      hasHostedEvent: contact.hasHostedEvent || org.hasHostedEvent,
      eventDate: contact.eventDate || null
    }))
  );


  // Filter organizations first
  const filteredOrganizations = organizations
    .filter((org) => {
      const matchesSearch = 
        org.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.email && org.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (org.department && org.department.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || org.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

  // Group organizations by organization name
  interface OrganizationGroup {
    organizationName: string;
    departments: OrganizationContact[];
    totalRequests: number;
    totalDepartments: number;
    hasHostedEvent: boolean;
    latestRequestDate: string;
  }

  const organizationGroups: OrganizationGroup[] = filteredOrganizations
    .reduce((groups: Map<string, OrganizationGroup>, org) => {
      const orgName = org.organizationName;
      
      if (!groups.has(orgName)) {
        groups.set(orgName, {
          organizationName: orgName,
          departments: [],
          totalRequests: 0,
          totalDepartments: 0,
          hasHostedEvent: false,
          latestRequestDate: org.latestRequestDate
        });
      }
      
      const group = groups.get(orgName)!;
      group.departments.push(org);
      group.totalRequests += org.totalRequests;
      group.hasHostedEvent = group.hasHostedEvent || org.hasHostedEvent;
      
      // Update latest request date
      if (new Date(org.latestRequestDate) > new Date(group.latestRequestDate)) {
        group.latestRequestDate = org.latestRequestDate;
      }
      
      return groups;
    }, new Map())
    .values();

  // Sort groups by organization name or latest request date
  const sortedGroups = Array.from(organizationGroups).sort((a, b) => {
    if (sortBy === 'organizationName') {
      return sortOrder === "desc" 
        ? b.organizationName.localeCompare(a.organizationName)
        : a.organizationName.localeCompare(b.organizationName);
    }
    
    // Default sort by latest request date
    const aDate = new Date(a.latestRequestDate).getTime();
    const bDate = new Date(b.latestRequestDate).getTime();
    return sortOrder === "desc" ? bDate - aDate : aDate - bDate;
  });

  // Sort departments within each group
  sortedGroups.forEach(group => {
    group.departments.sort((a, b) => {
      if (sortBy === 'eventDate') {
        const aDate = a.eventDate ? new Date(a.eventDate).getTime() : (sortOrder === "desc" ? -Infinity : Infinity);
        const bDate = b.eventDate ? new Date(b.eventDate).getTime() : (sortOrder === "desc" ? -Infinity : Infinity);
        return sortOrder === "desc" ? bDate - aDate : aDate - bDate;
      }
      
      if (sortBy === 'totalRequests') {
        return sortOrder === "desc" ? b.totalRequests - a.totalRequests : a.totalRequests - b.totalRequests;
      }
      
      // Sort by contact name or department
      const aValue = a.department || a.contactName;
      const bValue = b.department || b.contactName;
      return sortOrder === "desc" ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
    });
    
    group.totalDepartments = group.departments.length;
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
                <SelectItem value="eventDate">Event Date</SelectItem>
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
            Showing {sortedGroups.length} organizations with {filteredOrganizations.length} departments/contacts
          </small>
        </div>
      </div>

      {/* Organizations Grid */}
      {sortedGroups.length === 0 ? (
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
        <div className="space-y-8">
          {sortedGroups.map((group, groupIndex) => (
            <div key={`${group.organizationName}-${groupIndex}`} className="bg-gray-50 rounded-lg border p-6">
              {/* Organization Header */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Building className="w-6 h-6" style={{ color: '#236383' }} />
                    <h2 className="text-xl font-bold text-gray-900">{group.organizationName}</h2>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{group.totalDepartments} {group.totalDepartments === 1 ? 'contact' : 'departments'}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{group.totalRequests} total requests</span>
                    </span>
                    {group.hasHostedEvent && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        ✓ Has hosted events
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Department Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.departments.map((org, index) => (
                  <Card key={`${org.organizationName}-${org.contactName}-${index}`} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-[#e67e22] bg-white">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center space-x-2 text-lg mb-3">
                            {org.department && (
                              <span className="text-gray-900 font-semibold">{org.department}</span>
                            )}
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
                  {/* Event Date - Show for all events */}
                  {org.eventDate ? (
                    <div className="flex items-center text-sm font-medium" style={{ color: '#FBAD3F' }}>
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Event date: {(() => {
                        try {
                          // Handle timezone-safe parsing for database timestamps
                          let date: Date;
                          
                          if (org.eventDate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                            // Database timestamp format: "2025-08-27 00:00:00"
                            // Extract just the date part and create at noon to avoid timezone issues
                            const dateOnly = org.eventDate.split(' ')[0];
                            date = new Date(dateOnly + 'T12:00:00');
                          } else if (org.eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            // Pure date format: "2025-08-27"
                            date = new Date(org.eventDate + 'T12:00:00');
                          } else {
                            // ISO format or other - use as is
                            date = new Date(org.eventDate);
                          }
                          
                          if (isNaN(date.getTime())) return 'Invalid date';
                          return date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                        } catch {
                          return 'Invalid date';
                        }
                      })()}</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Event date: Not specified</span>
                    </div>
                  )}
                  
                  {/* Hosted Event Status */}
                  <div className="pt-2 border-t">
                    <div className="text-sm mb-3">
                      <strong>Hosted Event with Us?</strong> {
                        org.hasHostedEvent
                          ? <span className="text-green-600 font-semibold">Yes</span>
                          : <span className="text-gray-500">No</span>
                      }
                    </div>
                    
                    {/* Sandwich Count for Completed Events */}
                    {org.totalSandwiches > 0 && (
                      <div className="text-sm mb-3 bg-orange-50 p-2 rounded-lg border border-orange-200">
                        <div className="flex items-center space-x-2">
                          <span className="text-orange-600">🥪</span>
                          <strong className="text-orange-800">Sandwiches Made:</strong>
                          <span className="text-orange-800 font-semibold">{org.totalSandwiches}</span>
                        </div>
                      </div>
                    )}
                    
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
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }