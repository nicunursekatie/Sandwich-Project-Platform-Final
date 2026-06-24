import { useState } from 'react';
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Calendar,
  Award,
  Download,
  ExternalLink,
  Sandwich,
  Eye,
  BarChart3,
  Target,
  Activity,
  Users,
  Zap,
  Clock,
  Building2,
  Layers,
  Calculator,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/useResourcePermissions';
import { useAnnualSandwichGoal } from '@/hooks/useAppSettings';
import { PERMISSIONS } from '@shared/auth-utils';
import { getTodayString } from '@shared/date-utils';
import { useToast } from '@/hooks/use-toast';
import { calculateActualWeeklyAverage, calculateWeeklyData } from '@/lib/analytics-utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip as RechartsTooltip } from 'recharts';
import { HelpBubble } from '@/components/help-system';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import CollectionFormSelector from '@/components/collection-form-selector';
import { AnimatedCounter } from '@/components/modern-dashboard/animated-counter';
import DashboardActionTracker from '@/components/dashboard-action-tracker';
import { RecentlyAccessedResources } from '@/components/recently-accessed-resources';
// DashboardSearch import removed — its UI consolidated into UnifiedTopSearch
// in the persistent top navigation header. The endpoint it called
// (/api/people/search) is now used by the unified bar.
import { VolunteerOpportunitiesSpotlight } from '@/components/volunteer-opportunities-spotlight';
import OperationalOverview from '@/components/operational-overview';
import { LowVolumeAlert } from '@/components/low-volume-alert';
import { adminDocuments } from '@/pages/important-documents';

// Dark mode toggle removed per user request
import {
  SandwichStackIcon,
  GrowthTrendIcon,
  CommunityIcon,
  TargetIcon,
  SparkleIcon,
  NetworkIcon,
} from '@/components/modern-dashboard/custom-svg-icons';
// CMYK_PRINT_TSP_01 logo import removed — the centered logo card it powered
// was relocated to the sidebar brand block (simple-nav.tsx) so the dashboard
// can promote actionable content into the top slot.
import { logger } from '@/lib/logger';
// Using optimized SVG logos for faster loading
const tspLogoSvg = '/logo-optimized.svg';
const sandwichIconSvg = '/sandwich-icon-optimized.svg';

interface DashboardOverviewProps {
  onSectionChange: (section: string) => void;
}

