import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// TrackedCalendarItem type (matches schema)
interface TrackedCalendarItem {
  id: number;
  externalId: string | null;
  category: string;
  title: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  metadata: {
    type?: string;
    districts?: string[];
    academicYear?: string | null;
  };
}

// YearlyCalendarItem type (TSP planning items)
interface YearlyCalendarItem {
  id: number;
  month: number;
  year: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  isCompleted: boolean;
}

interface MonthlyCalendarGridProps {
  year: number;
  month: number; // 1-12
  trackedItems: TrackedCalendarItem[];
  yearlyItems?: YearlyCalendarItem[]; // Optional TSP calendar items
  onMonthChange?: (year: number, month: number) => void;
  onClose?: () => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// District-specific colors for visual differentiation
const DISTRICT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'CCS': { bg: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-400' },
  'Columbus City': { bg: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-400' },
  'Westerville': { bg: 'bg-purple-200', text: 'text-purple-900', border: 'border-purple-400' },
  'Worthington': { bg: 'bg-green-200', text: 'text-green-900', border: 'border-green-400' },
  'Dublin': { bg: 'bg-orange-200', text: 'text-orange-900', border: 'border-orange-400' },
  'Hilliard': { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' },
  'Upper Arlington': { bg: 'bg-cyan-200', text: 'text-cyan-900', border: 'border-cyan-400' },
  'Grandview': { bg: 'bg-teal-200', text: 'text-teal-900', border: 'border-teal-400' },
  'Bexley': { bg: 'bg-indigo-200', text: 'text-indigo-900', border: 'border-indigo-400' },
  'Gahanna': { bg: 'bg-rose-200', text: 'text-rose-900', border: 'border-rose-400' },
  'New Albany': { bg: 'bg-lime-200', text: 'text-lime-900', border: 'border-lime-400' },
  'South-Western': { bg: 'bg-amber-300', text: 'text-amber-900', border: 'border-amber-500' },
  'Groveport': { bg: 'bg-fuchsia-200', text: 'text-fuchsia-900', border: 'border-fuchsia-400' },
  'Canal Winchester': { bg: 'bg-sky-200', text: 'text-sky-900', border: 'border-sky-400' },
  'Reynoldsburg': { bg: 'bg-violet-200', text: 'text-violet-900', border: 'border-violet-400' },
  'All': { bg: 'bg-amber-200', text: 'text-amber-900', border: 'border-amber-400' },
  'default': { bg: 'bg-gray-200', text: 'text-gray-900', border: 'border-gray-400' },
};

// Category colors for tracked items and TSP calendar items
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Tracked calendar categories
  school_breaks: { bg: 'bg-amber-200', text: 'text-amber-900', border: 'border-amber-400' },
  school_markers: { bg: 'bg-emerald-200', text: 'text-emerald-900', border: 'border-emerald-400' },
  holiday: { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' },
  // TSP calendar item categories
  preparation: { bg: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-400' },
  'event-rush': { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' },
  staffing: { bg: 'bg-orange-200', text: 'text-orange-900', border: 'border-orange-400' },
  board: { bg: 'bg-purple-200', text: 'text-purple-900', border: 'border-purple-400' },
  seasonal: { bg: 'bg-green-200', text: 'text-green-900', border: 'border-green-400' },
  other: { bg: 'bg-gray-200', text: 'text-gray-900', border: 'border-gray-400' },
  default: { bg: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-400' },
};

// Safe date parsing (avoid timezone issues)
function parseDateSafe(dateStr: string): Date {
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  return new Date(`${dateStr}T12:00:00`);
}

// Get the days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Get what day of week the month starts on (0 = Sunday)
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

// Calculate which days a date range spans within a specific month
function getDateRangeInMonth(
  startDate: string,
  endDate: string,
  year: number,
  month: number
): { startDay: number; endDay: number; extendsBeforeMonth: boolean; extendsAfterMonth: boolean } | null {
  const rangeStart = parseDateSafe(startDate);
  const rangeEnd = parseDateSafe(endDate);
  const monthStart = new Date(year, month - 1, 1);
  const daysInMonth = getDaysInMonth(year, month);
  const monthEnd = new Date(year, month - 1, daysInMonth);

  // Check if range overlaps with month at all
  if (rangeStart > monthEnd || rangeEnd < monthStart) {
    return null;
  }

  // Calculate effective start/end days within the month
  let startDay: number;
  let endDay: number;
  let extendsBeforeMonth = false;
  let extendsAfterMonth = false;

  if (rangeStart < monthStart) {
    startDay = 1;
    extendsBeforeMonth = true;
  } else {
    startDay = rangeStart.getDate();
  }

  if (rangeEnd > monthEnd) {
    endDay = daysInMonth;
    extendsAfterMonth = true;
  } else {
    endDay = rangeEnd.getDate();
  }

  return { startDay, endDay, extendsBeforeMonth, extendsAfterMonth };
}

// Format date for display
function formatDateShort(dateStr: string): string {
  const date = parseDateSafe(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get color for an item based on its district(s)
function getItemColor(item: TrackedCalendarItem): { bg: string; text: string; border: string } {
  const districts = item.metadata?.districts || [];

  // If multiple districts or "All", use amber
  if (districts.length > 1 || districts.includes('All')) {
    return DISTRICT_COLORS['All'];
  }

  // Single district - use district-specific color
  if (districts.length === 1) {
    return DISTRICT_COLORS[districts[0]] || DISTRICT_COLORS['default'];
  }

  // Fallback to category color
  return CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
}

// Get display label for an item (district name or abbreviated)
function getItemLabel(item: TrackedCalendarItem): string {
  const districts = item.metadata?.districts || [];

  if (districts.length === 0) {
    return item.title;
  }

  if (districts.length === 1) {
    // Abbreviate long district names
    const district = districts[0];
    if (district === 'Columbus City' || district === 'CCS') return 'CCS';
    if (district === 'Upper Arlington') return 'UA';
    if (district === 'South-Western') return 'SW';
    if (district === 'Canal Winchester') return 'CW';
    if (district === 'New Albany') return 'NA';
    return district;
  }

  if (districts.includes('All')) {
    return 'All Districts';
  }

  return `${districts.length} Districts`;
}

// Unified calendar item for display (combines tracked and yearly items)
interface UnifiedCalendarItem {
  id: string; // Prefixed to avoid collisions
  type: 'tracked' | 'yearly';
  title: string;
  startDate: string;
  endDate: string;
  category: string;
  colors: { bg: string; text: string; border: string };
  label: string;
  // Tracked item specific
  districts?: string[];
  notes?: string | null;
  // Yearly item specific
  description?: string | null;
  priority?: string;
  isCompleted?: boolean;
}

export function MonthlyCalendarGrid({
  year,
  month,
  trackedItems,
  yearlyItems = [],
  onMonthChange,
  onClose,
}: MonthlyCalendarGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);

  // Calculate weeks needed (including partial weeks)
  const totalCells = firstDayOfWeek + daysInMonth;
  const weeksNeeded = Math.ceil(totalCells / 7);

  // Combine and filter tracked items and yearly items that have dates
  const allItems = useMemo((): UnifiedCalendarItem[] => {
    const items: UnifiedCalendarItem[] = [];

    // Process tracked items
    trackedItems.forEach(item => {
      const range = getDateRangeInMonth(item.startDate, item.endDate, year, month);
      if (range) {
        items.push({
          id: `tracked-${item.id}`,
          type: 'tracked',
          title: item.title,
          startDate: item.startDate,
          endDate: item.endDate,
          category: item.category,
          colors: getItemColor(item),
          label: getItemLabel(item),
          districts: item.metadata?.districts,
          notes: item.notes,
        });
      }
    });

    // Process yearly items that have dates
    yearlyItems.forEach(item => {
      if (item.startDate) {
        const endDate = item.endDate || item.startDate;
        const range = getDateRangeInMonth(item.startDate, endDate, year, month);
        if (range) {
          const categoryColors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
          items.push({
            id: `yearly-${item.id}`,
            type: 'yearly',
            title: item.title,
            startDate: item.startDate,
            endDate: endDate,
            category: item.category,
            colors: categoryColors,
            label: item.title,
            description: item.description,
            priority: item.priority,
            isCompleted: item.isCompleted,
          });
        }
      }
    });

    return items;
  }, [trackedItems, yearlyItems, year, month]);

  // Calculate item positions with lane assignments to prevent overlap
  const itemBars = useMemo(() => {
    const bars = allItems.map(item => {
      const range = getDateRangeInMonth(item.startDate, item.endDate, year, month)!;

      // Calculate grid positions
      const startCellIndex = firstDayOfWeek + range.startDay - 1;
      const endCellIndex = firstDayOfWeek + range.endDay - 1;

      // Break into week segments
      const segments: { weekIndex: number; startCol: number; endCol: number; isStart: boolean; isEnd: boolean }[] = [];

      let currentCell = startCellIndex;
      while (currentCell <= endCellIndex) {
        const weekIndex = Math.floor(currentCell / 7);
        const startCol = currentCell % 7;
        const weekEndCell = (weekIndex + 1) * 7 - 1;
        const segmentEndCell = Math.min(endCellIndex, weekEndCell);
        const endCol = segmentEndCell % 7;

        segments.push({
          weekIndex,
          startCol,
          endCol,
          isStart: currentCell === startCellIndex && !range.extendsBeforeMonth,
          isEnd: segmentEndCell === endCellIndex && !range.extendsAfterMonth,
        });

        currentCell = (weekIndex + 1) * 7;
      }

      return {
        item,
        range,
        segments,
        startCellIndex,
        endCellIndex,
      };
    });

    // Sort bars by start date, then by length (longer first) for better lane assignment
    bars.sort((a, b) => {
      if (a.startCellIndex !== b.startCellIndex) {
        return a.startCellIndex - b.startCellIndex;
      }
      return (b.endCellIndex - b.startCellIndex) - (a.endCellIndex - a.startCellIndex);
    });

    // Assign lanes to prevent overlap within each week
    const weekLanes: Map<string, { endCol: number; lane: number }[]>[] = [];
    for (let w = 0; w < weeksNeeded; w++) {
      weekLanes.push(new Map());
    }

    const barsWithLanes = bars.map(bar => {
      const lanes: Record<number, number> = {};

      bar.segments.forEach(segment => {
        const weekOccupied = weekLanes[segment.weekIndex];
        let lane = 0;

        // Find first available lane
        const occupiedLanes = Array.from(weekOccupied.values())
          .filter(occ => occ.endCol >= segment.startCol)
          .map(occ => occ.lane);

        while (occupiedLanes.includes(lane)) {
          lane++;
        }

        lanes[segment.weekIndex] = lane;
        weekOccupied.set(bar.item.id, { endCol: segment.endCol, lane });
      });

      return { ...bar, lanes };
    });

    return barsWithLanes;
  }, [allItems, firstDayOfWeek, year, month, weeksNeeded]);

  // Calculate max lanes per week to set appropriate row height
  const maxLanesPerWeek = useMemo(() => {
    const maxLanes: number[] = Array(weeksNeeded).fill(0);

    itemBars.forEach(bar => {
      Object.entries(bar.lanes).forEach(([weekStr, lane]) => {
        const week = parseInt(weekStr);
        maxLanes[week] = Math.max(maxLanes[week], lane + 1);
      });
    });

    return maxLanes;
  }, [itemBars, weeksNeeded]);

  // Navigate to previous month
  const goToPrevMonth = () => {
    if (onMonthChange) {
      if (month === 1) {
        onMonthChange(year - 1, 12);
      } else {
        onMonthChange(year, month - 1);
      }
    }
  };

  // Navigate to next month
  const goToNextMonth = () => {
    if (onMonthChange) {
      if (month === 12) {
        onMonthChange(year + 1, 1);
      } else {
        onMonthChange(year, month + 1);
      }
    }
  };

  // Check if a day is today
  const today = new Date();
  const isToday = (day: number) => {
    return today.getFullYear() === year &&
           today.getMonth() === month - 1 &&
           today.getDate() === day;
  };

  // Get unique districts and categories for legend
  const { uniqueDistricts, uniqueCategories } = useMemo(() => {
    const districts = new Set<string>();
    const categories = new Set<string>();

    allItems.forEach(item => {
      if (item.type === 'tracked' && item.districts) {
        item.districts.forEach(d => districts.add(d));
      }
      if (item.type === 'yearly') {
        categories.add(item.category);
      }
    });

    return {
      uniqueDistricts: Array.from(districts).sort(),
      uniqueCategories: Array.from(categories).sort(),
    };
  }, [allItems]);

  // Category display labels
  const CATEGORY_LABELS: Record<string, string> = {
    preparation: 'Preparation',
    'event-rush': 'Event Rush',
    staffing: 'Staffing',
    board: 'Board',
    seasonal: 'Seasonal',
    other: 'Other',
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {onMonthChange && (
            <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h3 className="text-lg font-semibold">
            {MONTH_NAMES[month - 1]} {year}
          </h3>
          {onMonthChange && (
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Back to Year View
          </Button>
        )}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {DAYS_OF_WEEK.map(day => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-gray-500 border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid with date range bars */}
      <div className="relative">
        {/* Week rows */}
        {Array.from({ length: weeksNeeded }).map((_, weekIndex) => {
          // Calculate row height based on number of bars
          const numLanes = Math.max(maxLanesPerWeek[weekIndex], 1);
          const rowHeight = Math.max(80, 28 + numLanes * 22); // Base 28px for date + 22px per lane

          return (
            <div key={weekIndex} className="relative">
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const cellIndex = weekIndex * 7 + dayIndex;
                  const dayNumber = cellIndex - firstDayOfWeek + 1;
                  const isValidDay = dayNumber >= 1 && dayNumber <= daysInMonth;

                  return (
                    <div
                      key={dayIndex}
                      style={{ height: `${rowHeight}px` }}
                      className={cn(
                        'p-1 border-r border-b last:border-r-0 relative',
                        !isValidDay && 'bg-gray-50',
                        isValidDay && isToday(dayNumber) && 'bg-blue-50'
                      )}
                    >
                      {isValidDay && (
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isToday(dayNumber) && 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center'
                          )}
                        >
                          {dayNumber}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Date range bars overlaid on this week */}
              <div className="absolute inset-0 pointer-events-none">
                {itemBars.map(({ item, segments, lanes }) =>
                  segments
                    .filter(seg => seg.weekIndex === weekIndex)
                    .map((segment, segIndex) => {
                      const leftPercent = (segment.startCol / 7) * 100;
                      const widthPercent = ((segment.endCol - segment.startCol + 1) / 7) * 100;
                      const lane = lanes[weekIndex] || 0;
                      const topOffset = 24 + lane * 22; // Start below date number

                      return (
                        <TooltipProvider key={`${item.id}-${segIndex}`}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'absolute h-5 flex items-center px-1.5 text-xs font-medium pointer-events-auto cursor-pointer',
                                  'border shadow-sm',
                                  item.colors.bg,
                                  item.colors.text,
                                  item.colors.border,
                                  segment.isStart ? 'rounded-l-md' : 'border-l-0',
                                  segment.isEnd ? 'rounded-r-md' : 'border-r-0',
                                  item.isCompleted && 'opacity-50 line-through'
                                )}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  top: `${topOffset}px`,
                                }}
                              >
                                <span className="truncate">
                                  {segment.isStart ? item.label : ''}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">{item.title}</p>
                                <p className="text-sm text-gray-600">
                                  {formatDateShort(item.startDate)} - {formatDateShort(item.endDate)}
                                </p>
                                {/* Tracked item: show districts */}
                                {item.type === 'tracked' && item.districts && item.districts.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.districts.map(district => (
                                      <Badge
                                        key={district}
                                        variant="outline"
                                        className={cn(
                                          'text-xs',
                                          DISTRICT_COLORS[district]?.bg || 'bg-gray-100',
                                          DISTRICT_COLORS[district]?.text || 'text-gray-800',
                                          DISTRICT_COLORS[district]?.border || 'border-gray-300'
                                        )}
                                      >
                                        {district}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {item.notes && (
                                  <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                                )}
                                {/* Yearly item: show category and priority */}
                                {item.type === 'yearly' && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-500 capitalize">{item.category?.replace('-', ' ')}</span>
                                    {item.priority && (
                                      <span className={cn(
                                        'capitalize',
                                        item.priority === 'high' && 'text-red-600',
                                        item.priority === 'medium' && 'text-blue-600',
                                        item.priority === 'low' && 'text-gray-600'
                                      )}>
                                        {item.priority} priority
                                      </span>
                                    )}
                                    {item.isCompleted && (
                                      <span className="text-green-600">Completed</span>
                                    )}
                                  </div>
                                )}
                                {item.description && (
                                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend showing districts and categories */}
      {(uniqueDistricts.length > 0 || uniqueCategories.length > 0) && (
        <div className="p-3 border-t bg-gray-50 space-y-3">
          {uniqueDistricts.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">School Districts:</div>
              <div className="flex flex-wrap gap-2">
                {uniqueDistricts.map(district => {
                  const colors = DISTRICT_COLORS[district] || DISTRICT_COLORS['default'];
                  return (
                    <Badge
                      key={district}
                      variant="outline"
                      className={cn(colors.bg, colors.text, colors.border, 'text-xs')}
                    >
                      {district}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
          {uniqueCategories.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">TSP Calendar Items:</div>
              <div className="flex flex-wrap gap-2">
                {uniqueCategories.map(category => {
                  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['default'];
                  return (
                    <Badge
                      key={category}
                      variant="outline"
                      className={cn(colors.bg, colors.text, colors.border, 'text-xs')}
                    >
                      {CATEGORY_LABELS[category] || category}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MonthlyCalendarGrid;
