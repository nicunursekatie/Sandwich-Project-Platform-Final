import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit2,
  Trash2,
} from 'lucide-react';

export type MonthSectionKey =
  | 'external'
  | 'tsp_activities'
  | 'planning_reminders'
  | 'leadership';

/** Filter chips aligned with the four month sections */
export type CalendarSectionChipKey = MonthSectionKey;

export const MONTH_SECTIONS: Array<{
  key: MonthSectionKey;
  label: string;
  emoji: string;
}> = [
  { key: 'external', label: 'External Factors', emoji: '🌎' },
  { key: 'tsp_activities', label: 'TSP Activities', emoji: '📋' },
  { key: 'planning_reminders', label: 'Planning Reminders', emoji: '💡' },
  { key: 'leadership', label: 'Leadership Availability', emoji: '👥' },
];

const TRACKED_CATEGORIES = new Set([
  'school_breaks',
  'school_markers',
  'religious_holidays',
  'holiday',
]);

export function yearlyItemSection(category: string): MonthSectionKey {
  switch (category) {
    case 'leadership_availability':
      return 'leadership';
    case 'event':
    case 'event-rush':
    case 'board':
    case 'staffing':
      return 'tsp_activities';
    case 'planning':
    case 'preparation':
    case 'action_item':
      return 'planning_reminders';
    case 'seasonal':
      return 'external';
    default:
      return 'planning_reminders';
  }
}

export function chipKeyForYearlyCategory(category: string): CalendarSectionChipKey {
  return yearlyItemSection(category);
}

export function chipKeyForTrackedCategory(_category: string): CalendarSectionChipKey {
  return 'external';
}

export interface YearlyCalendarItemRow {
  id: number;
  month: number;
  year: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  isRecurring: boolean;
  isCompleted: boolean;
}

export interface TrackedCalendarItemRow {
  id: number;
  category: string;
  title: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  metadata: {
    type?: string;
    districts?: string[];
    academicYear?: string | null;
    originalId?: string;
    tradition?: string;
  };
}

interface MonthSectionsProps<
  TYearly extends YearlyCalendarItemRow = YearlyCalendarItemRow,
  TTracked extends TrackedCalendarItemRow = TrackedCalendarItemRow,
> {
  monthItems: TYearly[];
  monthTrackedItems: Record<string, TTracked[]>;
  categoryColors: Record<string, string>;
  priorityColors: Record<string, string>;
  formatDateRange: (start: string, end: string) => string;
  formatDateRangeWithWeekday: (start: string, end: string) => string;
  canEditAll: boolean;
  canEditItem: (item: TYearly) => boolean;
  canDeleteItem: (item: TYearly) => boolean;
  onEditYearly: (item: TYearly) => void;
  onToggleComplete: (item: TYearly) => void;
  onDeleteYearly: (id: number) => void;
  onCopyYearly: (id: number) => void;
  onEditTracked: (item: TTracked) => void;
  onDeleteTracked: (item: TTracked) => void;
}

function buildMonthSections<
  TYearly extends YearlyCalendarItemRow,
  TTracked extends TrackedCalendarItemRow,
>(
  monthItems: TYearly[],
  monthTrackedItems: Record<string, TTracked[]>,
) {
  const sections: Record<
    MonthSectionKey,
    { yearly: TYearly[]; tracked: TTracked[] }
  > = {
    external: { yearly: [], tracked: [] },
    tsp_activities: { yearly: [], tracked: [] },
    planning_reminders: { yearly: [], tracked: [] },
    leadership: { yearly: [], tracked: [] },
  };

  for (const item of monthItems) {
    sections[yearlyItemSection(item.category)].yearly.push(item);
  }

  for (const [category, items] of Object.entries(monthTrackedItems)) {
    if (!TRACKED_CATEGORIES.has(category) && category) continue;
    sections.external.tracked.push(...items);
  }

  sections.external.tracked.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  return sections;
}

