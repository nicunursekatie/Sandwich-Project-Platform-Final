import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  MapPin,
  Navigation,
  Phone,
  Clock,
  Check,
  ChevronRight,
  Truck,
  Package,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { MobileShell } from '../components/mobile-shell';
import { cn } from '@/lib/utils';
import { format, isToday, parseISO } from 'date-fns';

interface RouteStop {
  id: number;
  type: 'pickup' | 'delivery';
  name: string;
  address?: string;
  time?: string;
  phone?: string;
  sandwichCount?: number;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

/**
 * Mobile driver route screen - today's pickups and deliveries
 */
export function MobileRoute() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch driver's assigned events for today
  const { data: events, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/event-requests', { driverId: user?.id, date: selectedDate }],
    staleTime: 60000,
  });

  // Transform events into route stops
  const routeStops: RouteStop[] = (events || [])
    .filter((event: any) => {
      // Filter to events where this user is assigned as driver
      const assignedDrivers = event.assignedDrivers || [];
      return assignedDrivers.some((d: any) => d.id === user?.id || d.userId === user?.id);
    })
    .flatMap((event: any): RouteStop[] => {
      const stops: RouteStop[] = [];

      // Add pickup stop if there's a host
      if (event.hostName || event.pickupLocation) {
        stops.push({
          id: event.id * 10 + 1,
          type: 'pickup',
          name: event.hostName || 'Pickup Location',
          address: event.pickupLocation || event.hostAddress,
          time: event.pickupTime,
          phone: event.hostPhone,
          sandwichCount: event.sandwichCount,
          status: event.pickupCompleted ? 'completed' : 'pending',
          notes: event.pickupNotes,
        });
      }

      // Add delivery stop
      stops.push({
        id: event.id * 10 + 2,
        type: 'delivery',
        name: event.recipientName || event.title || 'Delivery',
        address: event.deliveryLocation || event.recipientAddress || event.location,
        time: event.eventTime || event.deliveryTime,
        phone: event.recipientPhone,
        sandwichCount: event.sandwichCount,
        status: event.deliveryCompleted ? 'completed' : event.pickupCompleted ? 'in_progress' : 'pending',
        notes: event.deliveryNotes,
      });

      return stops;
    });

  // Open navigation app
  const openNavigation = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    // Try to detect iOS vs Android
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.open(`maps://maps.apple.com/?daddr=${encodedAddress}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
    }
  };

  // Make a phone call
  const makeCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const completedCount = routeStops.filter(s => s.status === 'completed').length;
  const totalStops = routeStops.length;

  return (
    <MobileShell
      title="My Route"
      showBack
      showNav
      rightAction={
        <button
          onClick={() => refetch()}
          className="p-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
          disabled={isRefetching}
        >
          <RefreshCw className={cn("w-5 h-5 text-slate-600 dark:text-slate-300", isRefetching && "animate-spin")} />
        </button>
      }
    >
      <div className="flex flex-col h-full">
        {/* Date selector and progress */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
          {/* Date */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isToday(parseISO(selectedDate)) ? "Today's Route" : format(parseISO(selectedDate), 'EEEE, MMM d')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {completedCount} of {totalStops} stops completed
              </p>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 border-none"
            />
          </div>

          {/* Progress bar */}
          {totalStops > 0 && (
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-primary transition-all duration-500"
                style={{ width: `${(completedCount / totalStops) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Route stops */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : routeStops.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                No stops scheduled
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                You don't have any pickups or deliveries assigned for this date.
              </p>
              <button
                onClick={() => navigate('/m/events')}
                className="px-6 py-2 bg-brand-primary text-white rounded-full font-medium"
              >
                View Events
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {routeStops.map((stop, index) => (
                <RouteStopCard
                  key={stop.id}
                  stop={stop}
                  index={index + 1}
                  isLast={index === routeStops.length - 1}
                  onNavigate={() => stop.address && openNavigation(stop.address)}
                  onCall={() => stop.phone && makeCall(stop.phone)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function RouteStopCard({
  stop,
  index,
  isLast,
  onNavigate,
  onCall,
}: {
  stop: RouteStop;
  index: number;
  isLast: boolean;
  onNavigate: () => void;
  onCall: () => void;
}) {
  const isPickup = stop.type === 'pickup';
  const isCompleted = stop.status === 'completed';

  return (
    <div className={cn(
      "relative bg-white dark:bg-slate-800 rounded-xl shadow-sm",
      "border",
      isCompleted
        ? "border-green-200 dark:border-green-800"
        : "border-slate-200 dark:border-slate-700"
    )}>
      {/* Connection line to next stop */}
      {!isLast && (
        <div className="absolute left-8 top-full w-0.5 h-3 bg-slate-200 dark:bg-slate-700 z-10" />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Stop number/status indicator */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold",
            isCompleted
              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              : isPickup
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          )}>
            {isCompleted ? <Check className="w-5 h-5" /> : index}
          </div>

          <div className="flex-1 min-w-0">
            {/* Type badge */}
            <span className={cn(
              "inline-block px-2 py-0.5 rounded text-xs font-medium mb-1",
              isPickup
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
            )}>
              {isPickup ? 'PICKUP' : 'DELIVERY'}
            </span>

            {/* Name */}
            <h3 className={cn(
              "font-semibold truncate",
              isCompleted
                ? "text-slate-500 dark:text-slate-400 line-through"
                : "text-slate-900 dark:text-slate-100"
            )}>
              {stop.name}
            </h3>

            {/* Address */}
            {stop.address && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {stop.address}
              </p>
            )}

            {/* Time and sandwich count */}
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
              {stop.time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{stop.time}</span>
                </div>
              )}
              {stop.sandwichCount && (
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span>{stop.sandwichCount} sandwiches</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {stop.notes && (
          <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">{stop.notes}</p>
          </div>
        )}

        {/* Action buttons */}
        {!isCompleted && (
          <div className="flex gap-2">
            {stop.address && (
              <button
                onClick={onNavigate}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                  "bg-brand-primary text-white font-medium",
                  "active:scale-[0.98] transition-transform"
                )}
              >
                <Navigation className="w-5 h-5" />
                Navigate
              </button>
            )}
            {stop.phone && (
              <button
                onClick={onCall}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                  "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium",
                  "active:scale-[0.98] transition-transform"
                )}
              >
                <Phone className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileRoute;
