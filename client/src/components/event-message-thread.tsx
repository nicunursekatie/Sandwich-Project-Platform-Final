import React, { useMemo, useState } from 'react';
import { useEventMessages } from '@/hooks/useEventMessages';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2, Phone, Mail, Video, Calendar, FileText, ClipboardList, AlertCircle, Users, Truck, Car, Bell, Package, Copy, PhoneOff, Share2, Edit2, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import type { EventRequest } from '@shared/schema';

interface Message {
  id: number;
  senderId: string;
  content: string;
  senderName?: string;
  senderEmail?: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  deletedAt?: string;
}

interface EventMessageThreadProps {
  eventId: string;
  eventRequest?: EventRequest;
  eventTitle?: string;
  maxHeight?: string;
  showHeader?: boolean;
  onDeleteContactAttempt?: (attemptNumber: number) => Promise<void>;
  onEditContactAttempt?: (attemptNumber: number, updatedData: {
    method: string;
    outcome: string;
    notes?: string;
    timestamp: string;
  }) => Promise<void>;
}

export const EventMessageThread: React.FC<EventMessageThreadProps> = ({
  eventId,
  eventRequest,
  eventTitle,
  maxHeight = '400px',
  showHeader = true,
  onDeleteContactAttempt,
  onEditContactAttempt,
}) => {
  const { user } = useAuth();
  // Use lightweight hook that doesn't create WebSocket connections
  const { data: rawMessages, isLoading, isError } = useEventMessages(eventId);

  // Filter out deleted messages and sort by creation date
  const messages = useMemo(() => {
    if (!rawMessages || !Array.isArray(rawMessages)) {
      return [];
    }

    return rawMessages
      .filter((msg: Message) => !msg.deletedAt)
      .sort((a: Message, b: Message) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }, [rawMessages]);

  // Build combined activity items from contact attempts and notes
  const activityItems = useMemo(() => {
    const items: Array<{
      type: 'contact' | 'note' | 'message' | 'initial';
      icon: React.ReactNode;
      title: string;
      content: string;
      date?: Date;
      badge?: string;
      attemptNumber?: number;
      createdBy?: string;
      canEdit?: boolean;
      canDelete?: boolean;
    }> = [];

    if (!eventRequest) return items;

    // Add initial request message at the top (if present)
    if (eventRequest.message) {
      items.push({
        type: 'initial',
        icon: <FileText className="h-4 w-4" />,
        title: 'Initial Request Message',
        content: eventRequest.message,
      });
    }

    // Add structured contact attempts from new contactAttemptsLog
    if (eventRequest.contactAttemptsLog && Array.isArray(eventRequest.contactAttemptsLog)) {
      eventRequest.contactAttemptsLog.forEach((attempt) => {
        const methodIcons = {
          phone: <Phone className="h-4 w-4" />,
          email: <Mail className="h-4 w-4" />,
          both: <MessageSquare className="h-4 w-4" />,
        };

        const canModify = user?.id === attempt.createdBy;

        items.push({
          type: 'contact',
          icon: methodIcons[attempt.method as keyof typeof methodIcons] || <MessageSquare className="h-4 w-4" />,
          title: `Contact Attempt #${attempt.attemptNumber}`,
          content: attempt.notes || attempt.outcome,
          date: new Date(attempt.timestamp),
          badge: `by ${attempt.createdByName || 'Unknown'}`,
          attemptNumber: attempt.attemptNumber,
          createdBy: attempt.createdBy,
          canEdit: canModify,
          canDelete: canModify,
        });
      });
    }

    // Legacy: Add old unresponsiveNotes if present and no new structured log exists
    if (eventRequest.unresponsiveNotes && (!eventRequest.contactAttemptsLog || eventRequest.contactAttemptsLog.length === 0)) {
      // Try to extract date from content like "[Nov 3, 2025, 3:35 PM] Attempt #1..."
      const dateMatch = eventRequest.unresponsiveNotes.match(/\[(.*?)\]/);
      let parsedDate: Date | undefined;
      let contentWithoutDate = eventRequest.unresponsiveNotes;

      if (dateMatch) {
        try {
          parsedDate = new Date(dateMatch[1]);
          // Remove the date portion from content
          contentWithoutDate = eventRequest.unresponsiveNotes.replace(/\[.*?\]\s*/, '');
        } catch (e) {
          // If date parsing fails, keep original content
        }
      }

      items.push({
        type: 'note',
        icon: <PhoneOff className="h-4 w-4" />,
        title: 'Contact Attempts Logged (Legacy)',
        content: contentWithoutDate,
        date: parsedDate,
      });
    }

    // Add planning notes
    if (eventRequest.planningNotes) {
      items.push({
        type: 'note',
        icon: <ClipboardList className="h-4 w-4" />,
        title: 'Planning Notes',
        content: eventRequest.planningNotes,
      });
    }

    // Add scheduling notes
    if (eventRequest.schedulingNotes) {
      items.push({
        type: 'note',
        icon: <Calendar className="h-4 w-4" />,
        title: 'Scheduling Notes',
        content: eventRequest.schedulingNotes,
      });
    }

    // Add additional requirements
    if (eventRequest.additionalRequirements) {
      items.push({
        type: 'note',
        icon: <AlertCircle className="h-4 w-4" />,
        title: 'Special Requirements',
        content: eventRequest.additionalRequirements,
      });
    }

    // Add volunteer notes
    if (eventRequest.volunteerNotes) {
      items.push({
        type: 'note',
        icon: <Users className="h-4 w-4" />,
        title: 'Volunteer Notes',
        content: eventRequest.volunteerNotes,
      });
    }

    // Add driver notes
    if (eventRequest.driverNotes) {
      items.push({
        type: 'note',
        icon: <Car className="h-4 w-4" />,
        title: 'Driver Notes',
        content: eventRequest.driverNotes,
      });
    }

    // Add van driver notes
    if (eventRequest.vanDriverNotes) {
      items.push({
        type: 'note',
        icon: <Truck className="h-4 w-4" />,
        title: 'Van Driver Notes',
        content: eventRequest.vanDriverNotes,
      });
    }

    // Add follow-up notes
    if (eventRequest.followUpNotes) {
      items.push({
        type: 'note',
        icon: <Bell className="h-4 w-4" />,
        title: 'Follow-up Notes',
        content: eventRequest.followUpNotes,
      });
    }

    // Add distribution notes
    if (eventRequest.distributionNotes) {
      items.push({
        type: 'note',
        icon: <Package className="h-4 w-4" />,
        title: 'Distribution Notes',
        content: eventRequest.distributionNotes,
      });
    }

    // Add duplicate check notes
    if (eventRequest.duplicateNotes) {
      items.push({
        type: 'note',
        icon: <Copy className="h-4 w-4" />,
        title: 'Duplicate Check Notes',
        content: eventRequest.duplicateNotes,
      });
    }

    // Add unresponsive/contact attempts logged
    if (eventRequest.unresponsiveNotes) {
      // Try to extract date from content like "[Nov 3, 2025, 3:35 PM] Attempt #1..."
      const dateMatch = eventRequest.unresponsiveNotes.match(/\[(.*?)\]/);
      let parsedDate: Date | undefined;
      let contentWithoutDate = eventRequest.unresponsiveNotes;

      if (dateMatch) {
        try {
          parsedDate = new Date(dateMatch[1]);
          // Remove the date portion from content
          contentWithoutDate = eventRequest.unresponsiveNotes.replace(/\[.*?\]\s*/, '');
        } catch (e) {
          // If date parsing fails, keep original content
        }
      }

      items.push({
        type: 'note',
        icon: <PhoneOff className="h-4 w-4" />,
        title: 'Contact Attempts Logged',
        content: contentWithoutDate,
        date: parsedDate,
      });
    }

    // Add social media notes
    if (eventRequest.socialMediaPostNotes) {
      items.push({
        type: 'note',
        icon: <Share2 className="h-4 w-4" />,
        title: 'Social Media Notes',
        content: eventRequest.socialMediaPostNotes,
      });
    }

    // Add messages
    messages.forEach((message) => {
      items.push({
        type: 'message',
        icon: <MessageSquare className="h-4 w-4" />,
        title: message.senderName || message.senderEmail || 'Unknown User',
        content: message.content,
        date: new Date(message.createdAt),
      });
    });

    // Sort by date (most recent first), putting items without dates at the top
    return items.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return -1;
      if (!b.date) return 1;
      return b.date.getTime() - a.date.getTime();
    });
  }, [eventRequest, messages, user]);

  const totalCount = activityItems.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading activity...</span>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No communication or notes yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Contact attempts and notes will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Communication & Notes
              <Badge variant="secondary" className="text-xs">
                {totalCount}
              </Badge>
            </h3>
            {eventTitle && (
              <p className="text-xs text-gray-500 mt-1">{eventTitle}</p>
            )}
          </div>
        </div>
      )}

      <ScrollArea style={{ height: maxHeight }} className="pr-4">
        <div className="space-y-3 pb-4">
          {activityItems.map((item, index) => (
            <Card key={index} className="p-3 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <div className="space-y-2">
                {/* Activity Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="text-[#236383] dark:text-[#47B3CB]">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.title}
                      </p>
                      {item.date && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          {formatDistanceToNow(item.date, { addSuffix: true })}
                          {' • '}
                          {format(item.date, 'MMM d, yyyy h:mm a')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {item.badge && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.badge}
                    </Badge>
                  )}
                </div>

                {/* Activity Content */}
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words ml-6">
                  {item.content}
                </div>

                {/* Edit/Delete buttons for contact attempts */}
                {item.type === 'contact' && (item.canEdit || item.canDelete) && (
                  <div className="flex gap-2 ml-6 mt-2">
                    {item.canDelete && onDeleteContactAttempt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => item.attemptNumber && onDeleteContactAttempt(item.attemptNumber)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
