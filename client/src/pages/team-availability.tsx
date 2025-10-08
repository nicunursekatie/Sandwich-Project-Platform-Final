import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import {
  Calendar,
  Clock,
  Users,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';

import type { AvailabilitySlot } from '@shared/schema';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { DateTimePicker } from '@/components/ui/datetime-picker';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profileImageUrl?: string;
  role: string;
}

type QuickFilter = 'today' | 'this-week' | 'next-week' | 'this-month';

export default function TeamAvailability() {
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users/basic'],
  });

  // Fetch availability slots for date range
  const { data: slots = [], isLoading: slotsLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: [
      '/api/availability',
      {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      },
    ],
  });

  const isLoading = usersLoading || slotsLoading;

  // Apply quick filters
  const handleQuickFilter = (filter: QuickFilter) => {
    const today = new Date();
    
    switch (filter) {
      case 'today':
        setStartDate(startOfDay(today));
        setEndDate(endOfDay(today));
        break;
      case 'this-week':
        setStartDate(startOfWeek(today, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(today, { weekStartsOn: 1 }));
        break;
      case 'next-week':
        const nextWeek = addWeeks(today, 1);
        setStartDate(startOfWeek(nextWeek, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(nextWeek, { weekStartsOn: 1 }));
        break;
      case 'this-month':
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
    }
  };

  // Combine user data with availability data
  const userAvailability = useMemo(() => {
    return users.map(user => {
      const userSlots = slots.filter(slot => slot.userId === user.id);
      const availableSlots = userSlots.filter(slot => slot.status === 'available');
      const unavailableSlots = userSlots.filter(slot => slot.status === 'unavailable');
      
      return {
        user,
        slots: userSlots,
        availableSlots,
        unavailableSlots,
        hasAvailability: userSlots.length > 0,
      };
    });
  }, [users, slots]);

  // Filter and sort by user name
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = userAvailability;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ user }) => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
        const displayName = (user.displayName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return (
          fullName.includes(query) ||
          displayName.includes(query) ||
          email.includes(query)
        );
      });
    }

    // Sort by user name
    return filtered.sort((a, b) => {
      const nameA = a.user.displayName || `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email;
      const nameB = b.user.displayName || `${b.user.displayName || ''} ${b.user.lastName || ''}`.trim() || b.user.email;
      return nameA.localeCompare(nameB);
    });
  }, [userAvailability, searchQuery]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalMembers = users.length;
    const availableMembers = new Set(
      slots.filter(slot => slot.status === 'available').map(slot => slot.userId)
    ).size;
    const unavailableMembers = new Set(
      slots.filter(slot => slot.status === 'unavailable').map(slot => slot.userId)
    ).size;

    return {
      totalMembers,
      availableMembers,
      unavailableMembers,
    };
  }, [users, slots]);

  const getUserDisplayName = (user: User) => {
    if (user.displayName) return user.displayName;
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  if (isLoading) {
    return <LoadingState text="Loading team availability..." size="lg" />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Back Button Header */}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="page-title">
          Team Availability
        </h1>
        <p className="text-gray-600" data-testid="page-description">
          View and track team member availability across selected date ranges
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Team Members</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="stat-total">
                {stats.totalMembers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Available Members</p>
              <p className="text-2xl font-bold text-green-600" data-testid="stat-available">
                {stats.availableMembers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <UserX className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unavailable Members</p>
              <p className="text-2xl font-bold text-red-600" data-testid="stat-unavailable">
                {stats.unavailableMembers}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6 mb-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Date Range Filter</h2>
          
          {/* Date Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <DateTimePicker
                date={startDate}
                setDate={(date) => date && setStartDate(date)}
                showTime={false}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <DateTimePicker
                date={endDate}
                setDate={(date) => date && setEndDate(date)}
                showTime={false}
                data-testid="input-end-date"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Filters
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('today')}
                data-testid="button-filter-today"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('this-week')}
                data-testid="button-filter-this-week"
              >
                <Calendar className="mr-2 h-4 w-4" />
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('next-week')}
                data-testid="button-filter-next-week"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Next Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickFilter('this-month')}
                data-testid="button-filter-this-month"
              >
                <Calendar className="mr-2 h-4 w-4" />
                This Month
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Showing availability from{' '}
            <span className="font-semibold" data-testid="text-date-range">
              {format(startDate, 'MMM dd, yyyy')} to {format(endDate, 'MMM dd, yyyy')}
            </span>
          </div>
        </div>
      </Card>

      {/* Availability List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Team Member Availability
        </h2>

        {filteredAndSortedUsers.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-state">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery
                ? 'No team members found matching your search'
                : 'No team members found'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedUsers.map(({ user, slots, availableSlots, unavailableSlots, hasAvailability }) => (
              <div
                key={user.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                data-testid={`user-card-${user.id}`}
              >
                <div className="flex items-start gap-4">
                  {/* User Avatar/Photo */}
                  <div className="flex-shrink-0">
                    {user.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt={getUserDisplayName(user)}
                        className="h-12 w-12 rounded-full object-cover"
                        data-testid={`img-avatar-${user.id}`}
                      />
                    ) : (
                      <div
                        className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center"
                        data-testid={`avatar-placeholder-${user.id}`}
                      >
                        <span className="text-blue-600 font-semibold text-lg">
                          {getUserDisplayName(user).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* User Info and Availability */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3
                        className="text-lg font-semibold text-gray-900"
                        data-testid={`text-username-${user.id}`}
                      >
                        {getUserDisplayName(user)}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-xs"
                        data-testid={`badge-role-${user.id}`}
                      >
                        {user.role}
                      </Badge>
                    </div>

                    {!hasAvailability ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm" data-testid={`text-no-availability-${user.id}`}>
                          No availability set
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Available Slots */}
                        {availableSlots.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                className="bg-green-100 text-green-800 border-green-300"
                                data-testid={`badge-available-count-${user.id}`}
                              >
                                Available ({availableSlots.length})
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {availableSlots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="flex items-start gap-2 text-sm bg-green-50 p-2 rounded border border-green-200"
                                  data-testid={`slot-available-${slot.id}`}
                                >
                                  <Clock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="text-gray-900 font-medium">
                                      {format(new Date(slot.startAt), 'MMM dd, yyyy h:mm a')} -{' '}
                                      {format(new Date(slot.endAt), 'h:mm a')}
                                    </div>
                                    {slot.notes && (
                                      <div
                                        className="text-gray-600 mt-1"
                                        data-testid={`text-notes-${slot.id}`}
                                      >
                                        {slot.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Unavailable Slots */}
                        {unavailableSlots.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                className="bg-red-100 text-red-800 border-red-300"
                                data-testid={`badge-unavailable-count-${user.id}`}
                              >
                                Unavailable ({unavailableSlots.length})
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {unavailableSlots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="flex items-start gap-2 text-sm bg-red-50 p-2 rounded border border-red-200"
                                  data-testid={`slot-unavailable-${slot.id}`}
                                >
                                  <Clock className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="text-gray-900 font-medium">
                                      {format(new Date(slot.startAt), 'MMM dd, yyyy h:mm a')} -{' '}
                                      {format(new Date(slot.endAt), 'h:mm a')}
                                    </div>
                                    {slot.notes && (
                                      <div
                                        className="text-gray-600 mt-1"
                                        data-testid={`text-notes-${slot.id}`}
                                      >
                                        {slot.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
