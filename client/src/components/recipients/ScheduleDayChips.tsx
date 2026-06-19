import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  WEEK_DAYS,
  DAY_ABBREV,
  extractDaysFromText,
  type ScheduleEntry,
} from './recipient-schedule-utils';

interface ScheduleDayChipsProps {
  schedules: ScheduleEntry[];
  variant: 'collection' | 'feeding';
}

const VARIANT_STYLES = {
  collection: 'bg-[#007E8C]/15 text-[#007E8C] border border-[#007E8C]/35 hover:bg-[#007E8C]/25',
  feeding: 'bg-[#FBAD3F]/20 text-[#B8860B] border border-[#FBAD3F]/50 hover:bg-[#FBAD3F]/30',
} as const;

const NOTE_DOT_STYLES = {
  collection: 'bg-[#007E8C]',
  feeding: 'bg-[#B8860B]',
} as const;

type DayDetail = { time: string; notes: string }[];

/** Group schedule entries by canonical weekday, preserving time + notes per entry. */
function groupByDay(schedules: ScheduleEntry[]): Map<string, DayDetail> {
  const byDay = new Map<string, DayDetail>();

  for (const entry of schedules) {
    const matched = extractDaysFromText(entry.day);
    const targets = matched.length > 0 ? matched : entry.day ? [entry.day] : [];

    for (const day of targets) {
      const canonical = WEEK_DAYS.find((d) => d.toLowerCase() === day.toLowerCase()) || day;
      const list = byDay.get(canonical) || [];
      const time = (entry.time || '').trim();
      const notes = (entry.notes || '').trim();
      // Dedup identical (time, notes) pairs.
      if (!list.some((d) => d.time === time && d.notes === notes)) {
        list.push({ time, notes });
      }
      byDay.set(canonical, list);
    }
  }

  return byDay;
}

export function ScheduleDayChips({ schedules, variant }: ScheduleDayChipsProps) {
  const byDay = groupByDay(schedules);

  if (byDay.size === 0) {
    return (
      <span className="text-sm text-slate-400 italic" title="No schedule entered">
        not set
      </span>
    );
  }

  const orderedDays = WEEK_DAYS.filter((d) => byDay.has(d));
  const extraDays = [...byDay.keys()].filter(
    (d) => !WEEK_DAYS.includes(d as (typeof WEEK_DAYS)[number])
  );

  return (
    <div className="flex flex-col gap-1">
      {[...orderedDays, ...extraDays].map((day) => {
        const details = byDay.get(day) || [];
        const label = DAY_ABBREV[day] || day.slice(0, 3);
        const times = details.map((d) => d.time).filter(Boolean);
        const hasNote = details.some((d) => d.notes);
        const timesDisplay = times.join(', ');

        return (
          <Tooltip key={day}>
            <TooltipTrigger asChild>
              <div
                className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs cursor-default w-fit ${VARIANT_STYLES[variant]}`}
              >
                <span className="font-semibold">{label}</span>
                {timesDisplay && (
                  <span className="font-normal text-[11px] opacity-90">{timesDisplay}</span>
                )}
                {hasNote && (
                  <span
                    aria-label="Has frequency note"
                    title="Has frequency / scheduling note"
                    className={`inline-block w-1.5 h-1.5 rounded-full ${NOTE_DOT_STYLES[variant]}`}
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="font-medium text-xs mb-1">{day}</p>
              {details.map((d, i) => (
                <div key={i} className="text-xs text-slate-600">
                  {d.time && <span className="font-medium">{d.time}</span>}
                  {d.notes && (
                    <span className={d.time ? ' — ' : ''}>{d.notes}</span>
                  )}
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
