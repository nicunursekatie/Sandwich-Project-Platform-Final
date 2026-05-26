import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Target, Calendar, Pencil, Check, X } from 'lucide-react';
import { useAnnualSandwichGoal, useUpdateAppSetting } from '@/hooks/useAppSettings';
import { useAuth } from '@/hooks/useAuth';
import { ANNUAL_SANDWICH_GOAL_KEY } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateGroupSandwiches,
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';


type PresetKey = 'ytd' | 'mtd' | 'qtd' | 'last7' | 'last30' | 'last90' | 'custom';

interface Period {
  start: Date;
  end: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function shiftYears(d: Date, n: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
function fmtDateRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = sameYear
    ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}
function daysBetween(start: Date, end: Date): number {
  const ms = endOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(1, Math.round(ms / (86400 * 1000)));
}
function fmtNum(n: number): string {
  return Math.round(n).toLocaleString();
}
function pct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}
function fmtPct(p: number | null, withSign = true): string {
  if (p === null || !isFinite(p)) return '—';
  const sign = withSign && p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISODate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

function getPresetPeriod(preset: PresetKey, now: Date): Period {
  const today = startOfDay(now);
  switch (preset) {
    case 'ytd':
      return {
        start: new Date(today.getFullYear(), 0, 1),
        end: endOfDay(today),
        label: 'Year to date',
      };
    case 'mtd':
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: endOfDay(today),
        label: 'Month to date',
      };
    case 'qtd': {
      const q = Math.floor(today.getMonth() / 3);
      return {
        start: new Date(today.getFullYear(), q * 3, 1),
        end: endOfDay(today),
        label: 'Quarter to date',
      };
    }
    case 'last7':
      return { start: addDays(today, -6), end: endOfDay(today), label: 'Last 7 days' };
    case 'last30':
      return { start: addDays(today, -29), end: endOfDay(today), label: 'Last 30 days' };
    case 'last90':
      return { start: addDays(today, -89), end: endOfDay(today), label: 'Last 90 days' };
    default:
      return { start: today, end: endOfDay(today), label: 'Custom' };
  }
}

interface Totals {
  total: number;
  individual: number;
  group: number;
  entries: number;
}

function totalsForPeriod(
  collections: SandwichCollection[],
  start: Date,
  end: Date
): Totals {
  let total = 0;
  let individual = 0;
  let group = 0;
  let entries = 0;
  for (const c of collections) {
    const d = parseCollectionDate(c.collectionDate as unknown as string);
    if (isNaN(d.getTime())) continue;
    if (d < start || d > end) continue;
    entries++;
    individual += Number(c.individualSandwiches || 0);
    group += calculateGroupSandwiches(c);
    total += calculateTotalSandwiches(c);
  }
  return { total, individual, group, entries };
}

interface MonthBucket {
  month: string;
  monthIdx: number;
  current: number;
  prior: number;
}

