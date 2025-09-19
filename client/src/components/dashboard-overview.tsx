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
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { useToast } from '@/hooks/use-toast';
import { HelpBubble } from '@/components/help-system';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import CollectionFormSelector from '@/components/collection-form-selector';
import { AnimatedCounter } from '@/components/modern-dashboard/animated-counter';
import DashboardActionTracker from '@/components/dashboard-action-tracker';

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

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied!',
        description:
          'The inventory calculator link has been copied to your clipboard.',
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
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
      const response = await fetch('/api/sandwich-collections/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: deferredLoad, // Only fetch after component has rendered
  });

  // Trigger deferred loading after initial render
  React.useEffect(() => {
    const timer = setTimeout(() => setDeferredLoad(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Key organizational documents from attached assets
  const importantDocuments = [
    {
      title: 'Key Findings: Peak Collection Weeks',
      description:
        'Comprehensive analysis of peak performance and organizational growth',
      category: 'Strategy',
      path: '/attached_assets/Key Findings_ Peak Sandwich Collection Weeks_1753498455636.pdf',
    },
    {
      title: 'Food Safety Guidelines',
      description: 'Essential safety protocols for volunteers',
      category: 'Operations',
      path: '/attached_assets/20230525-TSP-Food Safety Volunteers_1749341933308.pdf',
    },
    {
      title: 'Volunteer Driver Agreement',
      description: 'Required agreement form for volunteer drivers',
      category: 'Forms',
      path: '/attached_assets/TSP Volunteer Driver Agreement (1).pdf',
    },
    {
      title: 'Community Service Hours Form',
      description: 'Form for tracking and documenting community service hours',
      category: 'Forms',
      path: '/attached_assets/TSP COMMUNITY SERVICE HOURS (1) (1) (1).pdf',
    },
    {
      title: 'ACORD Document',
      description: 'Official ACORD documentation for organizational reference',
      category: 'Forms',
      path: '/attached_assets/ACORD®_1756831296864.pdf',
    },
  ];

  // Key statistics - Use actual database values instead of hardcoded ones
  const organizationalStats = {
    totalLifetimeSandwiches: statsData
      ? statsData.completeTotalSandwiches?.toLocaleString()
      : 'Loading...',
    peakWeekRecord: '38,828',
    peakWeekDate: 'November 15, 2023',
    currentAnnualCapacity: '500,000',
    weeklyBaseline: '6,000-12,000',
    surgingCapacity: '25,000-40,000',
    operationalYears: '5',
    growthMultiplier: '107x',
    individualSandwiches:
      statsData?.individualSandwiches?.toLocaleString() || 'Loading...',
    groupSandwiches: statsData
      ? (
          (statsData.completeTotalSandwiches || 0) -
          (statsData.individualSandwiches || 0)
        ).toLocaleString()
      : 'Loading...',
    totalEntries: statsData?.totalEntries?.toLocaleString() || 'Loading...',
  };

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
            Community Impact Through Coordinated Action
          </p>
        </div>

        {/* Collection Call-to-Action */}
        {(hasPermission(user, PERMISSIONS.COLLECTIONS_ADD) ||
          hasPermission(user, PERMISSIONS.COLLECTIONS_EDIT)) && (
          <div className="bg-white rounded-xl mx-4 p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <div className="text-center">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-brand-primary mb-2">
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
                  className="bg-brand-orange hover:bg-brand-orange-dark text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors text-base sm:text-lg md:text-sm min-h-[48px] sm:min-h-[56px] md:min-h-[40px]"
                  onClick={() => setShowCollectionForm(!showCollectionForm)}
                >
                  {showCollectionForm
                    ? 'Hide Form'
                    : 'Enter New Collection Data'}
                </Button>
                <Button
                  className="bg-white border border-brand-light-blue text-brand-light-blue hover:bg-brand-light-blue hover:text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors shadow-sm text-base sm:text-lg md:text-sm min-h-[48px] sm:min-h-[56px] md:min-h-[40px]"
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

        {/* Action Tracker Widget */}
        <div className="mx-4 mb-8">
          <DashboardActionTracker onNavigate={onSectionChange || (() => {})} />
        </div>

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
                Event Planning
              </h3>
              <p className="text-sm text-gray-600 mb-3">Manage events</p>
              <div className="text-brand-primary font-medium text-sm flex items-center">
                Open Event Planning →
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
