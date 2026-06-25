import React, { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  GraduationCap,
  PartyPopper,
  Sparkles,
  Trash2,
} from 'lucide-react';

// localStorage key prefix for which sections are collapsed. Versioned so we
// can safely re-default in the future without users carrying old state.
// The full key includes a per-card scope (e.g. `2026-1` for Jan 2026) so
// collapsing External Factors in January doesn't affect February.
const SECTION_COLLAPSE_KEY_PREFIX = 'yearlyCalendar.monthSection.collapsed.v2';

function collapseKeyFor(scopeKey: string): string {
  return `${SECTION_COLLAPSE_KEY_PREFIX}.${scopeKey}`;
}

function loadCollapsedSections(scopeKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(collapseKeyFor(scopeKey));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function persistCollapsedSections(scopeKey: string, next: Set<string>) {
  try {
    localStorage.setItem(collapseKeyFor(scopeKey), JSON.stringify(Array.from(next)));
  } catch {
    // localStorage disabled or full — fall back to in-session state.
  }
}

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

export const RENDERABLE_TRACKED_CATEGORIES = new Set([
  'school_breaks',
  'school_markers',
  'religious_holidays',
  'holiday',
]);

/** Count tracked items that appear under External Factors (matches buildMonthSections). */
export function countRenderableTrackedItems(
  monthTrackedItems: Record<string, unknown[]>,
): number {
  let count = 0;
  for (const [category, items] of Object.entries(monthTrackedItems)) {
    if (!RENDERABLE_TRACKED_CATEGORIES.has(category) && category) continue;
    count += items.length;
  }
  return count;
}

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
  /**
   * Scopes the section-collapse state in localStorage. Pass something
   * unique per card (e.g. `2026-1`) so collapsing External Factors in
   * January doesn't affect any other month. Falls back to `'global'` when
   * omitted, which collapses every card together.
   */
  scopeKey?: string;
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
    if (!RENDERABLE_TRACKED_CATEGORIES.has(category) && category) continue;
    sections.external.tracked.push(...items);
  }

  sections.external.tracked.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  return sections;
}

/**
 * Map a tracked external-factor item to its visual treatment.
 * School breaks (carry a districts list) get a slate/blue card with a
 * graduation cap. Religious holidays (carry a tradition) get violet with
 * sparkles. Everything else (federal holidays / observances) gets warm
 * amber with party popper. This gives External Factors visual weight that
 * matches the colored TSP Activity cards next to them.
 */
function trackedItemStyle<TTracked extends TrackedCalendarItemRow>(item: TTracked) {
  const districts = item.metadata?.districts || [];
  const tradition = item.metadata?.tradition;
  if (districts.length > 0) {
    return {
      kind: 'school' as const,
      borderClass: 'border-l-4 border-l-sky-500 border-sky-200',
      iconBg: 'bg-sky-100 text-sky-700',
      Icon: GraduationCap,
      label: 'School',
    };
  }
  if (tradition) {
    return {
      kind: 'religious' as const,
      borderClass: 'border-l-4 border-l-violet-500 border-violet-200',
      iconBg: 'bg-violet-100 text-violet-700',
      Icon: Sparkles,
      label: tradition,
    };
  }
  return {
    kind: 'holiday' as const,
    borderClass: 'border-l-4 border-l-amber-500 border-amber-200',
    iconBg: 'bg-amber-100 text-amber-700',
    Icon: PartyPopper,
    label: 'Holiday',
  };
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
  const style = trackedItemStyle(item);
  const Icon = style.Icon;

  return (
    <li
      className={`group/tr rounded-md border bg-white dark:bg-gray-900 p-2.5 ${style.borderClass}`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${style.iconBg}`}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            {item.title}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <CalendarDays className="h-3.5 w-3.5 text-[#236383]" />
            <span className="text-xs font-semibold text-[#236383]">
              {formatDateRange(item.startDate, item.endDate)}
            </span>
          </div>
          {(districts.length > 0 || style.kind === 'religious' || style.kind === 'holiday') && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {style.kind === 'school' &&
                districts.map((district) => (
                  <Badge
                    key={district}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-sky-50 text-sky-700 border-sky-200"
                  >
                    {district}
                  </Badge>
                ))}
              {style.kind === 'religious' && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200"
                >
                  {style.label}
                </Badge>
              )}
              {style.kind === 'holiday' && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200"
                >
                  Holiday
                </Badge>
              )}
            </div>
          )}
          {item.notes && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-snug">
              {item.notes}
            </p>
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
      </div>
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
  scopeKey = 'global',
}: MonthSectionsProps<TYearly, TTracked>) {
  const sections = buildMonthSections(monthItems, monthTrackedItems);

  // Section collapse state — defaults to all-open (empty set) and persists
  // per-scope (e.g. per month/year card) so each month remembers its own
  // open/closed state independently.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsedSections(scopeKey));

  // If the parent swaps in a different scope (e.g. selectedYear changes
  // and the same card is reused), re-read state for the new scope so we
  // don't bleed January's state into February.
  React.useEffect(() => {
    setCollapsed(loadCollapsedSections(scopeKey));
  }, [scopeKey]);

  const toggleSection = useCallback(
    (key: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        persistCollapsedSections(scopeKey, next);
        return next;
      });
    },
    [scopeKey],
  );

  return (
    <div className="space-y-3">
      {MONTH_SECTIONS.map(({ key, label, emoji }) => {
        const { yearly, tracked } = sections[key];
        if (yearly.length === 0 && tracked.length === 0) return null;
        const isOpen = !collapsed.has(key);
        const itemCount = yearly.length + tracked.length;
        const sectionId = `month-section-${key}`;

        return (
          <section key={key}>
            <button
              type="button"
              onClick={() => toggleSection(key)}
              aria-expanded={isOpen}
              aria-controls={sectionId}
              className="w-full flex items-center gap-1.5 py-1.5 px-1 text-left rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              data-testid={`toggle-${key}`}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
              )}
              <span aria-hidden>{emoji}</span>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300 m-0">
                {label}
              </h4>
              <span className="text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full ml-1">
                {itemCount}
              </span>
            </button>
            {isOpen && (
              <ul id={sectionId} className="space-y-1.5 list-none m-0 p-0 mt-1.5">
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
            )}
          </section>
        );
      })}
    </div>
  );
}
