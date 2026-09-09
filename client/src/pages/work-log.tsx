import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PERMISSIONS } from '@shared/auth-utils';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useResourcePermissions, usePermissions } from '@/hooks/useResourcePermissions';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { useToast } from '@/hooks/use-toast';

function formatElapsed(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hh = Math.floor(safeSeconds / 3600);
  const mm = Math.floor((safeSeconds % 3600) / 60);
  const ss = safeSeconds % 60;
  return [hh, mm, ss].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function WorkLogPage() {
  const { user } = useAuth();
  const { trackView, trackFormSubmit } = useActivityTracker();
  const { toast } = useToast();

  useEffect(() => {
    trackView(
      'Work Log',
      'Work Log',
      'Work Log Page',
      'User accessed work log page'
    );
  }, [trackView]);

  // Simplified permissions: CREATE_WORK_LOGS automatically includes edit/delete own permissions
  const { canAdd, canView, canEdit, canDelete } = useResourcePermissions('WORK_LOGS');
  const { WORK_LOGS_EDIT_ALL: canEditAllLogs, WORK_LOGS_DELETE_ALL: canDeleteAllLogs } = usePermissions(['WORK_LOGS_EDIT_ALL', 'WORK_LOGS_DELETE_ALL']);

  const canCreateLogs = canAdd;
  const canEditOwnLogs = canAdd; // Automatically included
  const canDeleteOwnLogs = canAdd; // Automatically included
  const canViewAllLogs = canView;
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [workDate, setWorkDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const {
    data: logsResponse,
    refetch,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/work-logs'],
    queryFn: async () => {
      logger.log('🚀 Work logs query function called');
      const data = await apiRequest('GET', '/api/work-logs');
      logger.log('🚀 Work logs API response data:', data);
      return data;
    },
    enabled: !!user, // Only fetch when user is authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes - work logs need reasonable freshness for collaborative updates
    refetchOnWindowFocus: true, // Refetch when user returns to see updates from other team members
  });

  // Handle both old array format and new paginated format { data, total, ... }
  const safelogs = Array.isArray(logsResponse)
    ? logsResponse
    : (logsResponse?.data && Array.isArray(logsResponse.data) ? logsResponse.data : []);

  const createLog = useMutation({
    mutationFn: async () => {
      const data = await apiRequest('POST', '/api/work-logs', {
        description: description || 'Work logged',
        hours,
        minutes,
        workDate: workDate + 'T12:00:00', // Add time component WITHOUT 'Z' to avoid timezone shift
      });
      return data;
    },
    onSuccess: () => {
      setDescription('');
      setHours(0);
      setMinutes(0);
      setWorkDate(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
      });
      queryClient.invalidateQueries({ queryKey: ['/api/work-logs'] });
      refetch(); // Force refetch to update the list immediately
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: number) => {
      const data = await apiRequest('DELETE', `/api/work-logs/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-logs'] });
      refetch(); // Force refetch to update the list immediately
    },
  });

  // --- Start work / stop work stopwatch ---
  const { data: timerResponse } = useQuery({
    queryKey: ['/api/work-logs/timer'],
    queryFn: async () => apiRequest('GET', '/api/work-logs/timer'),
    enabled: !!user && !!canCreateLogs,
    // The timer lives on the server so it survives reloads and follows the user
    // between devices; refetch on focus so a stale tab doesn't show a dead timer.
    refetchOnWindowFocus: true,
  });
  const activeTimer = timerResponse?.timer ?? null;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerDescription, setTimerDescription] = useState('');

  useEffect(() => {
    if (!activeTimer?.startedAt) {
      setElapsedSeconds(0);
      return;
    }
    const startedAtMs = new Date(activeTimer.startedAt).getTime();
    const tick = () =>
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.startedAt]);

  const invalidateTimer = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/work-logs/timer'] });

  const startTimer = useMutation({
    mutationFn: async () =>
      apiRequest('POST', '/api/work-logs/timer/start', {
        description: timerDescription || undefined,
      }),
    onSuccess: () => {
      invalidateTimer();
      toast({
        title: 'Timer started',
        description: 'Your time is being tracked. Click "Stop Work" when you finish.',
      });
    },
    onError: (err: any) => {
      invalidateTimer();
      toast({
        title: 'Could not start the timer',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async () =>
      apiRequest('POST', '/api/work-logs/timer/stop', {
        description: timerDescription || undefined,
      }),
    onSuccess: (result: any) => {
      setTimerDescription('');
      invalidateTimer();
      queryClient.invalidateQueries({ queryKey: ['/api/work-logs'] });
      refetch();
      const log = result?.log;
      toast({
        title: 'Work logged',
        description: result?.capped
          ? 'That timer ran for more than 24 hours, so the entry was capped at 24h 0m. Remove it and log the time manually if that is not right.'
          : `Logged ${log?.hours ?? 0}h ${log?.minutes ?? 0}m.`,
        variant: result?.capped ? 'destructive' : undefined,
      });
    },
    onError: (err: any) => {
      invalidateTimer();
      toast({
        title: 'Could not stop the timer',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const discardTimer = useMutation({
    mutationFn: async () => apiRequest('DELETE', '/api/work-logs/timer'),
    onSuccess: () => {
      setTimerDescription('');
      invalidateTimer();
      toast({
        title: 'Timer discarded',
        description: 'No work log entry was created.',
      });
    },
    onError: (err: any) => {
      invalidateTimer();
      toast({
        title: 'Could not discard the timer',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const timerBusy =
    startTimer.isPending || stopTimer.isPending || discardTimer.isPending;

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <PageBreadcrumbs segments={[
        { label: 'Operations' },
        { label: 'Work Log' }
      ]} />

      {/* Debug info - minimized and subtle */}
      <div className="text-xs text-gray-400 px-2">
        Debug: {safelogs.length} logs loaded • User:{' '}
        {(user as any)?.email || 'Unknown'}
      </div>

      {canCreateLogs && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Time Your Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div
                  className={`font-mono text-3xl tabular-nums ${
                    activeTimer ? 'text-brand-orange' : 'text-gray-400'
                  }`}
                  aria-live="polite"
                >
                  {formatElapsed(activeTimer ? elapsedSeconds : 0)}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {activeTimer
                    ? `Running since ${new Date(activeTimer.startedAt).toLocaleTimeString()}`
                    : 'Start the timer and we will log the elapsed time for you.'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeTimer ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => stopTimer.mutate()}
                      disabled={timerBusy}
                      className="bg-brand-orange hover:bg-brand-orange-dark text-white font-medium px-6"
                    >
                      {stopTimer.isPending ? 'Stopping...' : 'Stop Work'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => discardTimer.mutate()}
                      disabled={timerBusy}
                      className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                    >
                      Discard
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => startTimer.mutate()}
                    disabled={timerBusy}
                    className="bg-brand-orange hover:bg-brand-orange-dark text-white font-medium px-6"
                  >
                    {startTimer.isPending ? 'Starting...' : 'Start Work'}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                What are you working on?{' '}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <Textarea
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                placeholder={
                  activeTimer?.description ||
                  'Describe what you worked on (optional)...'
                }
                rows={2}
                className="resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Saved with the entry when you stop the timer.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {canCreateLogs && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Log Your Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createLog.mutate();
              }}
              className="space-y-4"
            >
              {/* Date field - compact styling */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Work Date
                </label>
                <Input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  required
                  className="w-full sm:w-48"
                />
              </div>

              {/* Time input - grouped visually as one unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Time Spent
                </label>
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value))}
                      placeholder="0"
                      required
                      className="w-16 text-center bg-white"
                    />
                    <span className="text-sm text-gray-600 font-medium">
                      hours
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                      placeholder="0"
                      required
                      className="w-16 text-center bg-white"
                    />
                    <span className="text-sm text-gray-600 font-medium">
                      minutes
                    </span>
                  </div>
                </div>
              </div>

              {/* Work description - moved below time and made optional */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Work Description{' '}
                  <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you worked on (optional)..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={createLog.isPending}
                  className="bg-brand-orange hover:bg-brand-orange-dark text-white font-medium px-6"
                >
                  {createLog.isPending ? 'Logging...' : 'Log Work'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Work Logs List - improved with better visual separation */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {canViewAllLogs ? 'All Work Logs' : 'My Work Logs'}
            </CardTitle>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="py-8 text-center text-gray-500">
              Loading work logs...
            </div>
          )}

          {error && (
            <div className="py-8 text-center">
              <div className="text-red-600 font-medium">Error loading logs</div>
              <div className="text-sm text-gray-500 mt-1">{error.message}</div>
            </div>
          )}

          {!isLoading && !error && (
            <div className="space-y-4">
              {safelogs.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  No work logs found. Start by logging your first work session
                  above.
                </div>
              )}

              {safelogs.map((log: any) => (
                <div
                  key={log?.id || Math.random()}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
                >
                  {/* Main work description - emphasized */}
                  <div className="text-gray-900 font-medium leading-relaxed">
                    {log.description}
                  </div>

                  {/* Metadata row - secondary information */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="font-medium text-brand-orange">
                        {log.hours}h {log.minutes}m
                      </span>
                      <span>
                        {log.workDate
                          ? new Date(log.workDate).toLocaleDateString()
                          : new Date(log.createdAt).toLocaleDateString()}
                      </span>
                      {log?.userId !== (user as any)?.id && (
                        <span className="text-brand-primary text-xs px-2 py-1 bg-brand-primary-lighter rounded-full">
                          Other user
                        </span>
                      )}
                    </div>

                    {/* Delete button - subtle and less aggressive */}
                    {((canDeleteOwnLogs && log?.userId === (user as any)?.id) ||
                      canDeleteAllLogs) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLog.mutate(log?.id)}
                        disabled={deleteLog.isPending}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs px-2 py-1"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
