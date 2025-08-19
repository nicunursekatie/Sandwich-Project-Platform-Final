import { Sandwich, LogOut, LayoutDashboard, ListTodo, MessageCircle, ClipboardList, FolderOpen, BarChart3, TrendingUp, Users, Car, Building2, FileText, ChevronDown, ChevronRight, Menu, X, UserCog, Lightbulb, AlertCircle, Trophy, Calculator, Calendar, Clock, Truck } from "lucide-react";
import { useLocation } from "wouter";
// Using optimized SVG for faster loading
const sandwichLogo = "/logo-optimized.svg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectList from "@/components/project-list";
import WeeklySandwichForm from "@/components/weekly-sandwich-form";

import CommitteeChat from "@/components/committee-chat";
import GoogleDriveLinks from "@/components/google-drive-links";
import DashboardOverview from "@/components/dashboard-overview";
import SandwichCollectionLog from "@/components/sandwich-collection-log";
import RecipientsManagement from "@/components/recipients-management";
import DriversManagement from "@/components/drivers-management";
import VolunteerManagement from "@/components/volunteer-management";
import HostsManagement from "@/components/hosts-management-consolidated";
import { DocumentsBrowser } from "@/components/documents-browser";

import BulkDataManager from "@/components/bulk-data-manager";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import Development from "@/pages/development";
import UnifiedMeetings from "@/components/unified-meetings";
import RoleDemo from "@/pages/role-demo";
import ProjectsClean from "@/pages/projects-clean";
import ProjectDetailClean from "@/pages/project-detail-clean";
import Analytics from "@/pages/analytics";
import ImpactDashboard from "@/pages/impact-dashboard";
import DataManagement from "@/pages/data-management";
import PerformanceDashboard from "@/pages/performance-dashboard";

import UserManagementRedesigned from "@/components/user-management-redesigned";
import UserProfile from "@/components/user-profile";
import { useState } from "react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { queryClient } from "@/lib/queryClient";
import SimpleNav from "@/components/simple-nav";
import AnnouncementBanner from "@/components/announcement-banner";
import MessageNotifications from "@/components/message-notifications";
import WorkLogPage from "@/pages/work-log";
import SuggestionsPortal from "@/pages/suggestions";
import GoogleSheetsPage from "@/pages/google-sheets";

import MessagingSystem from "@/components/messaging-system";
import RealTimeMessages from "@/pages/real-time-messages";
import Governance from "@/pages/governance";

import ImportantDocuments from "@/pages/important-documents";


import GmailStyleInbox from "@/components/gmail-style-inbox";
import { ToolkitTabs } from "@/components/toolkit-tabs";
import { KudosInbox } from "@/components/kudos-inbox";
import SocketChatHub from "@/components/socket-chat-hub";
import EventsViewer from "@/components/events-viewer";
import SignUpGeniusViewer from "@/components/signup-genius-viewer";
import DonationTracking from "@/components/donation-tracking";
import WeeklyMonitoringDashboard from "@/components/weekly-monitoring-dashboard";
import WishlistPage from "@/pages/wishlist";

