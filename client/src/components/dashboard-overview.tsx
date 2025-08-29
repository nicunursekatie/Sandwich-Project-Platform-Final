import { useState } from "react";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, TrendingUp, Calendar, Award, Download, ExternalLink, Sandwich, Eye, BarChart3, Target, Activity, Users, Zap, Clock, Building2, Layers, Calculator, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { HelpBubble } from "@/components/help-system";
import { DocumentPreviewModal } from "@/components/document-preview-modal";
import CollectionFormSelector from "@/components/collection-form-selector";
import { AnimatedCounter } from "@/components/modern-dashboard/animated-counter";

// Dark mode toggle removed per user request
import { SandwichStackIcon, GrowthTrendIcon, CommunityIcon, TargetIcon, SparkleIcon, NetworkIcon } from "@/components/modern-dashboard/custom-svg-icons";
import CMYK_PRINT_TSP_01__2_ from "@assets/CMYK_PRINT_TSP-01 (2).png";
// Using optimized SVG logos for faster loading
const tspLogoSvg = "/logo-optimized.svg";
const sandwichIconSvg = "/sandwich-icon-optimized.svg";

interface DashboardOverviewProps {
  onSectionChange: (section: string) => void;
}

export default function DashboardOverview({ onSectionChange }: { onSectionChange?: (section: string) => void }) {
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
    documentType: ''
  });

  const openPreviewModal = (path: string, name: string, type: string) => {
    setPreviewModal({
      isOpen: true,
      documentPath: path,
      documentName: name,
      documentType: type
    });
  };

  const closePreviewModal = () => {
    setPreviewModal({
      isOpen: false,
      documentPath: '',
      documentName: '',
      documentType: ''
    });
  };

  const handleShareInventoryCalculator = async () => {
    const url = 'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html';
    const title = 'Inventory Calculator';
    const text = 'Interactive tool for calculating sandwich inventory and planning quantities for collections';
    
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
        title: "Link copied!",
        description: "The inventory calculator link has been copied to your clipboard.",
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  // Defer stats loading until after first render for better FCP/LCP
  const [deferredLoad, setDeferredLoad] = useState(false);
  
  const { data: statsData } = useQuery({
    queryKey: ["/api/sandwich-collections/stats"],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: deferredLoad // Only fetch after component has rendered
  });

  // Trigger deferred loading after initial render
  React.useEffect(() => {
    const timer = setTimeout(() => setDeferredLoad(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Key organizational documents from attached assets
  const importantDocuments = [
    {
      title: "Key Findings: Peak Collection Weeks",
      description: "Comprehensive analysis of peak performance and organizational growth",
      category: "Strategy",
      path: "/attached_assets/Key Findings_ Peak Sandwich Collection Weeks_1753498455636.pdf"
    },
    {
      title: "Food Safety Guidelines",
      description: "Essential safety protocols for volunteers",
      category: "Operations",
      path: "/attached_assets/20230525-TSP-Food Safety Volunteers_1749341933308.pdf"
    },
    {
      title: "Volunteer Driver Agreement",
      description: "Required agreement form for volunteer drivers",
      category: "Forms",
      path: "/attached_assets/TSP Volunteer Driver Agreement (1).pdf"
    },
    {
      title: "Community Service Hours Form",
      description: "Form for tracking and documenting community service hours",
      category: "Forms",
      path: "/attached_assets/TSP COMMUNITY SERVICE HOURS (1) (1) (1).pdf"
    }
  ];

  // Key statistics - Use actual database values instead of hardcoded ones
  const organizationalStats = {
    totalLifetimeSandwiches: statsData ? statsData.completeTotalSandwiches?.toLocaleString() : "Loading...",
    peakWeekRecord: "38,828",
    peakWeekDate: "November 15, 2023",
    currentAnnualCapacity: "500,000",
    weeklyBaseline: "6,000-12,000",
    surgingCapacity: "25,000-40,000",
    operationalYears: "5",
    growthMultiplier: "107x",
    individualSandwiches: statsData?.individualSandwiches?.toLocaleString() || "Loading...",
    groupSandwiches: statsData ? ((statsData.completeTotalSandwiches || 0) - (statsData.individualSandwiches || 0)).toLocaleString() : "Loading...",
    totalEntries: statsData?.totalEntries?.toLocaleString() || "Loading..."
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
          <p className="text-base sm:text-lg md:text-xl text-[#236383] font-medium">
            Community Impact Through Coordinated Action
          </p>
        </div>

        {/* Collection Call-to-Action */}
        {(hasPermission(user, PERMISSIONS.CREATE_COLLECTIONS) || hasPermission(user, PERMISSIONS.MANAGE_COLLECTIONS)) && (
          <div className="bg-white rounded-xl mx-4 p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <div className="text-center">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-[#236383] mb-2">
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
                  className="bg-[#FBAD3F] hover:bg-[#e09a36] text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors text-base sm:text-lg md:text-sm min-h-[48px] sm:min-h-[56px] md:min-h-[40px]"
                  onClick={() => setShowCollectionForm(!showCollectionForm)}
                >
                  {showCollectionForm ? "Hide Form" : "Enter New Collection Data"}
                </Button>
                <Button 
                  className="bg-white border border-[#47B3CB] text-[#47B3CB] hover:bg-[#47B3CB] hover:text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors shadow-sm text-base sm:text-lg md:text-sm min-h-[48px] sm:min-h-[56px] md:min-h-[40px]"
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
                    queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections/stats"] });
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
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-[#FBAD3F] tracking-tight">
                <AnimatedCounter value={statsData?.completeTotalSandwiches || 0} />
              </h1>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mt-4">
                <div className="w-2 h-2 bg-[#47B3CB] rounded-full hidden sm:block"></div>
                <p className="text-lg sm:text-xl text-[#236383] font-medium text-center">
                  Total sandwiches distributed since 2020
                </p>
                <div className="w-2 h-2 bg-[#47B3CB] rounded-full hidden sm:block"></div>
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
              <h3 className="text-xs sm:text-sm font-semibold text-[#236383] uppercase tracking-wide">
                Individual Collections
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#FBAD3F] rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#FBAD3F] mb-2">
              <AnimatedCounter value={statsData?.individualSandwiches || 0} />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Personal contributions</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-semibold text-[#236383] uppercase tracking-wide">
                Group Collections
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#47B3CB] rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#47B3CB] mb-2">
              <AnimatedCounter value={statsData ? ((statsData.completeTotalSandwiches || 0) - (statsData.individualSandwiches || 0)) : 0} />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Organization donations</p>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-semibold text-[#236383] uppercase tracking-wide">
                Collection Records
              </h3>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#236383] rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#236383] mb-2">
              <AnimatedCounter value={statsData?.totalEntries || 0} />
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Data submissions</p>
          </div>
        </div>

        {/* Operational Capacity - Clean Design with Brand Color Accents */}
        <div className="mx-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <h2 className="text-base sm:text-lg font-semibold text-[#646464] mb-4 sm:mb-6">Operational Capacity</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {/* Peak Week - Burgundy accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-[#A31C41] border-l-4 border-l-[#A31C41] hover:shadow-md transition-shadow">
                <div className="text-lg sm:text-2xl font-bold text-[#A31C41] mb-1">
                  {organizationalStats.peakWeekRecord}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">Peak Week</div>
                <div className="text-xs text-[#646464] mt-1">Nov 15, 2023</div>
              </div>
              
              {/* Annual Target - Orange accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-[#FBAD3F] border-l-4 border-l-[#FBAD3F] hover:shadow-md transition-shadow">
                <div className="text-lg sm:text-2xl font-bold text-[#FBAD3F] mb-1">
                  {organizationalStats.currentAnnualCapacity}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">Annual Target</div>
                <div className="text-xs text-[#646464] mt-1">Current year</div>
              </div>
              
              {/* Weekly Baseline - Light Blue accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-[#47B3CB] border-l-4 border-l-[#47B3CB] hover:shadow-md transition-shadow">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-[#47B3CB] mb-1">
                  {organizationalStats.weeklyBaseline}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">Weekly Baseline</div>
                <div className="text-xs text-[#646464] mt-1">Regular ops</div>
              </div>
              
              {/* Surge Capacity - Dark Teal accent */}
              <div className="bg-white rounded-lg p-3 sm:p-4 text-center border border-[#007E8C] border-l-4 border-l-[#007E8C] hover:shadow-md transition-shadow">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-[#007E8C] mb-1">
                  {organizationalStats.surgingCapacity}
                </div>
                <div className="text-xs sm:text-sm text-[#646464] font-medium">Surge Capacity</div>
                <div className="text-xs text-[#646464] mt-1">Peak mobilization</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mx-4 mt-6 sm:mt-8">
          <div className="bg-white rounded-xl p-3 sm:p-4 text-left group shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#FBAD3F] rounded-lg flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-[#236383] mb-1 sm:mb-2">Inventory Calculator</h4>
            <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">Plan quantities</p>
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => window.open('https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html', '_blank')}
                className="flex-1 h-7 sm:h-8 text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareInventoryCalculator}
                className="flex-1 h-7 sm:h-8 text-xs"
              >
                <Share2 className="w-3 h-3 mr-1" />
                Share
              </Button>
            </div>
          </div>

          <button className="bg-white rounded-xl p-3 sm:p-4 text-left group cursor-pointer shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200" onClick={() => onSectionChange?.('collections')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#47B3CB] rounded-lg flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-[#236383]">Collections</h4>
            <p className="text-xs sm:text-sm text-gray-600">View all data</p>
          </button>

          <button className="bg-white rounded-xl p-3 sm:p-4 text-left group cursor-pointer shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200" onClick={() => onSectionChange?.('analytics')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#FBAD3F] rounded-lg flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-[#236383]">Analytics</h4>
            <p className="text-xs sm:text-sm text-gray-600">Deep insights</p>
          </button>

          <button className="bg-white rounded-xl p-3 sm:p-4 text-left group cursor-pointer shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200" onClick={() => onSectionChange?.('phone-directory')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#007E8C] rounded-lg flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-[#236383]">Directory</h4>
            <p className="text-xs sm:text-sm text-gray-600">Contact info</p>
          </button>

          <button className="bg-white rounded-xl p-3 sm:p-4 text-left group cursor-pointer shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-200 col-span-2 sm:col-span-1" onClick={() => onSectionChange?.('messages')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#A31C41] rounded-lg flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-[#236383]">Messages</h4>
            <p className="text-xs sm:text-sm text-gray-600">Communication</p>
          </button>
        </div>

        {/* Important Documents - Using same layout as governance documents */}
        <div className="bg-white rounded-xl mx-4 mt-6 sm:mt-8 p-4 sm:p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#FBAD3F] rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[#236383]">Important Documents</h2>
              <p className="text-xs sm:text-sm text-gray-600">Essential organizational resources</p>
            </div>
          </div>

          {/* Documents Grid - Better mobile responsiveness */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {importantDocuments.map((doc, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col border-2 hover:border-blue-200">
                <CardHeader className="pb-3 sm:pb-4 flex-shrink-0">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                      </div>
                      <CardTitle className="text-sm sm:text-lg md:text-xl font-semibold text-gray-900 leading-tight">
                        {doc.title}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 bg-purple-100 text-purple-800">
                      {doc.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs sm:text-sm font-medium px-2 sm:px-3 py-1">
                      PDF
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <CardDescription className="mb-4 sm:mb-6 flex-1 text-sm sm:text-base leading-relaxed text-gray-600">
                    {doc.description}
                  </CardDescription>
                  {/* Action buttons - mobile optimized */}
                  <div className="flex flex-col gap-2 sm:gap-3 mt-auto">
                    <Button
                      size="default"
                      variant="outline"
                      onClick={() => openPreviewModal(doc.path, doc.title, 'pdf')}
                      className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium"
                    >
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      Preview
                    </Button>
                    <Button
                      size="default"
                      variant="default"
                      onClick={() => window.open(doc.path, '_blank')}
                      className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium"
                    >
                      <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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