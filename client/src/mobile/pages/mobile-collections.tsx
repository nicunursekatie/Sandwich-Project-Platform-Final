import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  ChevronRight,
  Sandwich,
  MapPin,
  Clock,
  User,
  Check,
  Calendar,
} from 'lucide-react';
import { MobileShell } from '../components/mobile-shell';
import { cn } from '@/lib/utils';
import { format, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

type DateFilter = 'today' | 'week' | 'month' | 'all';

/**
 * Mobile collections screen - view and log collections
 */
export function MobileCollections() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // Fetch recent collections
  const { data: collections, isLoading } = useQuery({
    queryKey: ['/api/collections', { limit: 100 }],
    staleTime: 30000,
  });

  // Filter collections based on search and date filter
  const filteredCollections = collections?.filter((c: any) => {
    // Search filter
    const matchesSearch = !searchQuery ||
      c.hostName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.driverName?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Date filter
    if (dateFilter === 'all') return true;
    if (!c.date) return false;

    const collectionDate = typeof c.date === 'string' ? parseISO(c.date) : new Date(c.date);

    switch (dateFilter) {
      case 'today':
        return isToday(collectionDate);
      case 'week':
        return isThisWeek(collectionDate);
      case 'month':
        return isThisMonth(collectionDate);
      default:
        return true;
    }
  }) || [];

  return (
    <MobileShell title="Collections" showNav>
      <div className="flex flex-col h-full">
        {/* Search and filter bar */}
        <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 p-4 space-y-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-3 rounded-xl",
                  "bg-white dark:bg-slate-800",
                  "border border-slate-200 dark:border-slate-700",
                  "text-slate-900 dark:text-slate-100",
                  "placeholder:text-slate-400",
                  "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                )}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3 rounded-xl border",
                showFilters
                  ? "bg-brand-primary border-brand-primary text-white"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Quick date filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {([
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ] as const).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
                  "transition-colors",
                  dateFilter === filter.id
                    ? "bg-brand-primary text-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Collections list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            ))
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-12">
              <Sandwich className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400">No collections found</p>
              <button
                onClick={() => navigate('/m/collections/new')}
                className="mt-4 px-6 py-2 bg-brand-primary text-white rounded-full font-medium"
              >
                Log a Collection
              </button>
            </div>
          ) : (
            filteredCollections.map((collection: any) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onClick={() => navigate(`/m/collections/${collection.id}`)}
              />
            ))
          )}
        </div>

        {/* Floating action button */}
        <button
          onClick={() => navigate('/m/collections/new')}
          className={cn(
            "fixed right-4 bottom-20 z-40",
            "w-14 h-14 rounded-full",
            "bg-brand-primary text-white shadow-lg",
            "flex items-center justify-center",
            "active:scale-95 transition-transform"
          )}
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Log new collection"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </MobileShell>
  );
}

function CollectionCard({
  collection,
  onClick,
}: {
  collection: any;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full bg-white dark:bg-slate-800 rounded-xl p-4",
        "border border-slate-200 dark:border-slate-700 shadow-sm",
        "text-left active:scale-[0.99] transition-transform"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Host name */}
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
              {collection.hostName || 'Unknown Host'}
            </span>
          </div>

          {/* Driver and count */}
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span>{collection.driverName || 'Unassigned'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Sandwich className="w-3.5 h-3.5" />
              <span>{collection.count || 0} sandwiches</span>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>
              {collection.date
                ? format(new Date(collection.date), 'MMM d, yyyy')
                : 'No date'}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {collection.verified && (
            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          )}
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </button>
  );
}

export default MobileCollections;
