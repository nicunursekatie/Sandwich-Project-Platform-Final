import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Recipient } from '@shared/schema';
import { ScheduleDayChips } from './ScheduleDayChips';
import {
  WEEK_DAYS,
  DAY_ABBREV,
  RECIPIENT_FOCUS_AREAS,
  getCollectionSchedules,
  getFeedingSchedules,
  buildScheduleFromDaysAndTime,
  parseScheduleForInlineEdit,
  type ScheduleEntry,
} from './recipient-schedule-utils';

type SaveHandler = (updates: Partial<Recipient>) => void;

function stopRowClick(e: React.SyntheticEvent) {
  e.stopPropagation();
}

interface InlineBaseProps {
  canEdit: boolean;
  isSaving?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function InlineTextCell({
  value,
  placeholder = '—',
  canEdit,
  isSaving,
  className = '',
  onSave,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onSave: (value: string) => void;
} & InlineBaseProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (!canEdit) {
    return (
      <span className={`text-xs text-slate-600 truncate block ${className}`}>
        {value || placeholder}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={stopRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`h-7 text-xs ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        stopRowClick(e);
        setEditing(true);
      }}
      className={`group text-left text-xs w-full truncate rounded px-1 py-0.5 hover:bg-white hover:ring-1 hover:ring-[#007E8C]/30 ${className}`}
    >
      {isSaving ? (
        <Loader2 className="w-3 h-3 animate-spin inline" />
      ) : (
        <>
          <span className={value ? 'text-slate-700' : 'text-slate-400 italic'}>
            {value || placeholder}
          </span>
          <Pencil className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-50" />
        </>
      )}
    </button>
  );
}

export function InlineNumberCell({
  value,
  canEdit,
  isSaving,
  onSave,
}: {
  value: number | null;
  onSave: (value: number | null) => void;
} & InlineBaseProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (!editing) setDraft(value?.toString() ?? '');
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : parseInt(trimmed, 10);
    if (next !== value && (next === null || !Number.isNaN(next))) {
      onSave(next);
    }
  };

  if (!canEdit) {
    return (
      <span className="text-xs text-slate-700 tabular-nums">
        {value != null ? value.toLocaleString() : '—'}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={stopRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value?.toString() ?? '');
            setEditing(false);
          }
        }}
        className="h-7 text-xs w-20"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        stopRowClick(e);
        setEditing(true);
      }}
      className="group text-xs tabular-nums rounded px-1 py-0.5 hover:bg-white hover:ring-1 hover:ring-[#007E8C]/30"
    >
      {isSaving ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <>
          {value != null ? value.toLocaleString() : '—'}
          <Pencil className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-50" />
        </>
      )}
    </button>
  );
}

