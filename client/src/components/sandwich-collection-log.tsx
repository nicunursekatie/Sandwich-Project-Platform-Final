import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sandwich,
  Calendar,
  User,
  Users,
  Edit,
  Trash2,
  Upload,
  AlertTriangle,
  Scan,
  Square,
  CheckSquare,
  Filter,
  X,
  ArrowUp,
  ArrowDown,
  Download,
  Plus,
  Database,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Heart,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import SendKudosButton from '@/components/send-kudos-button';
import sandwichLogo from '@assets/LOGOS/Copy of TSP_transparent.png';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import BulkDataManager from '@/components/bulk-data-manager';
import CollectionFormSelector from '@/components/collection-form-selector';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  hasPermission,
  PERMISSIONS,
  canEditCollection,
  canDeleteCollection,
} from '@shared/auth-utils';
import type { SandwichCollection, Host } from '@shared/schema';
import { HelpBubble, helpContent } from '@/components/help-system';
import {
  calculateTotalSandwiches,
  calculateGroupSandwiches,
} from '@/lib/analytics-utils';

interface ImportResult {
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

interface DuplicateAnalysis {
  totalCollections: number;
  duplicateGroups: number;
  totalDuplicateEntries: number;
  suspiciousPatterns: number;
  ogDuplicates: number;
  duplicates: Array<{
    entries: SandwichCollection[];
    count: number;
    duplicateInfo: {
      collectionDate: string;
      groupNames: string;
      individualSandwiches: number;
      totalSandwiches: number;
    };
    keepNewest: {
      id: number;
      submittedAt: string;
      createdBy: string;
      individualSandwiches: number;
      totalSandwiches: number;
      groupNames: string;
    };
    toDelete: Array<{
      id: number;
      submittedAt: string;
      createdBy: string;
      individualSandwiches: number;
      totalSandwiches: number;
      groupNames: string;
    }>;
  }>;
  suspiciousEntries: SandwichCollection[];
  ogDuplicateEntries: Array<{
    ogEntry?: SandwichCollection;
    earlyEntry?: SandwichCollection;
    duplicateOgEntry?: SandwichCollection;
    reason: string;
  }>;
}

export default function SandwichCollectionLog() {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check user permissions for creating collections (automatically grants edit/delete of own)
  const canCreateCollections =
    hasPermission(user, PERMISSIONS.COLLECTIONS_ADD) ||
    hasPermission(user, PERMISSIONS.COLLECTIONS_EDIT);
  const canEditAllCollections = hasPermission(
    user,
    PERMISSIONS.COLLECTIONS_EDIT_ALL
  );
  const canDeleteAllCollections = hasPermission(
    user,
    PERMISSIONS.COLLECTIONS_DELETE_ALL
  );
  // Simplified approach: CREATE_COLLECTIONS automatically includes edit/delete own permissions
  const canEditData =
    hasPermission(user, PERMISSIONS.COLLECTIONS_ADD) ||
    hasPermission(user, PERMISSIONS.COLLECTIONS_EDIT_ALL);
  const canDeleteData =
    hasPermission(user, PERMISSIONS.COLLECTIONS_ADD) ||
    hasPermission(user, PERMISSIONS.COLLECTIONS_DELETE_ALL);
  const [editingCollection, setEditingCollection] =
    useState<SandwichCollection | null>(null);
  const [showDuplicateAnalysis, setShowDuplicateAnalysis] = useState(false);
  const [duplicateAnalysis, setDuplicateAnalysis] =
    useState<DuplicateAnalysis | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<Set<number>>(
    new Set()
  );
  const [selectedSuspiciousIds, setSelectedSuspiciousIds] = useState<
    Set<number>
  >(new Set());
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<number>>(
    new Set()
  );
  const [selectedKeepIds, setSelectedKeepIds] = useState<Map<number, number>>(
    new Map()
  );
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [batchEditData, setBatchEditData] = useState({
    hostName: '',
    collectionDate: '',
  });
  const [searchFilters, setSearchFilters] = useState({
    globalSearch: '',
    hostName: '',
    groupName: '',
    collectionDateFrom: '',
    collectionDateTo: '',
    createdAtFrom: '',
    createdAtTo: '',
  });

  // Debounced search filters for actual queries
  const [debouncedSearchFilters, setDebouncedSearchFilters] = useState({
    globalSearch: '',
    hostName: '',
    groupName: '',
    collectionDateFrom: '',
    collectionDateTo: '',
    createdAtFrom: '',
    createdAtTo: '',
  });

  const [sortConfig, setSortConfig] = useState({
    field: 'collectionDate' as keyof SandwichCollection,
    direction: 'desc' as 'asc' | 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [editFormData, setEditFormData] = useState({
    collectionDate: '',
    hostName: '',
    individualSandwiches: '',
    groupCollections: '',
    individualDeli: '',
    individualTurkey: '',
    individualHam: '',
    individualPbj: '',
  });
  const [editGroupCollections, setEditGroupCollections] = useState<
    Array<{ id: string; groupName: string; count?: number; sandwichCount?: number; deli?: number; turkey?: number; ham?: number; pbj?: number; hasTypeBreakdown?: boolean }>
  >([]);
  const [showEditIndividualBreakdown, setShowEditIndividualBreakdown] = useState(false);
  
  // Validation state for Edit Collection Dialog
  const [editIndividualBreakdownError, setEditIndividualBreakdownError] = useState<string>('');
  const [editGroupBreakdownErrors, setEditGroupBreakdownErrors] = useState<Map<string, string>>(new Map());
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [newCollectionData, setNewCollectionData] = useState({
    collectionDate: '',
    hostName: '',
    individualSandwiches: '',
    groupCollections: '',
  });
  const [newGroupCollections, setNewGroupCollections] = useState<
    Array<{ id: string; groupName: string; sandwichCount: number }>
  >([{ id: Math.random().toString(36), groupName: '', sandwichCount: 0 }]);
  const [newCollectionGroupOnlyMode, setNewCollectionGroupOnlyMode] =
    useState(false);

  // Use standardized calculation functions from analytics-utils.ts for data consistency
  const calculateGroupTotal = calculateGroupSandwiches;
  const calculateTotal = calculateTotalSandwiches;

  // Listen for form open events from dashboard
  useEffect(() => {
    const handleOpenForm = () => {
      setShowSubmitForm(true);
    };

    window.addEventListener('openCollectionForm', handleOpenForm);
    return () =>
      window.removeEventListener('openCollectionForm', handleOpenForm);
  }, []);

  // Debounce search filters to prevent excessive queries
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log('Setting debounced filters:', searchFilters);
      setDebouncedSearchFilters(searchFilters);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchFilters]);

  // Validation for individual sandwich breakdown in Edit dialog
  useEffect(() => {
    if (!showEditIndividualBreakdown) {
      setEditIndividualBreakdownError('');
      return;
    }

    const individualDeli = parseInt(editFormData.individualDeli) || 0;
    const individualTurkey = parseInt(editFormData.individualTurkey) || 0;
    const individualHam = parseInt(editFormData.individualHam) || 0;
    const individualPbj = parseInt(editFormData.individualPbj) || 0;
    const individualSandwiches = parseInt(editFormData.individualSandwiches) || 0;
    
    const breakdownSum = individualDeli + individualTurkey + individualHam + individualPbj;
    const hasAnyValue = individualDeli > 0 || individualTurkey > 0 || individualHam > 0 || individualPbj > 0;
    
    if (!hasAnyValue) {
      // Allow empty breakdown (optional)
      setEditIndividualBreakdownError('');
      return;
    }

    // If any value is entered, enforce sum validation
    if (breakdownSum !== individualSandwiches) {
      setEditIndividualBreakdownError(`Type breakdown (${breakdownSum}) must equal total individual sandwiches (${individualSandwiches})`);
    } else {
      setEditIndividualBreakdownError('');
    }
  }, [showEditIndividualBreakdown, editFormData.individualDeli, editFormData.individualTurkey, editFormData.individualHam, editFormData.individualPbj, editFormData.individualSandwiches]);

  // Validation for group breakdown in Edit dialog
  useEffect(() => {
    const errors = new Map<string, string>();
    
    editGroupCollections.forEach((group) => {
      // Only validate groups that have type breakdown enabled
      if (!group.hasTypeBreakdown) {
        return;
      }

      const deli = group.deli || 0;
      const turkey = group.turkey || 0;
      const ham = group.ham || 0;
      const pbj = group.pbj || 0;
      const breakdownSum = deli + turkey + ham + pbj;
      const hasAnyValue = deli > 0 || turkey > 0 || ham > 0 || pbj > 0;
      
      if (!hasAnyValue) {
        // Allow empty breakdown (optional)
        return;
      }

      // Support both 'count' and 'sandwichCount' field names for compatibility
      const groupCount = group.count || group.sandwichCount || 0;

      // If any value is entered, enforce sum validation
      if (breakdownSum !== groupCount) {
        errors.set(group.id, `Group type breakdown (${breakdownSum}) must equal group total (${groupCount})`);
      }
    });
    
    setEditGroupBreakdownErrors(errors);
  }, [editGroupCollections]);

  // Memoize expensive computations using debounced filters
  // Only fetch all data when we need client-side filtering/sorting, not for basic pagination
  const needsAllData = useMemo(
    () => showFilters || Object.values(debouncedSearchFilters).some((v) => v),
    [showFilters, debouncedSearchFilters]
  );

  const queryKey = useMemo(
    () => [
      '/api/sandwich-collections',
      needsAllData ? 'all' : currentPage,
      needsAllData ? 'all' : itemsPerPage,
      currentPage, // Always include current page for proper cache keying
      debouncedSearchFilters,
      sortConfig,
    ],
    [
      needsAllData,
      currentPage,
      itemsPerPage,
      debouncedSearchFilters,
      sortConfig,
    ]
  );

  const { data: collectionsResponse, isLoading } = useQuery({
    queryKey,
    queryFn: useCallback(async () => {
      if (needsAllData) {
        console.log(
          'Fetching all data for filtering with filters:',
          debouncedSearchFilters
        );
        const response = await fetch('/api/sandwich-collections?limit=10000');
        if (!response.ok) throw new Error('Failed to fetch collections');
        const data = await response.json();

        let filteredCollections = data.collections || [];
        console.log('Initial collections count:', filteredCollections.length);

        // Apply filters using debounced values
        if (debouncedSearchFilters.hostName) {
          const searchTerm = debouncedSearchFilters.hostName.toLowerCase();
          filteredCollections = filteredCollections.filter(
            (c: SandwichCollection) =>
              c.hostName?.toLowerCase().includes(searchTerm)
          );
          console.log(
            `Host name filter '${searchTerm}' applied: ${filteredCollections.length} results`
          );
        }

        if (debouncedSearchFilters.collectionDateFrom) {
          const fromDate = new Date(debouncedSearchFilters.collectionDateFrom);
          filteredCollections = filteredCollections.filter(
            (c: SandwichCollection) => new Date(c.collectionDate) >= fromDate
          );
          console.log(
            `Date from filter '${debouncedSearchFilters.collectionDateFrom}' applied: ${filteredCollections.length} results`
          );
        }

        if (debouncedSearchFilters.collectionDateTo) {
          const toDate = new Date(debouncedSearchFilters.collectionDateTo);
          // Add 23:59:59 to include the entire day
          toDate.setHours(23, 59, 59, 999);
          filteredCollections = filteredCollections.filter(
            (c: SandwichCollection) => new Date(c.collectionDate) <= toDate
          );
        }

        if (debouncedSearchFilters.createdAtFrom) {
          const fromDate = new Date(debouncedSearchFilters.createdAtFrom);
          filteredCollections = filteredCollections.filter(
            (c: SandwichCollection) => new Date(c.submittedAt) >= fromDate
          );
        }

        if (debouncedSearchFilters.createdAtTo) {
          const toDate = new Date(debouncedSearchFilters.createdAtTo);
          // Add 23:59:59 to include the entire day
          toDate.setHours(23, 59, 59, 999);
          filteredCollections = filteredCollections.filter(
            (c: SandwichCollection) => new Date(c.submittedAt) <= toDate
          );
        }

        // Global search filter - searches across multiple fields
        if (debouncedSearchFilters.globalSearch) {
          const searchTerm = debouncedSearchFilters.globalSearch.toLowerCase();
          filteredCollections = filteredCollections.filter(
            (c: SandwichCollection) => {
              // Search in host name
              const hostNameMatch = c.hostName
                ?.toLowerCase()
                .includes(searchTerm);

              // Search in group names using the getGroupCollections function
              const groupData = getGroupCollections(c);
              const groupNameMatch = groupData.some((group) =>
                group.groupName?.toLowerCase().includes(searchTerm)
              );

              // Search in collection date
              const formattedDate = formatDate(c.collectionDate);
              const dateMatch = formattedDate
                .toLowerCase()
                .includes(searchTerm);

              return hostNameMatch || groupNameMatch || dateMatch;
            }
          );
          console.log(
            `Global search filter '${searchTerm}' applied: ${filteredCollections.length} results`
          );
        }

        // Group name specific filter
        if (debouncedSearchFilters.groupName) {
          const searchTerm = debouncedSearchFilters.groupName.toLowerCase();
          filteredCollections = filteredCollections.filter(
            (c: SandwichCollection) => {
              const groupData = getGroupCollections(c);
              return groupData.some((group) =>
                group.groupName?.toLowerCase().includes(searchTerm)
              );
            }
          );
          console.log(
            `Group name filter '${searchTerm}' applied: ${filteredCollections.length} results`
          );
        }

        // Apply sorting
        filteredCollections.sort((a: any, b: any) => {
          const aVal = a[sortConfig.field];
          const bVal = b[sortConfig.field];

          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          const comparison = aVal < bVal ? -1 : 1;
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        // Apply pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedResults = filteredCollections.slice(
          startIndex,
          endIndex
        );

        console.log('Pagination debug:', {
          currentPage,
          itemsPerPage,
          startIndex,
          endIndex,
          totalFiltered: filteredCollections.length,
          resultCount: paginatedResults.length,
        });

        return {
          collections: paginatedResults,
          pagination: {
            currentPage,
            totalPages: Math.ceil(filteredCollections.length / itemsPerPage),
            totalItems: filteredCollections.length,
            itemsPerPage,
          },
        };
      } else {
        const sortParam = `&sort=${sortConfig.field}&order=${sortConfig.direction}`;
        const url = `/api/sandwich-collections?page=${currentPage}&limit=${itemsPerPage}${sortParam}`;
        console.log('Fetching paginated collections:', url);
        const response = await fetch(url);
        if (!response.ok) {
          console.error('Failed to fetch collections:', response.status, response.statusText);
          throw new Error('Failed to fetch collections');
        }
        const data = await response.json();
        console.log('Paginated collections response:', {
          collectionsCount: data.collections?.length || 0,
          pagination: data.pagination
        });
        return data;
      }
    }, [
      needsAllData,
      currentPage,
      itemsPerPage,
      debouncedSearchFilters,
      sortConfig,
    ]),
  });

  const collections = collectionsResponse?.collections || [];
  const pagination = collectionsResponse?.pagination;

  // Extract pagination info - handle both client-side and server-side pagination responses
  const totalItems = pagination?.totalItems || pagination?.total || 0;
  const totalPages =
    pagination?.totalPages || Math.ceil(totalItems / itemsPerPage) || 1;
  const currentPageFromServer =
    pagination?.currentPage || pagination?.page || 1;
  const hasNext = pagination?.hasNext || currentPage < totalPages;
  const hasPrev = pagination?.hasPrev || currentPage > 1;

  const { data: hostsList = [] } = useQuery<Host[]>({
    queryKey: ['/api/hosts'],
  });

  // Query for complete database totals including both individual and group collections
  const { data: totalStats } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // Calculate filtered statistics from current collections data
  const calculateFilteredStats = (collectionsData: SandwichCollection[]) => {
    if (!collectionsData || collectionsData.length === 0) {
      return {
        totalEntries: 0,
        individualSandwiches: 0,
        groupSandwiches: 0,
        completeTotalSandwiches: 0,
        hostName: null,
        dateRange: null,
      };
    }

    let individualTotal = 0;
    let groupTotal = 0;
    const dates: string[] = [];
    const hostNames = new Set<string>();

    collectionsData.forEach((collection) => {
      individualTotal += collection.individualSandwiches || 0;
      groupTotal += calculateGroupTotal(collection);
      if (collection.collectionDate) {
        dates.push(collection.collectionDate);
      }
      if (collection.hostName) {
        hostNames.add(collection.hostName);
      }
    });

    // Calculate date range
    let dateRange = null;
    if (dates.length > 0) {
      dates.sort();
      const earliestDate = new Date(dates[0]);
      const latestDate = new Date(dates[dates.length - 1]);
      dateRange = {
        earliest: earliestDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        latest: latestDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      };
    }

    return {
      totalEntries: collectionsData.length,
      individualSandwiches: individualTotal,
      groupSandwiches: groupTotal,
      completeTotalSandwiches: individualTotal + groupTotal,
      hostName: hostNames.size === 1 ? Array.from(hostNames)[0] : null,
      dateRange,
    };
  };

  // Determine if we're showing filtered data and get all data for calculations
  const hasActiveFilters = Object.values(debouncedSearchFilters).some(
    (v) => v && v.trim() !== ''
  );

  // Get all filtered collections when filters are active for statistics calculation
  const { data: allFilteredData } = useQuery({
    queryKey: [
      '/api/sandwich-collections',
      'all-for-stats',
      debouncedSearchFilters,
    ],
    queryFn: async () => {
      if (!hasActiveFilters) return { collections: [] };

      const response = await fetch('/api/sandwich-collections?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();

      let filteredCollections = data.collections || [];

      // Apply the same filters as in the main query
      if (debouncedSearchFilters.hostName) {
        const searchTerm = debouncedSearchFilters.hostName.toLowerCase();
        filteredCollections = filteredCollections.filter(
          (c: SandwichCollection) =>
            c.hostName?.toLowerCase().includes(searchTerm)
        );
      }

      if (debouncedSearchFilters.collectionDateFrom) {
        const fromDate = new Date(debouncedSearchFilters.collectionDateFrom);
        filteredCollections = filteredCollections.filter(
          (c: SandwichCollection) => new Date(c.collectionDate) >= fromDate
        );
      }

      if (debouncedSearchFilters.collectionDateTo) {
        const toDate = new Date(debouncedSearchFilters.collectionDateTo);
        toDate.setHours(23, 59, 59, 999);
        filteredCollections = filteredCollections.filter(
          (c: SandwichCollection) => new Date(c.collectionDate) <= toDate
        );
      }

      if (debouncedSearchFilters.createdAtFrom) {
        const fromDate = new Date(debouncedSearchFilters.createdAtFrom);
        filteredCollections = filteredCollections.filter(
          (c: SandwichCollection) => new Date(c.submittedAt) >= fromDate
        );
      }

      if (debouncedSearchFilters.createdAtTo) {
        const toDate = new Date(debouncedSearchFilters.createdAtTo);
        toDate.setHours(23, 59, 59, 999);
        filteredCollections = filteredCollections.filter(
          (c: SandwichCollection) => new Date(c.submittedAt) <= toDate
        );
      }

      if (debouncedSearchFilters.globalSearch) {
        const searchTerm = debouncedSearchFilters.globalSearch.toLowerCase();
        filteredCollections = filteredCollections.filter(
          (c: SandwichCollection) => {
            const hostNameMatch = c.hostName
              ?.toLowerCase()
              .includes(searchTerm);
            const groupData = getGroupCollections(c);
            const groupNameMatch = groupData.some((group) =>
              group.groupName?.toLowerCase().includes(searchTerm)
            );
            const formattedDate = formatDate(c.collectionDate);
            const dateMatch = formattedDate.toLowerCase().includes(searchTerm);
            return hostNameMatch || groupNameMatch || dateMatch;
          }
        );
      }

      if (debouncedSearchFilters.groupName) {
        const searchTerm = debouncedSearchFilters.groupName.toLowerCase();
        filteredCollections = filteredCollections.filter(
          (c: SandwichCollection) => {
            const groupData = getGroupCollections(c);
            return groupData.some((group) =>
              group.groupName?.toLowerCase().includes(searchTerm)
            );
          }
        );
      }

      return { collections: filteredCollections };
    },
    enabled: hasActiveFilters,
  });

  // Calculate current statistics to display
  // When filters are active, always calculate from filtered data (never use global stats)
  // Priority: allFilteredData > current collections > global stats (only when no filters)
  const currentStats = (() => {
    // When filters are active, always prioritize filtered data calculations
    if (hasActiveFilters) {
      if (allFilteredData?.collections) {
        return calculateFilteredStats(allFilteredData.collections);
      } else if (collections.length > 0) {
        return calculateFilteredStats(collections);
      } else {
        // Even with filters active, if no data is available, show zero stats
        return {
          totalEntries: 0,
          individualSandwiches: 0,
          groupSandwiches: 0,
          completeTotalSandwiches: 0,
          hostName: null,
          dateRange: null,
        };
      }
    }

    // No filters active - prefer current collections over global stats for consistency
    if (needsAllData && collections.length > 0) {
      return calculateFilteredStats(collections);
    }

    // Fallback to global stats only when no filters are active and no current data
    return {
      totalEntries: totalStats?.totalEntries || 0,
      individualSandwiches: totalStats?.individualSandwiches || 0,
      groupSandwiches: totalStats?.groupSandwiches || 0,
      completeTotalSandwiches: totalStats?.completeTotalSandwiches || 0,
      hostName: null,
      dateRange: null,
    };
  })();

  // When needsAllData is true, filtering and pagination are already handled in the queryFn
  // When needsAllData is false, server-side pagination and sorting are used
  const filteredCollections = collections;

  // Use pagination info from backend when available, otherwise it's already calculated in queryFn
  const effectiveTotalItems = totalItems;
  const effectiveTotalPages = totalPages;

  // Collections are already paginated - no additional slicing needed
  const paginatedCollections = filteredCollections;

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchFilters, sortConfig]);

  // Pagination Controls Component with Full Page Numbers
  const PaginationControls = ({ position }: { position: 'top' | 'bottom' }) => {
    // Calculate which page numbers to show
    const getVisiblePages = () => {
      const totalPages = effectiveTotalPages;
      const current = currentPage;
      const delta = 2; // Show 2 pages on each side of current page

      let pages = [];

      // Always show first page
      if (totalPages > 0) {
        pages.push(1);
      }

      // Calculate start and end of middle section
      let start = Math.max(2, current - delta);
      let end = Math.min(totalPages - 1, current + delta);

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i);
        }
      }

      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page (if different from first)
      if (totalPages > 1) {
        pages.push(totalPages);
      }

