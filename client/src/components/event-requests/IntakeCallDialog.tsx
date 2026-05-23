import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Phone,
  CheckCircle2,
  Circle,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  Package,
  Refrigerator,
  UtensilsCrossed,
  Car,
  UserCheck,
  FileText,
  Clock,
} from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  useDraftPersistence,
  loadDraft,
  clearDraft,
  formatDraftTimestamp,
} from '@/hooks/useDraftPersistence';

interface IntakeDraftData {
  checkedItems: string[];
  itemAnswers: Record<string, string>;
  callNotes: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

interface IntakeCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onCallComplete?: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  required?: boolean;
  notes?: string;
}

const OPERATING_AREAS = [
  'Dunwoody',
  'Sandy Springs',
  'Intown (generally not South Atlanta)',
  'Buckhead',
  'Peachtree Corners',
  'Alpharetta',
  'Milton',
  'Dacula',
  'Marietta',
  'Roswell',
];

// Extract the first integer from an operator's free-text answer.
// Handles "750", "around 200", "750ish", "approximately 1000".
// For ranges like "200-300" returns the first number (200) — operator can
// adjust on the event after intake if needed.
function parseNumberFromText(text: string): number | null {
  const match = text.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) ? n : null;
}

// Convert a native date-input value (YYYY-MM-DD) into a friendlier display
// string for the planningNotes summary block.
function formatIsoDateForNotes(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

// Friendlier display for itemAnswers values when summarizing into planningNotes.
function formatItemAnswerForNotes(itemId: string, value: string): string {
  if (itemId === 'event_date') return formatIsoDateForNotes(value);
  if (itemId === 'refrigeration') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
}

interface StructuredIntakeResult {
  updates: Record<string, unknown>;
  // Per-field mapping result for surfacing in the success toast.
  mapped: Array<{ itemId: string; column: string; display: string }>;
  // Items the operator filled in but we couldn't parse — fall back to
  // planningNotes; warn the user so they know structured data was missed.
  unparseable: Array<{ itemId: string; rawValue: string }>;
}

// Parse the structured intake fields out of itemAnswers and build a partial
// update payload of typed column values. Items that don't parse cleanly are
// surfaced separately so the user can be warned in the toast rather than
// having the data silently dropped.
function buildStructuredUpdates(
  itemAnswers: Record<string, string>
): StructuredIntakeResult {
  const updates: Record<string, unknown> = {};
  const mapped: StructuredIntakeResult['mapped'] = [];
  const unparseable: StructuredIntakeResult['unparseable'] = [];

  // event_date — native date input gives YYYY-MM-DD.
  // Always writes to desiredEventDate; the audit log preserves any prior
  // value so the original requested date is recoverable from history.
  const dateValue = itemAnswers.event_date?.trim();
  if (dateValue) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      // Parse as local midnight to avoid a one-day UTC drift when the
      // server converts the timestamp.
      const [y, m, d] = dateValue.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      updates.desiredEventDate = dt.toISOString();
      mapped.push({
        itemId: 'event_date',
        column: 'desired event date',
        display: formatIsoDateForNotes(dateValue),
      });
    } else {
      unparseable.push({ itemId: 'event_date', rawValue: dateValue });
    }
  }

  // sandwich_count — free text → integer.
  const sandwichValue = itemAnswers.sandwich_count?.trim();
  if (sandwichValue) {
    const n = parseNumberFromText(sandwichValue);
    if (n !== null) {
      updates.estimatedSandwichCount = n;
      mapped.push({
        itemId: 'sandwich_count',
        column: 'estimated sandwich count',
        display: String(n),
      });
    } else {
      unparseable.push({ itemId: 'sandwich_count', rawValue: sandwichValue });
    }
  }

  // participant_count — free text → integer.
  const participantValue = itemAnswers.participant_count?.trim();
  if (participantValue) {
    const n = parseNumberFromText(participantValue);
    if (n !== null) {
      updates.estimatedAttendance = n;
      mapped.push({
        itemId: 'participant_count',
        column: 'estimated attendance',
        display: String(n),
      });
    } else {
      unparseable.push({
        itemId: 'participant_count',
        rawValue: participantValue,
      });
    }
  }

  // refrigeration — Select with 'yes' / 'no' / 'unsure'. 'unsure' deliberately
  // does NOT write the boolean column (leaves it null = unknown).
  const refrigValue = itemAnswers.refrigeration?.trim().toLowerCase();
  if (refrigValue === 'yes' || refrigValue === 'no') {
    const bool = refrigValue === 'yes';
    updates.hasRefrigeration = bool;
    mapped.push({
      itemId: 'refrigeration',
      column: 'has refrigeration',
      display: bool ? 'Yes' : 'No',
    });
  }

  return { updates, mapped, unparseable };
}