export function InlineStatusSelect({
  status,
  canEdit,
  isSaving,
  onSave,
}: {
  status: string;
  onSave: (status: 'active' | 'inactive') => void;
} & InlineBaseProps) {
  if (!canEdit) {
    return (
      <Badge variant={status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
        {status}
      </Badge>
    );
  }

  return (
    <div onClick={stopRowClick}>
      <Select
        value={status}
        disabled={isSaving}
        onValueChange={(v) => onSave(v as 'active' | 'inactive')}
      >
        <SelectTrigger className="h-7 text-[10px] w-[88px] border-dashed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">active</SelectItem>
          <SelectItem value="inactive">inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function InlineContractCell({
  recipient,
  canEdit,
  isSaving,
  onSave,
}: {
  recipient: Recipient;
  onSave: SaveHandler;
} & InlineBaseProps) {
  const signed = recipient.contractSigned;

  if (!canEdit) {
    return signed ? (
      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Signed</Badge>
    ) : (
      <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-800">
        Pending
      </Badge>
    );
  }

  return (
    <div onClick={stopRowClick}>
      <Select
        value={signed ? 'signed' : 'pending'}
        disabled={isSaving}
        onValueChange={(v) => {
          const nextSigned = v === 'signed';
          onSave({
            contractSigned: nextSigned,
            contractSignedDate: nextSigned ? new Date() : null,
          });
        }}
      >
        <SelectTrigger className="h-7 text-[10px] w-[90px] border-dashed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="signed">Signed</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function InlineScheduleCell({
  recipient,
  variant,
  canEdit,
  isSaving,
  onSave,
}: {
  recipient: Recipient;
  variant: 'collection' | 'feeding';
  onSave: SaveHandler;
} & InlineBaseProps) {
  const schedules =
    variant === 'collection'
      ? getCollectionSchedules(recipient)
      : getFeedingSchedules(recipient);

  const readOnly = (
    <ScheduleDayChips schedules={schedules} variant={variant} />
  );

  if (!canEdit) return readOnly;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={stopRowClick}
          className="group w-full text-left rounded p-0.5 hover:ring-1 hover:ring-[#007E8C]/30 min-h-[24px]"
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
          ) : (
            <>
              {readOnly}
              <Pencil className="w-3 h-3 mt-0.5 opacity-0 group-hover:opacity-40 text-slate-500" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start" onClick={stopRowClick}>
        <ScheduleInlineEditor
          schedules={schedules}
          label={variant === 'collection' ? 'Collection' : 'Feeding'}
          onSave={(next) => {
            if (variant === 'collection') {
              onSave({
                collectionSchedules: next,
                collectionDay: next[0]?.day ?? null,
                collectionTime: next[0]?.time ?? null,
              });
            } else {
              onSave({
                feedingSchedules: next,
                feedingDay: next[0]?.day ?? null,
                feedingTime: next[0]?.time ?? null,
              });
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ScheduleInlineEditor({
  schedules,
  label,
  onSave,
}: {
  schedules: ScheduleEntry[];
  label: string;
  onSave: (schedules: ScheduleEntry[]) => void;
}) {
  const initial = parseScheduleForInlineEdit(schedules);
  const [days, setDays] = useState<string[]>(initial.days);
  const [time, setTime] = useState(initial.time);

  useEffect(() => {
    const parsed = parseScheduleForInlineEdit(schedules);
    setDays(parsed.days);
    setTime(parsed.time);
  }, [schedules]);

  const toggleDay = (day: string) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-700">{label} schedule</p>
      <div className="flex flex-wrap gap-1">
        {WEEK_DAYS.map((day) => {
          const selected = days.includes(day);
          const chipClass =
            label === 'Collection'
              ? selected
                ? 'bg-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/40'
                : 'bg-white border-slate-200 text-slate-500'
              : selected
                ? 'bg-[#FBAD3F]/25 text-[#B8860B] border-[#FBAD3F]/50'
                : 'bg-white border-slate-200 text-slate-500';
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${chipClass}`}
            >
              {DAY_ABBREV[day]}
            </button>
          );
        })}
      </div>
      <Input
        value={time}
        onChange={(e) => setTime(e.target.value)}
        placeholder="Time, e.g. 9:00 AM"
        className="h-8 text-xs"
      />
      <Button
        type="button"
        size="sm"
        className="w-full h-8 text-xs"
        onClick={() => onSave(buildScheduleFromDaysAndTime(days, time))}
      >
        Save schedule
      </Button>
    </div>
  );
}

export function InlineFocusAreasCell({
  recipient,
  canEdit,
  isSaving,
  onSave,
}: {
  recipient: Recipient;
  onSave: SaveHandler;
} & InlineBaseProps) {
  const areas =
    Array.isArray((recipient as Recipient & { focusAreas?: string[] }).focusAreas) &&
    (recipient as Recipient & { focusAreas?: string[] }).focusAreas!.length > 0
      ? (recipient as Recipient & { focusAreas?: string[] }).focusAreas!
      : recipient.focusArea
        ? [recipient.focusArea]
        : [];

  const display = (
    <div className="flex flex-wrap gap-1 max-w-[160px]">
      {areas.length > 0 ? (
        areas.map((area) => (
          <Badge
            key={area}
            variant="outline"
            className="text-[10px] bg-brand-primary-lighter/50 text-brand-primary border-brand-primary-border px-1.5 py-0"
          >
            {area}
          </Badge>
        ))
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  );

  if (!canEdit) return display;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={stopRowClick}
          className="group w-full text-left rounded p-0.5 hover:ring-1 hover:ring-[#007E8C]/30"
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start" onClick={stopRowClick}>
        <p className="text-xs font-semibold text-slate-700 mb-2">Focus areas</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {RECIPIENT_FOCUS_AREAS.map((area) => {
            const selected = areas.includes(area);
            return (
              <Badge
                key={area}
                variant={selected ? 'default' : 'outline'}
                className="cursor-pointer text-[10px]"
                onClick={() => {
                  const next = selected
                    ? areas.filter((a) => a !== area)
                    : [...areas, area];
                  onSave({ focusAreas: next, focusArea: next[0] ?? null });
                }}
              >
                {area}
              </Badge>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PrimaryContactInlineEditor({
  name,
  phone,
  email,
  onSave,
}: {
  name: string;
  phone: string;
  email: string;
  onSave: SaveHandler;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftPhone, setDraftPhone] = useState(phone);
  const [draftEmail, setDraftEmail] = useState(email);

  useEffect(() => {
    setDraftName(name);
    setDraftPhone(phone);
    setDraftEmail(email);
  }, [name, phone, email]);

  const commit = () => {
    if (
      draftName === name &&
      draftPhone === phone &&
      draftEmail === email
    ) {
      return;
    }
    onSave({
      contactPersonName: draftName || null,
      contactPersonPhone: draftPhone || null,
      contactPersonEmail: draftEmail || null,
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-700">Primary contact</p>
      <Input
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        placeholder="Name"
        className="h-8 text-xs"
      />
      <Input
        value={draftPhone}
        onChange={(e) => setDraftPhone(e.target.value)}
        placeholder="Phone"
        className="h-8 text-xs"
      />
      <Input
        value={draftEmail}
        onChange={(e) => setDraftEmail(e.target.value)}
        placeholder="Email"
        className="h-8 text-xs"
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={commit}>
        Save contact
      </Button>
    </div>
  );
}

export function InlinePrimaryContactCell({
  recipient,
  canEdit,
  isSaving,
  onSave,
}: {
  recipient: Recipient;
  onSave: SaveHandler;
} & InlineBaseProps) {
  const name = recipient.contactPersonName || recipient.contactName || '';
  const phone = recipient.contactPersonPhone || '';
  const email = recipient.contactPersonEmail || '';
  const [open, setOpen] = useState(false);

  if (!canEdit) {
    return (
      <div className="space-y-0.5">
        {name && <div className="text-xs font-medium truncate">{name}</div>}
        {phone && <div className="text-[11px] text-slate-500 truncate">{phone}</div>}
        {!name && !phone && !email && (
          <span className="text-xs text-slate-400 italic">—</span>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={stopRowClick}
          className="group w-full text-left rounded p-0.5 hover:ring-1 hover:ring-[#007E8C]/30 min-h-[24px]"
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              {name ? (
                <div className="text-xs font-medium truncate">{name}</div>
              ) : (
                <span className="text-xs text-slate-400 italic">Add contact</span>
              )}
              {phone && (
                <div className="text-[11px] text-slate-500 truncate">{phone}</div>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start" onClick={stopRowClick}>
        {open && (
          <PrimaryContactInlineEditor
            name={name}
            phone={phone}
            email={email}
            onSave={onSave}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
