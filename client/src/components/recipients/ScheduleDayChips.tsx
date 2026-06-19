import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  WEEK_DAYS,
  DAY_ABBREV,
  type ScheduleEntry,
  getScheduleDayDetails,
} from './recipient-schedule-utils';

interface ScheduleDayChipsProps {
  schedules: ScheduleEntry[];
  variant: 'collection' | 'feeding';
}

const VARIANT_STYLES = {
  collection: 'bg-[#007E8C]/15 text-[#007E8C] border-[#007E8C]/35 hover:bg-[#007E8C]/25',
  feeding: 'bg-[#FBAD3F]/20 text-[#B8860B] border-[#FBAD3F]/50 hover:bg-[#FBAD3F]/30',
} as const;

export function ScheduleDayChips({ schedules, variant }: ScheduleDayChipsProps) {
  const dayDetails = getScheduleDayDetails(schedules);

  if (dayDetails.size === 0) {
    return (
      <span className="text-xs text-slate-400 italic" title="No schedule entered">
        not set
      </span>
    );
  }

  const orderedDays = WEEK_DAYS.filter((d) => dayDetails.has(d));
  const extraDays = [...dayDetails.keys()].filter((d) => !WEEK_DAYS.includes(d as (typeof WEEK_DAYS)[number]));

  return (
    <div className="flex flex-wrap gap-1">
      {[...orderedDays, ...extraDays].map((day) => {
        const lines = dayDetails.get(day) || [];
        const label = DAY_ABBREV[day] || day.slice(0, 3);
        return (
          <Tooltip key={day}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`px-1.5 py-0 text-[10px] font-semibold cursor-default ${VARIANT_STYLES[variant]}`}
              >
                {label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="font-medium text-xs mb-1">{day}</p>
              {lines.map((line, i) => (
                <p key={i} className="text-xs text-slate-600">
                  {line}
                </p>
              ))}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
