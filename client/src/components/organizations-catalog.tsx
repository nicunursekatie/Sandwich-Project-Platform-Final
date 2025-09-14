import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Building,
  User,
  Mail,
  Phone,
  Calendar,
  Search,
  Filter,
  Users,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { formatDateForDisplay } from '@/lib/date-utils';

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
  latestActivityDate: string;
  totalRequests: number;
  status:
    | 'new'
    | 'contacted'
    | 'completed'
    | 'scheduled'
    | 'past'
    | 'declined'
    | 'contact_completed'
    | 'in_process';
  hasHostedEvent: boolean;
  eventDate?: string | null;
  totalSandwiches?: number;
  actualSandwichTotal?: number;
  actualEventCount?: number;
  eventFrequency?: string | null;
  latestCollectionDate?: string | null;
}

interface GroupCatalogProps {
  onNavigateToEventPlanning?: () => void;
}

export default function GroupCatalog({
  onNavigateToEventPlanning,
}: GroupCatalogProps = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('groupName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [selectedOrganization, setSelectedOrganization] =
    useState<OrganizationContact | null>(null);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [loadingEventDetails, setLoadingEventDetails] = useState(false);
  const [organizationDetails, setOrganizationDetails] = useState<any>(null);
  const [loadingOrganizationDetails, setLoadingOrganizationDetails] =
    useState(false);

  // Fetch groups data
  const {
    data: groupsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/groups-catalog'],
    queryFn: async () => {
      console.log('🔄 Groups catalog fetching data from API...');
      const response = await fetch('/api/groups-catalog');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      console.log('✅ Groups catalog received data:', data);
      return data;
    },
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Function to fetch complete event details
  const fetchEventDetails = async (organization: OrganizationContact) => {
    setLoadingEventDetails(true);
    try {
      const response = await fetch(
        `/api/event-requests/details/${encodeURIComponent(
          organization.organizationName
        )}/${encodeURIComponent(organization.contactName)}`
      );
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

  // Function to fetch complete organization details
  const fetchOrganizationDetails = async (organizationName: string) => {
    setLoadingOrganizationDetails(true);
    try {
      const response = await fetch(
        `/api/groups-catalog/details/${encodeURIComponent(organizationName)}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch organization details');
      }
      const details = await response.json();
      setOrganizationDetails(details);
      setShowEventDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching organization details:', error);
      setOrganizationDetails(null);
    } finally {
      setLoadingOrganizationDetails(false);
    }
  };

  // Helper function to get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_process':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'past':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Extract and flatten groups from response
  const rawGroups = groupsResponse?.groups || [];

  // Convert to flat structure and separate active vs historical organizations
  const allOrganizations: OrganizationContact[] = rawGroups.flatMap(
    (org: any) =>
      (org.departments || org.contacts || []).map((contact: any) => ({
        organizationName: org.name,
        contactName: contact.contactName || contact.name,
        email: contact.email,
        department: contact.department,
        latestRequestDate: contact.latestRequestDate || org.lastRequestDate,
        latestActivityDate:
          contact.latestActivityDate ||
          contact.latestRequestDate ||
          org.lastRequestDate,
        totalRequests: contact.totalRequests || 1,
        status: contact.status || 'new',
        hasHostedEvent: contact.hasHostedEvent || org.hasHostedEvent,
        eventDate: contact.eventDate || null,
        totalSandwiches: contact.totalSandwiches || 0,
        actualSandwichTotal: contact.actualSandwichTotal || 0,
        actualEventCount: contact.actualEventCount || 0,
        eventFrequency: contact.eventFrequency || null,
        latestCollectionDate: contact.latestCollectionDate || null,
      }))
  );

  // Separate active organizations (with event requests) from historical ones (sandwich collections only)
  const activeOrganizations = allOrganizations.filter(
    (org) => org.email && org.contactName !== 'Historical Organization'
  );

  const historicalOrganizations = allOrganizations.filter(
    (org) => !org.email || org.contactName === 'Historical Organization'
  );

  // Filter active organizations
  const filteredActiveGroups = activeOrganizations.filter((org) => {
    const matchesSearch =
      org.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.email &&
        org.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (org.department &&
        org.department.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filter historical organizations (simpler filtering since they don't have emails/status)
  const filteredHistoricalGroups = historicalOrganizations.filter((org) => {
    return (
      org.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.contactName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Group entries by group name
  interface GroupInfo {
    groupName: string;
    departments: OrganizationContact[];
    totalRequests: number;
    totalDepartments: number;
    hasHostedEvent: boolean;
    latestRequestDate: string;
    latestActivityDate: string;
  }

  // Process active organizations into groups
  const activeGroupInfo: GroupInfo[] = Array.from(
    filteredActiveGroups
      .reduce((groups: Map<string, GroupInfo>, org) => {
        const orgName = org.organizationName;

        if (!groups.has(orgName)) {
          groups.set(orgName, {
            groupName: orgName,
            departments: [],
            totalRequests: 0,
            totalDepartments: 0,
            hasHostedEvent: false,
            latestRequestDate: org.latestRequestDate,
            latestActivityDate: org.latestActivityDate,
          });
        }

        const group = groups.get(orgName)!;
        group.departments.push(org);
        group.totalRequests += org.totalRequests;
        group.hasHostedEvent = group.hasHostedEvent || org.hasHostedEvent;

        // Update latest request date
        if (
          new Date(org.latestRequestDate) > new Date(group.latestRequestDate)
        ) {
          group.latestRequestDate = org.latestRequestDate;
        }

        // Update latest activity date
        if (
          new Date(org.latestActivityDate) > new Date(group.latestActivityDate)
        ) {
          group.latestActivityDate = org.latestActivityDate;
        }

        return groups;
      }, new Map())
      .values()
  );

  // Process historical organizations into groups
  const historicalGroupInfo: GroupInfo[] = Array.from(
    filteredHistoricalGroups
      .reduce((groups: Map<string, GroupInfo>, org) => {
        const orgName = org.organizationName;

        if (!groups.has(orgName)) {
          groups.set(orgName, {
            groupName: orgName,
            departments: [],
            totalRequests: 0,
            totalDepartments: 0,
            hasHostedEvent: org.hasHostedEvent,
            latestRequestDate: org.latestRequestDate,
            latestActivityDate: org.latestActivityDate,
          });
        }

        const group = groups.get(orgName)!;
        group.departments.push(org);
        group.hasHostedEvent = group.hasHostedEvent || org.hasHostedEvent;

        return groups;
      }, new Map())
      .values()
  );

  // Sort active groups by organization name or latest activity date
  const sortedActiveGroups = activeGroupInfo.sort((a, b) => {
    if (sortBy === 'groupName') {
      return sortOrder === 'desc'
        ? b.groupName.localeCompare(a.groupName)
        : a.groupName.localeCompare(b.groupName);
    }

    // Default sort by latest activity date (includes both requests and collections)
    const aDate = new Date(a.latestActivityDate).getTime();
    const bDate = new Date(b.latestActivityDate).getTime();
    return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
  });

  // Sort historical groups by organization name
  const sortedHistoricalGroups = historicalGroupInfo.sort((a, b) => {
    return a.groupName.localeCompare(b.groupName);
  });

  // Sort departments within each active group
  sortedActiveGroups.forEach((group) => {
    group.departments.sort((a, b) => {
      if (sortBy === 'eventDate') {
        const aDate = a.eventDate
          ? new Date(a.eventDate).getTime()
          : sortOrder === 'desc'
            ? -Infinity
            : Infinity;
        const bDate = b.eventDate
          ? new Date(b.eventDate).getTime()
          : sortOrder === 'desc'
            ? -Infinity
            : Infinity;
        return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
      }

      if (sortBy === 'totalRequests') {
        return sortOrder === 'desc'
          ? b.totalRequests - a.totalRequests
          : a.totalRequests - b.totalRequests;
      }

      // Sort by contact name or department
      const aValue = a.department || a.contactName;
      const bValue = b.department || b.contactName;
      return sortOrder === 'desc'
        ? bValue.localeCompare(aValue)
        : aValue.localeCompare(bValue);
    });

    group.totalDepartments = group.departments.length;
  });

  // Pagination logic for active groups
  const totalActiveItems = sortedActiveGroups.length;
  const totalActivePages = Math.ceil(totalActiveItems / itemsPerPage);
  const activeStartIndex = (currentPage - 1) * itemsPerPage;
  const activeEndIndex = activeStartIndex + itemsPerPage;
  const paginatedActiveGroups = sortedActiveGroups.slice(
    activeStartIndex,
    activeEndIndex
  );

  // Historical groups don't need pagination initially - show all
  const paginatedHistoricalGroups = sortedHistoricalGroups;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new':
        return 'New Request';
      case 'contacted':
        return 'Contacted';
      case 'in_process':
        return 'In Process';
      case 'contact_completed':
        return 'Event Complete';
      case 'scheduled':
        return 'Upcoming Event';
      case 'completed':
        return 'Completed';
      case 'past':
        return 'Past Event';
      case 'declined':
        return 'Event Postponed';
      default:
        return 'Unknown';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <Badge className="bg-gradient-to-r from-teal-100 to-cyan-200 text-teal-800 border border-teal-300 shadow-sm">
            New Request
          </Badge>
        );
      case 'contacted':
        return (
          <Badge className="bg-gradient-to-r from-emerald-100 to-teal-200 text-teal-700 border border-teal-300 shadow-sm">
            Contacted
          </Badge>
        );
      case 'in_process':
        return (
          <Badge className="bg-gradient-to-r from-blue-100 to-indigo-200 text-blue-800 border border-blue-300 shadow-sm">
            In Process
          </Badge>
        );
      case 'contact_completed':
        return (
          <Badge className="bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800 border border-orange-300 shadow-sm">
            Event Complete
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-gradient-to-r from-yellow-100 to-orange-200 text-yellow-800 border border-yellow-300 shadow-sm">
            Upcoming Event
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border border-green-300 shadow-sm">
            Completed
          </Badge>
        );
      case 'past':
        return (
          <Badge className="bg-gradient-to-r from-gray-100 to-slate-200 text-gray-700 border border-gray-300 shadow-sm">
            Past Event
          </Badge>
        );
      case 'declined':
        return (
          <Badge
            className="text-white border-2 font-bold shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #A31C41 0%, #8B1538 100%)',
              borderColor: '#A31C41',
            }}
          >
            🚫 EVENT POSTPONED
          </Badge>
        );
      default:
        return null; // Remove confusing "Unknown" badges
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-200 shadow-sm">
            <Building className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Groups Catalog</h1>
            <p className="text-gray-600">Loading organization contacts...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-gray-200 animate-pulse rounded-lg"
            ></div>
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
          <p className="text-sm text-gray-500 mt-2">
            {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
          <Building className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups Catalog</h1>
          <p className="text-gray-600">
            Directory of all organizations we've worked with from event requests
          </p>
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
                <SelectItem value="declined">Postponed Events</SelectItem>
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
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 pt-3 border-t flex justify-between items-center">
          <small className="text-gray-600">
            Showing {activeStartIndex + 1}-
            {Math.min(activeEndIndex, totalActiveItems)} of {totalActiveItems}{' '}
            active groups • {paginatedHistoricalGroups.length} historical
            organizations
          </small>
          <div className="flex items-center gap-2">
            <small className="text-gray-600">Items per page:</small>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => setItemsPerPage(Number(value))}
            >
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

      {/* Organizations Display - Separated by Active and Historical */}
      {totalActiveItems === 0 && paginatedHistoricalGroups.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No organizations found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Event requests will populate this directory'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Organizations Section */}
          {totalActiveItems > 0 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-200">
                  <Calendar className="w-5 h-5 text-teal-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Active Organizations
                </h2>
                <Badge className="bg-teal-100 text-teal-700">
                  {totalActiveItems} organizations
                </Badge>
              </div>

              <div className="space-y-6">
                {paginatedActiveGroups.map((group, groupIndex) => (
                  <div
                    key={`${group.groupName}-${groupIndex}`}
                    className="bg-gradient-to-br from-white via-gray-50 to-slate-100 rounded-lg border border-gray-200 p-6 shadow-sm"
                  >
                    {/* Group Header */}
                    <div className="mb-6 pb-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Building
                            className="w-6 h-6"
                            style={{ color: '#236383' }}
                          />
                          <h2 className="text-xl font-bold text-gray-900">
                            {group.groupName}
                          </h2>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {group.totalDepartments}{' '}
                              {group.totalDepartments === 1
                                ? 'contact'
                                : 'departments'}
                            </span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{group.totalRequests} event requests</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Department Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.departments.map((org, index) => (
                        <Card
                          key={`${org.organizationName}-${org.contactName}-${index}`}
                          className={`hover:shadow-lg transition-all duration-300 border-l-4 ${
                            org.status === 'declined'
                              ? 'border-l-4 border-2 shadow-xl'
                              : 'bg-gradient-to-br from-white to-orange-50 border-l-4'
                          }`}
                          style={
                            org.status === 'declined'
                              ? {
                                  background:
                                    'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                                  borderLeftColor: '#A31C41',
                                  borderColor: '#A31C41',
                                }
                              : { borderLeftColor: '#FBAD3F' }
                          }
                        >
                          <CardHeader className="pb-3">
                            {/* Main headline with org name and date */}
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  {org.department && (
                                    <h3 className="text-xl font-bold text-gray-900 leading-tight">
                                      {org.department}
                                    </h3>
                                  )}
                                  {/* Event Date - Prominent */}
                                  {org.eventDate ? (
                                    <div
                                      className="flex items-center mt-2 text-lg font-semibold"
                                      style={{ color: '#FBAD3F' }}
                                    >
                                      <Calendar className="w-5 h-5 mr-2" />
                                      <span>
                                        {formatDateForDisplay(org.eventDate)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center mt-2 text-base text-gray-500">
                                      <Calendar className="w-4 h-4 mr-2" />
                                      <span>Event date not specified</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Contact Info - Enhanced with more details */}
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <User className="w-4 h-4" />
                                  <span className="font-medium">
                                    {org.contactName}
                                  </span>
                                </div>
                                {org.email && (
                                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                                    <Mail className="w-4 h-4" />
                                    <span>{org.email}</span>
                                  </div>
                                )}
                                {org.department && (
                                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                                    <Building className="w-4 h-4" />
                                    <span>Department: {org.department}</span>
                                  </div>
                                )}
                              </div>

                              {/* Enhanced Key Metrics Bar with Analytics */}
                              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-3 border border-orange-200 rounded-md">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm text-gray-700">
                                        Status:
                                      </span>
                                      <Badge
                                        className={getStatusBadgeColor(
                                          org.status
                                        )}
                                        variant="outline"
                                      >
                                        {getStatusText(org.status)}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {org.totalRequests} request
                                      {org.totalRequests !== 1 ? 's' : ''}
                                    </div>
                                  </div>

                                  {/* Enhanced Analytics Display */}
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center space-x-1">
                                      <span>🥪</span>
                                      <span className="font-semibold text-orange-700">
                                        {org.actualSandwichTotal ||
                                          org.totalSandwiches ||
                                          0}{' '}
                                        sandwiches
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <span>📅</span>
                                      <span className="font-semibold text-blue-700">
                                        {org.actualEventCount || 0} events
                                      </span>
                                    </div>
                                  </div>

                                  {/* Event Frequency Display */}
                                  {org.eventFrequency && (
                                    <div className="text-center text-xs text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded">
                                      {org.eventFrequency}
                                    </div>
                                  )}

                                  {org.hasHostedEvent && (
                                    <div className="flex items-center justify-center space-x-1 text-green-600">
                                      <CheckCircle className="w-3 h-3" />
                                      <span className="text-xs">
                                        Hosted {org.actualEventCount || 1} event
                                        {(org.actualEventCount || 1) > 1
                                          ? 's'
                                          : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent>
                            <div className="space-y-3">
                              {/* Contact Information - Most Important */}
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2 text-base">
                                  <User className="w-5 h-5 text-teal-600" />
                                  <span className="font-semibold text-gray-900">
                                    {org.contactName}
                                  </span>
                                </div>
                                {org.email && (
                                  <div className="flex items-center space-x-2 text-sm">
                                    <Mail className="w-4 h-4 text-teal-500" />
                                    <span className="text-teal-700 hover:text-teal-800">
                                      {org.email}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* View Complete Organization History Button */}
                              <Button
                                onClick={() => {
                                  setSelectedOrganization(org);
                                  setOrganizationDetails(null); // Reset previous details
                                  fetchOrganizationDetails(
                                    org.organizationName
                                  ); // Fetch complete organization history
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full text-sm bg-brand-orange hover:bg-brand-orange/90 text-white border-brand-orange hover:border-brand-orange/90"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Complete History
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Organizations Section */}
          {paginatedHistoricalGroups.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-slate-200">
                  <Building className="w-5 h-5 text-gray-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Historical Organizations
                </h2>
                <Badge className="bg-gray-100 text-gray-700">
                  {paginatedHistoricalGroups.length} organizations
                </Badge>
                <span className="text-sm text-gray-600">
                  (from sandwich collections only)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedHistoricalGroups.map((group, groupIndex) => (
                  <Card
                    key={`historical-${group.groupName}-${groupIndex}`}
                    className="bg-gradient-to-br from-gray-50 to-slate-100 border border-gray-200 hover:shadow-lg transition-all duration-300"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-gray-800 flex items-center space-x-2">
                        <Building className="w-5 h-5 text-gray-600" />
                        <span>{group.groupName}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="w-4 h-4 mr-2" />
                          <span>Historical host location</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <span className="w-4 h-4 text-orange-600 mr-2">
                            🥪
                          </span>
                          <span>Sandwich collection host</span>
                        </div>
                        <div className="pt-2 mt-3 border-t">
                          <small className="text-gray-500">
                            From sandwich collections records
                          </small>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls - Only for Active Organizations */}
      {totalActiveItems > 0 && totalActivePages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border p-4 shadow-sm mt-6">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalActivePages}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalActivePages, 5) }, (_, i) => {
                let pageNum;
                if (totalActivePages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalActivePages - 2) {
                  pageNum = totalActivePages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
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
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalActivePages))
              }
              disabled={currentPage === totalActivePages}
              className="h-8"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Organization History Dialog */}
      <Dialog
        open={showEventDetailsDialog}
        onOpenChange={setShowEventDetailsDialog}
      >
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Organization History:{' '}
              {organizationDetails?.organizationName ||
                selectedOrganization?.organizationName}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete event history and analytics
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {loadingOrganizationDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Loading organization details...
                </span>
              </div>
            ) : organizationDetails ? (
              <div className="space-y-6">
                {/* Summary Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-brand-primary dark:text-blue-400">
                        {organizationDetails.summary.totalEvents}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total Events
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {organizationDetails.summary.completedEvents}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Completed
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {organizationDetails.summary.totalActualSandwiches.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Sandwiches Made
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {organizationDetails.summary.eventFrequency ||
                          'First Time'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Frequency
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Contacts */}
                {organizationDetails.contacts &&
                  organizationDetails.contacts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Organization Contacts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {organizationDetails.contacts.map(
                            (contact: any, index: number) => (
                              <div
                                key={index}
                                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                              >
                                <div className="font-semibold">
                                  {contact.name}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {contact.email && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Mail className="w-3 h-3" />
                                      {contact.email}
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Phone className="w-3 h-3" />
                                      {contact.phone}
                                    </div>
                                  )}
                                  {contact.department && (
                                    <div className="text-xs mt-1 text-brand-primary dark:text-blue-400">
                                      {contact.department}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Event History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Event History ({organizationDetails.events.length} events)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {organizationDetails.events.map(
                        (event: any, index: number) => (
                          <div
                            key={index}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-brand-primary transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                                    {formatDateForDisplay(event.date)}
                                  </div>
                                  <Badge
                                    className={
                                      event.type === 'sandwich_collection'
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : 'bg-blue-100 text-blue-800 border-blue-200'
                                    }
                                  >
                                    {event.type === 'sandwich_collection'
                                      ? 'Collection'
                                      : 'Request'}
                                  </Badge>
                                  {getStatusBadge(event.status)}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                      Contact
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                      {event.contactName}
                                    </div>
                                    {event.email && (
                                      <div className="text-xs text-gray-500 dark:text-gray-500">
                                        {event.email}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                      Sandwiches
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                      {event.actualSandwiches > 0
                                        ? `${event.actualSandwiches.toLocaleString()} made`
                                        : event.estimatedSandwiches > 0
                                          ? `${event.estimatedSandwiches.toLocaleString()} estimated`
                                          : 'Not specified'}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                      Details
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                      {event.department && (
                                        <div>Dept: {event.department}</div>
                                      )}
                                      {event.hostName && (
                                        <div>Host: {event.hostName}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {event.notes && (
                                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                                    {event.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      {organizationDetails.events.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No events found for this organization
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No organization details available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
