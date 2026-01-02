import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Building2,
  Calendar,
  Target,
  Award,
  AlertCircle,
  Clock,
  Sparkles,
  Download,
  RefreshCw,
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Lightbulb,
  Phone,
  Mail,
  Star,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Types matching backend
interface EngagementScores {
  overall: number;
  frequency: number;
  recency: number;
  volume: number;
  completion: number;
  consistency: number;
}

interface EngagementMetrics {
  totalEvents: number;
  completedEvents: number;
  totalSandwiches: number;
  daysSinceLastEvent: number | null;
  daysSinceFirstEvent: number | null;
  lastEventDate: string | null;
  firstEventDate: string | null;
  averageEventInterval: number | null;
}

interface EngagementInsight {
  type: 'warning' | 'opportunity' | 'positive' | 'info';
  title: string;
  description: string;
  priority: number;
}

interface RecommendedAction {
  action: string;
  reason: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
}

interface ProgramSuitability {
  program: string;
  score: number;
  reason: string;
}

interface OrganizationEngagement {
  organizationName: string;
  canonicalName: string;
  category: string | null;
  scores: EngagementScores;
  metrics: EngagementMetrics;
  engagementLevel: 'highly_engaged' | 'engaged' | 'moderate' | 'low' | 'at_risk' | 'dormant' | 'new';
  engagementTrend: 'increasing' | 'decreasing' | 'stable' | 'new';
  trendPercentChange: number;
  outreachPriority: 'urgent' | 'high' | 'normal' | 'low';
  insights: EngagementInsight[];
  recommendedActions: RecommendedAction[];
  programSuitability: ProgramSuitability[];
  lastCalculatedAt: string;
}

interface GroupInsightsSummary {
  totalOrganizations: number;
  engagementDistribution: {
    highlyEngaged: number;
    engaged: number;
    moderate: number;
    low: number;
    atRisk: number;
    dormant: number;
    new: number;
  };
  outreachPriorities: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
  categoryBreakdown: Record<string, {
    count: number;
    avgEngagementScore: number;
  }>;
  averageEngagementScore: number;
  topPerformers: OrganizationEngagement[];
  needsAttention: OrganizationEngagement[];
  newOpportunities: OrganizationEngagement[];
}

// Helper functions
const getEngagementLevelColor = (level: string): string => {
  switch (level) {
    case 'highly_engaged': return 'bg-green-500';
    case 'engaged': return 'bg-emerald-400';
    case 'moderate': return 'bg-yellow-400';
    case 'low': return 'bg-orange-400';
    case 'at_risk': return 'bg-red-500';
    case 'dormant': return 'bg-gray-500';
    case 'new': return 'bg-blue-500';
    default: return 'bg-gray-400';
  }
};

const getEngagementLevelBadge = (level: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'highly_engaged': 'default',
    'engaged': 'default',
    'moderate': 'secondary',
    'low': 'secondary',
    'at_risk': 'destructive',
    'dormant': 'outline',
    'new': 'default',
  };

  const labels: Record<string, string> = {
    'highly_engaged': 'Highly Engaged',
    'engaged': 'Engaged',
    'moderate': 'Moderate',
    'low': 'Low',
    'at_risk': 'At Risk',
    'dormant': 'Dormant',
    'new': 'New',
  };

  return (
    <Badge variant={variants[level] || 'secondary'} className={cn(
      level === 'highly_engaged' && 'bg-green-500',
      level === 'engaged' && 'bg-emerald-500',
      level === 'new' && 'bg-blue-500',
    )}>
      {labels[level] || level}
    </Badge>
  );
};

const getPriorityBadge = (priority: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'urgent': 'destructive',
    'high': 'destructive',
    'normal': 'secondary',
    'low': 'outline',
  };

  return (
    <Badge variant={variants[priority] || 'secondary'} className={cn(
      priority === 'high' && 'bg-orange-500'
    )}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
};

