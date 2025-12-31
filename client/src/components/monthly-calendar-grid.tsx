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

interface MonthlyCalendarGridProps {
  year: number;
  month: number; // 1-12
  trackedItems: TrackedCalendarItem[];
  onMonthChange?: (year: number, month: number) => void;
  onClose?: () => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Category colors matching yearly-calendar.tsx
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  school_breaks: { bg: 'bg-amber-200', text: 'text-amber-900', border: 'border-amber-400' },
  school_markers: { bg: 'bg-emerald-200', text: 'text-emerald-900', border: 'border-emerald-400' },
  holiday: { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' },
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

export function MonthlyCalendarGrid({
  year,
  month,
  trackedItems,
  onMonthChange,
  onClose,
}: MonthlyCalendarGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);

  // Calculate weeks needed (including partial weeks)
  const totalCells = firstDayOfWeek + daysInMonth;
  const weeksNeeded = Math.ceil(totalCells / 7);

  // Get tracked items that overlap with this month
  const monthItems = useMemo(() => {
    return trackedItems.filter(item => {
      const range = getDateRangeInMonth(item.startDate, item.endDate, year, month);
      return range !== null;
    });
  }, [trackedItems, year, month]);

  // Calculate item positions for visual bars
  const itemBars = useMemo(() => {
    return monthItems.map(item => {
      const range = getDateRangeInMonth(item.startDate, item.endDate, year, month)!;
      const colors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;

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
        colors,
        segments,
      };
    });
  }, [monthItems, firstDayOfWeek, year, month]);

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
        {Array.from({ length: weeksNeeded }).map((_, weekIndex) => (
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
                    className={cn(
                      'h-20 p-1 border-r border-b last:border-r-0 relative',
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
              {itemBars.map(({ item, colors, segments }) =>
                segments
                  .filter(seg => seg.weekIndex === weekIndex)
                  .map((segment, segIndex) => {
                    const leftPercent = (segment.startCol / 7) * 100;
                    const widthPercent = ((segment.endCol - segment.startCol + 1) / 7) * 100;

                    return (
                      <TooltipProvider key={`${item.id}-${segIndex}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'absolute h-6 flex items-center px-1 text-xs font-medium pointer-events-auto cursor-pointer',
                                'top-8 border',
                                colors.bg,
                                colors.text,
                                colors.border,
                                segment.isStart ? 'rounded-l-md' : 'border-l-0',
                                segment.isEnd ? 'rounded-r-md' : 'border-r-0'
                              )}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                              }}
                            >
                              <span className="truncate">
                                {segment.isStart ? item.title : ''}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">{item.title}</p>
                              <p className="text-sm text-gray-600">
                                {formatDateShort(item.startDate)} - {formatDateShort(item.endDate)}
                              </p>
                              {item.metadata?.districts && item.metadata.districts.length > 0 && (
                                <p className="text-xs text-gray-500">
                                  {item.metadata.districts.join(', ')}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-gray-500">{item.notes}</p>
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
        ))}
      </div>

      {/* Legend */}
      {monthItems.length > 0 && (
        <div className="p-3 border-t bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(monthItems.map(i => i.category))).map(category => {
              const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
              const label = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <Badge
                  key={category}
                  variant="outline"
                  className={cn(colors.bg, colors.text, colors.border)}
                >
                  {label}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MonthlyCalendarGrid;
