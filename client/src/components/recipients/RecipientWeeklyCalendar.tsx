import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Recipient } from '@shared/schema';
import {
  WEEK_DAYS,
  DAY_ABBREV,
  buildWeeklyScheduleBuckets,
  getCollectionSchedules,
  getFeedingSchedules,
  getTimeForDayOnSchedule,
} from './recipient-schedule-utils';

interface RecipientWeeklyCalendarProps {
  recipients: Recipient[];
  onRecipientClick: (recipient: Recipient) => void;
}

function DaySection({
  title,
  count,
  headerClass,
  borderClass,
  recipients,
  day,
  scheduleType,
  onRecipientClick,
}: {
  title: string;
  count: number;
  headerClass: string;
  borderClass: string;
  recipients: Recipient[];
  day: string;
  scheduleType: 'collection' | 'feeding';
  onRecipientClick: (recipient: Recipient) => void;
}) {
  return (
    <div className={`rounded-md border ${borderClass} overflow-hidden flex-1 min-h-0 flex flex-col`}>
      <div className={`px-2 py-1.5 flex items-center justify-between ${headerClass}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{title}</span>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
          {count}
        </Badge>
      </div>
      <div className="p-1.5 space-y-1 flex-1 overflow-y-auto max-h-[220px]">
        {recipients.length === 0 ? (
          <p className="text-[10px] text-slate-400 italic px-1 py-1">None</p>
        ) : (
          recipients.map((r) => {
            const schedules =
              scheduleType === 'collection'
                ? getCollectionSchedules(r)
                : getFeedingSchedules(r);
            const time = getTimeForDayOnSchedule(schedules, day);
            return (
              <button
                key={`${scheduleType}-${r.id}`}
                type="button"
                onClick={() => onRecipientClick(r)}
                className="w-full text-left px-2 py-1 rounded border border-slate-200/80 bg-white hover:border-[#007E8C] hover:bg-[#007E8C]/5 transition-colors"
              >
                <div className="text-[11px] font-medium text-slate-800 truncate">{r.name}</div>
                {time && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5 shrink-0" />
                    {time}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function RecipientWeeklyCalendar({
  recipients,
  onRecipientClick,
}: RecipientWeeklyCalendarProps) {
  const { collection, feeding, collectionUnscheduled, feedingUnscheduled } =
    buildWeeklyScheduleBuckets(recipients);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Weekly overview — collection pickups (teal) and client feeding (orange) by day.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {WEEK_DAYS.map((day) => {
          const collectionList = collection[day] || [];
          const feedingList = feeding[day] || [];
          return (
            <div
              key={day}
              className="border border-slate-200 rounded-lg bg-slate-50/50 overflow-hidden flex flex-col min-h-[280px]"
            >
              <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-800">{DAY_ABBREV[day]}</span>
                  <span className="text-xs text-slate-500 ml-1 hidden sm:inline">{day}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {collectionList.length + feedingList.length}
                </Badge>
              </div>
              <div className="p-2 flex flex-col gap-2 flex-1">
                <DaySection
                  title="Collects"
                  count={collectionList.length}
                  headerClass="bg-[#007E8C]/10 text-[#007E8C]"
                  borderClass="border-[#007E8C]/20"
                  recipients={collectionList}
                  day={day}
                  scheduleType="collection"
                  onRecipientClick={onRecipientClick}
                />
                <DaySection
                  title="Feeds"
                  count={feedingList.length}
                  headerClass="bg-[#FBAD3F]/15 text-[#B8860B]"
                  borderClass="border-[#FBAD3F]/30"
                  recipients={feedingList}
                  day={day}
                  scheduleType="feeding"
                  onRecipientClick={onRecipientClick}
                />
              </div>
            </div>
          );
        })}
      </div>

      {(collectionUnscheduled.length > 0 || feedingUnscheduled.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {collectionUnscheduled.length > 0 && (
            <div className="border border-dashed border-[#007E8C]/30 rounded-lg p-3 bg-[#007E8C]/5">
              <p className="text-xs font-medium text-[#007E8C] mb-2">
                No collection day set ({collectionUnscheduled.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {collectionUnscheduled.map((r) => (
                  <button
                    key={`c-unsched-${r.id}`}
                    type="button"
                    onClick={() => onRecipientClick(r)}
                    className="text-xs px-2 py-1 rounded bg-white border border-[#007E8C]/20 hover:border-[#007E8C] transition-colors"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {feedingUnscheduled.length > 0 && (
            <div className="border border-dashed border-[#FBAD3F]/40 rounded-lg p-3 bg-[#FBAD3F]/10">
              <p className="text-xs font-medium text-[#B8860B] mb-2">
                No feeding day set ({feedingUnscheduled.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {feedingUnscheduled.map((r) => (
                  <button
                    key={`f-unsched-${r.id}`}
                    type="button"
                    onClick={() => onRecipientClick(r)}
                    className="text-xs px-2 py-1 rounded bg-white border border-[#FBAD3F]/30 hover:border-[#FBAD3F] transition-colors"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {recipients.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No recipients match your current filters.
        </div>
      )}
    </div>
  );
}
