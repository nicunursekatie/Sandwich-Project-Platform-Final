import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEventRequestContext } from './context/EventRequestContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Trash2,
  FileText,
  StickyNote,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, invalidateEventRequestQueries } from '@/lib/queryClient';
import type { EventRequest } from '@shared/schema';
import { STATUS_DEFINITIONS } from './constants';
import type { EventStatus } from '@shared/event-status-workflow';
import { getPickupDateTimeForInput, parsePostgresArray } from './utils';
import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { useEventCollaboration } from '@/hooks/use-event-collaboration';
import { PresenceAvatars } from '@/components/collaboration';
import { RefrigerationWarningAlert } from './RefrigerationWarningBadge';
import {
  ContactInfoSection,
  BackupContactSection,
  CompletedEventSection,
  SandwichPlanningSection,
  ResourceRequirementsSection,
  EventScheduleSection,
  DeliverySection,
  AttendeeSection,
  NotesSection,
  InstructionsSection,
  StatusToolkitSection,
  TspContactSection,
  DateChangeDialog,
  SpeakerWarningDialog,
  VanConflictDialog,
  StandbyFollowUpDialog,
  DeleteConfirmDialog,
  type EventFormData,
} from './form-sections';
import {
  buildEventDataForServer,
  detectChangedFields,
  determineSandwichMode,
  determineActualSandwichMode,
  calculateRelevantSandwichCount,
} from './form-utils';

// ────────────────────────────────────────────────────────────────────────
// Helpers (kept in this file because they reference component-level state)
// ────────────────────────────────────────────────────────────────────────

/**
 * Intelligent merge of cached form data with current server data.
 * Preserves user's intentional changes while accepting server updates.
 * When both user and server changed the same field, server wins.
 */
function intelligentMergeFormData(
  cachedFormData: Record<string, any>,
  originalServerData: Record<string, any> | null | undefined,
  currentServerData: Record<string, any>
): {
  mergedData: Record<string, any>;
  conflicts: string[];
  serverUpdates: string[];
  userChangesPreserved: string[];
} {
  const mergedData: Record<string, any> = { ...currentServerData };
  const conflicts: string[] = [];
  const serverUpdates: string[] = [];
  const userChangesPreserved: string[] = [];

  if (!originalServerData) {
    logger.log('⚠️ No original server data in cache - using CURRENT SERVER DATA (discarding stale cache)');
    return { mergedData: currentServerData, conflicts: [], serverUpdates: [], userChangesPreserved: [] };
  }

  const valuesEqual = (a: any, b: any): boolean => {
    const normalize = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    };
    return normalize(a) === normalize(b);
  };

  for (const key of Object.keys(cachedFormData)) {
    const cachedValue = cachedFormData[key];
    const originalValue = originalServerData[key];
    const currentValue = currentServerData[key];
    const userChangedField = !valuesEqual(cachedValue, originalValue);
    const serverChangedField = !valuesEqual(currentValue, originalValue);

    if (userChangedField && serverChangedField) {
      conflicts.push(key);
      mergedData[key] = currentValue;
    } else if (userChangedField) {
      userChangesPreserved.push(key);
      mergedData[key] = cachedValue;
    } else if (serverChangedField) {
      serverUpdates.push(key);
      mergedData[key] = currentValue;
    }
  }

  if (!mergedData.status) {
    mergedData.status = currentServerData.status || 'new';
  }

  return { mergedData, conflicts, serverUpdates, userChangesPreserved };
}

/**
 * Build form data object from an EventRequest.
 * This is the SINGLE source of truth for server → form mapping.
 * Used for initial population, discard recovery, and intelligent merge.
 */
