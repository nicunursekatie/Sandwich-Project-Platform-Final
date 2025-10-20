import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  Calendar,
  XCircle,
  UserCheck,
  Star,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface RequestFiltersProps {
  // Search and filter states
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  confirmationFilter: 'all' | 'confirmed' | 'requested';
  onConfirmationFilterChange: (filter: 'all' | 'confirmed' | 'requested') => void;
  sortBy: 'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc';
  onSortByChange: (sort: 'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc') => void;
  
  // Tab state
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  
  // Pagination state
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  
  // Status counts for tab badges
  statusCounts: {
    new: number;
    in_process: number;
    scheduled: number;
    completed: number;
    declined: number;
    my_assignments: number;
  };
  
  // Content for each tab
  children: {
    new: ReactNode;
    in_process: ReactNode;
    scheduled: ReactNode;
    completed: ReactNode;
    declined: ReactNode;
    my_assignments: ReactNode;
  };
  
  // Pagination info
  totalItems: number;
  totalPages: number;
}

export default function RequestFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  confirmationFilter,
  onConfirmationFilterChange,
  sortBy,
  onSortByChange,
  activeTab,
  onActiveTabChange,
  currentPage,
  onCurrentPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  statusCounts,
  children,
  totalItems,
  totalPages,
}: RequestFiltersProps) {
  const isMobile = useIsMobile();

  // Tab configuration with icons and labels
  const tabConfig = [
    {
      value: 'new',
      label: 'New',
      shortLabel: 'New',
      icon: Star,
      count: statusCounts.new,
      hasNotification: statusCounts.new > 0,
    },
    {
      value: 'in_process',
      label: 'In Process',
      shortLabel: 'Process',
      icon: Clock,
      count: statusCounts.in_process,
    },
    {
      value: 'scheduled',
      label: 'Scheduled',
      shortLabel: 'Scheduled',
      icon: Calendar,
      count: statusCounts.scheduled,
    },
    {
      value: 'completed',
      label: 'Completed',
      shortLabel: 'Done',
      icon: CheckCircle,
      count: statusCounts.completed,
    },
    {
      value: 'declined',
      label: 'Declined',
      shortLabel: 'Declined',
      icon: XCircle,
      count: statusCounts.declined,
    },
    {
      value: 'my_assignments',
      label: 'My Assignments',
      shortLabel: 'Mine',
      icon: UserCheck,
      count: statusCounts.my_assignments,
    },
  ];

  // Get current tab info for mobile selector
  const currentTab = tabConfig.find(tab => tab.value === activeTab);

  return (
    <div className="space-y-6">
      {/* Mobile: Dropdown Selector */}
      {isMobile ? (
        <div className="space-y-4">
          {/* Mobile Tab Selector */}
          <div className="mobile-tab-selector">
            <Select value={activeTab} onValueChange={onActiveTabChange}>
              <SelectTrigger className="mobile-select-trigger">
                <div className="flex items-center space-x-2">
                  {currentTab && (
                    <>
                      <currentTab.icon className="w-4 h-4 text-[#007E8C]" />
                      <SelectValue>
                        {currentTab.label} ({currentTab.count})
                      </SelectValue>
                    </>
                  )}
                  {currentTab?.hasNotification && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
              </SelectTrigger>
              <SelectContent className="mobile-select-content">
                {tabConfig.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value} className="mobile-select-item">
                    <div className="flex items-center space-x-2">
                      <tab.icon className="w-4 h-4 text-[#007E8C]" />
                      <span>{tab.label}</span>
                      <span className="text-gray-500">({tab.count})</span>
                      {tab.hasNotification && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Content */}
          <div className="space-y-4">
            {children[activeTab as keyof typeof children]}
          </div>
        </div>
      ) : (
        /* Desktop: Traditional Tabs */
        <Tabs value={activeTab} onValueChange={onActiveTabChange} className="space-y-4">
          <div className="w-full overflow-x-auto pb-1">
            <TabsList className="w-full inline-flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-1 min-w-full">
              {tabConfig.map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="relative text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                  data-testid={tab.value === 'my_assignments' ? 'tab-my-assignments' : undefined}
                  data-tour={tab.value === 'my_assignments' ? 'my-assignments-tab' : undefined}
                >
                  <div className="flex items-center space-x-1">
                    <tab.icon className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                    <span className="text-xs opacity-70">({tab.count})</span>
                  </div>
                  {tab.hasNotification && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Desktop Tab Content */}
          {['new', 'in_process', 'scheduled', 'completed', 'declined', 'my_assignments'].map(
            (status) => (
              <TabsContent key={status} value={status} className="space-y-4">
                {/* Search and Filters for this specific status */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#007E8C] w-4 h-4" />
                    <Input
                      placeholder="Search by organization, name, email, date, or location..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10 w-full"
                      data-testid="input-search-requests"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    onValueChange={(value: any) => onSortByChange(value)}
                  >
                    <SelectTrigger className="w-full sm:w-48 md:w-56" data-testid="sort-select-trigger">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                      <SelectItem value="created_date_desc">
                        Submission Date (Most Recent First)
                      </SelectItem>
                      <SelectItem value="created_date_asc">
                        Submission Date (Oldest First)
                      </SelectItem>
                      <SelectItem value="event_date_desc">
                        Event Date (Most Recent)
                      </SelectItem>
                      <SelectItem value="event_date_asc">
                        Event Date (Oldest)
                      </SelectItem>
                      <SelectItem value="organization_asc">
                        Organization A-Z
                      </SelectItem>
                      <SelectItem value="organization_desc">
                        Organization Z-A
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={confirmationFilter}
                    onValueChange={(value: any) => onConfirmationFilterChange(value)}
                  >
                    <SelectTrigger className="w-full sm:w-40 md:w-44">
                      <SelectValue placeholder="Filter by..." />
                    </SelectTrigger>
                    <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="requested">Requested</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tab Content */}
                <div className="space-y-4">
                  {children[status as keyof typeof children]}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Items per page:</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages} ({totalItems} total)
                      </span>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCurrentPageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          data-testid="button-previous-page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCurrentPageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            )
          )}
        </Tabs>
      )}

      {/* Mobile Search and Filters - Only shown on mobile */}
      {isMobile && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#007E8C] w-4 h-4" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 mobile-input mobile-search-input"
                data-testid="input-search-requests"
              />
            </div>
            <Select
              value={sortBy}
              onValueChange={(value: any) => onSortByChange(value)}
            >
              <SelectTrigger className="w-full mobile-select" data-testid="sort-select-trigger">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                <SelectItem value="created_date_desc">
                  Newest First
                </SelectItem>
                <SelectItem value="created_date_asc">
                  Oldest First
                </SelectItem>
                <SelectItem value="event_date_desc">
                  Most Recent Event
                </SelectItem>
                <SelectItem value="event_date_asc">
                  Oldest Event
                </SelectItem>
                <SelectItem value="organization_asc">
                  Org A-Z
                </SelectItem>
                <SelectItem value="organization_desc">
                  Org Z-A
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={confirmationFilter}
              onValueChange={(value: any) => onConfirmationFilterChange(value)}
            >
              <SelectTrigger className="w-full mobile-select">
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Items per page:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} ({totalItems} total)
                </span>
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCurrentPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    data-testid="button-previous-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCurrentPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}