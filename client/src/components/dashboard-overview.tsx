import { useState } from 'react';
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  TrendingUp,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/useResourcePermissions';
import { PERMISSIONS } from '@shared/auth-utils';
import { useToast } from '@/hooks/use-toast';
import { HelpBubble } from '@/components/help-system';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import CollectionFormSelector from '@/components/collection-form-selector';
import { AnimatedCounter } from '@/components/modern-dashboard/animated-counter';
import DashboardActionTracker from '@/components/dashboard-action-tracker';
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
import CMYK_PRINT_TSP_01__2_ from '@assets/CMYK_PRINT_TSP-01 (2).png';
import { logger } from '@/lib/logger';
// Using optimized SVG logos for faster loading
const tspLogoSvg = '/logo-optimized.svg';
const sandwichIconSvg = '/sandwich-icon-optimized.svg';

interface DashboardOverviewProps {
  onSectionChange: (section: string) => void;
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
    staleTime: 0, // Always refetch when invalidated
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

    // Calculate annual capacity based on recent performance trends
    const weeklyAverage = totalSandwiches / (operationalYears * 52);
    const annualCapacity = Math.round(weeklyAverage * 52);

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
      currentAnnualCapacity: annualCapacity.toLocaleString(),
      weeklyBaseline: `${baselineMin.toLocaleString()}-${baselineMax.toLocaleString()}`,
      surgingCapacity: `${surgeMin.toLocaleString()}-${surgeMax.toLocaleString()}`,
      operationalYears: operationalYears.toString(),
      growthMultiplier: `${growthMultiplier}x`,
      individualSandwiches: individual.toLocaleString(),
      groupSandwiches: group.toLocaleString(),
      totalEntries: (statsData.totalEntries || 0).toLocaleString(),
    };
  }, [statsData, allCollectionsData]);

  // Remove fake mini chart data - only use real data

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Dark Mode Toggle */}
      <div className="absolute top-4 right-4 z-50">
        {/* Dark mode toggle removed */}
      </div>
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className="bg-white rounded-xl mx-4 mt-8 p-6 sm:p-8 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
          <div className="relative">
            <img
              src={CMYK_PRINT_TSP_01__2_}
              alt="The Sandwich Project"
              className="w-[200px] sm:w-[250px] md:w-[400px] mb-4 sm:mb-6 mx-auto"
              width="400"
              height="125"
            />
          </div>
          <p className="text-base sm:text-lg md:text-xl text-brand-primary font-medium">
            Nourish The Hungry. Feed The Soul.
          </p>
        </div>

        {/* Collection Call-to-Action */}
        {(COLLECTIONS_ADD || COLLECTIONS_EDIT_OWN) && (
          <div className="bg-white rounded-xl mx-4 p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <div className="text-center">
              <div className="mb-4 sm:mb-6">
                <h2 className="sm:text-xl font-semibold text-brand-primary mb-2 text-[22px]">
                  Record Collection Data
                </h2>
                {showCollectionForm && (
                  <p className="text-sm sm:text-base text-gray-700">
                    Submit your sandwich contributions to help our community
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  className="bg-brand-orange hover:bg-brand-orange-dark text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors sm:text-lg md:text-sm min-h-[48px] sm:min-h-[56px] md:min-h-[40px] text-[16px]"
                  onClick={() => setShowCollectionForm(!showCollectionForm)}
                >
                  {showCollectionForm
                    ? 'Hide Form'
                    : 'Enter New Collection Data'}
                </Button>
                <Button
                  className="bg-white border border-brand-light-blue text-brand-light-blue hover:bg-brand-light-blue hover:text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors shadow-sm text-[16px] sm:text-lg md:text-sm min-h-[48px] sm:min-h-[56px] md:min-h-[40px]"
                  onClick={() => onSectionChange?.('collections')}
                >
                  View Collection History
                </Button>
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
        <div className="mx-4 mb-8 sm:mb-12">
          <div className="bg-white rounded-xl p-8 sm:p-12 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <div className="mb-4">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-brand-orange tracking-tight">
                <AnimatedCounter
                  value={statsData?.completeTotalSandwiches || 0}
                />
              </h1>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mt-4">
                <div className="w-2 h-2 bg-brand-light-blue rounded-full hidden sm:block"></div>
                <p className="text-lg sm:text-xl text-brand-primary font-medium text-center">
                  Total sandwiches distributed since 2020
                </p>
                <div className="w-2 h-2 bg-brand-light-blue rounded-full hidden sm:block"></div>
              </div>
            </div>
            <div className="text-sm text-gray-600 border-t border-gray-200 pt-4 sm:pt-6 mt-4 sm:mt-6">
              Real data from verified collection records
            </div>
          </div>
        </div>

        {/* Action Tracker Widget */}
        <div className="mx-4 mb-8">
          <DashboardActionTracker onNavigate={onSectionChange || (() => {})} />
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mx-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-semibold text-brand-primary uppercase tracking-wide">
                Individual Collections
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-brand-orange rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-brand-orange mb-2">
              <AnimatedCounter value={statsData?.individualSandwiches || 0} />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">
              Personal contributions
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-semibold text-brand-primary uppercase tracking-wide">
                Group Collections
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-brand-light-blue rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-brand-light-blue mb-2">
              <AnimatedCounter
                value={
                  statsData
                    ? (statsData.completeTotalSandwiches || 0) -
                      (statsData.individualSandwiches || 0)
                    : 0
                }
              />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">
              Organization donations
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-semibold text-brand-primary uppercase tracking-wide">
                Collection Records
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-brand-primary rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-brand-primary mb-2">
              <AnimatedCounter value={statsData?.totalEntries || 0} />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Data submissions</p>
          </div>
        </div>

        {/* Operational Capacity - Clean Design with Brand Color Accents */}
        <div className="mx-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <h2 className="text-base sm:text-lg font-semibold text-[#646464] mb-4 sm:mb-6">
              Operational Capacity
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {/* Peak Week - Burgundy accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-burgundy border-l-4 border-l-brand-burgundy hover:shadow-md transition-shadow">
                <div className="text-lg sm:text-2xl font-bold text-brand-burgundy mb-1">
                  {organizationalStats.peakWeekRecord}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">
                  Peak Week
                </div>
                <div className="text-xs text-[#646464] mt-1">Nov 15, 2023</div>
              </div>

              {/* Annual Target - Orange accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-orange border-l-4 border-l-brand-orange hover:shadow-md transition-shadow">
                <div className="text-lg sm:text-2xl font-bold text-brand-orange mb-1">
                  {organizationalStats.currentAnnualCapacity}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">
                  Annual Target
                </div>
                <div className="text-xs text-[#646464] mt-1">Current year</div>
              </div>

              {/* Weekly Baseline - Light Blue accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-light-blue border-l-4 border-l-brand-light-blue hover:shadow-md transition-shadow">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-brand-light-blue mb-1">
                  {organizationalStats.weeklyBaseline}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">
                  Weekly Baseline
                </div>
                <div className="text-xs text-[#646464] mt-1">Regular ops</div>
              </div>

              {/* Surge Capacity - Dark Teal accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-brand-teal border-l-4 border-l-brand-teal hover:shadow-md transition-shadow">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-brand-teal mb-1">
                  {organizationalStats.surgingCapacity}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">
                  Surge Capacity
                </div>
                <div className="text-xs text-[#646464] mt-1">
                  Peak mobilization
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Planning Tools Section */}
        <div className="mx-4 mb-8">
          <h3 className="text-lg font-semibold text-brand-primary mb-6">
            Planning Tools
          </h3>

          {/* Inventory Calculator - Clean and prominent */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-brand-primary/20 mb-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center mr-4">
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-brand-primary mb-1">
                  Inventory Calculator
                </h4>
                <p className="text-gray-600">
                  Essential tool for planning sandwich quantities
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={() =>
                  window.open(
                    'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html',
                    '_blank'
                  )
                }
                className="bg-brand-primary hover:bg-brand-teal text-white font-semibold px-8 py-3 text-base flex-1"
              >
                <Calculator className="w-5 h-5 mr-2" />
                Open Calculator
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleShareInventoryCalculator}
                className="border-brand-primary text-brand-primary hover:bg-brand-primary/5 px-6 py-3 font-medium"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share Tool
              </Button>
            </div>
          </div>

          {/* Event Toolkit - Share with volunteers */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-brand-orange/20 mb-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center mr-4">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <h4 className="text-xl font-bold text-brand-orange mb-1">
                  Event Toolkit for Volunteers
                </h4>
                <p className="text-gray-600">
                  Share with anyone making sandwiches - includes guides and labels
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={() =>
                  window.open(
                    'https://nicunursekatie.github.io/sandwichinventory/toolkit.html',
                    '_blank'
                  )
                }
                className="bg-brand-orange hover:bg-brand-orange hover:scale-105 hover:shadow-lg transition-all text-white font-semibold px-8 py-3 text-base flex-1"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Open Event Toolkit
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleShareEventToolkit}
                className="border-brand-orange text-brand-orange hover:bg-orange-50 px-6 py-3 font-medium"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share Toolkit
              </Button>
            </div>
          </div>

          {/* Host Collection Sites Directory */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-brand-teal/20 mb-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-brand-teal rounded-lg flex items-center justify-center mr-4">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-brand-teal mb-1">
                  Host Collection Sites Directory
                </h4>
                <p className="text-gray-600">
                  Public directory of all collection sites - share with volunteers and partners
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={() =>
                  window.open(
                    'https://nicunursekatie.github.io/sandwichprojectcollectionsites/',
                    '_blank'
                  )
                }
                className="bg-brand-teal hover:bg-brand-teal hover:scale-105 hover:shadow-lg transition-all text-white font-semibold px-8 py-3 text-base flex-1"
              >
                <Building2 className="w-5 h-5 mr-2" />
                View Collection Sites
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleShareCollectionSites}
                className="border-brand-teal text-brand-teal hover:bg-teal-50 px-6 py-3 font-medium"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share Directory
              </Button>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div
              className="action-card bg-white rounded-xl p-4 group cursor-pointer shadow-md hover:shadow-lg transition-all duration-200 border-2 hover:border-brand-primary/20"
              onClick={() => onSectionChange?.('collections')}
            >
              <div className="w-12 h-12 bg-brand-light-blue rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base font-semibold text-brand-primary mb-1">
                Collections
              </h3>
              <p className="text-sm text-gray-600 mb-3">View all data</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                Open Collections →
              </div>
            </div>

            <div
              className="action-card bg-white rounded-xl p-4 group cursor-pointer shadow-md hover:shadow-lg transition-all duration-200 border-2 hover:border-brand-primary/20"
              onClick={() => onSectionChange?.('analytics')}
            >
              <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base font-semibold text-brand-primary mb-1">
                Analytics
              </h3>
              <p className="text-sm text-gray-600 mb-3">Deep insights</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                View Analytics →
              </div>
            </div>

            <div
              className="action-card bg-white rounded-xl p-4 group cursor-pointer shadow-md hover:shadow-lg transition-all duration-200 border-2 hover:border-brand-primary/20"
              onClick={() => onSectionChange?.('event-requests')}
            >
              <div className="w-12 h-12 bg-brand-teal rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base font-semibold text-brand-primary mb-1">
                Event Requests
              </h3>
              <p className="text-sm text-gray-600 mb-3">Manage events</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                Open Event Requests →
              </div>
            </div>

            <div
              className="action-card bg-white rounded-xl p-4 group cursor-pointer shadow-md hover:shadow-lg transition-all duration-200 border-2 hover:border-brand-primary/20"
              onClick={() => onSectionChange?.('messages')}
            >
              <div className="w-12 h-12 bg-brand-burgundy rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base font-semibold text-brand-primary mb-1">
                Messages
              </h3>
              <p className="text-sm text-gray-600 mb-3">Communication</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                Open Messages →
              </div>
            </div>
          </div>
        </div>

        {/* Resources Section */}
        <div className="mx-4 mb-8">
          <h3 className="text-lg font-semibold text-brand-primary mb-6">
            Resources
          </h3>
          <div className="bg-white rounded-xl p-6 shadow-md">
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
              <div className="text-center py-8 px-4" data-testid="no-documents-message">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                      className="flex-1 h-8 text-xs bg-brand-primary hover:bg-brand-teal text-white"
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
        <div className="mx-4 mt-6 sm:mt-8">
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
