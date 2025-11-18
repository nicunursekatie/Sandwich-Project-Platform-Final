import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Users, 
  Calendar, 
  AlertCircle, 
  Clock, 
  MapPin, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { format, differenceInDays, isPast, isFuture, addDays } from 'date-fns';
import SandwichForecastWidget from '@/components/sandwich-forecast-widget';
import StaffingForecastWidget from '@/components/staffing-forecast-widget';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { HelpCircle } from 'lucide-react';

interface PlanningTabProps {
  eventRequests: EventRequest[];
}

export function PlanningTab({ 
  eventRequests
}: PlanningTabProps) {
  const [showSandwichModal, setShowSandwichModal] = React.useState(false);
  const [showStaffingModal, setShowStaffingModal] = React.useState(false);

  // Calculate time-based metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const next7Days = addDays(now, 7);
    const next14Days = addDays(now, 14);
    const next30Days = addDays(now, 30);

    const upcoming7Days = eventRequests.filter(e => {
      const eventDate = e.scheduledEventDate ? new Date(e.scheduledEventDate) : 
                       e.desiredEventDate ? new Date(e.desiredEventDate) : null;
      return eventDate && isFuture(eventDate) && eventDate <= next7Days && 
             ['scheduled', 'in_process'].includes(e.status?.toLowerCase() || '');
    }).length;

    const upcoming14Days = eventRequests.filter(e => {
      const eventDate = e.scheduledEventDate ? new Date(e.scheduledEventDate) : 
                       e.desiredEventDate ? new Date(e.desiredEventDate) : null;
      return eventDate && isFuture(eventDate) && eventDate <= next14Days && 
             ['scheduled', 'in_process'].includes(e.status?.toLowerCase() || '');
    }).length;

    const upcoming30Days = eventRequests.filter(e => {
      const eventDate = e.scheduledEventDate ? new Date(e.scheduledEventDate) : 
                       e.desiredEventDate ? new Date(e.desiredEventDate) : null;
      return eventDate && isFuture(eventDate) && eventDate <= next30Days && 
             ['scheduled', 'in_process'].includes(e.status?.toLowerCase() || '');
    }).length;

    // Overdue follow-ups (scheduled call dates in the past)
    const overdueFollowUps = eventRequests.filter(e => {
      if (!e.scheduledCallDate) return false;
      const callDate = new Date(e.scheduledCallDate);
      return isPast(callDate) && ['new', 'in_process'].includes(e.status?.toLowerCase() || '');
    }).length;

    // Stale requests (new status > 7 days old)
    const staleRequests = eventRequests.filter(e => {
      if (e.status?.toLowerCase() !== 'new') return false;
      if (!e.createdAt) return false;
      const created = new Date(e.createdAt);
      return differenceInDays(now, created) > 7;
    }).length;

    // Events missing critical info
    const missingInfo = eventRequests.filter(e => {
      const status = e.status?.toLowerCase() || '';
      if (!['scheduled', 'in_process'].includes(status)) return false;
      return !e.eventAddress || !e.scheduledEventDate || !e.estimatedSandwichCount;
    }).length;

    // Unassigned events (no TSP contact)
    const unassigned = eventRequests.filter(e => {
      const status = e.status?.toLowerCase() || '';
      return ['new', 'in_process'].includes(status) && !e.tspContact && !e.customTspContact;
    }).length;

    // Total estimated sandwiches
    const totalSandwiches = eventRequests
      .filter(e => {
        const status = e.status?.toLowerCase() || '';
        return ['scheduled', 'in_process'].includes(status) && e.estimatedSandwichCount;
      })
      .reduce((sum, e) => sum + (e.estimatedSandwichCount || 0), 0);

    // Events needing attention (stale, missing info, or overdue)
    const needsAttention = eventRequests.filter(e => {
      const status = e.status?.toLowerCase() || '';
      
      // Stale new requests
      if (status === 'new' && e.createdAt) {
        const created = new Date(e.createdAt);
        if (differenceInDays(now, created) > 7) return true;
      }
      
      // Missing critical info
      if (['scheduled', 'in_process'].includes(status)) {
        if (!e.eventAddress || !e.scheduledEventDate || !e.estimatedSandwichCount) return true;
      }
      
      // Overdue follow-up
      if (e.scheduledCallDate) {
        const callDate = new Date(e.scheduledCallDate);
        if (isPast(callDate) && ['new', 'in_process'].includes(status)) return true;
      }
      
      return false;
    }).length;

    return {
      upcoming7Days,
      upcoming14Days,
      upcoming30Days,
      overdueFollowUps,
      staleRequests,
      missingInfo,
      unassigned,
      totalSandwiches,
      needsAttention,
    };
  }, [eventRequests]);

  return (
    <div className="space-y-6">
      {/* Planning Tools Section */}
      <div className="premium-card p-6">
        <h2 className="text-xl font-semibold text-brand-primary mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Planning Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowSandwichModal(true)}
            className="premium-card-flat p-6 hover:shadow-lg transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#007E8C]/10 flex items-center justify-center group-hover:bg-[#007E8C]/20 transition-colors">
                <Package className="w-6 h-6 text-[#007E8C]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-slate-900 mb-1">Sandwich Planning</h3>
                <p className="text-sm text-slate-600">
                  Plan sandwich production based on scheduled events
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowStaffingModal(true)}
            className="premium-card-flat p-6 hover:shadow-lg transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#236383]/10 flex items-center justify-center group-hover:bg-[#236383]/20 transition-colors">
                <Users className="w-6 h-6 text-[#236383]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-slate-900 mb-1">Staffing Planning</h3>
                <p className="text-sm text-slate-600">
                  Coordinate drivers, speakers, and volunteers
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Time-Based Metrics */}
      <div className="premium-card p-6">
        <h2 className="text-xl font-semibold text-brand-primary mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Upcoming Events
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="premium-card-flat p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics.upcoming7Days}</div>
            <div className="text-sm text-slate-600 mt-1">Next 7 Days</div>
          </div>
          <div className="premium-card-flat p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics.upcoming14Days}</div>
            <div className="text-sm text-slate-600 mt-1">Next 14 Days</div>
          </div>
          <div className="premium-card-flat p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics.upcoming30Days}</div>
            <div className="text-sm text-slate-600 mt-1">Next 30 Days</div>
          </div>
        </div>
      </div>

      {/* Quick Action Items */}
      <div className="premium-card p-6">
        <h2 className="text-xl font-semibold text-brand-primary mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Needs Attention
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`premium-card-flat p-4 ${metrics.needsAttention > 0 ? 'border-l-4 border-orange-500' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className={`w-4 h-4 ${metrics.needsAttention > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
              <div className="text-sm font-medium text-slate-600">Total Issues</div>
            </div>
            <div className={`text-2xl font-bold ${metrics.needsAttention > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
              {metrics.needsAttention}
            </div>
          </div>
          <div className={`premium-card-flat p-4 ${metrics.overdueFollowUps > 0 ? 'border-l-4 border-red-500' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`w-4 h-4 ${metrics.overdueFollowUps > 0 ? 'text-red-500' : 'text-slate-400'}`} />
              <div className="text-sm font-medium text-slate-600">Overdue Follow-ups</div>
            </div>
            <div className={`text-2xl font-bold ${metrics.overdueFollowUps > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {metrics.overdueFollowUps}
            </div>
          </div>
          <div className={`premium-card-flat p-4 ${metrics.staleRequests > 0 ? 'border-l-4 border-yellow-500' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <Info className={`w-4 h-4 ${metrics.staleRequests > 0 ? 'text-yellow-500' : 'text-slate-400'}`} />
              <div className="text-sm font-medium text-slate-600">Stale Requests</div>
            </div>
            <div className={`text-2xl font-bold ${metrics.staleRequests > 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
              {metrics.staleRequests}
            </div>
            <div className="text-xs text-slate-500 mt-1">New &gt; 7 days</div>
          </div>
          <div className={`premium-card-flat p-4 ${metrics.missingInfo > 0 ? 'border-l-4 border-amber-500' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className={`w-4 h-4 ${metrics.missingInfo > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              <div className="text-sm font-medium text-slate-600">Missing Info</div>
            </div>
            <div className={`text-2xl font-bold ${metrics.missingInfo > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {metrics.missingInfo}
            </div>
            <div className="text-xs text-slate-500 mt-1">Address/Date/Count</div>
          </div>
        </div>
      </div>

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="premium-card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary" />
            Operational Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 premium-card-flat">
              <span className="text-sm text-slate-600">Total Estimated Sandwiches</span>
              <span className="text-lg font-bold text-brand-primary">
                {metrics.totalSandwiches.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 premium-card-flat">
              <span className="text-sm text-slate-600">Unassigned Events</span>
              <Badge variant={metrics.unassigned > 0 ? 'destructive' : 'outline'}>
                {metrics.unassigned}
              </Badge>
            </div>
          </div>
        </div>

        <div className="premium-card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            {metrics.unassigned > 0 && (
              <div className="p-3 premium-card-flat border-l-4 border-blue-500">
                <div className="text-sm font-medium text-slate-900">
                  {metrics.unassigned} event{metrics.unassigned !== 1 ? 's' : ''} need TSP contact assignment
                </div>
              </div>
            )}
            {metrics.overdueFollowUps > 0 && (
              <div className="p-3 premium-card-flat border-l-4 border-red-500">
                <div className="text-sm font-medium text-slate-900">
                  {metrics.overdueFollowUps} scheduled follow-up{metrics.overdueFollowUps !== 1 ? 's' : ''} overdue
                </div>
              </div>
            )}
            {metrics.missingInfo > 0 && (
              <div className="p-3 premium-card-flat border-l-4 border-amber-500">
                <div className="text-sm font-medium text-slate-900">
                  {metrics.missingInfo} event{metrics.missingInfo !== 1 ? 's' : ''} missing critical information
                </div>
              </div>
            )}
            {metrics.needsAttention === 0 && (
              <div className="p-3 premium-card-flat border-l-4 border-green-500">
                <div className="text-sm font-medium text-slate-900">
                  All events are up to date! 🎉
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sandwich Planning Modal */}
      <Dialog open={showSandwichModal} onOpenChange={setShowSandwichModal}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
              <Package className="w-6 h-6" />
              Weekly Sandwich Planning
            </DialogTitle>
            <DialogDescription>
              Plan sandwich production based on scheduled events. Monitor
              trends and adjust quantities based on demand patterns.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            <SandwichForecastWidget />

            <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
              <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Sandwich Planning Tips
              </h4>
              <ul className="text-sm text-[#236383] space-y-1">
                <li>
                  • Plan sandwich types based on dietary restrictions and
                  preferences
                </li>
                <li>
                  • Factor in 10-15% extra sandwiches for unexpected attendees
                </li>
                <li>
                  • Coordinate with kitchen volunteers for preparation
                  schedules
                </li>
                <li>
                  • Check delivery addresses for any special requirements
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t">
            <Button
              onClick={() => setShowSandwichModal(false)}
              className="text-white"
              style={{ backgroundColor: '#236383' }}
            >
              Close Sandwich Planning
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Staffing Planning Modal */}
      <Dialog open={showStaffingModal} onOpenChange={setShowStaffingModal}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
              <Users className="w-6 h-6" />
              Weekly Staffing Planning
            </DialogTitle>
            <DialogDescription>
              Coordinate drivers, speakers, and volunteers for scheduled
              events. Ensure all positions are filled before event dates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            <StaffingForecastWidget />

            <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
              <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Staffing Planning Tips
              </h4>
              <ul className="text-sm text-[#236383] space-y-1">
                <li>
                  • Check driver assignments early - transportation is
                  critical
                </li>
                <li>
                  • Speaker assignments should be confirmed 1 week before
                  events
                </li>
                <li>
                  • Van drivers are needed for large events or special
                  delivery requirements
                </li>
                <li>
                  • Volunteers help with event setup and sandwich distribution
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t">
            <Button
              onClick={() => setShowStaffingModal(false)}
              className="text-white"
              style={{ backgroundColor: '#236383' }}
            >
              Close Staffing Planning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