function TrackedItemLine<TTracked extends TrackedCalendarItemRow>({
  item,
  formatDateRange,
  canEditAll,
  onEditTracked,
  onDeleteTracked,
}: {
  item: TTracked;
  formatDateRange: (start: string, end: string) => string;
  canEditAll: boolean;
  onEditTracked: (item: TTracked) => void;
  onDeleteTracked: (item: TTracked) => void;
}) {
  const districts = item.metadata?.districts || [];
  const tradition = item.metadata?.tradition;

  return (
    <li className="group/tr flex items-start gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-[11px] font-medium text-gray-500 shrink-0 pt-0.5 min-w-[4.5rem]">
        {formatDateRange(item.startDate, item.endDate)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
          {item.title}
        </p>
        {(districts.length > 0 || tradition) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {districts.map((district) => (
              <Badge key={district} variant="outline" className="text-[10px] px-1.5 py-0">
                {district}
              </Badge>
            ))}
            {tradition && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700">
                {tradition}
              </Badge>
            )}
          </div>
        )}
        {item.notes && (
          <p className="text-xs text-gray-500 italic mt-0.5">{item.notes}</p>
        )}
      </div>
      {canEditAll && (
        <div className="opacity-0 group-hover/tr:opacity-100 flex gap-0.5 shrink-0">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEditTracked(item)}>
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-red-500"
            onClick={() => onDeleteTracked(item)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </li>
  );
}

function YearlyItemLine<TYearly extends YearlyCalendarItemRow>({
  item,
  categoryColors,
  priorityColors,
  formatDateRangeWithWeekday,
  canEdit,
  canDelete,
  onEditYearly,
  onToggleComplete,
  onDeleteYearly,
  onCopyYearly,
}: {
  item: TYearly;
  categoryColors: Record<string, string>;
  priorityColors: Record<string, string>;
  formatDateRangeWithWeekday: (start: string, end: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  onEditYearly: (item: TYearly) => void;
  onToggleComplete: (item: TYearly) => void;
  onDeleteYearly: (id: number) => void;
  onCopyYearly: (id: number) => void;
}) {
  return (
    <li
      className={`rounded-md border p-2.5 ${
        item.isCompleted ? 'opacity-60 bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
      } ${categoryColors[item.category] || categoryColors.other}`}
    >
      <div className="flex items-start gap-2">
        {item.isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${item.isCompleted ? 'line-through' : ''}`}>
            {item.title}
          </p>
          {item.startDate && (
            <div className="flex items-center gap-1 mt-1">
              <CalendarDays className="h-3.5 w-3.5 text-[#236383]" />
              <span className="text-xs font-semibold text-[#236383]">
                {formatDateRangeWithWeekday(item.startDate, item.endDate || item.startDate)}
              </span>
            </div>
          )}
          {item.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={`text-[10px] font-medium ${priorityColors[item.priority] || priorityColors.medium}`}>
              {item.priority} priority
            </span>
            {item.isRecurring && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Recurring
              </Badge>
            )}
          </div>
        </div>
      </div>
      {(canEdit || canDelete) && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {canEdit && item.category === 'action_item' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onToggleComplete(item)}
            >
              {item.isCompleted ? 'Undo' : 'Complete'}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onEditYearly(item)}>
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-red-600"
              onClick={() => onDeleteYearly(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          {canEdit && item.isRecurring && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onCopyYearly(item.id)}>
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function MonthSectionsContent<
  TYearly extends YearlyCalendarItemRow = YearlyCalendarItemRow,
  TTracked extends TrackedCalendarItemRow = TrackedCalendarItemRow,
>({
  monthItems,
  monthTrackedItems,
  categoryColors,
  priorityColors,
  formatDateRange,
  formatDateRangeWithWeekday,
  canEditAll,
  canEditItem,
  canDeleteItem,
  onEditYearly,
  onToggleComplete,
  onDeleteYearly,
  onCopyYearly,
  onEditTracked,
  onDeleteTracked,
}: MonthSectionsProps<TYearly, TTracked>) {
  const sections = buildMonthSections(monthItems, monthTrackedItems);

  return (
    <div className="space-y-4">
      {MONTH_SECTIONS.map(({ key, label, emoji }) => {
        const { yearly, tracked } = sections[key];
        if (yearly.length === 0 && tracked.length === 0) return null;

        return (
          <section key={key} className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <span aria-hidden>{emoji}</span>
              {label}
            </h4>
            <ul className="space-y-1.5 list-none m-0 p-0">
              {tracked.map((item) => (
                <TrackedItemLine
                  key={`tracked-${item.id}`}
                  item={item}
                  formatDateRange={formatDateRange}
                  canEditAll={canEditAll}
                  onEditTracked={onEditTracked}
                  onDeleteTracked={onDeleteTracked}
                />
              ))}
              {yearly.map((item) => (
                <YearlyItemLine
                  key={`yearly-${item.id}`}
                  item={item}
                  categoryColors={categoryColors}
                  priorityColors={priorityColors}
                  formatDateRangeWithWeekday={formatDateRangeWithWeekday}
                  canEdit={canEditItem(item)}
                  canDelete={canDeleteItem(item)}
                  onEditYearly={onEditYearly}
                  onToggleComplete={onToggleComplete}
                  onDeleteYearly={onDeleteYearly}
                  onCopyYearly={onCopyYearly}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