const getTrendIcon = (trend: string) => {
  if (trend === 'increasing') {
    return <ArrowUpRight className="h-4 w-4 text-green-500" />;
  }
  if (trend === 'decreasing') {
    return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
};

const formatDaysAgo = (days: number | null): string => {
  if (days === null) return 'Never';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};

const getDaysSinceLastEvent = (metrics: EngagementMetrics): number | null => {
  if (metrics.daysSinceLastEvent !== null && metrics.daysSinceLastEvent !== undefined) {
    return metrics.daysSinceLastEvent;
  }
  if (metrics.lastEventDate) {
    const last = new Date(metrics.lastEventDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  }
  return null;
};

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    'corp': 'Corporate',
    'small_medium_corp': 'Small/Medium Business',
    'large_corp': 'Large Corporation',
    'school': 'School',
    'church_faith': 'Church/Faith',
    'religious': 'Religious',
    'nonprofit': 'Nonprofit',
    'government': 'Government',
    'hospital': 'Hospital',
    'neighborhood': 'Neighborhood',
    'club': 'Club',
    'greek_life': 'Greek Life',
    'cultural': 'Cultural',
    'other': 'Other',
    'uncategorized': 'Uncategorized',
  };
  return labels[category] || category;
};

// Score display component
function ScoreDisplay({ label, score, color }: { label: string; score: number; color?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Progress value={score} className="w-20 h-2" />
        <span className="w-8 text-right font-medium">{Math.round(score)}</span>
      </div>
    </div>
  );
}

