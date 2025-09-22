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
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={onActiveTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="new" className="relative">
            New ({statusCounts.new})
            {statusCounts.new > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="in_process">
            In Process ({statusCounts.in_process})
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled ({statusCounts.scheduled})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({statusCounts.completed})
          </TabsTrigger>
          <TabsTrigger value="declined">
            Declined ({statusCounts.declined})
          </TabsTrigger>
        </TabsList>

        {/* Status-based tabs */}
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
    </div>
  );
}