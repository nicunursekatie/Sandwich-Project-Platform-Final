import React, { useMemo } from 'react';
import { useEventMessages } from '@/hooks/useEventMessages';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2, Phone, Mail, Video, Calendar, FileText, ClipboardList, AlertCircle, Users, Truck, Car, Bell, Package, Copy, PhoneOff, Share2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
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
}

export const EventMessageThread: React.FC<EventMessageThreadProps> = ({
  eventId,
  eventRequest,
  eventTitle,
  maxHeight = '400px',
  showHeader = true,
}) => {
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

    // Add contact attempt info
    if (eventRequest.contactAttempts && eventRequest.contactAttempts > 0) {
      const methodIcons = {
        phone: <Phone className="h-4 w-4" />,
        email: <Mail className="h-4 w-4" />,
        video_meeting: <Video className="h-4 w-4" />,
      };

      items.push({
        type: 'contact',
        icon: eventRequest.communicationMethod 
          ? methodIcons[eventRequest.communicationMethod as keyof typeof methodIcons] || <MessageSquare className="h-4 w-4" />
          : <MessageSquare className="h-4 w-4" />,
        title: `Contact Attempt${eventRequest.contactAttempts > 1 ? 's' : ''}`,
        content: eventRequest.contactCompletionNotes || 'Contact made',
        date: eventRequest.lastContactAttempt ? new Date(eventRequest.lastContactAttempt) : undefined,
        badge: `${eventRequest.contactAttempts} attempt${eventRequest.contactAttempts > 1 ? 's' : ''}`,
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
      items.push({
        type: 'note',
        icon: <PhoneOff className="h-4 w-4" />,
        title: 'Contact Attempts Logged',
        content: eventRequest.unresponsiveNotes,
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
  }, [eventRequest, messages]);

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

      <ScrollArea style={{ maxHeight }} className="pr-4">
        <div className="space-y-3">
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
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(item.date, { addSuffix: true })}
                          {' • '}
                          {format(item.date, 'MMM d, yyyy h:mm a')}
                        </p>
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
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