// Standalone section band header — gives the dashboard a clear hierarchy
// (TODAY / VOLUNTEERS / OPERATIONS / TOOLS / INSIGHTS) so the page reads as
// grouped priorities instead of one long undifferentiated scroll. Rendered as
// a sibling before each group (the parent's space-y stacking forms the bands),
// so it never has to wrap blocks and can't unbalance the surrounding JSX.
function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mx-4 flex items-baseline gap-3 border-b border-gray-200 pb-2 pt-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[#236383]">{label}</h2>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}

export default function DashboardOverview({
  onSectionChange,
}: {
  onSectionChange?: (section: string) => void;
}) {
  const { user } = useAuth();
  const { COLLECTIONS_ADD, COLLECTIONS_EDIT_OWN, ADMIN_ACCESS } = usePermissions([
    'COLLECTIONS_ADD',
    'COLLECTIONS_EDIT_OWN',
    'ADMIN_ACCESS',
  ]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const annualSandwichGoal = useAnnualSandwichGoal();

  // Form state
  const [showCollectionForm, setShowCollectionForm] = useState(false);

  // Modal state for document preview
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    documentPath: '',
    documentName: '',
    documentType: '',
  });

  const openPreviewModal = (path: string, name: string, type: string) => {
    setPreviewModal({
      isOpen: true,
      documentPath: path,
      documentName: name,
      documentType: type,
    });
  };

  const closePreviewModal = () => {
    setPreviewModal({
      isOpen: false,
      documentPath: '',
      documentName: '',
      documentType: '',
    });
  };

  const handleShareInventoryCalculator = async () => {
    const url =
      'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html';
    const title = 'Inventory Calculator';
    const text =
      'Interactive tool for calculating sandwich inventory and planning quantities for collections';

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (error) {
        // User cancelled the share or error occurred, fallback to clipboard
        handleCopyLink(url);
      }
    } else {
      // Fallback to clipboard for browsers that don't support Web Share API
      handleCopyLink(url);
    }
  };

  const handleShareEventToolkit = async () => {
    const url = 'https://nicunursekatie.github.io/sandwichinventory/toolkit.html';
    const title = 'Event Toolkit for Volunteers';
    const text =
      'Everything you need to plan and host a sandwich-making event - includes safety guides, instructions, and labels';

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (error) {
        // User cancelled the share or error occurred, fallback to clipboard
        handleCopyLink(url);
      }
    } else {
      // Fallback to clipboard for browsers that don't support Web Share API
      handleCopyLink(url);
    }
  };

  const handleShareCollectionSites = async () => {
    const url = 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/';
    const title = 'Host Collection Sites Directory';
    const text =
      'Public-facing directory of all host collection sites - easy to share with volunteers and partners';

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (error) {
        // User cancelled the share or error occurred, fallback to clipboard
        handleCopyLink(url);
      }
    } else {
      // Fallback to clipboard for browsers that don't support Web Share API
      handleCopyLink(url);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied!',
        description:
          'The inventory calculator link has been copied to your clipboard.',
      });
    } catch (error) {
      logger.error('Failed to copy link:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard.',
        variant: 'destructive',
      });
    }
  };

  // Defer stats loading until after first render for better FCP/LCP
  const [deferredLoad, setDeferredLoad] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/stats', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds for dashboard stats
    refetchOnMount: true,
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    enabled: deferredLoad,
  });
  React.useEffect(() => {
    const timer = setTimeout(() => setDeferredLoad(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch dashboard documents configuration from API
  const { data: dashboardDocumentsData } = useQuery({
    queryKey: ['/api/dashboard-documents'],
    // Use global defaults (5 min staleTime) - invalidateQueries handles refetch on mutations
  });

  // Map dashboard document IDs to full document details from adminDocuments
  const importantDocuments = React.useMemo(() => {
    if (!dashboardDocumentsData || !Array.isArray(dashboardDocumentsData)) {
      logger.log('📄 Dashboard documents: No data or not array', dashboardDocumentsData);
      // Return empty array if no documents configured
      return [];
    }

    logger.log('📄 Dashboard documents data received:', dashboardDocumentsData);

    const mapped = dashboardDocumentsData
      .map((dashDoc: any) => {
        const doc = adminDocuments.find((d: any) => d.id === dashDoc.documentId);
        if (!doc) {
          logger.warn(`⚠️ Document not found in adminDocuments: ${dashDoc.documentId}`);
          return null;
        }

        logger.log(`✅ Found document: ${doc.name} (${dashDoc.documentId})`);

        return {
          title: doc.name,
          description: doc.description,
          category: doc.category,
          path: doc.path,
          type: doc.type,
        };
      })
      .filter((doc: any) => doc !== null);

    logger.log('📄 Final important documents:', mapped);
    return mapped;
  }, [dashboardDocumentsData]);

  // Fetch all collections for peak calculations
  const { data: allCollectionsData } = useQuery({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch(
        '/api/sandwich-collections?page=1&limit=5000',
        {
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for peak calculations
    enabled: !!statsData, // Only fetch after stats are loaded
  });

  // Key statistics - All values calculated dynamically from real data
  const organizationalStats = React.useMemo(() => {
    if (!statsData) {
      return {
        totalLifetimeSandwiches: 'Loading...',
        peakWeekRecord: 'Loading...',
        peakWeekDate: 'Loading...',
        currentAnnualCapacity: 'Loading...',
        weeklyBaseline: 'Loading...',
        surgingCapacity: 'Loading...',
        operationalYears: 'Loading...',
        growthMultiplier: 'Loading...',
        individualSandwiches: 'Loading...',
        groupSandwiches: 'Loading...',
        totalEntries: 'Loading...',
      };
    }

    const totalSandwiches = statsData.completeTotalSandwiches || 0;
    const individual = statsData.individualSandwiches || 0;
    const group = totalSandwiches - individual;

    // Calculate peak week from collections data if available
    let peakWeekRecord = statsData.peakWeekRecord || 0;
    let peakWeekDate = statsData.peakWeekDate || 'Calculating...';

    if (allCollectionsData?.collections) {
      const collections = allCollectionsData.collections;
      const weeklyTotals: Record<string, { total: number; date: string }> = {};

      collections.forEach((collection: any) => {
        if (collection.collectionDate) {
          const date = new Date(collection.collectionDate);
          // Get Monday of the week as key
          const monday = new Date(date);
          monday.setDate(date.getDate() - date.getDay() + 1);
          const weekKey = monday.toISOString().split('T')[0];

          if (!weeklyTotals[weekKey]) {
            weeklyTotals[weekKey] = {
              total: 0,
              date: monday.toLocaleDateString(),
            };
          }

          // Calculate total sandwiches for this collection
          const individualCount = collection.individualSandwiches || 0;
          let groupCount = 0;
          if (
            collection.groupCollections &&
            Array.isArray(collection.groupCollections)
          ) {
            groupCount = collection.groupCollections.reduce(
              (sum: number, group: any) => {
                return sum + (group.count || group.sandwichCount || 0);
              },
              0
            );
          }
          weeklyTotals[weekKey].total += individualCount + groupCount;
        }
      });

      // Find peak week
      const peakWeek = Object.values(weeklyTotals).reduce(
        (max, week) => (week.total > max.total ? week : max),
        { total: 0, date: 'N/A' }
      );

      if (peakWeek.total > peakWeekRecord) {
        peakWeekRecord = peakWeek.total;
        peakWeekDate = peakWeek.date;
      }
    }

    // Calculate dynamic values from actual data
    const currentYear = new Date().getFullYear();

    // Calculate operational years from actual data if available
    const earliestYear = statsData.earliestCollectionDate
      ? new Date(statsData.earliestCollectionDate).getFullYear()
      : 2020;
    const operationalYears = currentYear - earliestYear;

    // Annual goal - organizational target (configurable via app settings)
    const annualGoal = annualSandwichGoal;

    // Calculate weekly average using proper method that excludes holiday weeks
    // This accounts for Thanksgiving, Christmas, New Year's, July 4th, and Memorial Day weeks
    const weeklyAverage = allCollectionsData?.collections
      ? calculateActualWeeklyAverage(allCollectionsData.collections)
      : totalSandwiches / (operationalYears * 52); // Fallback to simple calculation

    // Calculate baseline and surge capacity from data patterns
    const baselineMin = Math.round(weeklyAverage * 0.7);
    const baselineMax = Math.round(weeklyAverage * 1.3);
    const surgeMin = Math.round(weeklyAverage * 3);
    const surgeMax = Math.round(weeklyAverage * 5);

    // Calculate growth multiplier using first year data if available
    const firstYearTotal = statsData.firstYearTotal || 1000; // Fallback estimate
    const firstYearWeekly = firstYearTotal / 52;
    const growthMultiplier =
      firstYearWeekly > 0
        ? Math.round(weeklyAverage / firstYearWeekly)
        : Math.round(weeklyAverage / (1000 / 52));

    return {
      totalLifetimeSandwiches: totalSandwiches.toLocaleString(),
      peakWeekRecord: peakWeekRecord.toLocaleString(),
      peakWeekDate: peakWeekDate,
      currentAnnualCapacity: annualGoal.toLocaleString(),
      weeklyBaseline: `${baselineMin.toLocaleString()}-${baselineMax.toLocaleString()}`,
      surgingCapacity: `${surgeMin.toLocaleString()}-${surgeMax.toLocaleString()}`,
      operationalYears: operationalYears.toString(),
      growthMultiplier: `${growthMultiplier}x`,
      individualSandwiches: individual.toLocaleString(),
      groupSandwiches: group.toLocaleString(),
      totalEntries: (statsData.totalEntries || 0).toLocaleString(),
    };
  }, [statsData, allCollectionsData, annualSandwichGoal]);

  // Last 12 completed weeks of real collection totals for the dashboard trend
  // chart. Excludes the in-progress week so the line doesn't dip artificially.
  const weeklyTrend = React.useMemo(() => {
    const collections = allCollectionsData?.collections;
    if (!collections?.length) return [];
    return calculateWeeklyData(collections)
      .filter((w) => w.isComplete)
      .slice(-12)
      .map((w) => ({
        week: w.weekLabel.split(' - ')[0], // short Friday label
        sandwiches: w.totalSandwiches,
      }));
  }, [allCollectionsData]);

  return (
    <div className="min-h-screen premium-gradient-subtle relative w-full overflow-x-hidden">
      {/* Dark Mode Toggle */}
      <div className="absolute top-4 right-4 z-50">
        {/* Dark mode toggle removed */}
      </div>
      <div className="space-y-8 pb-8 pt-4 w-full">
        {/* The big centered TSP logo+tagline card that used to live here was
            moved to the top-left of the sidebar so the dashboard's prime
            above-the-fold space (Universal Search + Collection CTA) shows
            without scrolling. The brand still anchors the page via the
            sidebar — standard SaaS convention (Slack, Linear, Notion). */}

        {/* The large in-dashboard search card that used to live here was
            removed — its functionality moved into UnifiedTopSearch in the
            persistent top navigation header so a single bar is available on
            every page. Reclaiming this vertical slot pulls the Collection
            CTA + impact milestone higher up the dashboard. */}

        {/* Collection Call-to-Action */}
        {(COLLECTIONS_ADD || COLLECTIONS_EDIT_OWN) && (
          <div className="premium-card-elevated mx-4 p-4 sm:p-6 max-w-full">
            <div className="text-center max-w-full">
              <div className="mb-4 sm:mb-6">
                <h2 className="premium-text-h3 text-brand-primary mb-2">
                  Record Collection Data
                </h2>
                {showCollectionForm && (
                  <p className="premium-text-body-sm text-gray-700">
                    Submit your sandwich contributions to help our community
                  </p>
                )}
              </div>
              {/* Primary + secondary action hierarchy.
                  "Enter New Collection Data" is the page's reason for being —
                  it gets the spotlight via larger padding, bigger text, and
                  the amber accent (#FBAD3F) which pops against the teal-heavy
                  page palette. "View Collection History" steps back to a
                  text-link treatment so the eye lands on the primary action
                  first. The buttons no longer share visual weight. */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                <button
                  className="premium-btn-accent text-base sm:text-lg font-bold px-8 py-3.5 shadow-[0_4px_14px_rgba(251,173,63,0.4)] hover:shadow-[0_6px_20px_rgba(251,173,63,0.5)]"
                  style={{ minHeight: '52px' }}
                  onClick={() => setShowCollectionForm(!showCollectionForm)}
                  data-testid="button-enter-collection-data"
                >
                  {showCollectionForm
                    ? 'Hide Form'
                    : 'Enter New Collection Data'}
                </button>
                <button
                  className="text-sm font-medium text-brand-primary hover:text-brand-primary-dark hover:underline underline-offset-4 transition-colors px-3 py-2"
                  onClick={() => onSectionChange?.('collections')}
                  data-testid="button-view-collection-history"
                >
                  View Collection History →
                </button>
              </div>
            </div>

            {/* Embedded Collection Form - Full width on mobile */}
            {showCollectionForm && (
              <div className="mt-6">
                <CollectionFormSelector
                  onSuccess={() => {
                    setShowCollectionForm(false);
                    queryClient.invalidateQueries({
                      queryKey: ['/api/sandwich-collections'],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ['/api/sandwich-collections/stats'],
                    });
                  }}
                  onCancel={() => setShowCollectionForm(false)}
                />
              </div>
            )}
          </div>
        )}

        {/* Hero Impact Section */}
        <div className="mx-4 mb-8 sm:mb-12 max-w-full">
          <div className="premium-card-featured p-8 sm:p-12 text-center max-w-full">
            <div className="mb-4">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-brand-orange tracking-tight">
                <AnimatedCounter
                  value={statsData?.completeTotalSandwiches || 0}
                />
              </h1>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mt-4">
                <div className="w-2 h-2 bg-brand-light-blue rounded-full hidden sm:block"></div>
                <p className="premium-text-body-lg text-brand-primary font-medium text-center">
                  Total sandwiches collected since 2020
                </p>
                <div className="w-2 h-2 bg-brand-light-blue rounded-full hidden sm:block"></div>
              </div>
            </div>
            <div className="premium-divider my-4 sm:my-6"></div>
            {/* Last month, year-to-date, and current month stats */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-4">
              {statsData?.lastMonthSandwiches != null && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-brand-primary">
                    {(statsData.lastMonthSandwiches).toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {statsData.lastMonthName} {statsData.lastMonthYear}
                  </p>
                </div>
              )}
              {statsData?.lastMonthSandwiches != null && statsData?.ytdSandwiches != null && (
                <div className="hidden sm:block w-px h-10 bg-gray-200"></div>
              )}
              {statsData?.ytdSandwiches != null && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-brand-primary">
                    {(statsData.ytdSandwiches).toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    in {statsData.ytdYear} so far
                  </p>
                </div>
              )}
              {statsData?.ytdSandwiches != null && statsData?.currentMonthSandwiches != null && (
                <div className="hidden sm:block w-px h-10 bg-gray-200"></div>
              )}
              {statsData?.currentMonthSandwiches != null && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-brand-primary">
                    {(statsData.currentMonthSandwiches).toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {statsData.currentMonthName} {statsData.currentMonthYear}
                  </p>
                  {/* Projected month-end total based on the pace so far, with a
                      trend vs last month. Projecting (rather than comparing a
                      partial month to a full one) keeps the signal honest early
                      in the month instead of always reading as a drop. */}
                  {statsData?.lastMonthSandwiches != null && statsData.lastMonthSandwiches > 0 && (() => {
                    // Derive the day/month in Eastern Time so the projection
                    // lines up with currentMonthSandwiches (computed server-side
                    // in America/New_York); a local browser clock could project
                    // against the wrong month/day near month boundaries.
                    const [eY, eM, eD] = getTodayString().split('-').map(Number);
                    const dayOfMonth = eD;
                    const daysInMonth = new Date(eY, eM, 0).getDate();
                    if (dayOfMonth < 1) return null;
                    const projected = Math.round((statsData.currentMonthSandwiches / dayOfMonth) * daysInMonth);
                    const pct = Math.round(((projected - statsData.lastMonthSandwiches) / statsData.lastMonthSandwiches) * 100);
                    const up = pct >= 0;
                    return (
                      <p className={`text-xs font-medium mt-0.5 flex items-center justify-center gap-0.5 ${up ? 'text-green-600' : 'text-amber-600'}`}>
                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        on pace for ~{projected.toLocaleString()} ({up ? '+' : ''}{pct}% vs {statsData.lastMonthName})
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
            {/* Progress toward the annual goal — turns the bare YTD number and
                the "Annual Goal" target into an at-a-glance progress bar. */}
            {statsData?.ytdSandwiches != null && annualSandwichGoal > 0 && (() => {
              const goalPct = Math.min(100, Math.round((statsData.ytdSandwiches / annualSandwichGoal) * 100));
              return (
                <div className="max-w-md mx-auto mb-4">
                  <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-1">
                    <span>{statsData.ytdYear} progress toward goal</span>
                    <span className="font-semibold text-brand-primary">
                      {statsData.ytdSandwiches.toLocaleString()} / {annualSandwichGoal.toLocaleString()} ({goalPct}%)
                    </span>
                  </div>
                  <Progress value={goalPct} className="h-2" />
                </div>
              );
            })()}
            <div className="premium-text-body-sm text-gray-600">
              Real data from verified collection records
            </div>
          </div>
        </div>

        {/* ── TODAY: the things that need attention right now ── */}
        <SectionHeader label="Today" hint="What needs your attention right now" />

        {/* Operational Overview - Key metrics and urgent items */}
        <OperationalOverview onNavigate={onSectionChange || (() => {})} />

        {/* Action Tracker — your assigned tasks, events, and messages (moved up
            from below the tools grid: it belongs with today's priorities). */}
        <div className="mx-4 mb-8 max-w-full">
          <DashboardActionTracker onNavigate={onSectionChange || (() => {})} />
        </div>

        {/* Continue where you left off — people reopen the same resources constantly. */}
        <div className="mx-4 mb-8 max-w-full">
          <RecentlyAccessedResources />
        </div>

        {/* ── VOLUNTEERS ── */}
        <SectionHeader label="Volunteers" hint="Upcoming events that need people" />

        {/* Volunteer Opportunities Spotlight */}
        <VolunteerOpportunitiesSpotlight onNavigate={onSectionChange || (() => {})} />

        {/* ── OPERATIONS ── */}
        <SectionHeader label="Operations" hint="Forecast and capacity" />

        {/* Group Event Forecast - current week progress and upcoming weeks */}
        <div className="mx-4">
          <LowVolumeAlert onNavigateToEvents={() => onSectionChange?.('event-requests')} />
        </div>

        {/* ── TOOLS ── */}
        <SectionHeader label="Tools" hint="Calculators, toolkits, and TSP apps" />

        {/* TSP Additional Tools Section */}
        <div className="mx-4 mb-8 max-w-full">
          <h3 className="premium-text-h3 text-brand-primary mb-6">
            TSP Additional Tools
          </h3>
          <p className="premium-text-body-sm text-gray-600 mb-6">
            External platforms we've built to support TSP operations
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-full">
            {/* Hour Hero Magic - Service Hours Portal */}
            <div className="premium-card-elevated p-5" style={{ borderLeft: '4px solid #FBAD3F' }}>
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-brand-orange rounded-lg flex items-center justify-center mr-3">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="premium-text-body font-semibold text-brand-primary">
                    Service Hours Sign-Off Portal
                  </h4>
                </div>
              </div>
              <p className="premium-text-body-sm text-gray-600 mb-4">
                Portal for volunteers to enter their info and receive automated service hours letters
              </p>
              <button
                onClick={() => window.open('https://hour-hero-magic.lovable.app', '_blank')}
                className="premium-btn-accent w-full text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open Hour Hero Magic
              </button>
            </div>

            {/* Bread and Butter Donors - Donor Management */}
            <div className="premium-card-elevated p-5" style={{ borderLeft: '4px solid #236383' }}>
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center mr-3">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="premium-text-body font-semibold text-brand-primary">
                    Donor Management Platform
                  </h4>
                </div>
              </div>
              <p className="premium-text-body-sm text-gray-600 mb-4">
                DIY donor management - tracks donations, donors, and "Friends in TSP" network connections
              </p>
              <button
                onClick={() => window.open('https://bread-and-butter-donors.lovable.app/', '_blank')}
                className="premium-btn-primary w-full text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open Bread & Butter Donors
              </button>
            </div>

            {/* TSP Grant Manager */}
            <div className="premium-card-elevated p-5" style={{ borderLeft: '4px solid #007E8C' }}>
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-brand-teal rounded-lg flex items-center justify-center mr-3">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="premium-text-body font-semibold text-brand-primary">
                    Grant Tracking & Application Manager
                  </h4>
                </div>
              </div>
              <p className="premium-text-body-sm text-gray-600 mb-4">
                Track grants, deadlines, and use AI research tools to work on grant applications
              </p>
              <button
                onClick={() => window.open('https://tsp-grant-manager.lovable.app', '_blank')}
                className="premium-btn-secondary w-full text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open TSP Grant Manager
              </button>
            </div>

            {/* Sandwich Steward - Host Onboarding */}
            <div className="premium-card-elevated p-5" style={{ borderLeft: '4px solid #5B9EA6' }}>
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-brand-light-blue rounded-lg flex items-center justify-center mr-3">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="premium-text-body font-semibold text-brand-primary">
                    Host Onboarding Tracker
                  </h4>
                </div>
              </div>
              <p className="premium-text-body-sm text-gray-600 mb-4">
                Track hosts being onboarded - will eventually include all existing hosts
              </p>
              <button
                onClick={() => window.open('https://sandwich-steward.lovable.app', '_blank')}
                className="premium-btn-outline w-full text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open Sandwich Steward
              </button>
            </div>

            {/* Receipt Generator */}
            <div className="premium-card-elevated p-5" style={{ borderLeft: '4px solid #A31C41' }}>
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-brand-burgundy rounded-lg flex items-center justify-center mr-3">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="premium-text-body font-semibold text-brand-primary">
                    Donation Receipt Generator
                  </h4>
                </div>
              </div>
              <p className="premium-text-body-sm text-gray-600 mb-4">
                Generate donation receipts for donors quickly and easily
              </p>
              <button
                onClick={() => window.open('https://receipt-gen--katielong2316.replit.app', '_blank')}
                className="premium-btn-outline w-full text-sm border-brand-burgundy text-brand-burgundy hover:bg-brand-burgundy hover:text-white"
              >
                <ExternalLink className="w-4 h-4" />
                Open Receipt Generator
              </button>
            </div>
          </div>
        </div>

        {/* Planning Tools Section */}
        <div className="mx-4 mb-8 max-w-full">
          <h3 className="premium-text-h3 text-brand-primary mb-6">
            Planning Tools
          </h3>

          {/* Inventory Calculator - Clean and prominent */}
          <div className="premium-card-elevated p-6 mb-6 max-w-full" style={{ borderTop: '3px solid #236383' }}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center mr-4">
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="premium-text-h4 text-brand-primary mb-1">
                  Inventory Calculator
                </h4>
                <p className="premium-text-body-sm text-gray-600">
                  Essential tool for planning sandwich quantities
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() =>
                  window.open(
                    'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html',
                    '_blank'
                  )
                }
                className="premium-btn-primary flex-1"
              >
                <Calculator className="w-5 h-5" />
                Open Calculator
              </button>
              <button
                onClick={handleShareInventoryCalculator}
                className="premium-btn-outline"
              >
                <Share2 className="w-5 h-5" />
                Share Tool
              </button>
            </div>
          </div>

          {/* Event Toolkit - Share with volunteers */}
          <div className="premium-card-elevated p-6 mb-6 max-w-full" style={{ borderTop: '3px solid #FBAD3F' }}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center mr-4">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <h4 className="premium-text-h4 text-brand-orange mb-1">
                  Event Toolkit for Volunteers
                </h4>
                <p className="premium-text-body-sm text-gray-600">
                  Share with anyone making sandwiches - includes guides and labels
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() =>
                  window.open(
                    'https://nicunursekatie.github.io/sandwichinventory/toolkit.html',
                    '_blank'
                  )
                }
                className="premium-btn-primary flex-1"
              >
                <ExternalLink className="w-5 h-5" />
                Open Event Toolkit
              </button>
              <button
                onClick={handleShareEventToolkit}
                className="premium-btn-outline"
              >
                <Share2 className="w-5 h-5" />
                Share Toolkit
              </button>
            </div>
          </div>

          {/* Host Collection Sites Directory */}
          <div className="premium-card-elevated p-6 mb-6 max-w-full" style={{ borderTop: '3px solid #007E8C' }}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-teal rounded-lg flex items-center justify-center mr-4">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="premium-text-h4 text-brand-teal mb-1">
                  Host Collection Sites Directory
                </h4>
                <p className="premium-text-body-sm text-gray-600">
                  Public directory of all collection sites - share with volunteers and partners
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() =>
                  window.open(
                    'https://nicunursekatie.github.io/sandwichprojectcollectionsites/',
                    '_blank'
                  )
                }
                className="premium-btn-secondary flex-1"
              >
                <Building2 className="w-5 h-5" />
                View Collection Sites
              </button>
              <button
                onClick={handleShareCollectionSites}
                className="premium-btn-outline"
              >
                <Share2 className="w-5 h-5" />
                Share Directory
              </button>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 max-w-full">
            <div
              className="premium-card premium-interactive p-4 group cursor-pointer"
              onClick={() => onSectionChange?.('collections')}
            >
              <div className="w-12 h-12 bg-brand-light-blue rounded-lg flex items-center justify-center mb-3">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="premium-text-body font-semibold text-brand-primary mb-1">
                Collections
              </h3>
              <p className="premium-text-body-sm text-gray-600 mb-3">View all data</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                Open Collections →
              </div>
            </div>

            <div
              className="premium-card premium-interactive p-4 group cursor-pointer"
              onClick={() => onSectionChange?.('analytics')}
            >
              <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center mb-3">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="premium-text-body font-semibold text-brand-primary mb-1">
                Analytics
              </h3>
              <p className="premium-text-body-sm text-gray-600 mb-3">Deep insights</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                View Analytics →
              </div>
            </div>

            <div
              className="premium-card premium-interactive p-4 group cursor-pointer"
              onClick={() => onSectionChange?.('grant-metrics')}
            >
              <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center mb-3">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="premium-text-body font-semibold text-brand-primary mb-1">
                Grant Metrics
              </h3>
              <p className="premium-text-body-sm text-gray-600 mb-3">
                Funder-ready numbers
              </p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                View Grant Metrics →
              </div>
            </div>

            <div
              className="premium-card premium-interactive p-4 group cursor-pointer"
              onClick={() => onSectionChange?.('event-requests')}
            >
              <div className="w-12 h-12 bg-brand-teal rounded-lg flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="premium-text-body font-semibold text-brand-primary mb-1">
                Event Requests
              </h3>
              <p className="premium-text-body-sm text-gray-600 mb-3">Manage events</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                Open Event Requests →
              </div>
            </div>

            <div
              className="premium-card premium-interactive p-4 group cursor-pointer"
              onClick={() => onSectionChange?.('messages')}
            >
              <div className="w-12 h-12 bg-brand-burgundy rounded-lg flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="premium-text-body font-semibold text-brand-primary mb-1">
                Messages
              </h3>
              <p className="premium-text-body-sm text-gray-600 mb-3">Communication</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                Open Messages →
              </div>
            </div>
          </div>
        </div>

        {/* ── INSIGHTS ── (Action Tracker moved up to the Today section) */}
        <SectionHeader label="Insights" hint="Totals, capacity, and resources" />

        {/* Weekly collections trend — a compact 12-week chart so the dashboard
            shows momentum visually, not just as numbers. Full analytics live on
            the dedicated pages; this is the at-a-glance snapshot. */}
        {weeklyTrend.length > 1 && (
          <div className="mx-4 mb-8 max-w-full">
            <div className="premium-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="premium-text-caption text-brand-primary uppercase">
                  Weekly Collections — last {weeklyTrend.length} weeks
                </h3>
                <button
                  onClick={() => onSectionChange?.('analytics')}
                  className="text-sm text-brand-primary hover:underline flex items-center gap-1"
                >
                  Full analytics <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={weeklyTrend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#007E8C" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#007E8C" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd" />
                  <RechartsTooltip
                    formatter={(value: number) => [value.toLocaleString(), 'Sandwiches']}
                    labelStyle={{ color: '#236383', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sandwiches"
                    stroke="#007E8C"
                    strokeWidth={2}
                    fill="url(#dashTrendFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mx-4 mb-6 sm:mb-8 max-w-full">
          <div className="premium-card premium-interactive p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="premium-text-caption text-brand-primary uppercase">
                Individual Collections
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-brand-orange rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="premium-text-h2 text-brand-orange mb-2">
              <AnimatedCounter value={statsData?.individualSandwiches || 0} />
            </div>
            <p className="premium-text-body-sm text-gray-600">
              Personal contributions
            </p>
          </div>

          <div className="premium-card premium-interactive p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="premium-text-caption text-brand-primary uppercase">
                Group Collections
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-brand-light-blue rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="premium-text-h2 text-brand-light-blue mb-2">
              <AnimatedCounter
                value={
                  statsData
                    ? (statsData.completeTotalSandwiches || 0) -
                      (statsData.individualSandwiches || 0)
                    : 0
                }
              />
            </div>
            <p className="premium-text-body-sm text-gray-600">
              Organization donations
            </p>
          </div>

          <div className="premium-card premium-interactive p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="premium-text-caption text-brand-primary uppercase">
                Collection Records
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-brand-primary rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="premium-text-h2 text-brand-primary mb-2">
              <AnimatedCounter value={statsData?.totalEntries || 0} />
            </div>
            <p className="premium-text-body-sm text-gray-600">Data submissions</p>
          </div>
        </div>

        {/* Operational Capacity - Clean Design with Brand Color Accents */}
        <div className="mx-4 mb-6 sm:mb-8 max-w-full">
          <div className="premium-card p-4 sm:p-6 max-w-full">
            <h2 className="premium-text-h3 text-gray-700 mb-4 sm:mb-6">
              Operational Capacity
            </h2>
            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-full">
              {/* Peak Week - Burgundy accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-burgundy border-l-4 border-l-brand-burgundy elevation-1 hover:elevation-2 transition-all">
                <div className="premium-text-h3 text-brand-burgundy mb-1">
                  {organizationalStats.peakWeekRecord}
                </div>
                <div className="premium-text-body-sm text-gray-700 font-medium">
                  Peak Week
                </div>
                <div className="premium-text-caption text-gray-600 mt-1">{organizationalStats.peakWeekDate}</div>
              </div>

              {/* Annual Goal - Orange accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-orange border-l-4 border-l-brand-orange elevation-1 hover:elevation-2 transition-all">
                <div className="premium-text-h3 text-brand-orange mb-1">
                  {organizationalStats.currentAnnualCapacity}
                </div>
                <div className="premium-text-body-sm text-gray-700 font-medium">
                  Annual Goal
                </div>
                <div className="premium-text-caption text-gray-600 mt-1">2025 Target</div>
              </div>

              {/* Weekly Baseline - Light Blue accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-light-blue border-l-4 border-l-brand-light-blue elevation-1 hover:elevation-2 transition-all">
                <div className="premium-text-h4 text-brand-light-blue mb-1">
                  {organizationalStats.weeklyBaseline}
                </div>
                <div className="premium-text-body-sm text-gray-700 font-medium">
                  Weekly Baseline
                </div>
                <div className="premium-text-caption text-gray-600 mt-1">Regular ops</div>
              </div>

              {/* Surge Capacity - Dark Teal accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-teal border-l-4 border-l-brand-teal elevation-1 hover:elevation-2 transition-all">
                <div className="premium-text-h4 text-brand-teal mb-1">
                  {organizationalStats.surgingCapacity}
                </div>
                <div className="premium-text-body-sm text-gray-700 font-medium">
                  Surge Capacity
                </div>
                <div className="premium-text-caption text-gray-600 mt-1">
                  Peak mobilization
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resources Section */}
        <div className="mx-4 mb-8 max-w-full">
          <h3 className="text-lg font-semibold text-brand-primary mb-6">
            Resources
          </h3>
          <div className="bg-white rounded-xl p-6 shadow-md max-w-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-brand-orange rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-brand-primary">
                  Important Documents
                </h4>
                <p className="text-sm text-gray-600">
                  Essential organizational resources
                </p>
              </div>
            </div>

            {/* Documents Grid - Compact design */}
            {importantDocuments.length === 0 ? (
              <div className="text-center py-8 px-4 max-w-full" data-testid="no-documents-message">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-2">No documents configured for dashboard</p>
                {ADMIN_ACCESS && (
                  <p className="text-xs text-gray-400">
                    Admins can configure documents in the{' '}
                    <a href="/important-documents" className="text-brand-primary hover:underline">
                      Important Documents
                    </a>{' '}
                    page
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-full">
                {importantDocuments.map((doc, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-all duration-200 border hover:border-brand-primary/30"
                >
                  <div className="flex items-center mb-3">
                    <FileText className="h-5 w-5 text-brand-primary mr-2 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-brand-primary truncate">
                        {doc.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded">
                          {doc.category}
                        </span>
                        <span className="text-xs text-gray-500">PDF</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                    {doc.description}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openPreviewModal(doc.path, doc.title, 'pdf')
                      }
                      className="flex-1 h-8 text-xs border-brand-primary/30 hover:border-brand-primary text-brand-primary"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.open(doc.path, '_blank')}
                      className="flex-1 h-8 text-xs bg-brand-primary hover:bg-brand-primary-dark text-white"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        </div>

        {/* Help System */}
        <div className="mx-4 mt-6 sm:mt-8 max-w-full">
          <HelpBubble
            title="Dashboard Overview"
            content="This dashboard shows your impact at a glance! These numbers represent real meals provided to community members in your area. Use the forms above to submit new collection data or browse documents for guidance."
            character="sandy"
            position="top"
            trigger="hover"
          >
            <div className="text-center text-xs sm:text-sm text-gray-500 cursor-help">
              Need help? Hover here for guidance
            </div>
          </HelpBubble>
        </div>
      </div>
      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={closePreviewModal}
        documentPath={previewModal.documentPath}
        documentName={previewModal.documentName}
        documentType={previewModal.documentType}
      />
    </div>
  );
}
