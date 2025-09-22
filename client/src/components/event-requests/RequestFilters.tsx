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
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface RequestFiltersProps {
  // Search and filter states
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
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
  };
  
  // Content for each tab
  children: {
    new: ReactNode;
    in_process: ReactNode;
    scheduled: ReactNode;
    completed: ReactNode;
    declined: ReactNode;
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
  return (
    <div className="space-y-6">
      {/* Mobile Select Fallback - Only visible on xs screens */}
      <div className="sm:hidden">
        <Select
          value={activeTab}
          onValueChange={onActiveTabChange}
          data-testid="select-mobile-tab-filter"
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new" data-testid="select-option-new">
              New ({statusCounts.new})
            </SelectItem>
            <SelectItem value="in_process" data-testid="select-option-in-process">
              In Process ({statusCounts.in_process})
            </SelectItem>
            <SelectItem value="scheduled" data-testid="select-option-scheduled">
              Scheduled ({statusCounts.scheduled})
            </SelectItem>
            <SelectItem value="completed" data-testid="select-option-completed">
              Completed ({statusCounts.completed})
            </SelectItem>
            <SelectItem value="declined" data-testid="select-option-declined">
              Declined ({statusCounts.declined})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs - Hidden on xs, visible on sm+ */}
      <Tabs value={activeTab} onValueChange={onActiveTabChange} className="space-y-4 hidden sm:block">
        <div className="relative sticky top-0 z-10 bg-white dark:bg-black">
          <TabsList className="flex gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap flex-nowrap p-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory">
            <TabsTrigger 
              value="new" 
              className="shrink-0 snap-start px-3 py-2 text-sm sm:px-4 relative flex items-center gap-2"
              data-testid="tab-new"
            >
              New
              <Badge variant="secondary" className="ml-1">{statusCounts.new}</Badge>
              {statusCounts.new > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="in_process" 
              className="shrink-0 snap-start px-3 py-2 text-sm sm:px-4 flex items-center gap-2"
              data-testid="tab-in-process"
            >
              In Process
              <Badge variant="secondary" className="ml-1">{statusCounts.in_process}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="scheduled" 
              className="shrink-0 snap-start px-3 py-2 text-sm sm:px-4 flex items-center gap-2"
              data-testid="tab-scheduled"
            >
              Scheduled
              <Badge variant="secondary" className="ml-1">{statusCounts.scheduled}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="shrink-0 snap-start px-3 py-2 text-sm sm:px-4 flex items-center gap-2"
              data-testid="tab-completed"
            >
              Completed
              <Badge variant="secondary" className="ml-1">{statusCounts.completed}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="declined" 
              className="shrink-0 snap-start px-3 py-2 text-sm sm:px-4 flex items-center gap-2"
              data-testid="tab-declined"
            >
              Declined
              <Badge variant="secondary" className="ml-1">{statusCounts.declined}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Desktop Tab Content */}
        {['new', 'in_process', 'scheduled', 'completed', 'declined'].map(
          (status) => (
            <TabsContent key={status} value={status} className="space-y-4">
              {/* Search and Filters for this specific status */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#007E8C] w-4 h-4" />
                  <Input
                    placeholder="Search by organization, name, email, date, or location..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-requests"
                  />
                </div>
                <Select
                  value={sortBy}
                  onValueChange={(value: any) => onSortByChange(value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_date_desc">Submission Date (Most Recent First)</SelectItem>
                    <SelectItem value="created_date_asc">Submission Date (Oldest First)</SelectItem>
                    <SelectItem value="event_date_asc">Event Date (Soonest First)</SelectItem>
                    <SelectItem value="event_date_desc">Event Date (Latest First)</SelectItem>
                    <SelectItem value="organization_asc">Organization A-Z</SelectItem>
                    <SelectItem value="organization_desc">Organization Z-A</SelectItem>
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

      {/* Mobile Tab Content - Only visible on xs screens */}
      <div className="sm:hidden space-y-4">
        {['new', 'in_process', 'scheduled', 'completed', 'declined'].map(
          (status) => (
            activeTab === status && (
              <div key={status} className="space-y-4">
                {/* Search and Filters for this specific status */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#007E8C] w-4 h-4" />
                    <Input
                      placeholder="Search by organization, name, email, date, or location..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-requests-mobile"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    onValueChange={(value: any) => onSortByChange(value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_date_desc">Submission Date (Most Recent First)</SelectItem>
                      <SelectItem value="created_date_asc">Submission Date (Oldest First)</SelectItem>
                      <SelectItem value="event_date_asc">Event Date (Soonest First)</SelectItem>
                      <SelectItem value="event_date_desc">Event Date (Latest First)</SelectItem>
                      <SelectItem value="organization_asc">Organization A-Z</SelectItem>
                      <SelectItem value="organization_desc">Organization Z-A</SelectItem>
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
                          data-testid="button-previous-page-mobile"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCurrentPageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          data-testid="button-next-page-mobile"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}