      return pages;
    };

    const visiblePages = getVisiblePages();

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-white border-t border-slate-200 gap-4">
        {/* Left side - Per page selector only */}
        <div className="flex items-center gap-2 text-base">
          <span className="text-slate-600">Per page:</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => {
              setItemsPerPage(parseInt(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Right side - Page navigation with individual page numbers */}
        {effectiveTotalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* Previous button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-white border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              Previous
            </Button>

            {/* Page number buttons */}
            {visiblePages.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 py-2 text-slate-400"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 ${pageNum === currentPage ? 'bg-brand-primary text-white' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                >
                  {pageNum}
                </Button>
              );
            })}

            {/* Next button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === effectiveTotalPages}
              className="px-3 py-2 bg-white border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              Next
            </Button>

            {/* Last button (if not already visible) */}
            {currentPage < effectiveTotalPages - 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(effectiveTotalPages)}
                disabled={currentPage === effectiveTotalPages}
                className="px-3 py-2 bg-white border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
              >
                Last
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Get unique host names from collections for filtering
  const uniqueHostNames = Array.from(
    new Set(collections.map((c: SandwichCollection) => c.hostName))
  ).sort();

  // Include all hosts (active and inactive) for collection assignment
  const hostOptions = [
    ...hostsList
      .filter((host) => host.name !== 'Groups')
      .map((host) => host.name),
    'Other',
  ];

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatSubmittedAt = (timestamp: string | Date) => {
    return (
      new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }) +
      ' at ' +
      new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  // PHASE 6: Helper to get group collections from new JSONB array structure
  const getGroupCollections = (collection: SandwichCollection) => {
    // First check if the new groupCollections JSONB array exists and has data
    if (
      collection.groupCollections &&
      Array.isArray(collection.groupCollections) &&
      collection.groupCollections.length > 0
    ) {
      return collection.groupCollections
        .filter((group: any) => group.name && group.count > 0)
        .map((group: any) => ({
          groupName: group.name,
          sandwichCount: group.count,
          deli: group.deli || 0,
          turkey: group.turkey || 0,
          ham: group.ham || 0,
          pbj: group.pbj || 0,
        }));
    }

    // Fall back to legacy fields for backward compatibility
    const groups = [];
    const group1Name = (collection as any).group1Name;
    const group1Count = (collection as any).group1Count;
    const group2Name = (collection as any).group2Name;
    const group2Count = (collection as any).group2Count;

    if (group1Name && group1Count > 0) {
      groups.push({ groupName: group1Name, sandwichCount: group1Count });
    }
    if (group2Name && group2Count > 0) {
      groups.push({ groupName: group2Name, sandwichCount: group2Count });
    }
    return groups;
  };

  // Mutations for update and delete
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      return await apiRequest(
        'PATCH',
        `/api/sandwich-collections/${data.id}`,
        data.updates
      );
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections/stats'],
      });
      setEditingCollection(null);
      toast({
        title: 'Collection Updated Successfully! ✏️',
        description:
          'Your changes have been saved and the collection data has been updated.',
        duration: 4000,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update collection. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const result = await apiRequest(
        'DELETE',
        `/api/sandwich-collections/${id}`
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections/stats'],
      });
      toast({
        title: 'Collection Deleted Successfully 🗑️',
        description:
          'The sandwich collection record has been permanently removed from the system.',
        duration: 4000,
      });
    },
    onError: (error: any) => {
      console.error('Delete collection error:', error);

      // Check if it's just an auth error but the deletion might have worked
      // We'll refresh the data to see if it actually got deleted
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });

      // Show a more helpful error message
      const errorMessage = error?.message || 'Unknown error occurred';
      if (
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized')
      ) {
        toast({
          title: 'Authentication Error',
          description:
            'Your session may have expired. Please refresh the page and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Delete Error',
          description:
            'Failed to delete collection. Please refresh the page to check if it was actually deleted.',
          variant: 'destructive',
        });
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('=== CLIENT MUTATION DEBUG ===');
      console.log('Submitting data:', JSON.stringify(data, null, 2));
      try {
        const result = await apiRequest(
          'POST',
          '/api/sandwich-collections',
          data
        );
        console.log('API call successful, result:', result);
        return result;
      } catch (error) {
        console.error('API call failed:', error);
        throw error;
      }
    },
    onSuccess: (response, variables) => {
      const totalSandwiches =
        (variables.individualSandwiches || 0) +
        (variables.groupSandwiches || 0);

      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections/stats'],
      });
      setShowAddForm(false);
      setNewCollectionData({
        collectionDate: '',
        hostName: '',
        individualSandwiches: '',
        groupCollections: '',
      });
      setNewGroupCollections([
        { id: Math.random().toString(36), groupName: '', sandwichCount: 0 },
      ]);
      setNewCollectionGroupOnlyMode(false);
      toast({
        title: 'Collection Successfully Added! 🥪',
        description: `Recorded ${totalSandwiches} sandwiches from ${variables.hostName} on ${new Date(variables.collectionDate).toLocaleDateString()}. Thank you for your contribution!`,
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: 'Submission Failed',
        description:
          'Failed to add the collection. Please check your permissions and try again.',
        variant: 'destructive',
        duration: 7000,
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('/api/import-collections', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result: ImportResult) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      toast({
        title: 'Import completed',
        description: `Successfully imported ${result.successCount} of ${result.totalRecords} records.`,
      });
      if (result.errorCount > 0) {
        console.log('Import errors:', result.errors);
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error) => {
      toast({
        title: 'Import failed',
        description:
          error instanceof Error ? error.message : 'Failed to import CSV file',
        variant: 'destructive',
      });
    },
  });

  const analyzeDuplicatesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(
        'GET',
        '/api/sandwich-collections/analyze-duplicates'
      ) as Promise<DuplicateAnalysis>;
    },
    onSuccess: (result: DuplicateAnalysis) => {
      setDuplicateAnalysis(result);
      setShowDuplicateAnalysis(true);

      const initialKeepIds = new Map<number, number>();
      result.duplicates.forEach((group, index) => {
        initialKeepIds.set(index, group.keepNewest.id);
      });
      setSelectedKeepIds(initialKeepIds);

      toast({
        title: 'Analysis complete',
        description: `Found ${result.totalDuplicateEntries} duplicate entries and ${result.suspiciousPatterns} suspicious patterns.`,
      });
    },
    onError: () => {
      toast({
        title: 'Analysis failed',
        description: 'Failed to analyze duplicates. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const cleanDuplicatesMutation = useMutation({
    mutationFn: async (mode: 'exact' | 'suspicious' | 'og-duplicates') => {
      return apiRequest(
        'DELETE',
        '/api/sandwich-collections/clean-duplicates',
        { mode }
      );
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      setShowDuplicateAnalysis(false);
      setDuplicateAnalysis(null);
      setSelectedSuspiciousIds(new Set());
      setSelectedKeepIds(new Map());
      toast({
        title: 'Cleanup completed',
        description: `Successfully cleaned ${result.deletedCount} duplicate entries.`,
      });
    },
    onError: () => {
      toast({
        title: 'Cleanup failed',
        description: 'Failed to clean duplicates. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const cleanSelectedSuspiciousMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest('DELETE', '/api/sandwich-collections/clean-selected', {
        ids,
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      setShowDuplicateAnalysis(false);
      setDuplicateAnalysis(null);
      setSelectedSuspiciousIds(new Set());
      setSelectedKeepIds(new Map());
      toast({
        title: 'Selected entries deleted',
        description: `Successfully deleted ${result.deletedCount} selected entries.`,
      });
    },
    onError: () => {
      toast({
        title: 'Deletion failed',
        description: 'Failed to delete selected entries. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const batchEditMutation = useMutation({
    mutationFn: async (data: {
      ids: number[];
      updates: Partial<SandwichCollection>;
    }) => {
      console.log('Batch edit request:', data);
      const response = await fetch('/api/sandwich-collections/batch-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Batch edit error response:', errorData);
        throw new Error(errorData.message || 'Failed to update collections');
      }

      const result = await response.json();
      console.log('Batch edit success response:', result);
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      setSelectedCollections(new Set());
      setShowBatchEdit(false);
      setBatchEditData({ hostName: '', collectionDate: '' });
      toast({
        title: 'Batch edit completed',
        description: `Successfully updated ${result.updatedCount} of ${result.totalRequested} collections.`,
      });
    },
    onError: (error: any) => {
      console.error('Batch edit mutation error:', error);
      toast({
        title: 'Batch edit failed',
        description:
          error.message || 'Failed to update collections. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Export function
  const exportToCSV = async () => {
    try {
      // Fetch all collections data for export
      const response = await fetch('/api/sandwich-collections?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch all collections');
      const allCollectionsData = await response.json();
      const allCollections = allCollectionsData.collections || [];

      if (allCollections.length === 0) {
        toast({
          title: 'No data to export',
          description: 'There are no collections to export.',
          variant: 'destructive',
        });
        return;
      }

      // PHASE 5: Format group collections from new column structure
      const formatGroupCollections = (collection: SandwichCollection) => {
        const groups = getGroupCollections(collection);
        if (groups.length === 0) return '';
        return groups
          .map((group) => `${group.groupName}: ${group.sandwichCount}`)
          .join('; ');
      };

      // PHASE 5: Simplified CSV calculations using only new column structure
      const calculateGroupTotalForCSV = (collection: SandwichCollection) => {
        return calculateGroupTotal(collection);
      };

      const calculateTotalForCSV = (collection: SandwichCollection) => {
        return calculateTotal(collection);
      };

      const headers = [
        'ID',
        'Host Name',
        'Collection Date',
        'Individual Sandwiches',
        'Group Sandwiches',
        'Group Collections Detail',
        'Total Sandwiches',
        'Submitted At',
        'Created By',
      ];

      const csvData = [
        headers.join(','),
        ...allCollections.map((collection: SandwichCollection) =>
          [
            collection.id,
            `"${collection.hostName}"`,
            `"${collection.collectionDate}"`,
            collection.individualSandwiches || 0,
            calculateGroupTotalForCSV(collection),
            `"${formatGroupCollections(collection)}"`,
            calculateTotalForCSV(collection),
            `"${new Date(collection.submittedAt).toLocaleString()}"`,
            `"${collection.createdByName || 'Unknown'}"`,
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `sandwich-collections-complete-${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Export successful',
        description: `All ${allCollections.length} collections exported to CSV with complete data including group totals.`,
      });
    } catch (error) {
      console.error('CSV Export Error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export collections data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch('/api/sandwich-collections/batch-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      setSelectedCollections(new Set());
      toast({
        title: 'Batch delete completed',
        description: `Successfully deleted ${result.deletedCount} collections.`,
      });
    },
    onError: () => {
      toast({
        title: 'Batch delete failed',
        description: 'Failed to delete collections. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      importMutation.mutate(file);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please select a valid CSV file.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCollections(
        new Set(filteredCollections.map((c: SandwichCollection) => c.id))
      );
    } else {
      setSelectedCollections(new Set());
    }
  };

  const handleSelectCollection = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedCollections);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedCollections(newSelected);
  };

  const handleBatchEdit = () => {
    if (selectedCollections.size === 0) {
      toast({
        title: 'No collections selected',
        description: 'Please select collections to edit.',
        variant: 'destructive',
      });
      return;
    }
    setShowBatchEdit(true);
  };

  const submitBatchEdit = () => {
    console.log('submitBatchEdit called with batchEditData:', batchEditData);
    console.log('selectedCollections:', Array.from(selectedCollections));

    const updates: Partial<SandwichCollection> = {};
    if (batchEditData.hostName) updates.hostName = batchEditData.hostName;
    if (batchEditData.collectionDate)
      updates.collectionDate = batchEditData.collectionDate;

    console.log('Prepared updates:', updates);

    if (Object.keys(updates).length === 0) {
      console.log('No updates to apply');
      toast({
        title: 'No changes specified',
        description: 'Please specify at least one field to update.',
        variant: 'destructive',
      });
      return;
    }

    console.log('Submitting batch edit with:', {
      ids: Array.from(selectedCollections),
      updates,
    });

    batchEditMutation.mutate({
      ids: Array.from(selectedCollections),
      updates,
    });
  };

  const handleBatchDelete = () => {
    if (selectedCollections.size === 0) {
      toast({
        title: 'No collections selected',
        description: 'Please select collections to delete.',
        variant: 'destructive',
      });
      return;
    }

    if (
      confirm(
        `Are you sure you want to delete ${selectedCollections.size} selected collections? This action cannot be undone.`
      )
    ) {
      batchDeleteMutation.mutate(Array.from(selectedCollections));
    }
  };

  const handleEdit = (collection: SandwichCollection) => {
    setEditingCollection(collection);
    
    // Check if individual type breakdown exists
    const hasIndividualBreakdown = !!(collection.individualDeli || collection.individualTurkey || collection.individualHam || collection.individualPbj);
    setShowEditIndividualBreakdown(hasIndividualBreakdown);
    
    setEditFormData({
      collectionDate: collection.collectionDate,
      hostName: collection.hostName,
      individualSandwiches: collection.individualSandwiches.toString(),
      groupCollections: '', // Not used with new schema
      individualDeli: collection.individualDeli?.toString() || '',
      individualTurkey: collection.individualTurkey?.toString() || '',
      individualHam: collection.individualHam?.toString() || '',
      individualPbj: collection.individualPbj?.toString() || '',
    });

    // Parse existing group collections from new schema fields
    const groupList = [];

    // First try to read from the new groupCollections array
    if (
      collection.groupCollections &&
      Array.isArray(collection.groupCollections) &&
      collection.groupCollections.length > 0
    ) {
      collection.groupCollections.forEach((group: any, index: number) => {
        if (group.name && group.count > 0) {
          const hasTypeData = !!(group.deli || group.turkey || group.ham || group.pbj);
          const groupData: any = {
            id: `edit-${index + 1}`,
            groupName: group.name,
            sandwichCount: group.count,
            hasTypeBreakdown: hasTypeData, // Track if this group has type breakdown
          };
          
          // Include type breakdown if available
          if (hasTypeData) {
            groupData.deli = group.deli || 0;
            groupData.turkey = group.turkey || 0;
            groupData.ham = group.ham || 0;
            groupData.pbj = group.pbj || 0;
          }
          
          groupList.push(groupData);
        }
      });
    } else {
      // Fall back to legacy group1/group2 fields for backward compatibility
      if (collection.group1Name && collection.group1Count) {
        groupList.push({
          id: 'edit-1',
          groupName: collection.group1Name,
          sandwichCount: collection.group1Count,
          hasTypeBreakdown: false,
        });
      }
      if (collection.group2Name && collection.group2Count) {
        groupList.push({
          id: 'edit-2',
          groupName: collection.group2Name,
          sandwichCount: collection.group2Count,
          hasTypeBreakdown: false,
        });
      }
    }

    if (groupList.length > 0) {
      setEditGroupCollections(groupList);
    } else {
      setEditGroupCollections([
        { id: 'edit-1', groupName: '', sandwichCount: 0 },
      ]);
    }
  };

  const handleUpdate = () => {
    if (!editingCollection) return;

    // Check for individual breakdown validation errors
    if (editIndividualBreakdownError) {
      toast({ 
        title: 'Invalid individual breakdown', 
        description: editIndividualBreakdownError,
        variant: 'destructive' 
      });
      return;
    }

    // Check for group breakdown validation errors
    if (editGroupBreakdownErrors.size > 0) {
      const firstError = Array.from(editGroupBreakdownErrors.values())[0];
      toast({ 
        title: 'Invalid group breakdown', 
        description: firstError,
        variant: 'destructive' 
      });
      return;
    }

    // Convert editGroupCollections to new schema format
    const validGroups = editGroupCollections.filter(
      (g) => g.groupName.trim() && g.sandwichCount > 0
    );

    // Prepare groupCollections array for unlimited groups with type breakdown
    const groupCollections = validGroups.map((group) => {
      const groupData: any = {
        name: group.groupName,
        count: group.sandwichCount,
      };
      
      // Only include type breakdown if this group has it enabled
      if (group.hasTypeBreakdown && (group.deli || group.turkey || group.ham || group.pbj)) {
        groupData.deli = group.deli || 0;
        groupData.turkey = group.turkey || 0;
        groupData.ham = group.ham || 0;
        groupData.pbj = group.pbj || 0;
      }
      
      return groupData;
    });

    const updates: any = {
      collectionDate: editFormData.collectionDate,
      hostName: editFormData.hostName,
      individualSandwiches: parseInt(editFormData.individualSandwiches) || 0,
      // Include individual type breakdown
      individualDeli: parseInt(editFormData.individualDeli) || 0,
      individualTurkey: parseInt(editFormData.individualTurkey) || 0,
      individualHam: parseInt(editFormData.individualHam) || 0,
      individualPbj: parseInt(editFormData.individualPbj) || 0,
      // Include the new unlimited groups array
      groupCollections: groupCollections,
      // Keep legacy fields for backward compatibility (first 2 groups only)
      group1Name: validGroups[0]?.groupName || null,
      group1Count: validGroups[0]?.sandwichCount || null,
      group2Name: validGroups[1]?.groupName || null,
      group2Count: validGroups[1]?.sandwichCount || null,
    };

    updateMutation.mutate({
      id: editingCollection.id,
      updates,
    });
  };

  // Helper functions for edit group collections
  const addEditGroupRow = () => {
    const newId = `edit-${Date.now()}`;
    setEditGroupCollections([
      ...editGroupCollections,
      { id: newId, groupName: '', sandwichCount: 0, hasTypeBreakdown: false },
    ]);
  };

  const removeEditGroupRow = (id: string) => {
    if (editGroupCollections.length > 1) {
      setEditGroupCollections(
        editGroupCollections.filter((group) => group.id !== id)
      );
    }
  };

  const updateEditGroupCollection = (
    id: string,
    field: 'groupName' | 'sandwichCount',
    value: string | number
  ) => {
    setEditGroupCollections(
      editGroupCollections.map((group) =>
        group.id === id ? { ...group, [field]: value } : group
      )
    );
  };

  const handleDelete = (id: number) => {
    if (
      confirm(
        'Are you sure you want to delete this collection? This action cannot be undone.'
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewCollectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // In group-only mode, we only require collection date and group collections
    if (newCollectionGroupOnlyMode) {
      if (!newCollectionData.collectionDate) {
        toast({
          title: 'Missing information',
          description: 'Please fill in the collection date.',
          variant: 'destructive',
        });
        return;
      }

      const validGroupCollections = newGroupCollections.filter(
        (g) => g.sandwichCount > 0
      );

      if (validGroupCollections.length === 0) {
        toast({
          title: 'Missing group collections',
          description:
            'Please add at least one group collection with a sandwich count.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // Regular mode requires host name and collection date
      if (!newCollectionData.collectionDate || !newCollectionData.hostName) {
        toast({
          title: 'Missing required fields',
          description: 'Please fill in the collection date and host name.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Format group collections to match the new schema (separate columns)
    const validGroupCollections = newGroupCollections.filter(
      (group) => group.sandwichCount > 0
    );

    const submissionData = {
      collectionDate: newCollectionData.collectionDate,
      hostName: newCollectionGroupOnlyMode
        ? 'Groups - Unassigned'
        : newCollectionData.hostName,
      individualSandwiches: newCollectionGroupOnlyMode
        ? 0
        : parseInt(newCollectionData.individualSandwiches) || 0,
      // New schema: separate group columns (snake_case to match database)
      group1_name: validGroupCollections[0]?.groupName.trim() || null,
      group1_count: validGroupCollections[0]?.sandwichCount || null,
      group2_name: validGroupCollections[1]?.groupName.trim() || null,
      group2_count: validGroupCollections[1]?.sandwichCount || null,
    };

    createMutation.mutate(submissionData);
  };

  const addNewGroupRow = () => {
    setNewGroupCollections([
      ...newGroupCollections,
      {
        id: Math.random().toString(36),
        groupName: '',
        sandwichCount: 0,
      },
    ]);
  };

  const removeNewGroupRow = (id: string) => {
    if (newGroupCollections.length > 1) {
      setNewGroupCollections(
        newGroupCollections.filter((group) => group.id !== id)
      );
    }
  };

  const updateNewGroupCollection = (
    id: string,
    field: 'groupName' | 'sandwichCount',
    value: string | number
  ) => {
    setNewGroupCollections(
      newGroupCollections.map((group) =>
        group.id === id ? { ...group, [field]: value } : group
      )
    );
  };

  // Handler functions that reset page when sorting/filtering
  const handleSortChange = (field: keyof SandwichCollection) => {
    setSortConfig((prev) => ({ ...prev, field }));
    setCurrentPage(1);
  };

  const handleSortDirectionChange = () => {
    setSortConfig((prev) => ({
      ...prev,
      direction: prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const handleFilterChange = (filterUpdates: Partial<typeof searchFilters>) => {
    console.log('Filter change:', filterUpdates);
    setSearchFilters((prev) => {
      const newFilters = { ...prev, ...filterUpdates };
      console.log('New search filters:', newFilters);
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      hostName: '',
      collectionDateFrom: '',
      collectionDateTo: '',
      createdAtFrom: '',
      createdAtTo: '',
    };
    setSearchFilters(emptyFilters);
    setDebouncedSearchFilters(emptyFilters);
    setSortConfig({ field: 'collectionDate', direction: 'desc' });
    setCurrentPage(1);
    setShowFilters(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-slate-200 rounded-lg p-4 space-y-3"
            >
              <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-3 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center">
              <img
                src={sandwichLogo}
                alt="Sandwich Logo"
                className="mr-2 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
              />
              <span className="truncate">Collections</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-1">
              Manage collection data and bulk operations
            </p>
          </div>
          {canEditData && (
            <Button
              onClick={() => setShowDataManagement(true)}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2 w-full sm:w-auto btn-outline-tsp h-10 text-base"
              style={{
                borderColor: 'var(--color-brand-teal)',
                color: 'var(--color-brand-teal)',
              }}
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Data Management</span>
              <span className="sm:hidden">Data</span>
            </Button>
          )}
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4">
        {/* Global Search Field - Prominent placement at top */}
        <div className="mb-6">
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Scan className="h-5 w-5 text-slate-400" />
            </div>
            <Input
              data-testid="input-global-search"
              type="text"
              placeholder="Search collections (host names, groups, dates...)"
              value={searchFilters.globalSearch}
              onChange={(e) =>
                setSearchFilters((prev) => ({
                  ...prev,
                  globalSearch: e.target.value,
                }))
              }
              className="pl-10 pr-4 py-3 w-full border-2 border-slate-300 focus:border-blue-500 focus:ring-brand-primary-muted rounded-lg text-base"
            />
            {searchFilters.globalSearch && (
              <button
                data-testid="button-clear-global-search"
                onClick={() =>
                  setSearchFilters((prev) => ({ ...prev, globalSearch: '' }))
                }
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
          {searchFilters.globalSearch && (
            <p className="text-center text-base text-slate-600 mt-2">
              Searching across host names, group names, and dates
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {/* Enhanced Display-Friendly Stats with Filtered Stats Support */}
          <div className="space-y-4">
            {/* Filter Status and Context */}
            {hasActiveFilters && (
              <div className="bg-brand-primary-lighter border border-brand-primary-border rounded-lg p-3 text-base">
                <div className="flex items-center text-brand-primary-dark">
                  <Filter className="w-4 h-4 mr-2" />
                  <span className="font-medium">
                    {currentStats.hostName
                      ? `Statistics for ${currentStats.hostName}`
                      : 'Filtered Statistics'}
                  </span>
                </div>
                {currentStats.dateRange && (
                  <div className="text-brand-primary mt-1 text-sm">
                    Date range: {currentStats.dateRange.earliest} -{' '}
                    {currentStats.dateRange.latest}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-base text-slate-500 font-medium">
                  {hasActiveFilters
                    ? `${currentStats.totalEntries}`
                    : `${totalItems}`}
                  {hasActiveFilters ? ' filtered' : ''} entries
                </p>
                {hasActiveFilters && !currentStats.hostName && (
                  <span className="text-sm text-brand-primary bg-brand-primary-light px-2 py-1 rounded-full">
                    Multiple Hosts
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-black text-transparent bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text drop-shadow-sm">
                  {currentStats.completeTotalSandwiches.toLocaleString()}
                </div>
                <div className="text-base font-semibold text-amber-700 uppercase tracking-wide">
                  {hasActiveFilters ? 'Filtered' : 'Total'} Sandwiches
                </div>
              </div>
            </div>

            {/* Statistics Display */}
            <div
              className={`flex justify-center gap-8 rounded-xl py-4 px-6 border shadow-sm ${
                hasActiveFilters
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-brand-primary-border'
                  : 'bg-gradient-to-r from-teal-50 to-amber-50 border-amber-200'
              }`}
            >
              <div className="text-center">
                <div
                  className={`text-lg sm:text-xl font-bold drop-shadow-sm ${
                    hasActiveFilters ? 'text-brand-primary' : 'text-teal-700'
                  }`}
                >
                  {currentStats.individualSandwiches.toLocaleString()}
                </div>
                <div
                  className={`text-base font-semibold uppercase tracking-wide mt-1 ${
                    hasActiveFilters ? 'text-brand-primary' : 'text-teal-600'
                  }`}
                >
                  Individual
                </div>
              </div>
              <div
                className={`w-px bg-gradient-to-b ${
                  hasActiveFilters
                    ? 'from-blue-300 to-indigo-300'
                    : 'from-teal-300 to-amber-300'
                }`}
              ></div>
              <div className="text-center">
                <div
                  className={`text-lg sm:text-xl font-bold drop-shadow-sm ${
                    hasActiveFilters ? 'text-indigo-600' : 'text-orange-600'
                  }`}
                >
                  {currentStats.groupSandwiches.toLocaleString()}
                </div>
                <div
                  className={`text-base font-semibold uppercase tracking-wide mt-1 ${
                    hasActiveFilters ? 'text-indigo-600' : 'text-orange-600'
                  }`}
                >
                  Groups
                </div>
              </div>
            </div>

            {/* Global Stats Reference when filtering */}
            {hasActiveFilters && totalStats && (
              <div className="text-center text-sm text-slate-500 border-t pt-3">
                <span>
                  Global totals:{' '}
                  {totalStats.completeTotalSandwiches.toLocaleString()}{' '}
                  sandwiches across {totalStats.totalEntries} entries
                </span>
              </div>
            )}
          </div>

          {/* Action buttons - Mobile optimized */}
          <div className="flex flex-col sm:flex-row gap-2">
            {canCreateCollections && (
              <HelpBubble
                title="Recording Collections"
                content="Click here to submit new sandwich collection data. Fill in the host location, date, and sandwich counts to track your impact!"
                character="sandy"
                position="bottom"
                trigger="hover"
              >
                <Button
                  onClick={() => setShowSubmitForm(!showSubmitForm)}
                  variant="default"
                  size="sm"
                  className="flex items-center justify-center space-x-2 w-full sm:w-auto bg-brand-primary hover:bg-brand-primary-dark py-4 px-6 !text-lg sm:!text-base min-h-[56px] sm:min-h-[40px]"
                >
                  <Sandwich className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="font-medium">
                    {showSubmitForm ? 'Hide Form' : 'Enter New Collection Data'}
                  </span>
                </Button>
              </HelpBubble>
            )}
            <HelpBubble
              title="Filter Collections"
              content="Use these filters to search and sort your collection data by date, host, or other criteria. Perfect for finding specific entries!"
              character="guide"
              position="bottom"
              trigger="hover"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-1 w-full sm:w-auto justify-center py-2.5 bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </Button>
            </HelpBubble>
            {canEditData && (
              <Button
                onClick={() => setShowDataManagement(true)}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2 w-full sm:w-auto justify-center py-2.5 bg-white border-teal-400 text-teal-600 hover:bg-teal-50"
              >
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">Data Management</span>
                <span className="sm:hidden">Data</span>
              </Button>
            )}
            {selectedCollections.size > 0 && canEditData && (
              <div className="flex flex-col xs:flex-row gap-2 w-full mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchEdit}
                  className="flex items-center flex-1 justify-center py-2.5 bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  <span>Edit ({selectedCollections.size})</span>
                </Button>
                {canDeleteData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchDelete}
                    className="flex items-center flex-1 justify-center py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 bg-white border-gray-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span>Delete ({selectedCollections.size})</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Submit Collection Form - Full width */}
      {showSubmitForm && (
        <div className="mb-4">
          <CollectionFormSelector
            onSuccess={() => {
              setShowSubmitForm(false);
              queryClient.invalidateQueries({
                queryKey: ['/api/sandwich-collections'],
              });
            }}
            onCancel={() => setShowSubmitForm(false)}
          />
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <Label
                htmlFor="hostFilter"
                className="text-base font-medium text-slate-700"
              >
                Host/Location Name
              </Label>
              <Input
                id="hostFilter"
                data-testid="input-filter-host"
                placeholder="Search by host name..."
                value={searchFilters.hostName}
                onChange={(e) =>
                  handleFilterChange({ hostName: e.target.value })
                }
                className="mt-1"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    handleFilterChange({ hostName: 'OG Sandwich Project' })
                  }
                  className="px-3 py-1 text-sm bg-amber-100 text-amber-800 border border-amber-300 rounded-full hover:bg-amber-200 transition-colors"
                >
                  👑 Historical OG Project
                </button>
                <button
                  onClick={() => handleFilterChange({ hostName: '' })}
                  className="px-3 py-1 text-sm bg-slate-100 text-slate-700 border border-slate-300 rounded-full hover:bg-slate-200 transition-colors"
                >
                  All Locations
                </button>
              </div>
            </div>
            <div>
              <Label
                htmlFor="groupFilter"
                className="text-base font-medium text-slate-700"
              >
                Group Name
              </Label>
              <Input
                id="groupFilter"
                data-testid="input-filter-group"
                placeholder="Search by group name..."
                value={searchFilters.groupName}
                onChange={(e) =>
                  handleFilterChange({ groupName: e.target.value })
                }
                className="mt-1"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleFilterChange({ groupName: '' })}
                  className="px-3 py-1 text-sm bg-slate-100 text-slate-700 border border-slate-300 rounded-full hover:bg-slate-200 transition-colors"
                >
                  All Groups
                </button>
              </div>
            </div>
            <div>
              <Label
                htmlFor="collectionFromDate"
                className="text-base font-medium text-slate-700"
              >
                Collection Date From
              </Label>
              <Input
                id="collectionFromDate"
                data-testid="input-filter-date-from"
                type="date"
                value={searchFilters.collectionDateFrom}
                onChange={(e) =>
                  handleFilterChange({ collectionDateFrom: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="collectionToDate"
                className="text-base font-medium text-slate-700"
              >
                Collection Date To
              </Label>
              <Input
                id="collectionToDate"
                data-testid="input-filter-date-to"
                type="date"
                value={searchFilters.collectionDateTo}
                onChange={(e) =>
                  handleFilterChange({ collectionDateTo: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="createdFromDate"
                className="text-base font-medium text-slate-700"
              >
                Created Date From
              </Label>
              <Input
                id="createdFromDate"
                data-testid="input-filter-created-from"
                type="date"
                value={searchFilters.createdAtFrom}
                onChange={(e) =>
                  handleFilterChange({ createdAtFrom: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="createdToDate"
                className="text-base font-medium text-slate-700"
              >
                Created Date To
              </Label>
              <Input
                id="createdToDate"
                data-testid="input-filter-created-to"
                type="date"
                value={searchFilters.createdAtTo}
                onChange={(e) =>
                  handleFilterChange({ createdAtTo: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="text-base text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, totalItems)} of{' '}
                {totalItems} entries
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Label className="text-base font-medium text-slate-700">
                  Sort by:
                </Label>
                <div className="flex items-center space-x-2">
                  <Select
                    value={sortConfig.field}
                    onValueChange={(value) =>
                      handleSortChange(value as keyof SandwichCollection)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collectionDate">
                        Collection Date
                      </SelectItem>
                      <SelectItem value="hostName">Host Name</SelectItem>
                      <SelectItem value="individualSandwiches">
                        Sandwich Count
                      </SelectItem>
                      <SelectItem value="submittedAt">Created Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSortDirectionChange}
                    className="flex items-center space-x-1"
                  >
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    <span className="hidden sm:inline">
                      {sortConfig.direction === 'asc' ? 'Asc' : 'Desc'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="flex items-center space-x-1 w-full sm:w-auto bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
            >
              <X className="w-4 h-4" />
              <span>Clear Filters</span>
            </Button>
          </div>
        </div>
      )}

      {/* Top Pagination Controls */}
      {totalItems > 0 && <PaginationControls position="top" />}

      <div className="p-6">
        {paginatedCollections.length > 0 && (
          <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-200">
            <button
              onClick={() =>
                handleSelectAll(
                  !selectedCollections.size ||
                    selectedCollections.size < filteredCollections.length
                )
              }
              className="flex items-center space-x-2 text-base text-slate-600 hover:text-slate-900"
            >
              {selectedCollections.size === filteredCollections.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Select All</span>
            </button>
            {selectedCollections.size > 0 && (
              <span className="text-base text-slate-500">
                {selectedCollections.size} of {filteredCollections.length}{' '}
                selected
              </span>
            )}
          </div>
        )}
        <div className="space-y-3 sm:space-y-4">
          {paginatedCollections.map((collection: SandwichCollection) => {
            const groupData = getGroupCollections(collection);
            const totalSandwiches = calculateTotal(collection);
            const isSelected = selectedCollections.has(collection.id);

            // Check if the host is inactive
            const hostData = hostsList.find(
              (h) => h.name === collection.hostName
            );
            const isInactiveHost = hostData?.status === 'inactive';

            return (
              <div
                key={collection.id}
                className={`border-b py-4 px-3 hover:bg-slate-50 transition-colors ${
                  isSelected
                    ? 'bg-brand-primary-lighter'
                    : isInactiveHost
                      ? 'bg-gray-50 opacity-70'
                      : ''
                }`}
              >
                {/* Single horizontal row layout */}
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  {(canEditAllCollections ||
                    canEditCollection(user, collection)) && (
                    <button
                      onClick={() =>
                        handleSelectCollection(collection.id, !isSelected)
                      }
                      className="flex items-center shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-brand-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  )}

                  {/* Date - American format (Oct 1, 2025) */}
                  <div className="w-32 shrink-0">
                    <span className="text-base font-semibold text-slate-700">
                      {formatDate(collection.collectionDate)}
                    </span>
                  </div>

                  {/* Location/Host */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-slate-900 break-words">
                        {collection.hostName}
                      </span>
                      {collection.hostName === 'OG Sandwich Project' && (
                        <span className="text-xs bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 px-2 py-1 rounded-full font-medium border border-amber-300 shrink-0">
                          👑
                        </span>
                      )}
                      {isInactiveHost && (
                        <span className="text-xs bg-gray-300 text-gray-800 px-2 py-1 rounded-full font-medium shrink-0">
                          INACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Individual - with inline type breakdown when available */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-0.5">Individual</div>
                    <div className="text-base">
                      {(() => {
                        const hasTypes = collection.individualDeli || collection.individualTurkey || collection.individualHam || collection.individualPbj;
                        if (hasTypes) {
                          const types = [];
                          if (collection.individualTurkey) types.push(`${collection.individualTurkey} Turkey`);
                          if (collection.individualHam) types.push(`${collection.individualHam} Ham`);
                          if (collection.individualDeli) types.push(`${collection.individualDeli} Deli`);
                          if (collection.individualPbj) types.push(`${collection.individualPbj} PB&J`);
                          return <span>{types.join(', ')}</span>;
                        }
                        return <span className="font-bold">{collection.individualSandwiches}</span>;
                      })()}
                    </div>
                  </div>

                  {/* Groups - inline breakdown when available */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-0.5">Groups</div>
                    <div className="text-base">
                      {(() => {
                        if (groupData.length === 0) {
                          return <span className="font-bold">0</span>;
                        }
                        if (groupData.length === 1) {
                          const group = groupData[0];
                          const hasTypes = group.deli || group.turkey || group.ham || group.pbj;
                          if (hasTypes) {
                            const types = [];
                            if (group.turkey) types.push(`${group.turkey} Turkey`);
                            if (group.ham) types.push(`${group.ham} Ham`);
                            if (group.deli) types.push(`${group.deli} Deli`);
                            if (group.pbj) types.push(`${group.pbj} PB&J`);
                            return <span>{group.groupName}: {types.join(', ')}</span>;
                          }
                          return <span className="font-bold">{group.sandwichCount} <span className="font-normal">({group.groupName})</span></span>;
                        }
                        // Multiple groups - just show total
                        return <span className="font-bold">{calculateGroupTotal(collection)}</span>;
                      })()}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="w-20 shrink-0 text-right">
                    <div className="text-xs text-slate-500 mb-0.5">Total</div>
                    <div className="text-2xl font-bold">{totalSandwiches}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {collection.createdBy &&
                      collection.createdByName &&
                      hasPermission(user, PERMISSIONS.SEND_KUDOS) && (
                        <SendKudosButton
                          recipientId={collection.createdBy}
                          recipientName={collection.createdByName}
                          contextType="task"
                          contextId={collection.id.toString()}
                          contextTitle={`${totalSandwiches} sandwiches from ${collection.hostName}`}
                          size="sm"
                          variant="outline"
                          iconOnly={true}
                          className="h-8 w-8 p-0 bg-white border-gray-300 hover:bg-gray-50 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        />
                      )}
                    {canEditCollection(user, collection) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(collection)}
                        className="h-8 w-8 p-0 bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteCollection(user, collection) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(collection.id)}
                        className="h-8 w-8 p-0 text-gray-600 hover:text-[#A31C41] hover:bg-red-50 bg-white border-gray-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Submission info - small text at bottom */}
                <div className="mt-2 ml-11 text-sm text-slate-500">
                  Submitted {formatSubmittedAt(collection.submittedAt)}
                  {collection.createdByName && (
                    <span className="ml-1 font-medium">
                      by {collection.createdByName}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {collections.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No collection entries found. Use the form above to record sandwich
              collections.
            </div>
          )}

          {collections.length > 0 && filteredCollections.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No entries match the current filters. Try adjusting your search
              criteria.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Pagination Controls */}
      {totalItems > 0 && <PaginationControls position="bottom" />}

      {/* Duplicate Analysis Modal */}
      <Dialog
        open={showDuplicateAnalysis}
        onOpenChange={setShowDuplicateAnalysis}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
              Duplicate Analysis Results
            </DialogTitle>
          </DialogHeader>
          {duplicateAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">
                    {duplicateAnalysis.totalCollections}
                  </div>
                  <div className="text-base text-slate-600">
                    Total Collections
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {duplicateAnalysis.totalDuplicateEntries}
                  </div>
                  <div className="text-base text-slate-600">
                    Duplicate Entries
                  </div>
                </div>
              </div>

              {duplicateAnalysis.totalDuplicateEntries > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">
                      Exact Duplicates (
                      {duplicateAnalysis.totalDuplicateEntries})
                    </h3>
                  </div>
                  <div className="text-base text-slate-600 mb-2">
                    Use radio buttons to select which entry to keep in each
                    duplicate group. All other entries will be deleted.
                  </div>
                  <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                    <div className="space-y-3 p-3">
                      {duplicateAnalysis.duplicates.map((group, groupIndex) => (
                        <div
                          key={groupIndex}
                          className="border border-slate-100 rounded-lg p-3 bg-slate-50"
                        >
                          {/* Duplicate Info Header */}
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span className="font-semibold text-blue-900">
                                  {new Date(
                                    group.duplicateInfo.collectionDate
                                  ).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                              <span className="text-base font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                {group.count} duplicate
                                {group.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-base">
                              <div>
                                <div className="text-sm text-blue-600 font-medium mb-1">
                                  Group Names
                                </div>
                                <div className="text-blue-900 font-medium">
                                  {group.duplicateInfo.groupNames ||
                                    'No groups'}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-blue-600 font-medium mb-1">
                                  Sandwich Counts
                                </div>
                                <div className="text-blue-900 font-medium">
                                  {group.duplicateInfo.individualSandwiches}{' '}
                                  individual,{' '}
                                  {group.duplicateInfo.totalSandwiches} total
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Show ALL entries with radio buttons to select which to keep */}
                          <div className="space-y-2">
                            <div className="text-sm font-bold text-slate-700 mb-2 uppercase">
                              Select which entry to keep:
                            </div>
                            <RadioGroup
                              value={
                                selectedKeepIds.get(groupIndex)?.toString() ||
                                group.keepNewest.id.toString()
                              }
                              onValueChange={(value) => {
                                const newMap = new Map(selectedKeepIds);
                                newMap.set(groupIndex, parseInt(value));
                                setSelectedKeepIds(newMap);
                              }}
                            >
                              {/* Combine all entries (keepNewest + toDelete) into one list */}
                              {[group.keepNewest, ...group.toDelete].map(
                                (entry) => {
                                  const isSelected =
                                    selectedKeepIds.get(groupIndex) ===
                                    entry.id;
                                  return (
                                    <div
                                      key={entry.id}
                                      className={`flex items-start space-x-3 p-3 border-2 rounded-lg transition-colors ${
                                        isSelected
                                          ? 'bg-green-50 border-green-400 shadow-sm'
                                          : 'bg-white border-slate-200 hover:border-slate-300'
                                      }`}
                                      data-testid={`entry-${entry.id}`}
                                    >
                                      <div className="flex items-start pt-1">
                                        <RadioGroupItem
                                          value={entry.id.toString()}
                                          id={`entry-${groupIndex}-${entry.id}`}
                                          className="mt-0.5"
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center space-x-2">
                                            {isSelected && (
                                              <span className="text-sm font-bold text-green-700 uppercase bg-green-200 px-2 py-1 rounded">
                                                ✓ Keeping
                                              </span>
                                            )}
                                            <span
                                              className={`text-sm font-medium ${isSelected ? 'text-green-600' : 'text-slate-500'}`}
                                            >
                                              ID: {entry.id}
                                            </span>
                                          </div>
                                          <div
                                            className={`text-base font-medium ${isSelected ? 'text-green-700' : 'text-slate-600'}`}
                                          >
                                            <User className="w-4 h-4 inline mr-1" />
                                            {entry.createdBy}
                                          </div>
                                        </div>

                                        {/* Group Names Display */}
                                        {entry.groupNames && (
                                          <div
                                            className={`mb-2 p-2 border rounded ${
                                              isSelected
                                                ? 'bg-green-100 border-green-300'
                                                : 'bg-slate-50 border-slate-200'
                                            }`}
                                          >
                                            <div className="flex items-center space-x-2">
                                              <Users
                                                className={`w-4 h-4 ${isSelected ? 'text-green-700' : 'text-slate-600'}`}
                                              />
                                              <div>
                                                <div
                                                  className={`text-sm font-medium ${isSelected ? 'text-green-600' : 'text-slate-500'}`}
                                                >
                                                  Groups
                                                </div>
                                                <div
                                                  className={`text-base font-semibold ${isSelected ? 'text-green-900' : 'text-slate-700'}`}
                                                >
                                                  {entry.groupNames}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between text-base mb-2">
                                          <div className="flex items-center space-x-3">
                                            <span
                                              className={
                                                isSelected
                                                  ? 'text-slate-700'
                                                  : 'text-slate-600'
                                              }
                                            >
                                              <Sandwich className="w-3 h-3 inline mr-1" />
                                              {entry.individualSandwiches}{' '}
                                              individual
                                            </span>
                                          </div>
                                          <span
                                            className={`font-bold px-2 py-1 rounded ${
                                              isSelected
                                                ? 'text-green-900 bg-green-100'
                                                : 'text-slate-900 bg-slate-100'
                                            }`}
                                          >
                                            {entry.totalSandwiches} total
                                          </span>
                                        </div>

                                        <div
                                          className={`text-sm ${isSelected ? 'text-green-600' : 'text-slate-500'}`}
                                        >
                                          <Calendar className="w-3 h-3 inline mr-1" />
                                          Submitted:{' '}
                                          {new Date(
                                            entry.submittedAt
                                          ).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </RadioGroup>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {duplicateAnalysis.duplicates.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-base text-blue-800">
                        {(() => {
                          const totalEntriesToDelete =
                            duplicateAnalysis.duplicates.reduce(
                              (sum, group, index) => {
                                const keepId =
                                  selectedKeepIds.get(index) ||
                                  group.keepNewest.id;
                                const allIds = [
                                  group.keepNewest,
                                  ...group.toDelete,
                                ].map((e) => e.id);
                                return (
                                  sum +
                                  allIds.filter((id) => id !== keepId).length
                                );
                              },
                              0
                            );
                          return `${totalEntriesToDelete} duplicate entr${totalEntriesToDelete === 1 ? 'y' : 'ies'} will be deleted (keeping ${duplicateAnalysis.duplicates.length} selected entr${duplicateAnalysis.duplicates.length === 1 ? 'y' : 'ies'})`;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {duplicateAnalysis.suspiciousPatterns > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">
                      Suspicious Patterns (
                      {duplicateAnalysis.suspiciousPatterns})
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allIds = new Set(
                            duplicateAnalysis.suspiciousEntries.map(
                              (entry) => entry.id
                            )
                          );
                          setSelectedSuspiciousIds(
                            selectedSuspiciousIds.size === allIds.size
                              ? new Set()
                              : allIds
                          );
                        }}
                        className="text-sm"
                      >
                        {selectedSuspiciousIds.size ===
                        duplicateAnalysis.suspiciousEntries.length
                          ? 'Deselect All'
                          : 'Select All'}
                      </Button>
                    </div>
                  </div>
                  <div className="text-base text-slate-600 mb-2">
                    Review and select specific entries to delete. These entries
                    have problematic host names or data entry errors.
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                    <div className="space-y-1 p-2">
                      {duplicateAnalysis.suspiciousEntries.map((entry) => {
                        const groupData = getGroupCollections(entry);
                        const totalSandwiches = calculateTotal(entry);
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center space-x-3 p-2 border border-slate-100 rounded hover:bg-slate-50"
                          >
                            <Checkbox
                              id={`suspicious-${entry.id}`}
                              checked={selectedSuspiciousIds.has(entry.id)}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(selectedSuspiciousIds);
                                if (checked) {
                                  newSet.add(entry.id);
                                } else {
                                  newSet.delete(entry.id);
                                }
                                setSelectedSuspiciousIds(newSet);
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-base">
                                    "{entry.hostName || 'No Host'}"
                                  </span>
                                  <span className="text-sm text-slate-500">
                                    ID: {entry.id}
                                  </span>
                                </div>
                                <div className="text-base font-medium text-slate-900">
                                  {totalSandwiches} sandwiches
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-sm text-slate-600 mt-1">
                                <div>
                                  <Calendar className="w-3 h-3 inline mr-1" />
                                  {entry.collectionDate || 'No Date'}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span>
                                    {entry.individualSandwiches} individual
                                  </span>
                                  {groupData.length > 0 && (
                                    <span>
                                      {groupData.reduce(
                                        (sum: number, g: any) =>
                                          sum + (Number(g.sandwichCount) || 0),
                                        0
                                      )}{' '}
                                      group
                                    </span>
                                  )}
                                </div>
                              </div>
                              {groupData.length > 0 && (
                                <div className="text-sm text-slate-500 mt-1">
                                  Groups:{' '}
                                  {groupData
                                    .map(
                                      (g: any) =>
                                        `${g.groupName || g.name}: ${g.sandwichCount || g.count}`
                                    )
                                    .join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {selectedSuspiciousIds.size > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-base text-amber-800">
                        {selectedSuspiciousIds.size} entr
                        {selectedSuspiciousIds.size === 1 ? 'y' : 'ies'}{' '}
                        selected for deletion
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDuplicateAnalysis(false);
                    setSelectedSuspiciousIds(new Set());
                    setSelectedDuplicateIds(new Set());
                    setSelectedKeepIds(new Map());
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                {duplicateAnalysis.duplicates.length > 0 && (
                  <Button
                    onClick={() => {
                      const idsToDelete: number[] = [];
                      duplicateAnalysis.duplicates.forEach((group, index) => {
                        const keepId =
                          selectedKeepIds.get(index) || group.keepNewest.id;
                        const allIds = [
                          group.keepNewest,
                          ...group.toDelete,
                        ].map((e) => e.id);
                        allIds.forEach((id) => {
                          if (id !== keepId) {
                            idsToDelete.push(id);
                          }
                        });
                      });
                      if (idsToDelete.length > 0) {
                        cleanSelectedSuspiciousMutation.mutate(idsToDelete);
                      }
                    }}
                    disabled={cleanSelectedSuspiciousMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                  >
                    {cleanSelectedSuspiciousMutation.isPending
                      ? 'Deleting...'
                      : (() => {
                          const totalToDelete =
                            duplicateAnalysis.duplicates.reduce(
                              (sum, group, index) => {
                                const keepId =
                                  selectedKeepIds.get(index) ||
                                  group.keepNewest.id;
                                const allIds = [
                                  group.keepNewest,
                                  ...group.toDelete,
                                ].map((e) => e.id);
                                return (
                                  sum +
                                  allIds.filter((id) => id !== keepId).length
                                );
                              },
                              0
                            );
                          return `Delete Duplicates (${totalToDelete})`;
                        })()}
                  </Button>
                )}
                {selectedSuspiciousIds.size > 0 && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      cleanSelectedSuspiciousMutation.mutate(
                        Array.from(selectedSuspiciousIds)
                      )
                    }
                    disabled={cleanSelectedSuspiciousMutation.isPending}
                    className="text-red-600 hover:text-red-700 border-red-300 w-full sm:w-auto"
                  >
                    {cleanSelectedSuspiciousMutation.isPending
                      ? 'Deleting...'
                      : `Delete Selected Suspicious (${selectedSuspiciousIds.size})`}
                  </Button>
                )}
                {duplicateAnalysis.suspiciousPatterns > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => cleanDuplicatesMutation.mutate('suspicious')}
                    disabled={cleanDuplicatesMutation.isPending}
                    className="text-amber-600 hover:text-amber-700 border-amber-300 w-full sm:w-auto"
                  >
                    {cleanDuplicatesMutation.isPending
                      ? 'Cleaning...'
                      : `Delete All Suspicious (${duplicateAnalysis.suspiciousPatterns})`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        open={!!editingCollection}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCollection(null);
            setShowEditIndividualBreakdown(false);
            setShowEditGroupBreakdown(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-date">Collection Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editFormData.collectionDate}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    collectionDate: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="edit-host">Host Name</Label>
              <Select
                value={editFormData.hostName}
                onValueChange={(value) =>
                  setEditFormData({ ...editFormData, hostName: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  {hostOptions.map((host, index) => (
                    <SelectItem key={`edit-host-${index}-${host}`} value={host}>
                      {host}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-individual">Individual Sandwiches</Label>
              {!showEditIndividualBreakdown ? (
                <Input
                  id="edit-individual"
                  type="number"
                  min="0"
                  value={editFormData.individualSandwiches}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      individualSandwiches: e.target.value,
                    })
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label htmlFor="edit-deli" className="text-sm">Deli</Label>
                    <Input
                      id="edit-deli"
                      type="number"
                      min="0"
                      value={editFormData.individualDeli}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditFormData({
                          ...editFormData,
                          individualDeli: value,
                          individualSandwiches: (
                            (parseInt(value) || 0) +
                            (parseInt(editFormData.individualTurkey) || 0) +
                            (parseInt(editFormData.individualHam) || 0) +
                            (parseInt(editFormData.individualPbj) || 0)
                          ).toString(),
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-turkey" className="text-sm">Turkey</Label>
                    <Input
                      id="edit-turkey"
                      type="number"
                      min="0"
                      value={editFormData.individualTurkey}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditFormData({
                          ...editFormData,
                          individualTurkey: value,
                          individualSandwiches: (
                            (parseInt(editFormData.individualDeli) || 0) +
                            (parseInt(value) || 0) +
                            (parseInt(editFormData.individualHam) || 0) +
                            (parseInt(editFormData.individualPbj) || 0)
                          ).toString(),
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-ham" className="text-sm">Ham</Label>
                    <Input
                      id="edit-ham"
                      type="number"
                      min="0"
                      value={editFormData.individualHam}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditFormData({
                          ...editFormData,
                          individualHam: value,
                          individualSandwiches: (
                            (parseInt(editFormData.individualDeli) || 0) +
                            (parseInt(editFormData.individualTurkey) || 0) +
                            (parseInt(value) || 0) +
                            (parseInt(editFormData.individualPbj) || 0)
                          ).toString(),
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-pbj" className="text-sm">PBJ</Label>
                    <Input
                      id="edit-pbj"
                      type="number"
                      min="0"
                      value={editFormData.individualPbj}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditFormData({
                          ...editFormData,
                          individualPbj: value,
                          individualSandwiches: (
                            (parseInt(editFormData.individualDeli) || 0) +
                            (parseInt(editFormData.individualTurkey) || 0) +
                            (parseInt(editFormData.individualHam) || 0) +
                            (parseInt(value) || 0)
                          ).toString(),
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
              
              {/* Toggle for individual sandwich type breakdown */}
              <div className="mt-3">
                <div className={`border rounded-lg p-3 ${showEditIndividualBreakdown ? 'bg-brand-primary-lighter border-brand-primary' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-individual-breakdown"
                      checked={showEditIndividualBreakdown}
                      onChange={(e) => {
                        setShowEditIndividualBreakdown(e.target.checked);
                        if (!e.target.checked) {
                          // Clear breakdown when hiding
                          setEditFormData({
                            ...editFormData,
                            individualDeli: '',
                            individualTurkey: '',
                            individualHam: '',
                            individualPbj: '',
                          });
                        }
                      }}
                      className="w-4 h-4 text-brand-primary focus:ring-brand-primary"
                    />
                    <label htmlFor="edit-individual-breakdown" className="text-sm font-medium cursor-pointer">
                      Specify sandwich types (Deli/Turkey/Ham/PBJ)
                    </label>
                  </div>
                </div>
              </div>

              {/* Validation Status for Individual Breakdown */}
              {showEditIndividualBreakdown && (
                <div className="mt-2">
                  {(() => {
                    const individualDeli = parseInt(editFormData.individualDeli) || 0;
                    const individualTurkey = parseInt(editFormData.individualTurkey) || 0;
                    const individualHam = parseInt(editFormData.individualHam) || 0;
                    const individualPbj = parseInt(editFormData.individualPbj) || 0;
                    const individualSandwiches = parseInt(editFormData.individualSandwiches) || 0;
                    const breakdownSum = individualDeli + individualTurkey + individualHam + individualPbj;
                    const hasAnyValue = individualDeli > 0 || individualTurkey > 0 || individualHam > 0 || individualPbj > 0;
                    
                    if (!hasAnyValue) {
                      return null;
                    }

                    const isValid = breakdownSum === individualSandwiches;
                    
                    return (
                      <div className={`border rounded-lg p-3 ${isValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                        <div className="flex items-center gap-2">
                          {isValid ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              Breakdown Total: {breakdownSum} / Expected: {individualSandwiches}
                            </div>
                            {!isValid && (
                              <div className="text-xs text-red-600 mt-1">
                                {editIndividualBreakdownError}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <Label>Group Collections</Label>

              <div className="space-y-3 mt-2">
                {editGroupCollections.map((group) => (
                  <div key={group.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex gap-3 items-center">
                      <Input
                        placeholder="Group name"
                        value={group.groupName || ''}
                        onChange={(e) =>
                          updateEditGroupCollection(
                            group.id,
                            'groupName',
                            e.target.value
                          )
                        }
                        className="flex-1"
                        required
                      />
                      {!group.hasTypeBreakdown && (
                        <Input
                          type="number"
                          min="0"
                          placeholder="Count"
                          value={(() => {
                            const groupCount = group.count || group.sandwichCount || 0;
                            return groupCount === 0 ? '' : groupCount.toString();
                          })()}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || value === '0') {
                              updateEditGroupCollection(
                                group.id,
                                'sandwichCount',
                                0
                              );
                            } else {
                              updateEditGroupCollection(
                                group.id,
                                'sandwichCount',
                                parseInt(value) || 0
                              );
                            }
                          }}
                          onFocus={(e) => {
                            if (e.target.value === '0') {
                              e.target.value = '';
                            }
                          }}
                          className="w-24"
                        />
                      )}
                      
                      {/* Individual toggle for this group's type breakdown */}
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id={`group-${group.id}-breakdown`}
                          checked={group.hasTypeBreakdown || false}
                          onChange={(e) => {
                            const updatedGroup = {
                              ...group,
                              hasTypeBreakdown: e.target.checked,
                            };
                            if (!e.target.checked) {
                              // Clear type data when disabling
                              updatedGroup.deli = undefined;
                              updatedGroup.turkey = undefined;
                              updatedGroup.ham = undefined;
                              updatedGroup.pbj = undefined;
                            }
                            setEditGroupCollections(
                              editGroupCollections.map((g) =>
                                g.id === group.id ? updatedGroup : g
                              )
                            );
                          }}
                          className="w-4 h-4 text-brand-primary focus:ring-brand-primary"
                          title="Show sandwich types for this group"
                        />
                        <label 
                          htmlFor={`group-${group.id}-breakdown`} 
                          className="text-xs text-slate-600 cursor-pointer whitespace-nowrap"
                          title="Show sandwich types for this group"
                        >
                          Types
                        </label>
                      </div>
                      
                      {editGroupCollections.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeEditGroupRow(group.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Type breakdown fields for group when enabled */}
                    {group.hasTypeBreakdown && (
                      <>
                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded">
                          <div>
                            <Label className="text-xs">Deli</Label>
                            <Input
                              type="number"
                              min="0"
                              value={group.deli || ''}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                const updatedGroup = {
                                  ...group,
                                  deli: value,
                                  sandwichCount: value + (group.turkey || 0) + (group.ham || 0) + (group.pbj || 0),
                                };
                                setEditGroupCollections(
                                  editGroupCollections.map((g) =>
                                    g.id === group.id ? updatedGroup : g
                                  )
                                );
                              }}
                              placeholder="0"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Turkey</Label>
                            <Input
                              type="number"
                              min="0"
                              value={group.turkey || ''}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                const updatedGroup = {
                                  ...group,
                                  turkey: value,
                                  sandwichCount: (group.deli || 0) + value + (group.ham || 0) + (group.pbj || 0),
                                };
                                setEditGroupCollections(
                                  editGroupCollections.map((g) =>
                                    g.id === group.id ? updatedGroup : g
                                  )
                                );
                              }}
                              placeholder="0"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Ham</Label>
                            <Input
                              type="number"
                              min="0"
                              value={group.ham || ''}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                const updatedGroup = {
                                  ...group,
                                  ham: value,
                                  sandwichCount: (group.deli || 0) + (group.turkey || 0) + value + (group.pbj || 0),
                                };
                                setEditGroupCollections(
                                  editGroupCollections.map((g) =>
                                    g.id === group.id ? updatedGroup : g
                                  )
                                );
                              }}
                              placeholder="0"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">PBJ</Label>
                            <Input
                              type="number"
                              min="0"
                              value={group.pbj || ''}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                const updatedGroup = {
                                  ...group,
                                  pbj: value,
                                  sandwichCount: (group.deli || 0) + (group.turkey || 0) + (group.ham || 0) + value,
                                };
                                setEditGroupCollections(
                                  editGroupCollections.map((g) =>
                                    g.id === group.id ? updatedGroup : g
                                  )
                                );
                              }}
                              placeholder="0"
                              className="h-8"
                            />
                          </div>
                        </div>
                        
                        {/* Validation Status for Group Breakdown */}
                        {(() => {
                          const deli = group.deli || 0;
                          const turkey = group.turkey || 0;
                          const ham = group.ham || 0;
                          const pbj = group.pbj || 0;
                          const breakdownSum = deli + turkey + ham + pbj;
                          const hasAnyValue = deli > 0 || turkey > 0 || ham > 0 || pbj > 0;
                          
                          if (!hasAnyValue) {
                            return null;
                          }

                          const groupCount = group.count || group.sandwichCount || 0;
                          const isValid = breakdownSum === groupCount;
                          const errorMsg = editGroupBreakdownErrors.get(group.id);
                          
                          return (
                            <div className={`border rounded-lg p-2 mt-2 ${isValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                              <div className="flex items-center gap-2">
                                {isValid ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                )}
                                <div className="flex-1">
                                  <div className="text-xs font-medium">
                                    Breakdown Total: {breakdownSum} / Expected: {groupCount}
                                  </div>
                                  {!isValid && errorMsg && (
                                    <div className="text-xs text-red-600 mt-1">
                                      {errorMsg}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ))}

                {/* Add Another Group Button - Below existing group rows */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEditGroupRow}
                >
                  ➕ Add Another Group
                </Button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingCollection(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending || editIndividualBreakdownError !== '' || editGroupBreakdownErrors.size > 0}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Collection'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Edit Modal */}
      <Dialog open={showBatchEdit} onOpenChange={setShowBatchEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Edit Collections</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-base text-slate-600">
              Editing {selectedCollections.size} selected collections. Leave
              fields empty to keep existing values.
            </p>

            <div>
              <Label htmlFor="batch-date">Collection Date</Label>
              <Input
                id="batch-date"
                type="date"
                value={batchEditData.collectionDate}
                onChange={(e) =>
                  setBatchEditData({
                    ...batchEditData,
                    collectionDate: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="batch-host">Host Name</Label>
              <Select
                value={batchEditData.hostName}
                onValueChange={(value) =>
                  setBatchEditData({ ...batchEditData, hostName: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select host (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {hostOptions.map((host, index) => (
                    <SelectItem
                      key={`batch-host-${index}-${host}`}
                      value={host}
                    >
                      {host}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowBatchEdit(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitBatchEdit}
                disabled={batchEditMutation.isPending}
              >
                {batchEditMutation.isPending
                  ? 'Updating...'
                  : 'Update Collections'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Management Dialog */}
      <Dialog open={showDataManagement} onOpenChange={setShowDataManagement}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Data Management Center</DialogTitle>
          </DialogHeader>
          <BulkDataManager
            onExportCSV={exportToCSV}
            onImportCSV={() => fileInputRef.current?.click()}
            onCheckDuplicates={() => analyzeDuplicatesMutation.mutate()}
            onCleanOGDuplicates={() =>
              cleanDuplicatesMutation.mutate('og-duplicates')
            }
          />
        </DialogContent>
      </Dialog>

      {/* Quick Help Button */}
    </div>
  );
}
