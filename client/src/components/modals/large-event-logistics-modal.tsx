import { Calendar, MapPin, Users, Truck, Megaphone, Package, AlertCircle, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { EventRequest } from '@shared/schema';

interface LargeEventLogisticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventRequest[];
}

export default function LargeEventLogisticsModal({
  open,
  onOpenChange,
  events,
}: LargeEventLogisticsModalProps) {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Not set';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDayOfWeek = (date: Date | string | null | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const needsSandwichOrder = (event: EventRequest) => {
    const dayOfWeek = getDayOfWeek(event.scheduledEventDate || event.desiredEventDate);
    return dayOfWeek !== 'Tuesday' && dayOfWeek !== 'Wednesday';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center text-2xl">
            <AlertCircle className="text-amber-500 mr-2 w-6 h-6" />
            Large Event Logistics Review
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Events with 500+ sandwiches require additional planning and coordination
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-6">
            {events.map((event) => {
              const needsOrder = needsSandwichOrder(event);

              return (
                <Card key={event.id} className="border-2 border-amber-200">
                  <CardContent className="pt-6">
                    {/* Event Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {event.organizationName || 'Unknown Organization'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                            {event.estimatedSandwichCount?.toLocaleString()} sandwiches
                          </Badge>
                          <Badge variant="outline" className="text-gray-700">
                            {event.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Event Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Event Date</p>
                          <p className="text-sm text-gray-900">
                            {formatDate(event.scheduledEventDate || event.desiredEventDate)}
                          </p>
                        </div>
                      </div>

                      {event.eventAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Location</p>
                            <p className="text-sm text-gray-900">{event.eventAddress}</p>
                          </div>
                        </div>
                      )}

                      {(event.volunteerCount || event.adultCount || event.childrenCount) && (
                        <div className="flex items-start gap-2">
                          <Users className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Expected Attendees</p>
                            <p className="text-sm text-gray-900">
                              {event.volunteerCount ||
                                `${event.adultCount || 0} adults, ${event.childrenCount || 0} children`}
                            </p>
                          </div>
                        </div>
                      )}

                      {event.eventStartTime && (
                        <div className="flex items-start gap-2">
                          <Clock className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Event Time</p>
                            <p className="text-sm text-gray-900">
                              {event.eventStartTime}
                              {event.eventEndTime && ` - ${event.eventEndTime}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Logistics Requirements */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Logistics Requirements</h4>
                      <div className="space-y-3">
                        {/* Speaker Needed */}
                        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                          <Megaphone className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-blue-900">Speaker Required</p>
                            <p className="text-sm text-blue-700">
                              Large events typically need a speaker to present TSP mission.
                              <span className="font-semibold"> Ideally Juliet</span> should be assigned.
                            </p>
                          </div>
                        </div>

                        {/* Van Needed */}
                        <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                          <Truck className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-purple-900">Van Likely Needed</p>
                            <p className="text-sm text-purple-700">
                              With {event.estimatedSandwichCount?.toLocaleString()} sandwiches,
                              the van will likely be required for transportation.
                            </p>
                          </div>
                        </div>

                        {/* Sandwich Order */}
                        {needsOrder && (
                          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                            <Package className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-amber-900">Large Sandwich Order Required</p>
                              <p className="text-sm text-amber-700">
                                Event is on {getDayOfWeek(event.scheduledEventDate || event.desiredEventDate)}
                                (not Tuesday/Wednesday). Need to place order for{' '}
                                {event.estimatedSandwichCount?.toLocaleString()} sandwiches well in advance.
                              </p>
                            </div>
                          </div>
                        )}

                        {!needsOrder && (
                          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                            <Package className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-green-900">Regular Collection Day</p>
                              <p className="text-sm text-green-700">
                                Event is on {getDayOfWeek(event.scheduledEventDate || event.desiredEventDate)}.
                                Can potentially use regular Tuesday/Wednesday collection sandwiches, but verify capacity
                                for {event.estimatedSandwichCount?.toLocaleString()} sandwiches.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Additional Notes */}
                        {(event.planningNotes || event.additionalRequirements || event.contactCompletionNotes) && (
                          <div className="border-t pt-3 mt-3">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Additional Notes</h5>
                            <div className="space-y-1 text-sm text-gray-600">
                              {event.planningNotes && (
                                <p><span className="font-medium">Planning:</span> {event.planningNotes}</p>
                              )}
                              {event.additionalRequirements && (
                                <p><span className="font-medium">Requirements:</span> {event.additionalRequirements}</p>
                              )}
                              {event.contactCompletionNotes && (
                                <p><span className="font-medium">Contact Notes:</span> {event.contactCompletionNotes}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact Information */}
                    {(event.firstName || event.email || event.phone) && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          {(event.firstName || event.lastName) && (
                            <p><span className="font-medium">Name:</span> {event.firstName} {event.lastName}</p>
                          )}
                          {event.email && (
                            <p><span className="font-medium">Email:</span> {event.email}</p>
                          )}
                          {event.phone && (
                            <p><span className="font-medium">Phone:</span> {event.phone}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 mt-4 border-t bg-white flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={() => {
              // Navigate to event requests page
              window.location.href = '/event-requests';
            }}
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            Go to Event Requests
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
