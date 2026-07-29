/**
 * SendToolkitDialog
 *
 * The "I'm sending the toolkit RIGHT NOW" entry point. Opens the email
 * composer pre-loaded with the toolkit template; when the email is
 * actually sent, this dialog calls back with the send timestamp so the
 * caller can fire the markToolkitSent mutation (which logs the date AND
 * moves the event from New → In Process in one action).
 *
 * This is intentionally a thin wrapper around <EventEmailComposer/> so
 * the user sees the email composer immediately — no extra date/time
 * dialog in between. The send timestamp IS the toolkit-sent timestamp.
 *
 * For the "I already sent the toolkit, just log it" path, see the
 * sibling component <ToolkitSentDialog/> — that one keeps the
 * manual-date-entry + call-log form.
 */
import React from 'react';
import { EventEmailComposer } from '@/components/event-email-composer';
import type { EventRequest } from '@shared/schema';

interface SendToolkitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  /** Fires once the email has actually been sent — gives the parent
   *  the ISO timestamp to record + the open dialog gets closed. */
  onToolkitEmailSent: (toolkitSentDate: string) => void;
}

export default function SendToolkitDialog({
  isOpen,
  onClose,
  eventRequest,
  onToolkitEmailSent,
}: SendToolkitDialogProps) {
  if (!eventRequest) return null;

  const handleEmailSent = () => {
    // Send-time IS the toolkit-sent time. We use the moment the email
    // composer reports a successful send so the audit log shows the
    // actual send event, not an arbitrary user-typed date.
    //
    // IMPORTANT: do NOT call onClose() here. EventEmailComposer already
    // calls onClose() itself after firing onEmailSent (see
    // event-email-composer.tsx onSuccess handler). Calling it here too
    // would double-close, causing setToolkitEventRequest(null) to fire
    // while EventEmailComposer is still mid-onSuccess — that unmounts
    // the composer while it's trying to complete its own render + close
    // sequence, which throws a React state-update-on-unmounted error
    // in some environments. The composer will close itself immediately
    // after onEmailSent returns.
    onToolkitEmailSent(new Date().toISOString());
  };

  return (
    <EventEmailComposer
      eventRequest={{
        id: eventRequest.id,
        firstName: eventRequest.firstName || '',
        lastName: eventRequest.lastName || '',
        email: eventRequest.email || '',
        phone: eventRequest.phone || undefined,
        organizationName: eventRequest.organizationName || '',
        department: eventRequest.department || undefined,
        desiredEventDate: eventRequest.desiredEventDate?.toString() || undefined,
        eventAddress: eventRequest.eventAddress || undefined,
        estimatedSandwichCount: eventRequest.estimatedSandwichCount || undefined,
        eventStartTime: eventRequest.eventStartTime || undefined,
        eventEndTime: eventRequest.eventEndTime || undefined,
        message: eventRequest.message || undefined,
      }}
      onEmailSent={handleEmailSent}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}
