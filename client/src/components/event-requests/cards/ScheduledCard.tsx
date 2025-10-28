import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Clock,
  Package,
  MapPin,
  Users,
  FileText,
  History,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

import {
  formatTime12Hour,
  formatEventDate,
} from '@/components/event-requests/utils';

import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import type { EventRequest } from '@shared/schema';

/* =============================
   CLEAN + CONSISTENT CARD LAYOUT
============================= */

interface ScheduledCardProps {
  request: EventRequest;
  canEdit?: boolean;
  startEditing: (field: string, value: any) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
}

export const ScheduledCard: React.FC<ScheduledCardProps> = ({
  request,
  canEdit,
  startEditing,
  saveEdit,
  cancelEdit,
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  return (
    <Card className="w-full bg-white shadow-sm border border-gray-100 rounded-xl">
      <CardContent className="p-6 space-y-6">
        {/* ============ 1. EVENT DETAILS / TIMES ============ */}
        <section className="rounded-md border-l-4 border-brand-primary bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-primary font-semibold">
              <Clock className="w-4 h-4" />
              <span className="text-base font-semibold">Event Details</span>
            </div>
            {canEdit && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-sm border-brand-primary text-brand-primary hover:bg-brand-primary/10"
                  >
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Event Times</DialogTitle>
                  </DialogHeader>
                  {/* Keep your existing TimeDialogContent component */}
                  {/* <TimeDialogContent {...{ request, startEditing, saveEdit, cancelEdit }} /> */}
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="text-sm text-gray-700 space-y-1">
            <p>
              <span className="font-medium text-gray-800">Date:</span>{' '}
              {formatEventDate(request.eventDate)}
            </p>
            <p>
              <span className="font-medium text-gray-800">Start:</span>{' '}
              {request.eventStartTime
                ? formatTime12Hour(request.eventStartTime)
                : '—'}
            </p>
            <p>
              <span className="font-medium text-gray-800">End:</span>{' '}
              {request.eventEndTime
                ? formatTime12Hour(request.eventEndTime)
                : '—'}
            </p>
            {request.pickupDateTime && (
              <p>
                <span className="font-medium text-gray-800">Pickup:</span>{' '}
                {formatTime12Hour(request.pickupDateTime)}
              </p>
            )}
          </div>
        </section>

        {/* ============ 2. HOST / RECIPIENT INFO ============ */}
        <section className="rounded-md border-l-4 border-brand-primary bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-brand-primary font-semibold">
            <MapPin className="w-4 h-4" />
            <span className="text-base font-semibold">Host / Recipient</span>
          </div>

          <div className="text-sm text-gray-700 space-y-1">
            <p>
              <span className="font-medium text-gray-800">Host:</span>{' '}
              {request.hostName || '—'}
            </p>
            <p>
              <span className="font-medium text-gray-800">Recipient:</span>{' '}
              {request.recipientName || '—'}
            </p>
          </div>
        </section>

        {/* ============ 3. SANDWICH DETAILS ============ */}
        <section className="rounded-md border-l-4 border-brand-primary bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-brand-primary font-semibold">
            <Package className="w-4 h-4" />
            <span className="text-base font-semibold">Sandwich Details</span>
          </div>

          <div className="text-sm text-gray-700">
            <p>
              <span className="font-medium text-gray-800">
                Total Sandwiches:
              </span>{' '}
              {request.totalSandwiches || '—'}
            </p>
            {request.sandwichType && (
              <p>
                <span className="font-medium text-gray-800">Type:</span>{' '}
                {request.sandwichType}
              </p>
            )}
          </div>
        </section>

        {/* ============ 4. LOGISTICS ============ */}
        <section className="rounded-md border-l-4 border-brand-primary bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-brand-primary font-semibold">
            <Users className="w-4 h-4" />
            <span className="text-base font-semibold">Logistics</span>
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              <span className="font-medium text-gray-800">Driver:</span>{' '}
              {request.driverName || '—'}
            </p>
            <p>
              <span className="font-medium text-gray-800">Drop-off Site:</span>{' '}
              {request.dropoffLocation || '—'}
            </p>
          </div>
        </section>

        {/* ============ 5. ASSIGNMENTS ============ */}
        <section className="rounded-md border-l-4 border-brand-primary bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-brand-primary font-semibold">
            <Users className="w-4 h-4" />
            <span className="text-base font-semibold">Assignments</span>
          </div>
          <div className="text-sm text-gray-700">
            {request.assignedVolunteers?.length ? (
              <ul className="list-disc list-inside">
                {request.assignedVolunteers.map((v: any) => (
                  <li key={v.id}>{v.name}</li>
                ))}
              </ul>
            ) : (
              <p className="italic text-gray-500">No volunteers assigned.</p>
            )}
          </div>
        </section>

        {/* ============ 6. NOTES (COLLAPSIBLE) ============ */}
        <details
          open={showNotes}
          onToggle={() => setShowNotes(!showNotes)}
          className="rounded-md border border-gray-200 bg-gray-50 p-4"
        >
          <summary className="cursor-pointer flex items-center justify-between font-semibold text-gray-800">
            <span>Notes & Requirements</span>
            {showNotes ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </summary>
          <div className="mt-2 space-y-2 text-sm text-gray-700">
            {request.message ? (
              <div>
                <p className="font-medium text-gray-800">Original Request:</p>
                <p className="whitespace-pre-wrap">{request.message}</p>
              </div>
            ) : (
              <p className="italic text-gray-500">No notes provided.</p>
            )}
          </div>
        </details>

        {/* ============ 7. AUDIT LOG (COLLAPSIBLE) ============ */}
        <details
          open={showAudit}
          onToggle={() => setShowAudit(!showAudit)}
          className="rounded-md border border-gray-200 bg-gray-50 p-4"
        >
          <summary className="cursor-pointer flex items-center justify-between font-semibold text-gray-800">
            <span>Audit Log</span>
            {showAudit ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </summary>
          <div className="mt-3">
            <EventRequestAuditLog requestId={request.id} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
};