export default function Dashboard({ initialSection = "dashboard" }: { initialSection?: string }) {
  const [location] = useLocation();
  const [activeSection, setActiveSection] = useState(initialSection);
  
  // Listen to URL changes to update activeSection
  React.useEffect(() => {
    console.log('Current URL location:', location);
    
    // Extract section from URL path
    if (location.startsWith('/projects/')) {
      const projectId = location.split('/projects/')[1];
      if (projectId) {
        const newSection = `project-${projectId}`;
        console.log('Setting activeSection to project ID:', newSection);
        setActiveSection(newSection);
      }
    } else {
      // Handle other sections if needed
      const pathSection = location.substring(1) || 'dashboard';
      if (pathSection !== activeSection && pathSection !== location.substring(1)) {
        console.log('Setting activeSection to:', pathSection);
        setActiveSection(pathSection);
      }
    }
  }, [location]);
  
  // Debug logging
  React.useEffect(() => {
    console.log('Dashboard activeSection changed to:', activeSection);
  }, [activeSection]);

  // Enhanced setActiveSection with debugging
  const enhancedSetActiveSection = (section: string) => {
    console.log('📍 Dashboard setActiveSection called with:', section);
    setActiveSection(section);
  };
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, isLoading } = useAuth();

  // Make setActiveSection available globally for project detail navigation
  React.useEffect(() => {
    (window as any).dashboardSetActiveSection = enhancedSetActiveSection;
    
    return () => {
      delete (window as any).dashboardSetActiveSection;
    };
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Simplified navigation structure
  const navigationItems = [
    // Core section
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "collections", label: "Collections", icon: Sandwich },
    ...(hasPermission(user, PERMISSIONS.ACCESS_EVENTS) ? [{ id: "events", label: "Events", icon: Calendar }] : []),
    { id: "inventory-calculator", label: "Inventory Calculator", icon: Calculator },

    
    // Data section (filtered by permissions)
    ...(hasPermission(user, PERMISSIONS.ACCESS_HOSTS) ? [{ id: "hosts", label: "Host Location", icon: Building2 }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_DRIVERS) ? [{ id: "drivers", label: "Drivers", icon: Car }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_RECIPIENTS) ? [{ id: "recipients", label: "Recipients", icon: Users }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_VOLUNTEERS) ? [{ id: "volunteers", label: "Volunteers", icon: Users }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_DONATION_TRACKING) ? [{ id: "donation-tracking", label: "Donation Tracking", icon: Truck }] : []),
    
    // Operations section
    ...(hasPermission(user, PERMISSIONS.VIEW_MEETINGS) ? [{ id: "meetings", label: "Meetings", icon: ClipboardList }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_ANALYTICS) ? [{ id: "analytics", label: "Analytics", icon: BarChart3 }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_WEEKLY_MONITORING) ? [{ id: "weekly-monitoring", label: "Weekly Monitoring", icon: Clock }] : []),

    ...(hasPermission(user, PERMISSIONS.VIEW_PROJECTS) ? [{ id: "projects", label: "Projects", icon: ListTodo }] : []),
    
    // Communication section
    { id: "chat", label: "Chat", icon: MessageCircle },
    ...(hasPermission(user, PERMISSIONS.VIEW_COMMITTEE) ? [{ id: "committee", label: "Committee", icon: MessageCircle }] : []),

    ...(hasPermission(user, PERMISSIONS.VIEW_SUGGESTIONS) ? [{ id: "suggestions", label: "Suggestions", icon: Lightbulb }] : []),
    
    // Resources section
    ...(hasPermission(user, PERMISSIONS.ACCESS_TOOLKIT) ? [{ id: "toolkit", label: "Toolkit", icon: FolderOpen }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_DEVELOPMENT) ? [{ id: "development", label: "Development", icon: FileText }] : []),
    ...(hasPermission(user, PERMISSIONS.ACCESS_WORK_LOGS) ? [{ id: "work-log", label: "Work Log", icon: ClipboardList }] : []),
    
    // Admin section
    ...(hasPermission(user, PERMISSIONS.MANAGE_USERS) ? [{ id: "user-management", label: "Admin", icon: UserCog }] : []),
  ];

  // Navigation is already filtered by permissions above

  const renderContent = () => {
    // Extract project ID from activeSection if it's a project detail page
    const projectIdMatch = activeSection.match(/^project-(\d+)$/);
    const projectId = projectIdMatch ? parseInt(projectIdMatch[1]) : null;

    // Handle project detail pages
    if (projectId) {
      return <ProjectDetailClean projectId={projectId} />;
    }

    switch (activeSection) {
      case "dashboard":
        return <DashboardOverview onSectionChange={setActiveSection} />;
      case "collections":
        return <SandwichCollectionLog />;
      case "events":
        return <EventsViewer />;
      case "signup-genius":
        return <SignUpGeniusViewer />;
      case "donation-tracking":
        return <DonationTracking />;
      case "weekly-monitoring":
        return (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Weekly Monitoring</h1>
                <p className="text-gray-600">Track weekly submission status and send email notifications for missing data</p>
              </div>
            </div>
            <WeeklyMonitoringDashboard />
          </div>
        );
      case "inventory-calculator":
        // Open the inventory calculator in a new tab and return to dashboard
        window.open('https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html', '_blank');
        setActiveSection("dashboard");
        return <DashboardOverview onSectionChange={setActiveSection} />;
      case "projects":
        console.log("Rendering ProjectsClean component");
        return <ProjectsClean />;
      case "real-time-messages":
        return <RealTimeMessages />;
      case "messages":
        return <GmailStyleInbox />;
      case "gmail-inbox":
        return <GmailStyleInbox />;
      case "inbox":
        return <GmailStyleInbox />;
      case "stream-messages":
        return <RealTimeMessages />;
      case "chat":
        return (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Chat</h1>
                <p className="text-gray-600">Real-time communication with your team across different channels</p>
              </div>
            </div>
            <SocketChatHub />
          </div>
        );
      case "kudos":
        return (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-100">
                <Trophy className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Your Kudos</h1>
                <p className="text-gray-600">Recognition received for your great work</p>
              </div>
            </div>
            <KudosInbox />
          </div>
        );
      case "profile":
        return <UserProfile />;
      case "meetings":
        return <UnifiedMeetings />;


      case "toolkit":
        return <ToolkitTabs />;

      case "hosts":
        return <HostsManagement />;
      case "recipients":
        return <RecipientsManagement />;
      case "drivers":
        return <DriversManagement />;
      case "donation-tracking":
        return <DonationTracking />;

      case "wishlist":
        return <WishlistPage />;
      case "analytics":
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-main-heading text-primary">Analytics Dashboard</h1>
              <p className="font-body text-muted-foreground">Data insights and impact visualization</p>
            </div>
            <Tabs defaultValue="data" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9 sm:h-10">
                <TabsTrigger value="data" className="text-xs sm:text-sm">Data Analytics</TabsTrigger>
                <TabsTrigger value="impact" className="text-xs sm:text-sm">Impact Dashboard</TabsTrigger>
              </TabsList>
              <TabsContent value="data" className="mt-6">
                <AnalyticsDashboard />
              </TabsContent>
              <TabsContent value="impact" className="mt-6">
                <ImpactDashboard />
              </TabsContent>
            </Tabs>
          </div>
        );
      case "role-demo":
        return <RoleDemo />;
      case "work-log":
        return <WorkLogPage />;
      case "suggestions":
        return <SuggestionsPortal />;
      case "google-sheets":
        return <GoogleSheetsPage />;
      case "governance":
        return <Governance />;
      case "committee":
      case "committee-chat":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{backgroundColor: 'var(--tsp-teal-light)'}}>
                <MessageCircle className="w-6 h-6" style={{color: 'var(--tsp-teal)'}} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Committee Communications</h1>
                <p className="text-gray-600">Internal committee discussions and collaboration</p>
              </div>
            </div>
            <CommitteeChat />
          </div>
        );
      case "user-management":
        return <UserManagementRedesigned />;
      case "development":
        return <Development />;
      case "admin":
        return <ImportantDocuments />;
      default:
        // Handle project detail pages
        if (projectId) {
          return <ProjectDetailClean projectId={projectId} />;
        }
        // Handle legacy project routes
        if (activeSection.startsWith("project-")) {
          const legacyProjectId = parseInt(activeSection.replace("project-", ""));
          if (!isNaN(legacyProjectId)) {
            return <ProjectDetailClean projectId={legacyProjectId} />;
          }
        }
        return <DashboardOverview onSectionChange={setActiveSection} />;
    }
  };

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // If not authenticated after loading, redirect or show error
  if (!user) {
    window.location.href = '/';
    return null;
  }

  return (
      <div className="bg-gray-50 min-h-screen flex flex-col overflow-x-hidden safe-area-inset">
      {/* Announcement Banner */}
      <AnnouncementBanner />
      
      {/* Top Header */}
      <div className="bg-gradient-to-r from-white to-orange-50/30 border-b-2 border-amber-200 shadow-sm px-2 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center mobile-header-fix min-h-[60px] sm:min-h-[70px]">
        <div className="flex items-center space-x-2 min-w-0 flex-shrink-0">
          {/* Mobile menu button - positioned first for easy access */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors touch-manipulation relative z-60"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={sandwichLogo} alt="Sandwich Logo" className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" width="24" height="24" />
          <h1 className="text-base sm:text-lg font-semibold text-teal-800 hidden sm:block">The Sandwich Project</h1>
          <h1 className="text-sm font-semibold text-teal-800 sm:hidden">TSP</h1>
        </div>
        
        {/* Flexible spacer */}
        <div className="flex-1" />
        
        {/* Current User Indicator - moved to right side with right-aligned buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {user && (
            <div className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 shadow-sm">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-r from-teal-100 to-teal-200 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-xs font-medium text-teal-800">
                  {(user as any)?.firstName?.charAt(0) || (user as any)?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-medium text-teal-800">
                  {(user as any)?.firstName ? `${(user as any).firstName} ${(user as any)?.lastName || ''}`.trim() : (user as any)?.email}
                </span>
                <span className="text-xs text-amber-600">
                  {(user as any)?.email}
                </span>
              </div>
              <div className="sm:hidden">
                <span className="text-xs font-medium text-teal-800">
                  {(user as any)?.firstName ? `${(user as any).firstName}` : (user as any)?.email?.split('@')[0] || 'User'}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center space-x-1 sm:space-x-2 relative z-50 flex-shrink-0">
          <button
            onClick={() => {
              console.log('Messages button clicked');
              setActiveSection("messages");
              setIsMobileMenuOpen(false);
            }}
            className={`p-2 rounded-lg transition-colors relative z-50 pointer-events-auto touch-manipulation ${
              activeSection === "messages"
                ? "bg-[#236383] hover:bg-[#1d5470] text-white border border-[#236383] shadow-sm"
                : "text-teal-600 hover:bg-teal-50 hover:text-teal-800"
            }`}
            title="Messages"
            aria-label="Messages"
          >
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          {/* Defer MessageNotifications to improve first paint performance */}
          {typeof window !== 'undefined' && <MessageNotifications user={user} />}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Profile button clicked, current section:', activeSection);
              setActiveSection("profile");
              // Force update URL to ensure proper navigation
              window.history.pushState({}, '', '/dashboard?section=profile');
              // Close mobile menu if open
              setIsMobileMenuOpen(false);
            }}
            className={`p-2 rounded-lg transition-colors relative z-50 pointer-events-auto touch-manipulation ${
              activeSection === "profile"
                ? "bg-[#236383] hover:bg-[#1d5470] text-white border border-[#236383] shadow-sm"
                : "text-teal-600 hover:bg-teal-50 hover:text-teal-800"
            }`}
            title="Account Settings"
            aria-label="Account Settings"
          >
            <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={async () => {
              try {
                // Call logout API to clear session
                await fetch('/api/logout', {
                  method: 'POST',
                  credentials: 'include'
                });
                // Clear query cache
                queryClient.clear();
                // Redirect to landing page
                window.location.href = "/";
              } catch (error) {
                console.error('Logout error:', error);
                // Fallback: clear cache and redirect anyway
                queryClient.clear();
                window.location.href = "/";
              }
            }}
            className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-amber-700 hover:text-amber-900 rounded-lg hover:bg-amber-50 transition-colors touch-manipulation border border-amber-200 hover:border-amber-300"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs sm:text-sm hidden sm:block">Logout</span>
          </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 relative pt-[60px] md:pt-0">
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-50 ${
          isSidebarCollapsed ? 'w-16' : 'w-64 sm:w-72'
        } bg-gradient-to-b from-white to-orange-50/30 border-r-2 border-amber-200 shadow-lg flex flex-col transition-all duration-300 ease-in-out h-full`}>
          {/* Collapse Toggle Button */}
          <div className="hidden md:flex justify-end p-2 border-b border-amber-200">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <img src={sandwichLogo} alt="Expand" className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-4 h-4 text-amber-700 rotate-90" />
              )}
            </button>
          </div>

          {/* Simple Navigation with enhanced mobile scrolling */}
          <div className="flex-1 overflow-y-auto pb-6 touch-pan-y overscroll-contain">
            <SimpleNav 
              activeSection={activeSection} 
              onSectionChange={(section) => {
                console.log('Dashboard setActiveSection called with:', section);
                setActiveSection(section);
                // Close mobile menu when navigation item is clicked
                setIsMobileMenuOpen(false);
                // Also update URL for back button support
                const newUrl = section === 'dashboard' ? '/dashboard' : `/dashboard?section=${section}`;
                window.history.pushState({}, '', newUrl);
              }}
              isCollapsed={isSidebarCollapsed}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden w-full md:w-auto relative z-10 bg-amber-50/30">
          {activeSection === 'gmail-inbox' ? (
            // Special full-height layout for inbox
            <div className="h-full">
              {renderContent()}
            </div>
          ) : (
            // Normal layout for other content
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <div className="p-0 sm:p-4 md:p-6 pb-20 min-h-full">
                <div className="max-w-full overflow-x-hidden">
                  {renderContent()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