function buildFormDataFromEventRequest(
  eventRequest: EventRequest | null,
  formatDateForInput: (date: any) => string,
  getPickupDateTimeForInputFn: typeof getPickupDateTimeForInput,
  parsePostgresArrayFn: typeof parsePostgresArray
): Record<string, any> {
  const existingSandwichTypes = eventRequest?.sandwichTypes ?
    (typeof eventRequest?.sandwichTypes === 'string' ?
      JSON.parse(eventRequest.sandwichTypes) : eventRequest?.sandwichTypes) : [];
  const totalCount = eventRequest?.estimatedSandwichCount || 0;
  const existingActualSandwichTypes = eventRequest?.actualSandwichTypes ?
    (typeof eventRequest?.actualSandwichTypes === 'string' ?
      JSON.parse(eventRequest.actualSandwichTypes) : eventRequest?.actualSandwichTypes) : [];

  return {
    eventDate: eventRequest ? formatDateForInput(eventRequest.desiredEventDate || eventRequest.scheduledEventDate) : '',
    dateFlexible: eventRequest?.dateFlexible ?? null,
    backupDates: (eventRequest as any)?.backupDates?.map((d: string) => formatDateForInput(d)) || [],
    eventStartTime: eventRequest?.eventStartTime || '',
    eventEndTime: eventRequest?.eventEndTime || '',
    pickupTime: eventRequest?.pickupTime || '',
    pickupDateTime: getPickupDateTimeForInputFn((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate || eventRequest?.scheduledEventDate)),
    pickupDate: (() => {
      const pickupDT = getPickupDateTimeForInputFn((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate || eventRequest?.scheduledEventDate));
      return pickupDT ? pickupDT.split('T')[0] : '';
    })(),
    pickupTimeSeparate: (() => {
      const pickupDT = getPickupDateTimeForInputFn((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate || eventRequest?.scheduledEventDate));
      return pickupDT ? pickupDT.split('T')[1]?.substring(0, 5) : '';
    })(),
    eventAddress: eventRequest?.eventAddress || '',
    deliveryDestination: eventRequest?.deliveryDestination || '',
    holdingOvernight: !!(eventRequest?.overnightHoldingLocation),
    overnightHoldingLocation: eventRequest?.overnightHoldingLocation || '',
    overnightPickupTime: eventRequest?.overnightPickupTime || '',
    sandwichTypes: existingSandwichTypes,
    hasRefrigeration: eventRequest?.hasRefrigeration?.toString() || '',
    driversNeeded: eventRequest?.driversNeeded || 0,
    selfTransport: eventRequest?.selfTransport || false,
    vanDriverNeeded: eventRequest?.vanDriverNeeded || false,
    speakersNeeded: eventRequest?.speakersNeeded || 0,
    volunteersNeeded: eventRequest?.volunteersNeeded || 0,
    tspContact: eventRequest?.tspContact || '',
    customTspContact: (eventRequest as any)?.customTspContact || '',
    message: (eventRequest as any)?.message || '',
    schedulingNotes: (eventRequest as any)?.schedulingNotes || '',
    planningNotes: (eventRequest as any)?.planningNotes || '',
    nextAction: (eventRequest as any)?.nextAction || '',
    driverInstructions: (eventRequest as any)?.driverInstructions || '',
    volunteerInstructions: (eventRequest as any)?.volunteerInstructions || '',
    speakerInstructions: (eventRequest as any)?.speakerInstructions || '',
    totalSandwichCount: totalCount,
    estimatedSandwichCountMin: (eventRequest as any)?.estimatedSandwichCountMin || 0,
    estimatedSandwichCountMax: (eventRequest as any)?.estimatedSandwichCountMax || 0,
    rangeSandwichType: (eventRequest as any)?.estimatedSandwichRangeType || '',
    volunteerCount: (eventRequest as any)?.volunteerCount || 0,
    estimatedAttendance: (eventRequest as any)?.estimatedAttendance || 0,
    adultCount: (eventRequest as any)?.adultCount || 0,
    childrenCount: (eventRequest as any)?.childrenCount || 0,
    kidsAgeRange: (eventRequest as any)?.kidsAgeRange || '',
    firstName: eventRequest?.firstName || '',
    lastName: eventRequest?.lastName || '',
    email: eventRequest?.email || '',
    phone: eventRequest?.phone || '',
    organizationName: eventRequest?.organizationName || '',
    department: eventRequest?.department || '',
    organizationCategory: (eventRequest as any)?.organizationCategory || '',
    schoolClassification: (eventRequest as any)?.schoolClassification || '',
    backupContactFirstName: (eventRequest as any)?.backupContactFirstName || '',
    backupContactLastName: (eventRequest as any)?.backupContactLastName || '',
    backupContactEmail: (eventRequest as any)?.backupContactEmail || '',
    backupContactPhone: (eventRequest as any)?.backupContactPhone || '',
    backupContactRole: (eventRequest as any)?.backupContactRole || '',
    previouslyHosted: (eventRequest as any)?.previouslyHosted || 'i_dont_know',
    speakerAudienceType: (eventRequest as any)?.speakerAudienceType || '',
    speakerDuration: (eventRequest as any)?.speakerDuration || '',
    deliveryTimeWindow: (eventRequest as any)?.deliveryTimeWindow || '',
    deliveryParkingAccess: (eventRequest as any)?.deliveryParkingAccess || '',
    assignedVanDriverId: eventRequest?.assignedVanDriverId || '',
    isDhlVan: (eventRequest as any)?.isDhlVan || false,
    status: eventRequest?.status || 'new',
    toolkitSent: eventRequest?.toolkitSent || false,
    toolkitSentDate: eventRequest?.toolkitSentDate ? formatDateForInput(eventRequest.toolkitSentDate) : '',
    toolkitStatus: eventRequest?.toolkitStatus || 'not_sent',
    isCorporatePriority: (eventRequest as any)?.isCorporatePriority || false,
    standbyExpectedDate: (eventRequest as any)?.standbyExpectedDate ? formatDateForInput((eventRequest as any).standbyExpectedDate) : '',
    socialMediaPostRequested: (eventRequest as any)?.socialMediaPostRequested || false,
    socialMediaPostRequestedDate: (eventRequest as any)?.socialMediaPostRequestedDate ? formatDateForInput((eventRequest as any).socialMediaPostRequestedDate) : '',
    socialMediaPostCompleted: (eventRequest as any)?.socialMediaPostCompleted || false,
    socialMediaPostCompletedDate: (eventRequest as any)?.socialMediaPostCompletedDate ? formatDateForInput((eventRequest as any).socialMediaPostCompletedDate) : '',
    socialMediaPostNotes: (eventRequest as any)?.socialMediaPostNotes || '',
    actualSandwichCount: (eventRequest as any)?.actualSandwichCount || 0,
    actualSandwichTypes: existingActualSandwichTypes,
    actualSandwichCountRecordedDate: (eventRequest as any)?.actualSandwichCountRecordedDate ? formatDateForInput((eventRequest as any).actualSandwichCountRecordedDate) : '',
    actualSandwichCountRecordedBy: (eventRequest as any)?.actualSandwichCountRecordedBy || '',
    followUpOneDayCompleted: (eventRequest as any)?.followUpOneDayCompleted || false,
    followUpOneDayDate: (eventRequest as any)?.followUpOneDayDate ? formatDateForInput((eventRequest as any).followUpOneDayDate) : '',
    followUpOneMonthCompleted: (eventRequest as any)?.followUpOneMonthCompleted || false,
    followUpOneMonthDate: (eventRequest as any)?.followUpOneMonthDate ? formatDateForInput((eventRequest as any).followUpOneMonthDate) : '',
    followUpNotes: (eventRequest as any)?.followUpNotes || '',
    assignedRecipientIds: parsePostgresArrayFn((eventRequest as any)?.assignedRecipientIds),
  };
}

// ────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────

interface EventSchedulingFormProps {
  eventRequest: EventRequest | null;
  isVisible?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onScheduled?: () => void;
  onEventScheduled?: () => void;
  onDelete?: (eventRequestId: number) => void;
  mode?: 'schedule' | 'edit' | 'create';
}

