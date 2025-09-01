import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building, User, Mail, Phone, Calendar, Search, Filter, Users, MapPin, ExternalLink, ChevronLeft, ChevronRight, Clock, CheckCircle } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";

interface Group {
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

interface GroupCatalogProps {
  onNavigateToEventPlanning?: () => void;
}

export default function GroupCatalog({ onNavigateToEventPlanning }: GroupCatalogProps = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("eventDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationContact | null>(null);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [loadingEventDetails, setLoadingEventDetails] = useState(false);

  // Fetch groups data
  const { data: groupsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/groups-catalog'],
    queryFn: async () => {
      const response = await fetch('/api/groups-catalog');
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    }
  });

  // Function to fetch complete event details
  const fetchEventDetails = async (organization: OrganizationContact) => {
    setLoadingEventDetails(true);
    try {
      const response = await fetch(`/api/event-requests/details/${encodeURIComponent(organization.organizationName)}/${encodeURIComponent(organization.contactName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch event details');
      }
      const details = await response.json();
      setEventDetails(details);
    } catch (error) {
      console.error('Error fetching event details:', error);
      setEventDetails(null);
    } finally {
      setLoadingEventDetails(false);
    }
  };

  
  // Extract and flatten groups from response
  const rawGroups = groupsResponse?.groups || [];
  
  // Convert to flat structure for easier filtering and display
  const groups: OrganizationContact[] = rawGroups.flatMap((org: Group) => 
    org.departments.map(contact => ({
      organizationName: org.name,
      contactName: contact.contactName,
      email: contact.email,
      department: contact.department,
      latestRequestDate: contact.latestRequestDate || org.lastRequestDate,
      totalRequests: contact.totalRequests || 1,
      status: contact.status || 'new',
      hasHostedEvent: contact.hasHostedEvent || org.hasHostedEvent,
      eventDate: contact.eventDate || null
    }))
  );


  // Filter groups first
  const filteredGroups = groups
    .filter((org) => {
      const matchesSearch = 
        org.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.email && org.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (org.department && org.department.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || org.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

  // Group entries by group name
  interface GroupInfo {
    groupName: string;
    departments: OrganizationContact[];
    totalRequests: number;
    totalDepartments: number;
    hasHostedEvent: boolean;
    latestRequestDate: string;
  }

  const groupInfo: GroupInfo[] = filteredGroups
    .reduce((groups: Map<string, GroupInfo>, org) => {
      const orgName = org.organizationName;
      
      if (!groups.has(orgName)) {
        groups.set(orgName, {
          groupName: orgName,
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
  const sortedGroups = Array.from(groupInfo).sort((a, b) => {
    if (sortBy === 'groupName') {
      return sortOrder === "desc" 
        ? b.groupName.localeCompare(a.groupName)
        : a.groupName.localeCompare(b.groupName);
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

  // Pagination logic
  const totalItems = sortedGroups.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = sortedGroups.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">New Request</Badge>;
      case 'contacted':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Contacted</Badge>;
      case 'contact_completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Event Complete</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Upcoming Event</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case 'past':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Past Event</Badge>;
      case 'declined':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Declined</Badge>;
      default:
        return null; // Remove confusing "Unknown" badges
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
            <h1 className="text-2xl font-bold text-gray-900">Groups Catalog</h1>
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
          <h1 className="text-2xl font-bold text-gray-900">Groups Catalog</h1>
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
                <SelectItem value="groupName">Group</SelectItem>
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
        <div className="mt-4 pt-3 border-t flex justify-between items-center">
          <small className="text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} groups with {filteredGroups.length} departments/contacts
          </small>
          <div className="flex items-center gap-2">
            <small className="text-gray-600">Items per page:</small>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="48">48</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      {totalItems === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No groups found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm || statusFilter !== "all" 
              ? "Try adjusting your search or filters" 
              : "Event requests will populate this directory"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {paginatedGroups.map((group, groupIndex) => (
            <div key={`${group.organizationName}-${groupIndex}`} className="bg-gray-50 rounded-lg border p-6">
              {/* Group Header */}
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
                      onClick={() => {
                        setSelectedOrganization(org);
                        setEventDetails(null); // Reset previous details
                        setShowEventDetailsDialog(true);
                        fetchEventDetails(org); // Fetch complete details
                      }}
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

      {/* Pagination Controls */}
      {totalItems > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border p-4 shadow-sm mt-6">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="h-8 w-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Event Details Dialog */}
      {showEventDetailsDialog && selectedOrganization && (
        <Dialog open={showEventDetailsDialog} onOpenChange={setShowEventDetailsDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <Building className="w-6 h-6" style={{ color: '#236383' }} />
                <span>{selectedOrganization.organizationName}</span>
                {selectedOrganization.department && (
                  <span className="text-gray-600">- {selectedOrganization.department}</span>
                )}
              </DialogTitle>
              <DialogDescription>
                Comprehensive event and contact information
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {loadingEventDetails ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#236383]"></div>
                  <span className="ml-3 text-gray-600">Loading event details...</span>
                </div>
              ) : eventDetails ? (
                <>
                  {/* Contact Information */}
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <User className="w-5 h-5 mr-2" style={{ color: '#236383' }} />
                      Contact Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Contact Name</label>
                        <p className="text-lg font-semibold" style={{ color: '#236383' }}>
                          {eventDetails.firstName} {eventDetails.lastName}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email Address</label>
                        <p className="text-base font-medium" style={{ color: '#236383' }}>
                          {eventDetails.email}
                        </p>
                      </div>
                      {eventDetails.phone && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Phone Number</label>
                          <p className="text-base font-medium text-gray-700">
                            {eventDetails.phone}
                          </p>
                        </div>
                      )}
                      {eventDetails.department && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Department</label>
                          <p className="text-base font-medium text-gray-700">
                            {eventDetails.department}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Event Planning Details */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <Calendar className="w-5 h-5 mr-2" style={{ color: '#236383' }} />
                      Event Planning Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Current Status</label>
                        <div className="mt-1">
                          {(() => {
                            const statusConfig = {
                              'new': { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'New Request' },
                              'contacted': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Contact Made' },
                              'scheduled': { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Event Scheduled' },
                              'completed': { color: 'bg-green-100 text-green-800 border-green-200', label: 'Event Completed' },
                              'past': { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Past Event' }
                            };
                            const config = statusConfig[eventDetails.status as keyof typeof statusConfig] || statusConfig.new;
                            return (
                              <Badge className={`${config.color} border`}>
                                {config.label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>

                      {eventDetails.desiredEventDate && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Event Date</label>
                          <p className="text-base font-semibold" style={{ color: '#FBAD3F' }}>
                            {(() => {
                              try {
                                const date = new Date(eventDetails.desiredEventDate);
                                return date.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                });
                              } catch {
                                return eventDetails.desiredEventDate;
                              }
                            })()}
                          </p>
                        </div>
                      )}

                      {eventDetails.estimatedSandwichCount && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Estimated Sandwiches</label>
                          <p className="text-lg font-semibold text-orange-600">
                            {eventDetails.estimatedSandwichCount} sandwiches
                          </p>
                        </div>
                      )}

                      {eventDetails.sandwichesMade && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Sandwiches Made</label>
                          <p className="text-lg font-semibold text-green-600">
                            {eventDetails.sandwichesMade} sandwiches
                          </p>
                        </div>
                      )}

                      {eventDetails.eventStartTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Event Start Time</label>
                          <p className="text-base font-medium text-gray-700">
                            {eventDetails.eventStartTime}
                          </p>
                        </div>
                      )}

                      {eventDetails.eventEndTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Event End Time</label>
                          <p className="text-base font-medium text-gray-700">
                            {eventDetails.eventEndTime}
                          </p>
                        </div>
                      )}
                    </div>

                    {eventDetails.eventAddress && (
                      <div className="mt-4 pt-4 border-t">
                        <label className="text-sm font-medium text-gray-600">Event Address</label>
                        <p className="text-base font-medium text-gray-700">
                          {eventDetails.eventAddress}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Additional Details */}
                  {(eventDetails.message || eventDetails.planningNotes || eventDetails.contactCompletionNotes) && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-800 mb-3">Additional Information</h3>
                      {eventDetails.message && (
                        <div className="mb-3">
                          <label className="text-sm font-medium text-blue-700">Original Message</label>
                          <p className="text-sm text-blue-800 bg-white p-2 rounded border">
                            {eventDetails.message}
                          </p>
                        </div>
                      )}
                      {eventDetails.planningNotes && (
                        <div className="mb-3">
                          <label className="text-sm font-medium text-blue-700">Planning Notes</label>
                          <p className="text-sm text-blue-800 bg-white p-2 rounded border">
                            {eventDetails.planningNotes}
                          </p>
                        </div>
                      )}
                      {eventDetails.contactCompletionNotes && (
                        <div>
                          <label className="text-sm font-medium text-blue-700">Contact Notes</label>
                          <p className="text-sm text-blue-800 bg-white p-2 rounded border">
                            {eventDetails.contactCompletionNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Event History */}
                  <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                    <h3 className="font-semibold text-teal-800 mb-3 flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      Event History
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-teal-700">Request Submitted</label>
                        <p className="text-base font-medium text-teal-800">
                          {(() => {
                            try {
                              const date = new Date(eventDetails.createdAt);
                              return date.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              });
                            } catch (error) {
                              return 'Unknown';
                            }
                          })()}
                        </p>
                      </div>
                      
                      {eventDetails.hasHostedEvent !== undefined && (
                        <div>
                          <label className="text-sm font-medium text-teal-700">Previously Hosted Events</label>
                          <div className="flex items-center space-x-2 mt-1">
                            {eventDetails.hasHostedEvent ? (
                              <>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-green-600 font-semibold">Yes</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-500">First time</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No detailed event information available</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowEventDetailsDialog(false)}
                >
                  Close
                </Button>
                {eventDetails && (eventDetails.status === 'new' || eventDetails.status === 'scheduled') && (
                  <Button 
                    onClick={() => {
                      setShowEventDetailsDialog(false);
                      onNavigateToEventPlanning?.();
                    }}
                    className="bg-[#236383] hover:bg-[#236383]/90 text-white"
                  >
                    Go to Event Planning
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}