function monthlyBreakdown(
  collections: SandwichCollection[],
  currentYear: number,
  priorYear: number,
  ytdCutoffMonth: number,
  ytdCutoffDay: number
): MonthBucket[] {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const buckets: MonthBucket[] = monthNames.map((m, i) => ({
    month: m,
    monthIdx: i,
    current: 0,
    prior: 0,
  }));
  for (const c of collections) {
    const d = parseCollectionDate(c.collectionDate as unknown as string);
    if (isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    if (y !== currentYear && y !== priorYear) continue;
    // For both years, only count up through the same cutoff date for fair comparison
    if (m > ytdCutoffMonth) continue;
    if (m === ytdCutoffMonth && day > ytdCutoffDay) continue;
    const total = calculateTotalSandwiches(c);
    if (y === currentYear) buckets[m].current += total;
    else buckets[m].prior += total;
  }
  // Trim months after the cutoff for cleaner chart
  return buckets.slice(0, ytdCutoffMonth + 1);
}

export default function PaceComparisonAnalytics() {
  const [preset, setPreset] = useState<PresetKey>('ytd');
  const [customStart, setCustomStart] = useState<string>(
    toISODate(new Date(new Date().getFullYear(), 0, 1))
  );
  const [customEnd, setCustomEnd] = useState<string>(toISODate(new Date()));
  const ANNUAL_GOAL = useAnnualSandwichGoal();
  const { user } = useAuth();
  const canEditGoal = !!user && ['admin', 'super_admin', 'admin_coordinator'].includes((user as any).role);
  const updateSetting = useUpdateAppSetting();
  const { toast } = useToast();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  const { data, isLoading } = useQuery<{ collections: SandwichCollection[] }>({
    queryKey: ['/api/sandwich-collections', { all: true, limit: 10000 }],
    queryFn: async () => {
      const res = await fetch('/api/sandwich-collections?page=1&limit=10000');
      if (!res.ok) throw new Error('Failed to load collections');
      return res.json();
    },
  });

  const now = new Date();
  const currentPeriod: Period = useMemo(() => {
    if (preset === 'custom') {
      const s = fromISODate(customStart);
      const e = endOfDay(fromISODate(customEnd));
      return { start: s, end: e, label: 'Custom range' };
    }
    return getPresetPeriod(preset, now);
  }, [preset, customStart, customEnd, now]);

  const priorYearPeriod: Period = useMemo(
    () => ({
      start: shiftYears(currentPeriod.start, -1),
      end: shiftYears(currentPeriod.end, -1),
      label: `${currentPeriod.label}, prior year`,
    }),
    [currentPeriod]
  );

  const priorPeriod: Period = useMemo(() => {
    const lengthMs = currentPeriod.end.getTime() - currentPeriod.start.getTime();
    const end = addDays(currentPeriod.start, -1);
    const start = new Date(end.getTime() - lengthMs);
    return { start: startOfDay(start), end: endOfDay(end), label: 'Prior equal-length period' };
  }, [currentPeriod]);

  const collections = data?.collections || [];

  const curr = useMemo(
    () => totalsForPeriod(collections, currentPeriod.start, currentPeriod.end),
    [collections, currentPeriod]
  );
  const ly = useMemo(
    () => totalsForPeriod(collections, priorYearPeriod.start, priorYearPeriod.end),
    [collections, priorYearPeriod]
  );
  const pp = useMemo(
    () => totalsForPeriod(collections, priorPeriod.start, priorPeriod.end),
    [collections, priorPeriod]
  );

  // Year-end projection (only meaningful for YTD)
  const projection = useMemo(() => {
    if (preset !== 'ytd') return null;
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const dayOfYear =
      Math.floor((now.getTime() - yearStart.getTime()) / (86400 * 1000)) + 1;
    const daysInYear =
      ((now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) ||
      now.getFullYear() % 400 === 0
        ? 366
        : 365);
    const projected = Math.round((curr.total / dayOfYear) * daysInYear);
    return { projected, dayOfYear, daysInYear };
  }, [curr.total, preset, now]);

  // Monthly chart data
  const monthly = useMemo(() => {
    if (preset !== 'ytd') return null;
    return monthlyBreakdown(
      collections,
      now.getFullYear(),
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate()
    );
  }, [collections, preset, now]);

  // Narrative
  const narrative = useMemo(() => {
    if (isLoading) return [];
    const lines: string[] = [];
    const yoyPct = pct(curr.total, ly.total);
    if (yoyPct !== null) {
      const diff = curr.total - ly.total;
      lines.push(
        diff >= 0
          ? `You're ahead of this time last year by ${fmtNum(diff)} sandwiches (${fmtPct(yoyPct)}).`
          : `You're behind this time last year by ${fmtNum(Math.abs(diff))} sandwiches (${fmtPct(yoyPct)}).`
      );
    }
    const indivPct = pct(curr.individual, ly.individual);
    const groupPct = pct(curr.group, ly.group);
    if (indivPct !== null && groupPct !== null) {
      if (Math.abs(groupPct) > Math.abs(indivPct) && Math.abs(groupPct) > 10) {
        lines.push(
          groupPct > 0
            ? `Growth is driven by group events — group sandwiches are up ${fmtPct(groupPct, false)} vs last year.`
            : `Group event totals are down ${fmtPct(Math.abs(groupPct), false)} vs last year — worth a look.`
        );
      } else if (Math.abs(indivPct) > 10) {
        lines.push(
          indivPct > 0
            ? `Individual collections are up ${fmtPct(indivPct, false)} vs last year.`
            : `Individual collections are down ${fmtPct(Math.abs(indivPct), false)} vs last year.`
        );
      }
    }
    if (projection) {
      const pctOfGoal = (projection.projected / ANNUAL_GOAL) * 100;
      lines.push(
        `At current pace you'll finish around ${fmtNum(projection.projected)} — about ${pctOfGoal.toFixed(0)}% of the ${fmtNum(ANNUAL_GOAL)} goal.`
      );
    }
    return lines;
  }, [curr, ly, projection, isLoading, ANNUAL_GOAL]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const yoyPctTotal = pct(curr.total, ly.total);
  const ppPctTotal = pct(curr.total, pp.total);

  const currentRangeLabel = fmtDateRange(currentPeriod.start, currentPeriod.end);
  const lyRangeLabel = fmtDateRange(priorYearPeriod.start, priorYearPeriod.end);
  const ppDayCount = daysBetween(priorPeriod.start, priorPeriod.end);
  const ppRangeLabel = fmtDateRange(priorPeriod.start, priorPeriod.end);
  const sameDatesLastYearLabel = `vs same dates last year (${lyRangeLabel})`;
  const precedingPeriodLabel = `vs preceding ${ppDayCount} day${ppDayCount === 1 ? '' : 's'} (${ppRangeLabel})`;

  return (
    <div className="space-y-4">
      {/* Period picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Compare period
          </CardTitle>
          <CardDescription>
            Showing <strong>{currentPeriod.label}</strong> ({fmtDate(currentPeriod.start)} – {fmtDate(currentPeriod.end)}). Each card compares against the <em>same dates last year</em> and the <em>equal-length window immediately before</em> this one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {([
              ['ytd', 'Year to date'],
              ['mtd', 'Month to date'],
              ['qtd', 'Quarter to date'],
              ['last7', 'Last 7 days'],
              ['last30', 'Last 30 days'],
              ['last90', 'Last 90 days'],
              ['custom', 'Custom…'],
            ] as [PresetKey, string][]).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={preset === k ? 'default' : 'outline'}
                onClick={() => setPreset(k)}
              >
                {label}
              </Button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <div>
                <Label htmlFor="pc-start" className="text-xs">From</Label>
                <Input
                  id="pc-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-44"
                />
              </div>
              <div>
                <Label htmlFor="pc-end" className="text-xs">To</Label>
                <Input
                  id="pc-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-44"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Headline cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ComparisonCard
          title="Total sandwiches"
          current={curr.total}
          periodRange={currentRangeLabel}
          comparisons={[
            { label: sameDatesLastYearLabel, value: ly.total, pct: yoyPctTotal },
            { label: precedingPeriodLabel, value: pp.total, pct: ppPctTotal },
          ]}
          entries={curr.entries}
        />
        <ComparisonCard
          title="Individual sandwiches"
          current={curr.individual}
          periodRange={currentRangeLabel}
          comparisons={[
            {
              label: sameDatesLastYearLabel,
              value: ly.individual,
              pct: pct(curr.individual, ly.individual),
            },
          ]}
        />
        <ComparisonCard
          title="Group sandwiches"
          current={curr.group}
          periodRange={currentRangeLabel}
          comparisons={[
            {
              label: sameDatesLastYearLabel,
              value: ly.group,
              pct: pct(curr.group, ly.group),
            },
          ]}
        />
      </div>

      {/* Year-end projection (YTD only) */}
      {projection && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" /> Year-end projection
            </CardTitle>
            <CardDescription>
              Based on day {projection.dayOfYear} of {projection.daysInYear} at current pace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <div className="text-3xl font-bold text-slate-900">
                  {fmtNum(projection.projected)}
                </div>
                <div className="text-xs text-slate-500">Projected year-end</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-slate-700">
                  {((projection.projected / ANNUAL_GOAL) * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  of {fmtNum(ANNUAL_GOAL)} goal
                  {canEditGoal && !editingGoal && (
                    <button
                      type="button"
                      onClick={() => {
                        setGoalDraft(String(ANNUAL_GOAL));
                        setEditingGoal(true);
                      }}
                      className="text-slate-400 hover:text-slate-700"
                      title="Edit annual goal"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {editingGoal && (
                  <div className="flex items-center gap-1 mt-2">
                    <Input
                      type="number"
                      min={1}
                      value={goalDraft}
                      onChange={(e) => setGoalDraft(e.target.value)}
                      className="w-32 h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      disabled={updateSetting.isPending}
                      onClick={() => {
                        const n = parseInt(goalDraft, 10);
                        if (!Number.isFinite(n) || n <= 0) {
                          toast({
                            title: 'Invalid goal',
                            description: 'Enter a positive whole number.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        updateSetting.mutate(
                          { key: ANNUAL_SANDWICH_GOAL_KEY, value: String(n) },
                          {
                            onSuccess: () => {
                              setEditingGoal(false);
                              toast({ title: 'Annual goal updated' });
                            },
                            onError: (err: any) => {
                              toast({
                                title: 'Could not update goal',
                                description: err?.message || 'Please try again.',
                                variant: 'destructive',
                              });
                            },
                          }
                        );
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingGoal(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${projection.projected >= ANNUAL_GOAL ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{
                      width: `${Math.min(100, (projection.projected / ANNUAL_GOAL) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly side-by-side chart (YTD only) */}
      {monthly && monthly.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Monthly comparison: {now.getFullYear()} vs {now.getFullYear() - 1}
            </CardTitle>
            <CardDescription>
              Each month counts only through the same day-of-month for fair comparison.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => fmtNum(v)} />
                  <Tooltip formatter={(value: number) => fmtNum(value)} />
                  <Legend />
                  <Bar
                    dataKey="prior"
                    name={`${now.getFullYear() - 1}`}
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="current"
                    name={`${now.getFullYear()}`}
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Narrative */}
      {narrative.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What changed</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {narrative.map((line, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComparisonCard({
  title,
  current,
  comparisons,
  entries,
  periodRange,
}: {
  title: string;
  current: number;
  comparisons: { label: string; value: number; pct: number | null }[];
  entries?: number;
  periodRange?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{fmtNum(current)}</div>
        {(periodRange || entries !== undefined) && (
          <div className="text-xs text-slate-500 mt-0.5">
            {periodRange}
            {periodRange && entries !== undefined && ' · '}
            {entries !== undefined && (
              <>
                {entries.toLocaleString()} collection {entries === 1 ? 'entry' : 'entries'}
              </>
            )}
          </div>
        )}
        <div className="mt-3 space-y-1.5">
          {comparisons.map((c, i) => {
            const isUp = c.pct !== null && c.pct >= 0;
            return (
              <div key={i} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-slate-600 leading-snug">{c.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500 text-xs">{fmtNum(c.value)}</span>
                  <Badge
                    variant="outline"
                    className={
                      c.pct === null
                        ? 'text-slate-500'
                        : isUp
                          ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                          : 'text-rose-700 border-rose-200 bg-rose-50'
                    }
                  >
                    {c.pct === null ? '—' : (
                      <>
                        {isUp ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {fmtPct(c.pct)}
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