const EventSchedulingForm: React.FC<EventSchedulingFormProps> = ({
  eventRequest,
  isVisible,
  isOpen,
  onClose,
  onScheduled,
  onEventScheduled,
  onDelete,
  mode = 'schedule',
}) => {
  const dialogOpen = isVisible || isOpen || false;
  const onSuccessCallback = onScheduled || onEventScheduled || (() => {});

  // Scratchpad context for opening the standalone scratchpad dialog
  const { setScratchpadEventRequest, setShowScratchpad } = useEventRequestContext();

  // ── Data Fetching ──────────────────────────────────────────────────

  const { data: fullEventRequest } = useQuery<EventRequest>({
    queryKey: ['/api/event-requests', eventRequest?.id, 'full'],
    queryFn: async () => {
      const response = await fetch(`/api/event-requests/${eventRequest!.id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch full event data');
      return response.json();
    },
    enabled: dialogOpen && !!eventRequest?.id,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });

  const effectiveEventRequest = fullEventRequest || eventRequest;

  // ── Form State ─────────────────────────────────────────────────────

  const [formData, setFormData] = useState<Record<string, any>>({
    eventDate: '', backupDates: [] as string[], eventStartTime: '', eventEndTime: '',
    pickupTime: '', pickupDateTime: '', pickupDate: '', pickupTimeSeparate: '',
    eventAddress: '', deliveryDestination: '', holdingOvernight: false,
    overnightHoldingLocation: '', overnightPickupTime: '',
    sandwichTypes: [] as Array<{type: string, quantity: number}>,
    hasRefrigeration: '', driversNeeded: 0, selfTransport: false, vanDriverNeeded: false,
    assignedVanDriverId: '', isDhlVan: false, speakersNeeded: 0, volunteersNeeded: 0,
    tspContact: '', customTspContact: '', message: '', schedulingNotes: '',
    planningNotes: '', nextAction: '', driverInstructions: '', volunteerInstructions: '',
    speakerInstructions: '', totalSandwichCount: 0, estimatedSandwichCountMin: 0,
    estimatedSandwichCountMax: 0, rangeSandwichType: '', volunteerCount: 0,
    estimatedAttendance: 0, adultCount: 0, childrenCount: 0, kidsAgeRange: '',
    status: 'new', toolkitSent: false, toolkitSentDate: '', toolkitStatus: 'not_sent',
    socialMediaPostRequested: false, socialMediaPostRequestedDate: '',
    socialMediaPostCompleted: false, socialMediaPostCompletedDate: '',
    socialMediaPostNotes: '', actualSandwichCount: 0,
    actualSandwichTypes: [] as Array<{type: string, quantity: number}>,
    actualSandwichCountRecordedDate: '', actualSandwichCountRecordedBy: '',
    followUpOneDayCompleted: false, followUpOneDayDate: '',
    followUpOneMonthCompleted: false, followUpOneMonthDate: '', followUpNotes: '',
    assignedRecipientIds: [] as string[], manualEntrySource: '',
    firstName: '', lastName: '', email: '', phone: '', organizationName: '',
    department: '', organizationCategory: '', schoolClassification: '',
    backupContactFirstName: '', backupContactLastName: '', backupContactEmail: '',
    backupContactPhone: '', backupContactRole: '', previouslyHosted: 'i_dont_know',
    speakerAudienceType: '', speakerDuration: '', deliveryTimeWindow: '',
    deliveryParkingAccess: '', isCorporatePriority: false, standbyExpectedDate: '',
    dateFlexible: null as boolean | null,
  });

  const [sandwichMode, setSandwichMode] = useState<'total' | 'range' | 'types'>('total');
  const [actualSandwichMode, setActualSandwichMode] = useState<'total' | 'types'>('total');
  const [attendeeMode, setAttendeeMode] = useState<'total' | 'breakdown'>('total');

  // ── UI State ───────────────────────────────────────────────────────

  const [formInitialized, setFormInitialized] = useState(false);
  const originalFormDataRef = useRef<Record<string, any> | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showBackupContactInfo, setShowBackupContactInfo] = useState(false);
  const [showCompletedDetails, setShowCompletedDetails] = useState(false);
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState('');
  const [isMessageEditable, setIsMessageEditable] = useState(false);
  const [showVanConflictDialog, setShowVanConflictDialog] = useState(false);
  const [vanConflictDetails, setVanConflictDetails] = useState<{
    conflictingEvents: Array<{ id: number; name: string; time?: string }>;
    acknowledged: boolean;
  } | null>(null);
  const [showSpeakerWarningDialog, setShowSpeakerWarningDialog] = useState(false);
  const [vanConflictChecked, setVanConflictChecked] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showStandbyFollowUpDialog, setShowStandbyFollowUpDialog] = useState(false);
  const [standbyFollowUpDate, setStandbyFollowUpDate] = useState('');
  const [standbyFollowUpMode, setStandbyFollowUpMode] = useState<'specific' | 'one_week'>('one_week');
  const standbySaveClickedRef = useRef(false);
  const [hasRecoveredData, setHasRecoveredData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Version tracking for optimistic locking
  const callNotesExpectedVersionRef = useRef<string | null>(null);


  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // ── Derived Values ─────────────────────────────────────────────────

  const isCreateMode = mode === 'create' || !eventRequest;




  const canRemoveCorporatePriority = useMemo(() => {
    const allowedEmails = [
      'admin@sandwich.project', 'katielong2316@gmail.com',
      'katie@thesandwichproject.org', 'christine@thesandwichproject.org',
    ];
    const userEmail = currentUser?.email?.toLowerCase();
    return userEmail && allowedEmails.includes(userEmail);
  }, [currentUser?.email]);

  // ── Date Formatting ────────────────────────────────────────────────

  const formatDateForInput = (date: any) => {
    if (!date) return '';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // ── Auto-Save ──────────────────────────────────────────────────────

  const getAutoSaveKey = useCallback(() => {
    return `tsp-event-form-autosave-${eventRequest?.id || 'new'}`;
  }, [eventRequest?.id]);

  const clearAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    try { localStorage.removeItem(getAutoSaveKey()); } catch (e) { /* ignore */ }
  }, [getAutoSaveKey]);

  const saveToLocalStorage = useCallback(() => {
    if (!formInitialized) return;
    try {
      localStorage.setItem(getAutoSaveKey(), JSON.stringify({
        formData, sandwichMode, actualSandwichMode, attendeeMode,
        savedAt: new Date().toISOString(),
        eventId: eventRequest?.id || null,
        originalServerData: originalFormDataRef.current,
      }));
    } catch (e) { /* ignore */ }
  }, [formData, sandwichMode, actualSandwichMode, attendeeMode, formInitialized, getAutoSaveKey, eventRequest?.id]);

  const skipRecoveryRef = useRef(false);

  // ── Discard Recovered Data ─────────────────────────────────────────
  // FIXED: Now uses buildFormDataFromEventRequest instead of 200 lines of copy-paste

  const discardRecoveredData = useCallback(() => {
    clearAutoSave();
    setHasRecoveredData(false);
    skipRecoveryRef.current = true;

    const sourceEvent = effectiveEventRequest || eventRequest;
    if (!sourceEvent) return;

    // Use the shared helper instead of duplicating all field mappings
    const serverFormData = buildFormDataFromEventRequest(
      sourceEvent, formatDateForInput, getPickupDateTimeForInput, parsePostgresArray
    );
    setFormData(serverFormData);

    // Determine modes from data
    setSandwichMode(determineSandwichMode(
      sourceEvent.sandwichTypes,
      (sourceEvent as any)?.estimatedSandwichCountMin,
      (sourceEvent as any)?.estimatedSandwichCountMax
    ));
    setActualSandwichMode(determineActualSandwichMode(sourceEvent?.actualSandwichTypes));
    const hasAttendeeBreakdown = ((sourceEvent as any)?.adultCount || 0) > 0 || ((sourceEvent as any)?.childrenCount || 0) > 0;
    setAttendeeMode(hasAttendeeBreakdown ? 'breakdown' : 'total');
    setShowCompletedDetails(sourceEvent?.status === 'completed');

    // Update originalFormDataRef using the same helper
    originalFormDataRef.current = serverFormData;
    setFormInitialized(true);

    toast({ title: 'Changes discarded', description: 'Form has been reset to the last saved version.' });
  }, [effectiveEventRequest, eventRequest, clearAutoSave, toast]);

  // ── Auto-save effect ───────────────────────────────────────────────

  useEffect(() => {
    if (!dialogOpen || !formInitialized || isSubmitting) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (!isSubmitting) saveToLocalStorage();
    }, 1000);

    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [dialogOpen, formInitialized, formData, sandwichMode, actualSandwichMode, attendeeMode, saveToLocalStorage, isSubmitting]);

  // ── Collaboration ──────────────────────────────────────────────────

  const collaboration = useEventCollaboration(eventRequest?.id ?? null);
  const isCollaborationEnabled = !!(eventRequest && eventRequest.id);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: vanDrivers = [] } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
    select: (drivers) => drivers.filter(driver => driver.vanApproved),
    staleTime: 10 * 60 * 1000,
  });

  const handleFieldFocus = useCallback(async (fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return;
    try {
      await collaboration.acquireFieldLock?.(fieldName);
    } catch (error) {
      const err = error as Error;
      const isLockConflict = err.message?.includes('locked by') || err.message?.includes('Field is locked');
      if (isLockConflict) {
        toast({ title: 'Field Locked', description: err.message || 'This field is currently being edited by another user.', variant: 'destructive' });
      }
    }
  }, [isCollaborationEnabled, collaboration, toast]);

  const handleFieldBlur = useCallback(async (fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return;
    try { await collaboration.releaseFieldLock?.(fieldName); } catch (error) { /* ignore */ }
  }, [isCollaborationEnabled, collaboration]);

  const isFieldLockedByOther = useCallback((fieldName: string): boolean => {
    if (!isCollaborationEnabled || !collaboration || !currentUser) return false;
    return collaboration.isFieldLockedByOther?.(fieldName, currentUser.id) || false;
  }, [isCollaborationEnabled, collaboration, currentUser]);

  const getFieldLock = useCallback((fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return null;
    return collaboration.locks?.get(fieldName) || null;
  }, [isCollaborationEnabled, collaboration]);

  // Handle real-time field updates from other users
  useEffect(() => {
    if (!isCollaborationEnabled || !collaboration) return;
    const cleanup = collaboration.onFieldUpdate?.((fieldName, value, version) => {
      if (fieldName === 'status' && !value) return;
      setFormData(prev => ({ ...prev, [fieldName]: value }));
      toast({ title: 'Field Updated', description: `${fieldName} was updated by another user.` });
    });
    return cleanup;
  }, [isCollaborationEnabled, collaboration, toast]);

  // Cleanup field locks on unmount
  useEffect(() => {
    return () => {
      if (!isCollaborationEnabled || !collaboration?.locks || !currentUser) return;
      collaboration.locks.forEach((lock, fieldName) => {
        if (lock.lockedBy === currentUser.id) {
          collaboration.releaseFieldLock?.(fieldName)?.catch(() => {});
        }
      });
    };
  }, [isCollaborationEnabled, collaboration, currentUser]);

  // ── Form Initialization ────────────────────────────────────────────

  const formInitSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (dialogOpen) {
      // Include whether we have full data in the session key so the form
      // re-initializes when fullEventRequest loads (not just the partial prop)
      const currentEventId = effectiveEventRequest?.id || 'new';
      const sessionKey = `${currentEventId}-${fullEventRequest ? 'full' : 'partial'}`;

      if (formInitSessionRef.current === sessionKey && formInitialized) return;

      // UPGRADE PATH: When transitioning from partial → full data, preserve user edits
      // instead of wiping the form. Only update the baseline (originalFormDataRef) so
      // change detection works against the complete server data.
      const prevSessionKey = formInitSessionRef.current || '';
      const prevEventId = prevSessionKey.replace(/-(?:partial|full)$/, '');
      const currentEventIdStr = String(currentEventId);
      const isPartialToFull = prevEventId === currentEventIdStr && prevSessionKey.endsWith('-partial') && sessionKey.endsWith('-full') && formInitialized;
      if (isPartialToFull) {
        const fullServerData = buildFormDataFromEventRequest(
          effectiveEventRequest, formatDateForInput, getPickupDateTimeForInput, parsePostgresArray
        );
        const oldBaseline = originalFormDataRef.current || {};

        // Find fields the user has changed since the partial init
        const userEdits: Record<string, any> = {};
        Object.keys(formData).forEach(key => {
          const currentVal = (formData as any)[key];
          const baselineVal = oldBaseline[key];
          // Normalize for comparison
          const norm = (v: any) => (v === '' || v === null || v === undefined) ? null : v;
          if (Array.isArray(currentVal) && Array.isArray(baselineVal)) {
            if (JSON.stringify(currentVal) !== JSON.stringify(baselineVal)) {
              userEdits[key] = currentVal;
            }
          } else if (norm(currentVal) !== norm(baselineVal)) {
            userEdits[key] = currentVal;
          }
        });

        // Update baseline to full server data
        originalFormDataRef.current = fullServerData;
        formInitSessionRef.current = sessionKey;

        // Re-apply user edits on top of full server data
        if (Object.keys(userEdits).length > 0) {
          setFormData({ ...fullServerData, ...userEdits } as any);
          logger.log('🔄 Upgraded form to full data, preserved user edits:', Object.keys(userEdits));
        } else {
          setFormData(fullServerData as any);
        }

        // Update modes from full data
        setSandwichMode(determineSandwichMode(
          effectiveEventRequest?.sandwichTypes,
          (effectiveEventRequest as any)?.estimatedSandwichCountMin,
          (effectiveEventRequest as any)?.estimatedSandwichCountMax
        ));
        setActualSandwichMode(determineActualSandwichMode(effectiveEventRequest?.actualSandwichTypes));
        const hasBreakdown = ((effectiveEventRequest as any)?.adultCount || 0) > 0 || ((effectiveEventRequest as any)?.childrenCount || 0) > 0;
        setAttendeeMode(hasBreakdown ? 'breakdown' : 'total');
        setShowCompletedDetails(effectiveEventRequest?.status === 'completed');
        return;
      }

      formInitSessionRef.current = sessionKey;
      setFormInitialized(false);
      setHasRecoveredData(false);

      let recoveredFromStorage = false;
      let mergedOriginalFormDataRef: Record<string, any> | null = null;

      // Auto-save recovery
      const shouldSkipRecovery = skipRecoveryRef.current;
      skipRecoveryRef.current = false;

      try {
        const savedDataStr = !shouldSkipRecovery ? localStorage.getItem(getAutoSaveKey()) : null;
        if (savedDataStr) {
          const savedData = JSON.parse(savedDataStr);
          const savedEventId = savedData.eventId;
          const currentEvtId = eventRequest?.id || null;

          if (savedEventId === currentEvtId) {
            const savedAt = new Date(savedData.savedAt);
            const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
            const savedStatus = savedData.formData?.status;
            const serverStatus = effectiveEventRequest?.status;
            const statusMismatch = savedStatus && serverStatus && savedStatus !== serverStatus;

            if (statusMismatch) {
              clearAutoSave();
            } else if (hoursSinceSave < 24) {
              const currentServerData = buildFormDataFromEventRequest(
                effectiveEventRequest, formatDateForInput, getPickupDateTimeForInput, parsePostgresArray
              );
              const { mergedData, conflicts, serverUpdates, userChangesPreserved } = intelligentMergeFormData(
                savedData.formData, savedData.originalServerData, currentServerData
              );

              setFormData(mergedData as any);
              if (savedData.sandwichMode) setSandwichMode(savedData.sandwichMode);
              if (savedData.actualSandwichMode) setActualSandwichMode(savedData.actualSandwichMode);
              if (savedData.attendeeMode) setAttendeeMode(savedData.attendeeMode);
              setHasRecoveredData(true);
              recoveredFromStorage = true;
              // IMPORTANT: originalFormDataRef must be SERVER data, not merged data.
              // Otherwise recovered user changes won't be detected as "changed" on submit.
              mergedOriginalFormDataRef = currentServerData;
              setShowCompletedDetails(mergedData.status === 'completed');

              // Notify user about merge results
              if (conflicts.length > 0) {
                toast({ title: 'Changes merged with conflicts', description: `${conflicts.length} field(s) were updated by others: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '...' : ''}`, duration: 10000 });
              } else if (serverUpdates.length > 0 && userChangesPreserved.length > 0) {
                toast({ title: 'Changes merged successfully', description: `${userChangesPreserved.length} change(s) preserved, ${serverUpdates.length} update(s) applied.`, duration: 6000 });
              } else if (userChangesPreserved.length > 0) {
                toast({ title: 'Form data recovered', description: 'Your unsaved changes have been restored. Click "Discard" to start fresh.' });
              }
            } else {
              clearAutoSave();
            }
          }
        }
      } catch (e) { /* ignore */ }

      // If no recovery, populate from server data
      if (!recoveredFromStorage) {
        const serverFormData = buildFormDataFromEventRequest(
          effectiveEventRequest, formatDateForInput, getPickupDateTimeForInput, parsePostgresArray
        );
        setFormData(serverFormData as any);
        setSandwichMode(determineSandwichMode(
          effectiveEventRequest?.sandwichTypes,
          (effectiveEventRequest as any)?.estimatedSandwichCountMin,
          (effectiveEventRequest as any)?.estimatedSandwichCountMax
        ));
        setActualSandwichMode(determineActualSandwichMode(effectiveEventRequest?.actualSandwichTypes));
        const hasBreakdown = ((effectiveEventRequest as any)?.adultCount || 0) > 0 || ((effectiveEventRequest as any)?.childrenCount || 0) > 0;
        setAttendeeMode(hasBreakdown ? 'breakdown' : 'total');
        setShowCompletedDetails(effectiveEventRequest?.status === 'completed');
      }

      // Set originalFormDataRef to server data (the true DB baseline).
      // This must ALWAYS reflect what the server has — never the user's recovered/merged changes.
      // Using merged data here caused detectChangedFields to see no diff on recovered data,
      // silently dropping saves (e.g. vanDriverNeeded checkbox would never persist).
      originalFormDataRef.current = buildFormDataFromEventRequest(
        effectiveEventRequest, formatDateForInput, getPickupDateTimeForInput, parsePostgresArray
      );
      setFormInitialized(true);
    } else {
      // Dialog closed
      setFormInitialized(false);
      formInitSessionRef.current = null;

      if (originalFormDataRef.current) {
        if (JSON.stringify(formData) === JSON.stringify(originalFormDataRef.current)) {
          clearAutoSave();
        }
      }
    }
  }, [isVisible, isOpen, effectiveEventRequest, fullEventRequest, mode, getAutoSaveKey, clearAutoSave, toast]);

  // Auto-expand contact info in create mode
  useEffect(() => {
    if (isCreateMode) setShowContactInfo(true);
  }, [isCreateMode]);

  // ── Version Tracking for Optimistic Locking ──────────────────────

  useEffect(() => {
    callNotesExpectedVersionRef.current = effectiveEventRequest?.updatedAt ? String(effectiveEventRequest.updatedAt) : null;
  }, [effectiveEventRequest?.updatedAt]);

  // ── Sync message field from scratchpad ──────────────────────────
  // When the standalone scratchpad syncs call notes to the server, the query cache
  // updates effectiveEventRequest.message. Keep the form in sync so saving the form
  // doesn't overwrite the scratchpad's notes with stale data.
  useEffect(() => {
    if (!formInitialized || effectiveEventRequest?.message === undefined) return;
    const serverMessage = effectiveEventRequest.message || '';
    const baselineMessage = originalFormDataRef.current?.message || '';
    const formMessage = (formData as any).message || '';

    // Only update if: server message changed from baseline AND form hasn't locally modified it
    if (serverMessage !== baselineMessage && formMessage === baselineMessage) {
      setFormData((prev: any) => ({ ...prev, message: serverMessage }));
      if (originalFormDataRef.current) {
        originalFormDataRef.current = { ...originalFormDataRef.current, message: serverMessage };
      }
    }
  }, [effectiveEventRequest?.message, formInitialized]);


  // ── Mutations ──────────────────────────────────────────────────────

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      const payload = { ...data };
      // Use effectiveEventRequest (full data) for version check, not the stale prop
      const latestUpdatedAt = callNotesExpectedVersionRef.current || effectiveEventRequest?.updatedAt || eventRequest?.updatedAt;
      if (latestUpdatedAt) payload._expectedVersion = latestUpdatedAt;
      return apiRequest('PATCH', `/api/event-requests/${id}`, payload);
    },
    networkMode: 'always',
    onSuccess: async (updatedEvent: any) => {
      setIsSubmitting(false);
      clearAutoSave();
      setHasRecoveredData(false);
      const orgName = eventRequest?.organizationName || formData.organizationName || 'Event';
      toast({
        title: mode === 'edit' ? 'Changes Saved Successfully' : 'Event Scheduled Successfully',
        description: mode === 'edit'
          ? `Your changes to "${orgName}" have been saved to the database.`
          : `"${orgName}" has been scheduled and saved.`,
        duration: 8000,
      });
      await invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      const serverMessage = error?.data?.message || error?.message;
      const isConflict = error?.status === 409 || error?.code?.includes('CONFLICT');
      const isNotFound = error?.status === 404 || serverMessage?.includes('not found');
      const isNetworkError = error?.message?.includes('Failed to fetch') || error?.message?.includes('Request timeout');
      const orgName = eventRequest?.organizationName || formData.organizationName || 'this event';

      let errorTitle = 'Save Failed';
      let errorDescription = mode === 'edit' ? 'Failed to update event.' : 'Failed to schedule event.';

      if (isConflict) {
        errorTitle = 'Edit Conflict';
        saveToLocalStorage();
        errorDescription = 'This event was modified by another user. Please close and reopen to see latest data. Your changes are saved locally.';
        invalidateEventRequestQueries(queryClient);
      } else if (isNotFound) {
        errorTitle = 'Event Not Found';
        errorDescription = 'The event request was not found. It may have been deleted.';
      } else if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = `Could not save changes to "${orgName}". Check your connection and try again.`;
      } else if (serverMessage) {
        errorDescription = serverMessage;
      }

      toast({ title: errorTitle, description: errorDescription, variant: 'destructive', duration: 10000 });
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/event-requests', data),
    networkMode: 'always',
    onSuccess: async () => {
      clearAutoSave();
      setHasRecoveredData(false);
      toast({ title: 'Event Created Successfully', description: `"${formData.organizationName || 'New event'}" has been created.`, duration: 8000 });
      await invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      saveToLocalStorage();
      const serverMessage = error?.data?.message || error?.message;
      const isNetworkError = error?.message?.includes('Failed to fetch') || error?.message?.includes('Request timeout');
      let errorTitle = 'Creation Failed';
      let errorDescription = serverMessage || 'Failed to create event. Please try again.';
      if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = 'Could not create event. Check your connection.';
      }
      toast({ title: errorTitle, description: errorDescription, variant: 'destructive', duration: 10000 });
    },
  });

  const deleteEventRequestMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/event-requests/${id}`),
    onSuccess: () => {
      toast({ title: 'Event deleted successfully', description: 'The event request has been deleted.' });
      invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete event.', variant: 'destructive' });
    },
  });

  // ── Van Conflict Check ─────────────────────────────────────────────

  const eventLikelyNeedsVan = (): boolean => {
    if ((formData.vanDriverNeeded || formData.isDhlVan) && !formData.selfTransport) return true;
    const count = sandwichMode === 'total' ? formData.totalSandwichCount
      : sandwichMode === 'range' ? (formData.estimatedSandwichCountMax || formData.estimatedSandwichCountMin || 0)
      : formData.sandwichTypes.reduce((sum: number, item: any) => sum + item.quantity, 0);
    if (count > 500) return true;
    const notes = `${formData.schedulingNotes || ''} ${formData.planningNotes || ''}`.toLowerCase();
    if (/\bvan\b/.test(notes) && !notes.includes('van-approved') && !notes.includes('van approved')) return true;
    return false;
  };

  const checkVanConflicts = async (): Promise<boolean> => {
    if (!formData.eventDate || !eventLikelyNeedsVan()) return true;
    try {
      const response = await fetch(`/api/event-requests/conflicts-for-date?date=${formData.eventDate}`);
      if (!response.ok) return true;
      const data = await response.json();
      if (data.vanConflicts?.length > 0) {
        const conflictingEvents = data.vanConflicts.flatMap((c: any) => [
          { id: c.event1?.id, name: c.event1?.organizationName, time: c.event1?.eventStartTime },
          { id: c.event2?.id, name: c.event2?.organizationName, time: c.event2?.eventStartTime },
        ]).filter((e: any) => e.id !== eventRequest?.id);
        const uniqueEvents = Array.from(new Map(conflictingEvents.map((e: any) => [e.id, e])).values());
        if (uniqueEvents.length > 0) {
          toast({
            title: 'Van Availability Notice',
            description: `The van may already be assigned to: ${uniqueEvents.map((e: any) => e.name + (e.time ? ` at ${e.time}` : '')).join(', ')}`,
            duration: 12000,
          });
          return false;
        }
      }
      return true;
    } catch { return true; }
  };

  // ── Submit ─────────────────────────────────────────────────────────

  const performSubmit = async (skipSpeakerWarning = false, fieldOverrides?: Record<string, any>) => {
    setIsSubmitting(true);
    clearAutoSave();

    // Block submission if form not initialized
    if (eventRequest && !formInitialized) {
      setIsSubmitting(false);
      logger.log('⛔ Save blocked: form not initialized');
      toast({ title: 'Please wait', description: 'Form is still loading. Please try again in a moment.', variant: 'destructive' });
      return;
    }

    // Speaker warning check
    const totalRelevantSandwiches = calculateRelevantSandwichCount(formData as EventFormData, sandwichMode);
    if (!skipSpeakerWarning && totalRelevantSandwiches > 500 && formData.speakersNeeded < 1) {
      setIsSubmitting(false);
      logger.log('⚠️ Save paused: speaker warning dialog shown');
      setShowSpeakerWarningDialog(true);
      return;
    }

    // Manual entry source is strongly recommended, but should not block saves.
    // Intake often captures details over multiple touchpoints/calls.
    if (isCreateMode && !formData.manualEntrySource) {
      logger.log('⚠️ Save continuing without manual entry source');
      toast({
        title: 'Request source not selected',
        description: 'Save will continue. You can add "How did this request come in?" later from Primary Contact Information.',
        duration: 5000,
      });
      setShowContactInfo(true);
    }

    // Build server payload using extracted utility
    let eventData: Record<string, any>;
    try {
      eventData = buildEventDataForServer(formData as any, {
        mode,
        hasEventRequest: !!eventRequest,
        eventRequestStatus: eventRequest?.status,
        sandwichMode,
        actualSandwichMode,
        fieldOverrides,
      });
    } catch (constructionError) {
      console.error('❌ [PROD DEBUG] ERROR constructing eventData:', constructionError);
      setIsSubmitting(false);
      toast({ title: 'Error', description: 'Failed to prepare form data. Please try again.', variant: 'destructive' });
      return;
    }

    if (eventRequest) {
      if (!eventRequest.id) {
        logger.log('⛔ Save blocked: no event ID');
        toast({ title: 'Error', description: 'Event request ID is missing. Please refresh.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      if (!originalFormDataRef.current) {
        logger.log('⛔ Save blocked: originalFormDataRef is null');
        toast({ title: 'Please wait', description: 'Form is still initializing. Please try again.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      // Detect changed fields using extracted utility
      const filteredEventData = detectChangedFields(eventData, originalFormDataRef.current, mode);

      // In edit mode, if nothing changed, tell the user
      if (mode === 'edit' && Object.keys(filteredEventData).length === 0) {
        setIsSubmitting(false);
        logger.log('⛔ Save blocked: no changes detected. Van fields - formData:', formData.vanDriverNeeded, 'original:', originalFormDataRef.current.vanDriverNeeded);
        toast({ description: 'No changes detected. Make a change and try saving again.' });
        return;
      }

      logger.log('🔄 Updating event:', eventRequest.id, 'Changed fields:', Object.keys(filteredEventData), 'Van:', filteredEventData.vanDriverNeeded);
      // VAN DRIVER DEBUG: always log so bug can be diagnosed in production
      console.info('[VAN DRIVER SAVE] event:', eventRequest.id, 'in filteredEventData:', { vanDriverNeeded: filteredEventData.vanDriverNeeded, assignedVanDriverId: filteredEventData.assignedVanDriverId, isDhlVan: filteredEventData.isDhlVan }, 'in formData:', { vanDriverNeeded: (formData as any).vanDriverNeeded, assignedVanDriverId: (formData as any).assignedVanDriverId, isDhlVan: (formData as any).isDhlVan }, 'original baseline:', { vanDriverNeeded: originalFormDataRef.current?.vanDriverNeeded, assignedVanDriverId: originalFormDataRef.current?.assignedVanDriverId, isDhlVan: originalFormDataRef.current?.isDhlVan });
      updateEventRequestMutation.mutate({ id: eventRequest.id, data: filteredEventData });
    } else {
      logger.log('➕ Creating new event');
      createEventRequestMutation.mutate(eventData);
    }
  };

  // ── Status Change Handler ──────────────────────────────────────────

  const handleStatusChange = (newStatus: EventStatus) => {
    if (newStatus === 'cancelled' || newStatus === 'declined' || newStatus === 'non_event' || newStatus === 'rescheduled') {
      const statusLabel = STATUS_DEFINITIONS[newStatus]?.label || newStatus;
      toast({
        title: 'Status Change Requires Documentation',
        description: `When saving, please ensure you've documented the reason for changing to ${statusLabel} in the notes field.`,
        duration: 6000,
      });
    }
    setFormData(prev => ({ ...prev, status: newStatus }));
  };

  // ── Form Submit Handler ────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Non-blocking van conflict check
    if (eventLikelyNeedsVan() && !vanConflictChecked) {
      checkVanConflicts()
        .then(noConflicts => { setVanConflictChecked(true); })
        .catch(() => { setVanConflictChecked(true); });
    }

    // Standby follow-up date prompt
    const originalStatus = eventRequest?.status || 'new';
    if (formData.status === 'standby' && originalStatus !== 'standby' && !formData.standbyExpectedDate) {
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      setStandbyFollowUpDate(oneWeekFromNow.toISOString().split('T')[0]);
      setStandbyFollowUpMode('one_week');
      setShowStandbyFollowUpDialog(true);
      return;
    }

    await performSubmit(false);
  };

  // ── Date Change ────────────────────────────────────────────────────

  const handleDateChangeConfirmation = () => {
    setFormData(prev => ({ ...prev, eventDate: pendingDateChange }));
    setShowDateConfirmation(false);
    setPendingDateChange('');
  };

  // ── Section Progress ───────────────────────────────────────────────

  const sectionStatus = {
    contact: !!(formData.firstName || formData.lastName || formData.email || formData.phone),
    schedule: !!formData.eventDate,
    delivery: !!(formData.eventAddress || (formData.assignedRecipientIds?.length > 0)),
    sandwiches: !!(formData.totalSandwichCount > 0 || formData.sandwichTypes?.length > 0 || formData.estimatedSandwichCountMin > 0),
    resources: !!(formData.driversNeeded > 0 || formData.speakersNeeded > 0 || formData.volunteersNeeded > 0 || formData.selfTransport),
    notes: !!(formData.schedulingNotes || formData.planningNotes || formData.nextAction),
  };
  const completedSections = Object.values(sectionStatus).filter(Boolean).length;
  const totalSections = Object.keys(sectionStatus).length;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <Dialog open={dialogOpen} onOpenChange={onClose} modal={false}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-[#236383]">
              {isCreateMode ? 'Create New Event' : `${mode === 'edit' ? 'Edit Event Details:' : 'Schedule Event:'} ${eventRequest?.organizationName}`}
            </DialogTitle>
            {isCollaborationEnabled && currentUser && (
              <div className="flex items-center gap-2" data-testid="presence-avatars-container">
                <PresenceAvatars users={collaboration.presentUsers || []} currentUserId={currentUser.id} />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6">
          {/* Auto-save Recovery Banner */}
          {hasRecoveredData && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between mb-4" data-testid="autosave-recovery-banner">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800">Unsaved changes were recovered from your previous session.</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={discardRecoveredData}
                className="text-amber-700 border-amber-300 hover:bg-amber-100" data-testid="discard-recovered-data-btn">
                Discard
              </Button>
            </div>
          )}

          {/* Open Call Notes Scratchpad button */}
          <div className="mb-4" data-testid="call-notes-scratchpad">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 flex items-center justify-center gap-2 py-3"
              onClick={() => {
                if (eventRequest) {
                  setScratchpadEventRequest(eventRequest);
                  setShowScratchpad(true);
                }
              }}
            >
              <StickyNote className="w-4 h-4" />
              Open Call Notes Scratchpad
              {formData.message && (
                <span className="text-xs opacity-75 ml-1">(has notes)</span>
              )}
            </Button>
          </div>

          {/* Progress Indicator */}
          <div className="bg-slate-50 rounded-lg p-3 border mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#236383]">Form Progress</span>
              <span className="text-sm text-gray-600">{completedSections} of {totalSections} sections</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-[#47B3CB] h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedSections / totalSections) * 100}%` }} />
            </div>
          </div>

          {/* Workflow Guidance */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-900 font-medium">Lifecycle workflow guidance</p>
            <p className="text-sm text-blue-800 mt-1">
              Save anytime as details come in. To move to <span className="font-semibold">Scheduled</span>, only an event date is required.
              All other details can be completed later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" id="event-scheduling-form">

            {/* Lifecycle & Core Scheduling */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <h3 className="text-base font-semibold text-[#236383]">1) Lifecycle & Core Scheduling</h3>

              {/* Status & Toolkit */}
              <StatusToolkitSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                eventRequest={eventRequest}
                canRemoveCorporatePriority={!!canRemoveCorporatePriority}
                onStatusChange={handleStatusChange}
              />

              {/* Event Schedule */}
              <EventScheduleSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                isComplete={sectionStatus.schedule}
                eventRequest={eventRequest}
                formatDateForInput={formatDateForInput}
                onVanConflictReset={() => setVanConflictChecked(false)}
                onScheduledDateChange={(newDate) => {
                  setPendingDateChange(newDate);
                  setShowDateConfirmation(true);
                }}
              />
            </div>

            {/* Contacts */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <h3 className="text-base font-semibold text-[#236383]">2) Contacts</h3>

              {/* Contact Info */}
              <ContactInfoSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                isExpanded={showContactInfo}
                onToggle={() => setShowContactInfo(!showContactInfo)}
                isComplete={sectionStatus.contact}
                isCreateMode={isCreateMode}
              />

              {/* Backup Contact */}
              <BackupContactSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                isExpanded={showBackupContactInfo}
                onToggle={() => setShowBackupContactInfo(!showBackupContactInfo)}
              />
            </div>

            {/* Planning & Logistics */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <h3 className="text-base font-semibold text-[#236383]">3) Planning & Logistics</h3>

              {/* Sandwich Planning */}
              <SandwichPlanningSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                sandwichMode={sandwichMode}
                setSandwichMode={setSandwichMode}
                isComplete={sectionStatus.sandwiches}
              />

              {/* Attendees */}
              <AttendeeSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                attendeeMode={attendeeMode}
                setAttendeeMode={setAttendeeMode}
              />

              {/* Delivery */}
              <DeliverySection
                formData={formData as EventFormData}
                setFormData={setFormData}
                eventRequestId={eventRequest?.id}
              />

              {/* Refrigeration */}
              <div>
                <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
                <Select value={formData.hasRefrigeration} onValueChange={(value) => setFormData(prev => ({ ...prev, hasRefrigeration: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select refrigeration status" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <RefrigerationWarningAlert
                  sandwichTypes={formData.sandwichTypes}
                  hasRefrigeration={
                    formData.hasRefrigeration === 'true' ? true :
                    formData.hasRefrigeration === 'false' ? false : null
                  }
                  className="mt-2"
                />
              </div>

              {/* Resource Requirements */}
              <ResourceRequirementsSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                vanDrivers={vanDrivers}
                isComplete={sectionStatus.resources}
              />
            </div>

            {/* Internal Coordination */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <h3 className="text-base font-semibold text-[#236383]">4) Internal Coordination & Notes</h3>

              {/* TSP Contact */}
              <TspContactSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                users={users}
                isCollaborationEnabled={isCollaborationEnabled}
                isFieldLockedByOther={isFieldLockedByOther}
                getFieldLock={getFieldLock}
                handleFieldFocus={handleFieldFocus}
                handleFieldBlur={handleFieldBlur}
              />

            {/* Contact Attempts History */}
            {eventRequest && (eventRequest.contactAttempts > 0 || eventRequest.unresponsiveNotes) && (
              <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Contact Attempts History
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="bg-white px-3 py-1 rounded border border-blue-300">
                      <span className="font-medium text-blue-900">Total Attempts:</span>{' '}
                      <span className="text-blue-700 font-bold">{eventRequest.contactAttempts || 0}</span>
                    </div>
                    {eventRequest.lastContactAttempt && (
                      <div className="bg-white px-3 py-1 rounded border border-blue-300">
                        <span className="font-medium text-blue-900">Last Attempt:</span>{' '}
                        <span className="text-blue-700">{new Date(eventRequest.lastContactAttempt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    )}
                    {eventRequest.contactMethod && (
                      <div className="bg-white px-3 py-1 rounded border border-blue-300">
                        <span className="font-medium text-blue-900">Method:</span>{' '}
                        <span className="text-blue-700 capitalize">{eventRequest.contactMethod}</span>
                      </div>
                    )}
                  </div>
                  {eventRequest.unresponsiveNotes && (
                    <div className="bg-white p-3 rounded border border-blue-300">
                      <p className="text-sm font-medium text-blue-900 mb-1">Attempt Log:</p>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono">{eventRequest.unresponsiveNotes}</div>
                    </div>
                  )}
                  {eventRequest.isUnresponsive && (
                    <div className="bg-yellow-100 border border-yellow-400 rounded p-2 flex items-start gap-2">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-800">Marked as Unresponsive</p>
                        {eventRequest.unresponsiveReason && (
                          <p className="text-sm text-yellow-700">Reason: {eventRequest.unresponsiveReason}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

              {/* Notes & Requirements */}
              <NotesSection
                formData={formData as EventFormData}
                setFormData={setFormData}
                isComplete={sectionStatus.notes}
                isMessageEditable={isMessageEditable}
                setIsMessageEditable={setIsMessageEditable}
                isCollaborationEnabled={isCollaborationEnabled}
                isFieldLockedByOther={isFieldLockedByOther}
                getFieldLock={getFieldLock}
                handleFieldFocus={handleFieldFocus}
                handleFieldBlur={handleFieldBlur}
              />

              {/* Volunteer Instructions */}
              <InstructionsSection
                formData={formData as EventFormData}
                setFormData={setFormData}
              />
            </div>

            {/* Completed Event Details */}
            <CompletedEventSection
              formData={formData as EventFormData}
              setFormData={setFormData}
              isExpanded={showCompletedDetails}
              onToggle={() => setShowCompletedDetails(!showCompletedDetails)}
              actualSandwichMode={actualSandwichMode}
              setActualSandwichMode={setActualSandwichMode}
            />

          </form>
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 flex justify-between px-4 sm:px-6 py-4 border-t bg-white">
          <div>
            {eventRequest && mode === 'edit' && (
              <Button type="button" variant="outline"
                className="border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
                onClick={() => setShowDeleteConfirmation(true)}
                disabled={deleteEventRequestMutation.isPending}
                data-testid="button-delete-event">
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteEventRequestMutation.isPending ? 'Deleting...' : 'Delete Event'}
              </Button>
            )}
          </div>
          <div className="flex space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="event-scheduling-form" className="text-white"
              style={{ backgroundColor: '#236383' }}
              disabled={isSubmitting || updateEventRequestMutation.isPending || createEventRequestMutation.isPending}
              data-testid="button-submit">
              {(updateEventRequestMutation.isPending || createEventRequestMutation.isPending)
                ? (mode === 'edit' ? 'Saving...' : 'Scheduling...')
                : (mode === 'edit' ? 'Save Changes' : 'Schedule Event')}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* ── Dialogs ─────────────────────────────────────────────── */}

      <DateChangeDialog
        open={showDateConfirmation}
        onOpenChange={setShowDateConfirmation}
        onConfirm={handleDateChangeConfirmation}
        onCancel={() => setShowDateConfirmation(false)}
      />

      <SpeakerWarningDialog
        open={showSpeakerWarningDialog}
        onOpenChange={(open) => { if (!open) { setShowSpeakerWarningDialog(false); setIsSubmitting(false); } }}
        onCancel={() => { setShowSpeakerWarningDialog(false); setIsSubmitting(false); }}
        onContinue={async () => { setShowSpeakerWarningDialog(false); await performSubmit(true); }}
      />

      <VanConflictDialog
        open={showVanConflictDialog}
        onOpenChange={(open) => { if (!open) { setShowVanConflictDialog(false); setVanConflictChecked(false); setIsSubmitting(false); } }}
        conflictDetails={vanConflictDetails}
        onGoBack={() => { setShowVanConflictDialog(false); setVanConflictChecked(false); setIsSubmitting(false); }}
        onAcknowledge={() => { setShowVanConflictDialog(false); setVanConflictChecked(true); }}
      />

      <StandbyFollowUpDialog
        open={showStandbyFollowUpDialog}
        onOpenChange={(open) => {
          if (!open && !standbySaveClickedRef.current) {
            setShowStandbyFollowUpDialog(false);
            setFormData(prev => ({ ...prev, status: eventRequest?.status || 'new' }));
            setIsSubmitting(false);
          }
        }}
        followUpDate={standbyFollowUpDate}
        setFollowUpDate={setStandbyFollowUpDate}
        followUpMode={standbyFollowUpMode}
        setFollowUpMode={setStandbyFollowUpMode}
        onSave={async () => {
          standbySaveClickedRef.current = true;
          setFormData(prev => ({ ...prev, standbyExpectedDate: standbyFollowUpDate }));
          setShowStandbyFollowUpDialog(false);
          try {
            await performSubmit(false, { standbyExpectedDate: standbyFollowUpDate });
          } finally {
            standbySaveClickedRef.current = false;
          }
        }}
      />

      <DeleteConfirmDialog
        open={showDeleteConfirmation}
        onOpenChange={setShowDeleteConfirmation}
        eventRequest={eventRequest}
        onDelete={() => {
          if (eventRequest) {
            if (onDelete) { onDelete(eventRequest.id); }
            else { deleteEventRequestMutation.mutate(eventRequest.id); }
            setShowDeleteConfirmation(false);
          }
        }}
        isPending={deleteEventRequestMutation.isPending}
      />
    </Dialog>
  );
};

export default EventSchedulingForm;
