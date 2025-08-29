import { useState } from "react";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, TrendingUp, Calendar, ExternalLink, Eye, BarChart3, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { useToast } from "@/hooks/use-toast";
import { HelpBubble } from "@/components/help-system";
import { DocumentPreviewModal } from "@/components/document-preview-modal";
import CollectionFormSelector from "@/components/collection-form-selector";
import { AnimatedCounter } from "@/components/modern-dashboard/animated-counter";
import CMYK_PRINT_TSP_01__2_ from "@assets/CMYK_PRINT_TSP-01 (2).png";

interface DashboardOverviewProps {
  onSectionChange: (section: string) => void;
}

export default function DashboardOverview({ onSectionChange }: { onSectionChange?: (section: string) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    documentPath: "",
    documentName: "",
    documentType: ""
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
      documentPath: "",
      documentName: "",
      documentType: ""
    });
  };

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
    enabled: deferredLoad
  });

  React.useEffect(() => {
    const timer = setTimeout(() => setDeferredLoad(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className="bg-white rounded-xl mx-4 mt-8 p-8 text-center shadow-lg">
          <div className="relative">
            <img 
              src={CMYK_PRINT_TSP_01__2_} 
              alt="The Sandwich Project" 
              className="w-[200px] xs:w-[250px] sm:w-[300px] md:w-[400px] mb-4 sm:mb-6 mx-auto" 
              width="400"
              height="125"
            />
          </div>
          <p className="text-base sm:text-lg md:text-xl font-medium" style={{ color: '#236383' }}>
            Community Impact Through Coordinated Action
          </p>
        </div>

        {/* Collection Call-to-Action */}
        {(hasPermission(user, PERMISSIONS.CREATE_COLLECTIONS) || hasPermission(user, PERMISSIONS.MANAGE_COLLECTIONS)) && (
          <div className="bg-white rounded-xl mx-3 sm:mx-4 md:mx-6 p-4 sm:p-6 shadow-lg">
            <div className="text-center">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: '#236383' }}>
                  Record Collection Data
                </h2>
                {showCollectionForm && (
                  <p className="text-sm sm:text-base text-gray-700">
                    Submit your sandwich contributions to help our community
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                <Button 
                  className="text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px]"
                  style={{ backgroundColor: '#FBAD3F' }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#e09527'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#FBAD3F'}
                  onClick={() => setShowCollectionForm(!showCollectionForm)}
                >
                  {showCollectionForm ? "Hide Form" : "Enter New Collection Data"}
                </Button>
                <Button 
                  className="bg-white border font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors shadow-sm text-sm sm:text-base min-h-[44px] sm:min-h-[48px]"
                  style={{ borderColor: '#007E8C', color: '#007E8C' }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#007E8C'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.color = '#007E8C'; }}
                  onClick={() => onSectionChange?.('collections')}
                >
                  View Collection History
                </Button>
              </div>
            </div>

            {showCollectionForm && (
              <div className="mt-3 sm:mt-4">
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
        <div className="mx-3 sm:mx-4 md:mx-6 mb-8 sm:mb-12">
          <div className="bg-white rounded-xl p-6 sm:p-8 md:p-12 text-center shadow-lg">
            <div className="mb-3 sm:mb-4">
              <h1 className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight" style={{ color: '#FBAD3F' }}>
                <AnimatedCounter value={statsData?.completeTotalSandwiches || 0} />
              </h1>
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#236383' }}></div>
                <p className="text-sm xs:text-base sm:text-lg md:text-xl font-medium" style={{ color: '#236383' }}>
                  Total sandwiches distributed since 2020
                </p>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#236383' }}></div>
              </div>
            </div>
            <div className="text-sm text-gray-600 border-t border-gray-200 pt-6 mt-6">
              Real data from verified collection records
            </div>
          </div>
        </div>

        {/* Simple Documents Section */}
        <div className="bg-white rounded-xl mx-3 sm:mx-4 md:mx-6 mt-6 sm:mt-8 p-4 sm:p-6 shadow-lg">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FBAD3F' }}>
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold" style={{ color: '#236383' }}>Important Documents</h2>
              <p className="text-xs sm:text-sm text-gray-600">Essential organizational resources</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md">
              <h3 className="font-semibold mb-2">Key Findings: Peak Collection Weeks</h3>
              <p className="text-sm text-gray-600 mb-3">Comprehensive analysis of peak performance and organizational growth</p>
              <button className="w-full text-white px-4 py-2 rounded transition-colors" style={{ backgroundColor: '#236383' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#1e5470'} onMouseLeave={(e) => e.target.style.backgroundColor = '#236383'}>
                Download PDF
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md">
              <h3 className="font-semibold mb-2">Food Safety Guidelines</h3>
              <p className="text-sm text-gray-600 mb-3">Essential safety protocols for volunteers</p>
              <button className="w-full text-white px-4 py-2 rounded transition-colors" style={{ backgroundColor: '#236383' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#1e5470'} onMouseLeave={(e) => e.target.style.backgroundColor = '#236383'}>
                Download PDF
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md">
              <h3 className="font-semibold mb-2">Volunteer Driver Agreement</h3>
              <p className="text-sm text-gray-600 mb-3">Required agreement form for volunteer drivers</p>
              <button className="w-full text-white px-4 py-2 rounded transition-colors" style={{ backgroundColor: '#236383' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#1e5470'} onMouseLeave={(e) => e.target.style.backgroundColor = '#236383'}>
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* Help System */}
        <div className="mx-3 sm:mx-4 md:mx-6 mt-6 sm:mt-8 mb-6">
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