// Organization detail dialog
function OrganizationDetailDialog({
  organization,
  open,
  onOpenChange
}: {
  organization: OrganizationEngagement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {organization.organizationName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {organization.category && (
              <Badge variant="outline">{getCategoryLabel(organization.category)}</Badge>
            )}
            {getEngagementLevelBadge(organization.engagementLevel)}
            {getPriorityBadge(organization.outreachPriority)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Engagement Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-4 w-4" />
                Engagement Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-bold">
                  {Math.round(organization.scores.overall)}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {getTrendIcon(organization.engagementTrend)}
                  <span>{organization.engagementTrend}</span>
                  {organization.trendPercentChange !== 0 && (
                    <span>({organization.trendPercentChange > 0 ? '+' : ''}{organization.trendPercentChange}%)</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <ScoreDisplay label="Recency" score={organization.scores.recency} />
                <ScoreDisplay label="Frequency" score={organization.scores.frequency} />
                <ScoreDisplay label="Completion" score={organization.scores.completion} />
                <ScoreDisplay label="Volume" score={organization.scores.volume} />
                <ScoreDisplay label="Consistency" score={organization.scores.consistency} />
              </div>
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Activity Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Events</div>
                  <div className="text-xl font-semibold">{organization.metrics.totalEvents}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Completed Events</div>
                  <div className="text-xl font-semibold">{organization.metrics.completedEvents}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Sandwiches</div>
                  <div className="text-xl font-semibold">{organization.metrics.totalSandwiches.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Last Event</div>
                  <div className="text-xl font-semibold">{formatDaysAgo(getDaysSinceLastEvent(organization.metrics))}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          {organization.insights.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {organization.insights.map((insight, idx) => (
                    <div key={idx} className={cn(
                      "p-3 rounded-lg border",
                      insight.type === 'warning' && 'border-red-200 bg-red-50',
                      insight.type === 'opportunity' && 'border-yellow-200 bg-yellow-50',
                      insight.type === 'positive' && 'border-green-200 bg-green-50',
                      insight.type === 'info' && 'border-blue-200 bg-blue-50',
                    )}>
                      <div className="font-medium">{insight.title}</div>
                      <div className="text-sm text-muted-foreground">{insight.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Actions */}
          {organization.recommendedActions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {organization.recommendedActions.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                      {getPriorityBadge(action.priority)}
                      <div>
                        <div className="font-medium">{action.action}</div>
                        <div className="text-sm text-muted-foreground">{action.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Program Suitability */}
          {organization.programSuitability.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Program Suitability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {organization.programSuitability.map((program, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium">{program.program}</div>
                        <div className="text-sm text-muted-foreground">{program.reason}</div>
                      </div>
                      <Badge variant="outline">{program.score}% match</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Organization row component
function OrganizationRow({
  organization,
  onClick
}: {
  organization: OrganizationEngagement;
  onClick: () => void;
}) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={onClick}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", getEngagementLevelColor(organization.engagementLevel))} />
          <div>
            <div className="font-medium">{organization.organizationName}</div>
            {organization.category && (
              <div className="text-xs text-muted-foreground">{getCategoryLabel(organization.category)}</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{Math.round(organization.scores.overall)}</span>
          {getTrendIcon(organization.engagementTrend)}
        </div>
      </TableCell>
      <TableCell>
        {getEngagementLevelBadge(organization.engagementLevel)}
      </TableCell>
      <TableCell>
        {getPriorityBadge(organization.outreachPriority)}
      </TableCell>
      <TableCell className="text-right">
        {organization.metrics.totalSandwiches.toLocaleString()}
      </TableCell>
      <TableCell className="text-right">
        {formatDaysAgo(getDaysSinceLastEvent(organization.metrics))}
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

// Main component
export default function GroupsInsightsDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<OrganizationEngagement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [engagementFilter, setEngagementFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('overall');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch insights summary
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<GroupInsightsSummary>({
    queryKey: ['/api/group-engagement/insights'],
    queryFn: async () => {
      const response = await fetch('/api/group-engagement/insights', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch group engagement insights');
      return response.json();
    },
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all scores with filters
  const { data: scoresData, isLoading: scoresLoading, refetch: refetchScores } = useQuery<{
    total: number;
    organizations: OrganizationEngagement[];
  }>({
    queryKey: ['/api/group-engagement/scores', sortBy, sortOrder, engagementFilter, priorityFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      if (engagementFilter !== 'all') params.set('engagementLevel', engagementFilter);
      if (priorityFilter !== 'all') params.set('outreachPriority', priorityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const response = await fetch(`/api/group-engagement/scores?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch organization scores');
      return response.json();
    },
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = authLoading || summaryLoading || scoresLoading;

  // Filter organizations by search
  const filteredOrganizations = useMemo(() => {
    if (!scoresData?.organizations) return [];
    if (!searchQuery) return scoresData.organizations;

    const query = searchQuery.toLowerCase();
    return scoresData.organizations.filter(org =>
      org.organizationName.toLowerCase().includes(query) ||
      (org.category && org.category.toLowerCase().includes(query))
    );
  }, [scoresData, searchQuery]);

  // Chart data for engagement distribution
  const engagementChartData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Highly Engaged', value: summary.engagementDistribution.highlyEngaged, color: '#22c55e' },
      { name: 'Engaged', value: summary.engagementDistribution.engaged, color: '#10b981' },
      { name: 'Moderate', value: summary.engagementDistribution.moderate, color: '#eab308' },
      { name: 'Low', value: summary.engagementDistribution.low, color: '#f97316' },
      { name: 'At Risk', value: summary.engagementDistribution.atRisk, color: '#ef4444' },
      { name: 'Dormant', value: summary.engagementDistribution.dormant, color: '#6b7280' },
      { name: 'New', value: summary.engagementDistribution.new, color: '#3b82f6' },
    ].filter(item => item.value > 0);
  }, [summary]);

  // Chart data for outreach priorities
  const priorityChartData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Urgent', value: summary.outreachPriorities.urgent, color: '#ef4444' },
      { name: 'High', value: summary.outreachPriorities.high, color: '#f97316' },
      { name: 'Normal', value: summary.outreachPriorities.normal, color: '#6b7280' },
      { name: 'Low', value: summary.outreachPriorities.low, color: '#22c55e' },
    ].filter(item => item.value > 0);
  }, [summary]);

  // Categories for filter
  const categories = useMemo(() => {
    if (!summary?.categoryBreakdown) return [];
    return Object.keys(summary.categoryBreakdown).sort();
  }, [summary]);

  const handleExport = async () => {
    try {
      const response = await fetch('/api/group-engagement/export', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'group-engagement-scores.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetch('/api/group-engagement/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      refetchSummary();
      refetchScores();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-yellow-500" />
              Groups Engagement Insights
            </h2>
            <p className="text-muted-foreground">
              AI-powered analysis of organization engagement to prioritize outreach
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalOrganizations}</div>
                <p className="text-xs text-muted-foreground">
                  Unique groups in catalog
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Engagement Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(summary.averageEngagementScore)}</div>
                <Progress value={summary.averageEngagementScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  {summary.outreachPriorities.urgent + summary.outreachPriorities.high}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.outreachPriorities.urgent} urgent, {summary.outreachPriorities.high} high priority
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Opportunities</CardTitle>
                <Sparkles className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">
                  {summary.newOpportunities.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  New orgs with completed events
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Distribution</CardTitle>
              <CardDescription>
                Organizations by engagement level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={engagementChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {engagementChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outreach Priorities</CardTitle>
              <CardDescription>
                Organizations by outreach priority level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value">
                      {priorityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Organizations</TabsTrigger>
            <TabsTrigger value="attention" className="text-orange-600">
              Needs Attention
            </TabsTrigger>
            <TabsTrigger value="top" className="text-green-600">
              Top Performers
            </TabsTrigger>
            <TabsTrigger value="new" className="text-blue-600">
              New Opportunities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {/* Filters */}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search organizations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <Select value={engagementFilter} onValueChange={setEngagementFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Engagement Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="highly_engaged">Highly Engaged</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="dormant">Dormant</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overall">Overall Score</SelectItem>
                      <SelectItem value="recency">Recency</SelectItem>
                      <SelectItem value="frequency">Frequency</SelectItem>
                      <SelectItem value="volume">Volume</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="lastEvent">Last Event</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                  >
                    {sortOrder === 'asc' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* All organizations table */}
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Sandwiches</TableHead>
                      <TableHead className="text-right">Last Event</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.map(org => (
                      <OrganizationRow
                        key={org.canonicalName}
                        organization={org}
                        onClick={() => {
                          setSelectedOrg(org);
                          setDialogOpen(true);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
                {filteredOrganizations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No organizations found matching your filters
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attention">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Organizations Needing Attention
                </CardTitle>
                <CardDescription>
                  These organizations have urgent or high priority for outreach
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Sandwiches</TableHead>
                      <TableHead className="text-right">Last Event</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.needsAttention.map(org => (
                      <OrganizationRow
                        key={org.canonicalName}
                        organization={org}
                        onClick={() => {
                          setSelectedOrg(org);
                          setDialogOpen(true);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
                {(!summary?.needsAttention || summary.needsAttention.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No organizations currently need urgent attention
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-500" />
                  Top Performing Partners
                </CardTitle>
                <CardDescription>
                  These organizations are highly engaged and could be great ambassadors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Sandwiches</TableHead>
                      <TableHead className="text-right">Last Event</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.topPerformers.map(org => (
                      <OrganizationRow
                        key={org.canonicalName}
                        organization={org}
                        onClick={() => {
                          setSelectedOrg(org);
                          setDialogOpen(true);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
                {(!summary?.topPerformers || summary.topPerformers.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No top performers found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                  New Opportunities
                </CardTitle>
                <CardDescription>
                  New organizations with completed events - nurture these relationships
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Sandwiches</TableHead>
                      <TableHead className="text-right">Last Event</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.newOpportunities.map(org => (
                      <OrganizationRow
                        key={org.canonicalName}
                        organization={org}
                        onClick={() => {
                          setSelectedOrg(org);
                          setDialogOpen(true);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
                {(!summary?.newOpportunities || summary.newOpportunities.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No new opportunities found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Organization Detail Dialog */}
        <OrganizationDetailDialog
          organization={selectedOrg}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>
    </TooltipProvider>
  );
}