const IntakeCallDialog: React.FC<IntakeCallDialogProps> = ({
  isOpen,
  onClose,
  eventRequest,
  onCallComplete,
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [itemAnswers, setItemAnswers] = useState<Record<string, string>>({});
  const [callNotes, setCallNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Contact person info - auto-filled from event request, editable during call
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Draft persistence: per-event key, autosave to localStorage with debounce.
  // Suspended until the user actually interacts so we don't overwrite a saved
  // draft with the initial form state when the dialog mounts.
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [pendingRestoreDraft, setPendingRestoreDraft] = useState<
    | { savedAt: string; data: IntakeDraftData }
    | null
  >(null);

  const draftKey = eventRequest ? `intake:${eventRequest.id}` : null;
  const draftData: IntakeDraftData = {
    checkedItems: Array.from(checkedItems),
    itemAnswers,
    callNotes,
    contactName,
    contactPhone,
    contactEmail,
  };
  const { savedAt: draftSavedAt } = useDraftPersistence<IntakeDraftData>({
    key: draftKey,
    data: draftData,
    // Suspend autosave while the restore banner is up so typing into the
    // pre-populated form doesn't overwrite the existing localStorage draft
    // before the user has a chance to click Restore.
    enabled: isOpen && hasUserInteracted && !pendingRestoreDraft,
    version: eventRequest?.updatedAt ?? null,
    debounceMs: 500,
  });

  // Wrap the state setters so any user action flips hasUserInteracted on,
  // which is what gates the autosave effect above.
  const markInteracted = () => {
    if (!hasUserInteracted) setHasUserInteracted(true);
  };

  // Shared "load the event's current values into form state" routine, used
  // by the open-dialog effect and by discardPendingDraft.
  const populateFromEventRequest = useCallback((req: EventRequest) => {
    const fullName = `${req.firstName || ''} ${req.lastName || ''}`.trim();
    setContactName(fullName);
    setContactPhone(req.phone || '');
    setContactEmail(req.email || '');

    const initialAnswers: Record<string, string> = {};
    const initialChecked = new Set<string>();
    if (fullName) {
      initialAnswers.contact_name = fullName;
      initialChecked.add('contact_name');
    }
    if (req.phone) {
      initialAnswers.contact_phone = req.phone;
      initialChecked.add('contact_phone');
    }
    if (req.email) {
      initialAnswers.contact_email = req.email;
      initialChecked.add('contact_email');
    }

    // Pre-fill the structured checklist items from existing event data so
    // the operator sees what we already know and only re-types if it changed.
    if (req.desiredEventDate) {
      const d = new Date(req.desiredEventDate);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        initialAnswers.event_date = `${y}-${m}-${day}`;
        initialChecked.add('event_date');
      }
    }
    if (req.estimatedSandwichCount != null) {
      initialAnswers.sandwich_count = String(req.estimatedSandwichCount);
      initialChecked.add('sandwich_count');
    }
    if (req.estimatedAttendance != null) {
      initialAnswers.participant_count = String(req.estimatedAttendance);
      initialChecked.add('participant_count');
    }
    if (req.hasRefrigeration === true) {
      initialAnswers.refrigeration = 'yes';
      initialChecked.add('refrigeration');
    } else if (req.hasRefrigeration === false) {
      initialAnswers.refrigeration = 'no';
      initialChecked.add('refrigeration');
    }
    if (req.eventAddress) {
      initialAnswers.event_address = req.eventAddress;
      initialChecked.add('event_address');
    }

    setItemAnswers(initialAnswers);
    setCheckedItems(initialChecked);
    setCallNotes('');
  }, []);

  // Initialize contact info from event request when dialog opens.
  // If a draft exists for this event, surface a restore banner. Autosave
  // is gated by hasUserInteracted, so a draft only exists when the user
  // actually changed something — including contact-field corrections,
  // which are part of the saved payload and must not be silently dropped.
  useEffect(() => {
    if (!isOpen || !eventRequest) return;

    const existingDraft = loadDraft<IntakeDraftData>(`intake:${eventRequest.id}`);
    if (existingDraft) {
      setPendingRestoreDraft({
        savedAt: existingDraft.savedAt,
        data: existingDraft.data,
      });
      // Pre-populate from the event so the dialog body has content while
      // the user decides. If they restore, those values get overwritten;
      // if they discard, the pre-fill stays.
      populateFromEventRequest(eventRequest);
      setHasUserInteracted(false);
      return;
    }

    populateFromEventRequest(eventRequest);
    setHasUserInteracted(false);
  }, [isOpen, eventRequest, populateFromEventRequest]);

  const restorePendingDraft = () => {
    if (!pendingRestoreDraft) return;
    const d = pendingRestoreDraft.data;
    setCheckedItems(new Set(d.checkedItems || []));
    setItemAnswers(d.itemAnswers || {});
    setCallNotes(d.callNotes || '');
    setContactName(d.contactName || '');
    setContactPhone(d.contactPhone || '');
    setContactEmail(d.contactEmail || '');
    setPendingRestoreDraft(null);
    // Treat the restored content as already-interacted so autosave resumes
    // immediately and keeps the draft fresh.
    setHasUserInteracted(true);
  };

  const discardPendingDraft = () => {
    if (!eventRequest) return;
    clearDraft(`intake:${eventRequest.id}`);
    setPendingRestoreDraft(null);
    populateFromEventRequest(eventRequest);
    setHasUserInteracted(false);
  };

  const toggleItem = (itemId: string) => {
    markInteracted();
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleCall = () => {
    if (!eventRequest?.phone) return;

    if (isMobile) {
      window.location.href = `tel:${eventRequest?.phone}`;
    } else {
      navigator.clipboard.writeText(eventRequest?.phone || '').then(() => {
        window.alert(`Phone number copied!\n${eventRequest?.phone} has been copied to your clipboard.`);
      });
    }
  };

  const handleAnswerChange = (itemId: string, answer: string) => {
    markInteracted();
    setItemAnswers((prev) => ({
      ...prev,
      [itemId]: answer,
    }));
    
    // Automatically check the item when text is entered
    if (answer.trim() && !checkedItems.has(itemId)) {
      setCheckedItems((prev) => new Set(prev).add(itemId));
    }
    // Uncheck if answer is cleared
    if (!answer.trim() && checkedItems.has(itemId)) {
      setCheckedItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleComplete = async () => {
    if (!eventRequest || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const nowLabel = new Date().toLocaleString();
      const answeredItems = checklistItems.filter((item) => {
        const value = itemAnswers[item.id];
        return value && value.trim().length > 0;
      });

      const summaryLines = [
        `Intake call completed: ${nowLabel}`,
        `Contact: ${contactName || 'N/A'} | ${contactPhone || 'N/A'} | ${contactEmail || 'N/A'}`,
        ...answeredItems.map(
          (item) =>
            `- ${item.label}: ${formatItemAnswerForNotes(item.id, itemAnswers[item.id].trim())}`
        ),
      ];

      if (callNotes.trim()) {
        summaryLines.push(`Notes: ${callNotes.trim()}`);
      }

      const summaryBlock = summaryLines.join('\n');
      const existingNotes = eventRequest?.planningNotes || '';
      const updatedPlanningNotes = existingNotes
        ? `${existingNotes}\n\n${summaryBlock}`
        : summaryBlock;

      // Build structured updates first so they don't get overwritten by
      // the explicit contact/address mappings below if there's any overlap.
      const structured = buildStructuredUpdates(itemAnswers);
      const updates: Record<string, unknown> = {
        ...structured.updates,
        planningNotes: updatedPlanningNotes,
      };

      const trimmedContactName = contactName.trim();
      if (trimmedContactName) {
        const [firstName, ...rest] = trimmedContactName.split(' ');
        updates.firstName = firstName || null;
        updates.lastName = rest.length ? rest.join(' ') : null;
      }

      if (contactPhone.trim()) {
        updates.phone = contactPhone.trim();
      }

      if (contactEmail.trim()) {
        updates.email = contactEmail.trim();
      }

      if (itemAnswers.event_address?.trim()) {
        updates.eventAddress = itemAnswers.event_address.trim();
      }

      await apiRequest('PATCH', `/api/event-requests/${eventRequest?.id}`, updates);

      // Build a toast that tells the operator exactly which structured fields
      // got mapped to columns and which inputs couldn't be parsed (those still
      // live in planningNotes, but the operator should know they're not
      // searchable/reportable as structured data).
      const toastParts: string[] = ['Notes and contact updates saved.'];
      if (structured.mapped.length > 0) {
        toastParts.push(
          'Saved to event: ' +
            structured.mapped.map((m) => `${m.column} (${m.display})`).join(', ')
        );
      }
      const hasUnparseable = structured.unparseable.length > 0;
      if (hasUnparseable) {
        toastParts.push(
          "Couldn't parse: " +
            structured.unparseable.map((u) => u.itemId).join(', ') +
            ' — kept in notes only.'
        );
      }
      toast({
        title: hasUnparseable ? 'Intake call saved (with warnings)' : 'Intake call saved',
        description: toastParts.join(' '),
        variant: hasUnparseable ? 'destructive' : 'default',
        duration: hasUnparseable ? 12000 : 5000,
      });

      // Save succeeded — clear the autosaved draft for this event.
      clearDraft(`intake:${eventRequest?.id}`);

      onCallComplete?.();
      setCheckedItems(new Set());
      setItemAnswers({});
      setCallNotes('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setHasUserInteracted(false);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description:
          error?.message ||
          'Unable to save intake call notes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!eventRequest) return null;

  const checklistItems: ChecklistItem[] = [
    // Initial Questions
    {
      id: 'how_heard',
      label: 'How did they hear about us?',
      category: 'Initial Questions',
      required: true,
    },
    {
      id: 'check_date_conflicts',
      label: 'Check calendar for conflicts - do we have too many events that day?',
      category: 'Initial Questions',
      required: true,
      notes: 'Check if requested date works / ask about flexibility (look for low weeks with fewer events)',
    },
    {
      id: 'get_event_time',
      label: 'Get event time: Start/end times if >500 sandwiches or speaker/volunteers needed, pickup time if <500 without speaker',
      category: 'Initial Questions',
      required: true,
      notes: '<500 sandwiches + no speaker: need pickup time. >500 sandwiches OR speaker/volunteers: need start and end times. Drivers are volunteers - need heads up to plan',
    },

    // Location & Area Check
    {
      id: 'get_address',
      label: 'Get/confirm event address',
      category: 'Location & Area',
      required: true,
    },
    {
      id: 'check_area',
      label: 'Check if in operating area',
      category: 'Location & Area',
      required: true,
      notes: `Typical areas: ${OPERATING_AREAS.join(', ')}`,
    },
    {
      id: 'confirm_transport',
      label: 'Confirm transport feasibility to typical recipients',
      category: 'Location & Area',
      required: true,
      notes: 'Only if in typical vicinity',
    },
    {
      id: 'outside_area',
      label: 'If outside area: collect info, check with team',
      category: 'Location & Area',
      notes: 'Let them know we need to check with team',
    },

    // Refrigeration & Sandwich Type
    {
      id: 'refrigeration',
      label: 'Do they have refrigeration available?',
      category: 'Refrigeration & Type',
      required: true,
    },
    {
      id: 'confirm_deli',
      label: 'If no fridge: only PBJ option (mention only if they want PBJ or no fridge)',
      category: 'Refrigeration & Type',
      notes: "Don't mention PBJ unless they want it or have no fridge",
    },
    {
      id: 'school_pbj',
      label: 'If school: confirm making deli (no PBJ for schools due to allergy risk)',
      category: 'Refrigeration & Type',
      notes: 'Students making PBJ often make messy sandwiches',
    },

    // Event Details Collection
    {
      id: 'contact_name',
      label: 'Contact person name',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'contact_phone',
      label: 'Contact phone number',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'contact_email',
      label: 'Contact email',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'event_address',
      label: 'Event address',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'event_date',
      label: 'Event date',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'event_time',
      label: 'Event time',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'participant_count',
      label: 'Approximate number of people',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'sandwich_count',
      label: 'Number of sandwiches',
      category: 'Event Details',
      required: true,
      notes: 'If they say 200, ask how many people and time available - see if they can make more',
    },
    {
      id: 'sandwich_type',
      label: 'Type of sandwiches',
      category: 'Event Details',
      required: true,
    },
    {
      id: 'speaker_needed',
      label: 'Do they want a speaker?',
      category: 'Event Details',
      notes: 'Prefer to send for >500 sandwiches, but will send for others when possible, especially corporate',
    },
    {
      id: 'additional_volunteers',
      label: 'Additional volunteers needed?',
      category: 'Event Details',
      notes: 'For larger events',
    },

    // Food Safety & Logistics
    {
      id: 'review_toolkit',
      label: 'Review toolkit (food safety, setup, supplies)',
      category: 'Food Safety & Logistics',
      required: true,
      notes: '• Food safety protocols\n• Setup requirements\n• Supplies needed\n• Tablecloths\n• Food-safe gloves',
    },
    {
      id: 'food_safe_gloves',
      label: 'Include food safe gloves, tablecloths, etc.',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'meat_cheese_refrigeration',
      label: 'Meat and cheese must be refrigerated until used',
      category: 'Food Safety & Logistics',
      notes: 'Only take out what is needed. Once made and packed back into bread bag, put back in fridge',
    },
    {
      id: 'discuss_shopping',
      label: 'Discuss shopping: coolers, deli meat & cheese storage, bread',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'transport_meat_cheese',
      label: 'When transporting: meat/cheese on ice packs in cooler',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'buying_supplies',
      label: 'Meat/cheese bought just before event, remain unopened until making',
      category: 'Food Safety & Logistics',
      notes: 'One person who reviewed food safety protocols should buy supplies. Others should not bring ingredients',
    },
    {
      id: 'cooling_sandwiches',
      label: 'Last sandwiches in freezer to cool OR pickup 30+ min after making',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'parking_access',
      label: 'Information for TSP volunteer: parking or building access?',
      category: 'Food Safety & Logistics',
    },
    {
      id: 'backup_contact',
      label: 'Back-up contact? (Name and number)',
      category: 'Food Safety & Logistics',
    },

    // Process Discussion
    {
      id: 'discuss_process',
      label: 'Discuss how groups make sandwiches',
      category: 'Process Discussion',
      notes: 'Have them open PDF: Two slices bread, two slices cheese, two to three slices turkey',
    },
    {
      id: 'assembly_line',
      label: 'Discuss teams making sandwiches in assembly line',
      category: 'Process Discussion',
    },
    {
      id: 'runner_role',
      label: 'Discuss having a runner (gets meat/cheese out, puts sandwiches back)',
      category: 'Process Discussion',
    },
    {
      id: 'typical_rules',
      label: 'Discuss typical event rules: runner needed, food safety (hair tied back, gloves, tablecloths), someone to snap photos',
      category: 'Process Discussion',
    },
  ];

  const itemsByCategory = checklistItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const requiredCount = checklistItems.filter((item) => item.required).length;
  const checkedRequiredCount = checklistItems.filter(
    (item) => item.required && checkedItems.has(item.id)
  ).length;

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset visible state when dialog closes. Note: we deliberately do NOT
      // call clearDraft here — closing without saving should preserve the
      // autosaved draft so the user can resume on the next open.
      setCheckedItems(new Set());
      setItemAnswers({});
      setCallNotes('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setHasUserInteracted(false);
      setPendingRestoreDraft(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl text-[#236383]">
                <Phone className="w-6 h-6" />
                Intake Call Guide
              </DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {eventRequest?.organizationName} • {eventRequest?.firstName}{' '}
                {eventRequest?.lastName}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-sm px-3 py-1"
                style={{ borderColor: '#007E8C', color: '#007E8C' }}
              >
                {checkedRequiredCount}/{requiredCount} Required
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCall}
                className="flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                {isMobile ? 'Call' : 'Copy Number'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {pendingRestoreDraft && (
              <div
                className="border-l-4 border-amber-500 bg-amber-50 rounded-md p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                role="alert"
              >
                <div className="text-sm">
                  <div className="font-semibold text-amber-900">
                    Unsaved intake notes found
                  </div>
                  <div className="text-amber-800 mt-1">
                    A draft from{' '}
                    <span className="font-medium">
                      {formatDraftTimestamp(pendingRestoreDraft.savedAt)}
                    </span>{' '}
                    was autosaved for this event. Restore it, or discard and
                    start fresh?
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={discardPendingDraft}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={restorePendingDraft}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Restore draft
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Info Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-[#236383] mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Quick Reference
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {eventRequest?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Phone:</span>
                    <span>{eventRequest?.phone}</span>
                  </div>
                )}
                {eventRequest?.email && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Email:</span>
                    <span className="truncate">{eventRequest?.email}</span>
                  </div>
                )}
                {eventRequest?.eventAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Address:</span>
                    <span className="truncate">{eventRequest?.eventAddress}</span>
                  </div>
                )}
                {(eventRequest?.desiredEventDate || eventRequest?.scheduledEventDate) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Date:</span>
                    <span>
                      {eventRequest?.scheduledEventDate
                        ? new Date(eventRequest.scheduledEventDate).toLocaleDateString()
                        : eventRequest?.desiredEventDate
                        ? new Date(eventRequest.desiredEventDate).toLocaleDateString()
                        : 'Not set'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Checklist by Category */}
            {Object.entries(itemsByCategory).map(([category, items]) => (
              <div key={category} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-[#236383] mb-3 text-lg flex items-center gap-2">
                  {category === 'Initial Questions' && <Clock className="w-5 h-5" />}
                  {category === 'Location & Area' && <MapPin className="w-5 h-5" />}
                  {category === 'Refrigeration & Type' && <Refrigerator className="w-5 h-5" />}
                  {category === 'Event Details' && <FileText className="w-5 h-5" />}
                  {category === 'Food Safety & Logistics' && <UtensilsCrossed className="w-5 h-5" />}
                  {category === 'Process Discussion' && <Users className="w-5 h-5" />}
                  {category}
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
                        checkedItems.has(item.id)
                          ? 'bg-green-50 border border-green-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="mt-0.5 flex-shrink-0"
                        aria-label={`Toggle ${item.label}`}
                      >
                        {checkedItems.has(item.id) ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <label
                            className={`text-sm cursor-pointer flex-1 ${
                              checkedItems.has(item.id)
                                ? 'text-gray-600 line-through'
                                : 'text-gray-900'
                            }`}
                            onClick={() => toggleItem(item.id)}
                          >
                            {item.label}
                            {item.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                        </div>
                        {item.notes && (
                          <div className="text-xs text-gray-500 mt-1 ml-7 italic">
                            {item.notes.split('\n').map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                          </div>
                        )}
                        {/* Answer input field - special handling for contact info */}
                        <div className="mt-2 ml-7">
                          {item.id === 'contact_name' ? (
                            <Input
                              type="text"
                              placeholder="Record notes here"
                              value={contactName}
                              onChange={(e) => {
                                const value = e.target.value;
                                markInteracted();
                                setContactName(value);
                                handleAnswerChange(item.id, value);
                              }}
                              className="text-sm h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : item.id === 'contact_phone' ? (
                            <Input
                              type="tel"
                              placeholder="Record notes here"
                              value={contactPhone}
                              onChange={(e) => {
                                const value = e.target.value;
                                markInteracted();
                                setContactPhone(value);
                                handleAnswerChange(item.id, value);
                              }}
                              className="text-sm h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : item.id === 'contact_email' ? (
                            <Input
                              type="email"
                              placeholder="Record notes here"
                              value={contactEmail}
                              onChange={(e) => {
                                const value = e.target.value;
                                markInteracted();
                                setContactEmail(value);
                                handleAnswerChange(item.id, value);
                              }}
                              className="text-sm h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : item.id === 'event_date' ? (
                            <Input
                              type="date"
                              value={itemAnswers[item.id] || ''}
                              onChange={(e) =>
                                handleAnswerChange(item.id, e.target.value)
                              }
                              className="text-sm h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : item.id === 'refrigeration' ? (
                            <Select
                              value={itemAnswers[item.id] || ''}
                              onValueChange={(v) => handleAnswerChange(item.id, v)}
                            >
                              <SelectTrigger
                                className="text-sm h-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SelectValue placeholder="Yes / No / Unsure" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="unsure">Unsure</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type="text"
                              placeholder="Record notes here"
                              value={itemAnswers[item.id] || ''}
                              onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                              className="text-sm h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Operating Areas Reference */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-[#236383] mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Typical Operating Areas
              </h3>
              <p className="text-sm text-gray-700 mb-2">
                If event is in these areas, confirm transport feasibility:
              </p>
              <div className="flex flex-wrap gap-2">
                {OPERATING_AREAS.map((area) => (
                  <Badge
                    key={area}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: '#FBAD3F', color: '#D68319' }}
                  >
                    {area}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Call Notes Section */}
            <div className="bg-white border border-gray-300 rounded-lg p-4">
              <Label htmlFor="call-notes" className="text-base font-semibold text-[#236383] mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Call Notes & Information Collected
              </Label>
              <Textarea
                id="call-notes"
                value={callNotes}
                onChange={(e) => {
                  markInteracted();
                  setCallNotes(e.target.value);
                }}
                placeholder="Record information collected during the call: contact details, event specifics, logistics, etc..."
                className="min-h-[150px] mt-2"
              />
              <p className="text-xs text-gray-500 mt-2">
                Use this space to record all the information you collect during the call. This will help ensure nothing is missed.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div className="text-sm text-gray-600 flex items-center gap-3">
            {checkedRequiredCount === requiredCount ? (
              <span className="text-green-600 font-medium">
                ✓ All required items completed
              </span>
            ) : (
              <span>
                Complete {requiredCount - checkedRequiredCount} more required item
                {requiredCount - checkedRequiredCount !== 1 ? 's' : ''}
              </span>
            )}
            {draftSavedAt && (
              <span className="text-xs text-gray-500 italic">
                Draft autosaved {formatDraftTimestamp(draftSavedAt)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Close
            </Button>
            <Button
              onClick={handleComplete}
              className="bg-[#007E8C] hover:bg-[#236383] text-white"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Mark Call Complete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IntakeCallDialog;
