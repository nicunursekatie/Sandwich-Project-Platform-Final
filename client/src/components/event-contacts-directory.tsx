import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Search, Users, Filter, Building } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { EventContactCard } from './event-contact-card';
import type { EventContact } from '@shared/schema';

export default function EventContactsDirectory() {
  const [, setLocation] = useLocation();

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch contacts
  const { data: contacts = [], isLoading } = useQuery<EventContact[]>({
    queryKey: ['/api/event-contacts'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get unique organizations for filter dropdown
  const uniqueOrganizations = useMemo(() => {
    const orgs = new Set<string>();
    contacts.forEach(contact => {
      contact.organizations.forEach(org => orgs.add(org));
    });
    return Array.from(orgs).sort();
  }, [contacts]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        contact =>
          contact.fullName.toLowerCase().includes(term) ||
          contact.email?.toLowerCase().includes(term) ||
          contact.phone?.includes(term) ||
          contact.organizations.some(org => org.toLowerCase().includes(term))
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(contact =>
        contact.contactRoles.includes(roleFilter as 'primary' | 'backup' | 'tsp')
      );
    }

    // Status filter (has completed events or not)
    if (statusFilter === 'completed') {
      filtered = filtered.filter(contact => contact.completedEvents > 0);
    } else if (statusFilter === 'in-progress') {
      filtered = filtered.filter(contact => contact.hasOnlyIncompleteEvents);
    }

    // Organization filter
    if (organizationFilter !== 'all') {
      filtered = filtered.filter(contact =>
        contact.organizations.includes(organizationFilter)
      );
    }

    return filtered;
  }, [contacts, searchTerm, roleFilter, statusFilter, organizationFilter]);

  // Count active filters
  const activeFilterCount = [
    roleFilter !== 'all',
    statusFilter !== 'all',
    organizationFilter !== 'all',
  ].filter(Boolean).length;

  const handleContactClick = (contact: EventContact) => {
    // Navigate to contact detail page
    setLocation(`/event-contact/${encodeURIComponent(contact.id)}`);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-slate-500">Loading event contacts...</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-blue-500 w-6 h-6" />
              Event Contacts Directory
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-teal-600 hover:text-teal-800 transition-colors">
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Event Contacts Help</p>
                  <p className="text-sm">
                    A directory of all contacts from group events. Each contact appears once,
                    with a summary of all events they've been involved in. Click a contact to
                    see their full event history.
                  </p>
                </TooltipContent>
              </Tooltip>
            </h1>
          </div>

          {/* Search and Filters */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, email, phone, or organization..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Toggle */}
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filter Dropdowns */}
            {showFilters && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex flex-col md:flex-row gap-3">
                  {/* Role Filter */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="filter-role" className="text-xs font-medium text-slate-600">
                      Contact Role
                    </Label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger id="filter-role" className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="primary">Primary Contact</SelectItem>
                        <SelectItem value="backup">Backup Contact</SelectItem>
                        <SelectItem value="tsp">TSP Coordinator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="filter-status" className="text-xs font-medium text-slate-600">
                      Event Status
                    </Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="filter-status" className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Contacts</SelectItem>
                        <SelectItem value="completed">Has Completed Events</SelectItem>
                        <SelectItem value="in-progress">Only In-Progress Events</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Organization Filter */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="filter-organization" className="text-xs font-medium text-slate-600">
                      Organization
                    </Label>
                    <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                      <SelectTrigger id="filter-organization" className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Organizations</SelectItem>
                        {uniqueOrganizations.map((org) => (
                          <SelectItem key={org} value={org}>
                            {org}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters */}
                  {activeFilterCount > 0 && (
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRoleFilter('all');
                          setStatusFilter('all');
                          setOrganizationFilter('all');
                        }}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-slate-600">
          Showing {filteredContacts.length} of {contacts.length} contacts
        </div>

        {/* Contacts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <EventContactCard
              key={contact.id}
              contact={contact}
              onClick={() => handleContactClick(contact)}
            />
          ))}

          {filteredContacts.length === 0 && contacts.length > 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              <Building className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No contacts match your current filters.</p>
              <p className="text-sm mt-1">Try adjusting your search or filter criteria.</p>
            </div>
          )}

          {contacts.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No event contacts found.</p>
              <p className="text-sm mt-1">Contacts will appear here once events are created.</p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
