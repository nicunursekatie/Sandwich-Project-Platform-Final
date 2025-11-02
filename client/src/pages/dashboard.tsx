import {
  Sandwich,
  LogOut,
  LayoutDashboard,
  ListTodo,
  MessageCircle,
  ClipboardList,
  FolderOpen,
  BarChart3,
  TrendingUp,
  Users,
  Car,
  Building2,
  FileText,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  UserCog,
  Lightbulb,
  AlertCircle,
  Trophy,
  Calculator,
  Calendar,
  Clock,
  Truck,
  FileImage,
  Gift,
  Copy,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { useLocation, useRoute } from 'wouter';
// Using optimized SVG for faster loading
const sandwichLogo = '/sandwich-icon-optimized.svg';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useMemo, Suspense, lazy } from 'react';
import * as React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { queryClient } from '@/lib/queryClient';
import SimpleNav from '@/components/simple-nav';
import { NAV_ITEMS } from '@/nav.config';
import AnnouncementBanner from '@/components/announcement-banner';
import { useAnalytics } from '@/hooks/useAnalytics';
import EnhancedNotifications from '@/components/enhanced-notifications';
import OnboardingChallengeButton from '@/components/onboarding-challenge-button';
import { KudosLoginNotifier } from '@/components/kudos-login-notifier';
import { GuidedTour } from '@/components/GuidedTour';
import { ErrorBoundary } from '@/components/error-boundary';
import { DashboardNavigationProvider } from '@/contexts/dashboard-navigation-context';
import { SMSAnnouncementModal } from '@/components/sms-announcement-modal';

// Lazy load all page/section components for better performance
const ProjectList = lazy(() => import('@/components/project-list'));
const WeeklySandwichForm = lazy(() => import('@/components/weekly-sandwich-form'));
const CommitteeChat = lazy(() => import('@/components/committee-chat'));
const GoogleDriveLinks = lazy(() => import('@/components/google-drive-links'));
const DashboardOverview = lazy(() => import('@/components/dashboard-overview'));
const SandwichCollectionLog = lazy(() => import('@/components/sandwich-collection-log'));
const RecipientsManagement = lazy(() => import('@/components/recipients-management'));
const DriversManagement = lazy(() => import('@/components/drivers-management-simple'));
const VolunteerManagement = lazy(() => import('@/components/volunteer-management'));
const HostsManagement = lazy(() => import('@/components/hosts-management-consolidated'));
const DocumentManagement = lazy(() => import('@/components/document-management'));
const ImportantDocuments = lazy(() => import('@/pages/important-documents'));
const BulkDataManager = lazy(() => import('@/components/bulk-data-manager'));
const HostAnalytics = lazy(() => import('@/components/host-analytics'));
const EnhancedMeetingDashboard = lazy(() => import('@/components/enhanced-meeting-dashboard'));
const RoleDemo = lazy(() => import('@/pages/role-demo'));
const ProjectsManagement = lazy(() => import('@/components/projects'));
const ProjectDetailClean = lazy(() => import('@/pages/project-detail-clean'));
const Analytics = lazy(() => import('@/pages/analytics'));
const ImpactDashboard = lazy(() => import('@/pages/impact-dashboard'));
const DataManagement = lazy(() => import('@/pages/data-management'));
const PerformanceDashboard = lazy(() => import('@/pages/performance-dashboard'));
const GrantMetrics = lazy(() => import('@/pages/grant-metrics'));
const UserManagementRedesigned = lazy(() => import('@/components/user-management-redesigned'));
const UserProfile = lazy(() => import('@/components/user-profile'));
const OnboardingAdmin = lazy(() => import('@/pages/onboarding-admin'));
const WorkLogPage = lazy(() => import('@/pages/work-log'));
const SuggestionsPortal = lazy(() => import('@/pages/suggestions'));
const GoogleSheetsPage = lazy(() => import('@/pages/google-sheets'));
const RealTimeMessages = lazy(() => import('@/pages/real-time-messages'));
const GmailStyleInbox = lazy(() => import('@/components/gmail-style-inbox'));
const ToolkitTabs = lazy(() => import('@/components/toolkit-tabs').then(m => ({ default: m.ToolkitTabs })));
const KudosInbox = lazy(() => import('@/components/kudos-inbox').then(m => ({ default: m.KudosInbox })));
const StreamChatRooms = lazy(() => import('@/components/stream-chat-rooms'));
const EventsViewer = lazy(() => import('@/components/events-viewer'));
const SignUpGeniusViewer = lazy(() => import('@/components/signup-genius-viewer'));
const DonationTracking = lazy(() => import('@/components/donation-tracking'));
const WeeklyMonitoringDashboard = lazy(() => import('@/components/weekly-monitoring-dashboard'));
const WishlistPage = lazy(() => import('@/pages/wishlist'));
const TeamBoard = lazy(() => import('@/pages/TeamBoard'));
const PromotionGraphics = lazy(() => import('@/pages/promotion-graphics'));
const CoolerTrackingPage = lazy(() => import('@/pages/cooler-tracking'));
const EventRequestsManagement = lazy(() => import('@/components/event-requests'));
const EventRemindersManagement = lazy(() => import('@/components/event-reminders-management'));
const GroupCatalog = lazy(() => import('@/components/organizations-catalog'));
const ActionTracking = lazy(() => import('@/components/action-tracking-enhanced'));
const LogosPage = lazy(() => import('@/pages/logos'));
const ImportantLinks = lazy(() => import('@/pages/important-links'));
const Resources = lazy(() => import('@/pages/resources').then(m => ({ default: m.Resources })));
const EventRequestAuditLog = lazy(() => import('@/components/event-request-audit-log').then(m => ({ default: m.EventRequestAuditLog })));
const HistoricalImport = lazy(() => import('@/pages/historical-import'));
const MyAvailability = lazy(() => import('@/pages/my-availability'));
const TeamAvailability = lazy(() => import('@/pages/team-availability'));
const GoogleCalendarAvailability = lazy(() => import('@/pages/google-calendar-availability'));
const RouteMapView = lazy(() => import('@/pages/route-map'));
const EventMapView = lazy(() => import('@/pages/event-map'));
const Help = lazy(() => import('@/pages/Help'));
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'));
const AdminSettings = lazy(() => import('@/pages/admin-settings'));
const DesignSystemShowcase = lazy(() => import('@/pages/design-system-showcase'));
const SmartSearchAdmin = lazy(() => import('@/pages/smart-search-admin'));

import sandwich_logo from '@assets/CMYK_PRINT_TSP-01_1749585167435.png';

import sandwich_20logo from '@assets/LOGOS/sandwich logo.png';
import { logger } from '@/lib/logger';

// Loading fallback component for lazy-loaded sections
const SectionLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading section...</p>
    </div>
  </div>
);

export default function Dashboard({
  initialSection = 'dashboard',
}: {
  initialSection?: string;
}) {
  const { trackView } = useActivityTracker();
  const [location, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedHost, setSelectedHost] = useState<string>('');

  React.useEffect(() => {
    trackView(
      'Dashboard',
      'Dashboard',
      'Main Dashboard',
      `User accessed dashboard - section: ${activeSection}`
    );
  }, [activeSection, trackView]);

  // Parse URL query parameters
  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      section: searchParams.get('section'),
      tab: searchParams.get('tab'),
      eventId: searchParams.get('eventId'),
      view: searchParams.get('view'),
      id: searchParams.get('id'),
    };
  }, [location]);

  // Listen to URL changes to update activeSection
  React.useEffect(() => {
    logger.log('Current URL location:', location);

    // Check for section in query parameters first
    if (urlParams.section) {
      logger.log('Setting activeSection from query parameter:', urlParams.section);
      
      // Handle special case for project detail view via query parameters
      if (urlParams.section === 'projects' && urlParams.view === 'detail' && urlParams.id) {
        const projectSection = `project-${urlParams.id}`;
        logger.log('Setting activeSection to project detail:', projectSection);
        setActiveSection(projectSection);
        return;
      }
      
      setActiveSection(urlParams.section);
      return;
    }

    // Extract section from URL path (strip query parameters)
    const pathWithoutQuery = location.split('?')[0];
    
    if (pathWithoutQuery.startsWith('/projects/')) {
      const parts = pathWithoutQuery.split('/projects/');
      const projectId = parts.length > 1 ? parts[1] : null;
      if (projectId) {
        const newSection = `project-${projectId}`;
        logger.log('Setting activeSection to project ID:', newSection);
        setActiveSection(newSection);
      }
    } else {
      // Handle other sections - strip query parameters and leading slash
      const pathSection = pathWithoutQuery.substring(1) || 'dashboard';
      logger.log('Setting activeSection to:', pathSection);
      setActiveSection(pathSection);
    }
  }, [location, urlParams.section]);

  // Debug logging
  React.useEffect(() => {
    logger.log('Dashboard activeSection changed to:', activeSection);
  }, [activeSection]);

  // Enhanced setActiveSection with debugging
  const enhancedSetActiveSection = (section: string) => {
    logger.log('📍 Dashboard setActiveSection called with:', section);
    setActiveSection(section);
  };
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, isLoading } = useAuth();
  const { trackNavigation, trackButtonClick } = useAnalytics();

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };


  const renderContent = () => {
    // Extract project ID from activeSection if it's a project detail page
    const projectIdMatch = activeSection.match(/^project-(\d+)$/);
    const projectId =
      projectIdMatch && projectIdMatch[1] ? parseInt(projectIdMatch[1]) : null;

    // Handle project detail pages
    if (projectId) {
      return <ProjectDetailClean projectId={projectId} />;
    }

    switch (activeSection) {
      case 'dashboard':
        return <DashboardOverview onSectionChange={setActiveSection} />;
      case 'collections':
        return <SandwichCollectionLog />;
      case 'events':
        return <EventsViewer />;
      case 'signup-genius':
        return <SignUpGeniusViewer />;
      case 'donation-tracking':
        return <DonationTracking />;
      case 'weekly-monitoring':
        return (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">
                  Weekly Monitoring
                </h1>
                <p className="text-sm sm:text-base text-gray-600 break-words">
                  Track weekly submission status and send email notifications
                  for missing data
                </p>
              </div>
            </div>
            <WeeklyMonitoringDashboard />
          </div>
        );
      case 'inventory-calculator':
        // Open the inventory calculator in a new tab and return to dashboard
        window.open(
          'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html',
          '_blank'
        );
        setActiveSection('dashboard');
        return <DashboardOverview onSectionChange={setActiveSection} />;
      case 'important-documents':
        return <ImportantDocuments />;
      case 'resources':
        return <Resources />;
      case 'projects':
        logger.log('Rendering ProjectsManagement component');
        return <ProjectsManagement />;
      case 'real-time-messages':
        return <RealTimeMessages />;
      case 'messages':
        return <GmailStyleInbox />;
      case 'gmail-inbox':
        return <GmailStyleInbox />;
      case 'inbox':
        return <GmailStyleInbox />;
      case 'stream-messages':
        return <RealTimeMessages />;
      case 'chat':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0 flex items-center gap-4 p-6 pb-2 border-b border-gray-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">Team Chat</h1>
                <p className="text-sm sm:text-base text-gray-600 break-words">
                  Real-time communication with your team across different
                  channels
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <StreamChatRooms />
            </div>
          </div>
        );
      case 'kudos':
        return (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-100">
                <Trophy className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">Your Kudos</h1>
                <p className="text-sm sm:text-base text-gray-600 break-words">
                  Recognition received for your great work
                </p>
              </div>
            </div>
            <KudosInbox />
          </div>
        );
      case 'profile':
        return <UserProfile />;
      case 'meetings':
        return <EnhancedMeetingDashboard />;

      case 'toolkit':
        return <ToolkitTabs />;

      case 'documents':
      case 'document-management':
        return <DocumentManagement />;

      case 'hosts':
        return <HostsManagement />;
      case 'route-map':
        return <RouteMapView />;
      case 'event-map':
        return <EventMapView />;
      case 'recipients':
        return <RecipientsManagement />;
      case 'drivers':
        return <DriversManagement />;
      case 'volunteers':
        return <VolunteerManagement />;
      case 'event-requests':
        return <EventRequestsManagement
          initialTab={urlParams.tab}
          initialEventId={urlParams.eventId ? parseInt(urlParams.eventId) : undefined}
        />;
      case 'event-reminders':
        return <EventRemindersManagement />;
      case 'historical-import':
        return <HistoricalImport />;
      case 'groups-catalog':
        return (
          <GroupCatalog
            onNavigateToEventPlanning={() => setActiveSection('event-requests')}
          />
        );
      case 'action-tracking':
        return <ActionTracking />;
      case 'my-actions':
        return <ActionTracking />;

      case 'wishlist':
        return <WishlistPage />;
      case 'team-board':
        return <TeamBoard />;
      case 'promotion':
        return <PromotionGraphics />;
      case 'cooler-tracking':
        return <CoolerTrackingPage />;
      case 'important-links':
        return <ImportantLinks />;
      case 'analytics':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-lg sm:text-xl md:text-2xl font-main-heading text-primary break-words">
                Impact & Analytics Dashboard
              </h1>
              <p className="text-sm sm:text-base font-body text-muted-foreground break-words">
                Track community impact, collection trends, and host performance
              </p>
            </div>
            <Tabs defaultValue="impact" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9 sm:h-10 bg-brand-primary/10 border-brand-primary/20">
                <TabsTrigger
                  value="impact"
                  className="text-xs sm:text-sm data-[state=active]:bg-brand-primary data-[state=active]:text-white text-brand-primary"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Impact Dashboard
                </TabsTrigger>
                <TabsTrigger
                  value="hosts"
                  className="text-xs sm:text-sm data-[state=active]:bg-brand-primary data-[state=active]:text-white text-[#646464]"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Host Analytics
                </TabsTrigger>
              </TabsList>
              <TabsContent value="impact" className="mt-6">
                <ImpactDashboard />
              </TabsContent>
              <TabsContent value="hosts" className="mt-6">
                <HostAnalytics
                  selectedHost={selectedHost}
                  onHostChange={setSelectedHost}
                />
              </TabsContent>
            </Tabs>
          </div>
        );
      case 'grant-metrics':
        return <GrantMetrics />;
      case 'role-demo':
        return <RoleDemo />;
      case 'work-log':
        return <WorkLogPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'suggestions':
        return <SuggestionsPortal />;
      case 'google-sheets':
        return <GoogleSheetsPage />;
      case 'committee':
      case 'committee-chat':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div
                className="flex items-center justify-center w-12 h-12 rounded-xl"
                style={{ backgroundColor: 'var(--color-brand-teal-light)' }}
              >
                <MessageCircle
                  className="w-6 h-6"
                  style={{ color: 'var(--color-brand-teal)' }}
                />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">
                  Committee Communications
                </h1>
                <p className="text-sm sm:text-base text-gray-600 break-words">
                  Internal committee discussions and collaboration
                </p>
              </div>
            </div>
            <CommitteeChat />
          </div>
        );
      case 'my-availability':
        return <MyAvailability />;
      case 'team-availability':
        return <TeamAvailability />;
      case 'google-calendar-availability':
        return <GoogleCalendarAvailability />;
      case 'user-management':
        return <UserManagementRedesigned />;
      case 'onboarding-admin':
        return <OnboardingAdmin />;
      case 'admin':
        return <AdminSettings />;
      case 'help':
        return <Help />;
      case 'design-system':
        return <DesignSystemShowcase />;
      case 'smart-search-admin':
        return <SmartSearchAdmin />;
      default:
        // Handle project detail pages
        if (projectId) {
          return <ProjectDetailClean projectId={projectId} />;
        }
        // Handle legacy project routes
        if (activeSection.startsWith('project-')) {
          const legacyProjectId = parseInt(
            activeSection.replace('project-', '')
          );
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
    <>
      {/* Login Kudos Notifier */}
      <KudosLoginNotifier />
      <SMSAnnouncementModal />

      <DashboardNavigationProvider setActiveSection={enhancedSetActiveSection}>
        <div className="bg-gray-50 min-h-screen flex flex-col overflow-x-hidden safe-area-inset">
        {/* Announcement Banner */}
        <AnnouncementBanner />
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-white to-orange-50/30 border-b-2 border-amber-200 shadow-sm px-2 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center mobile-header-fix min-h-[60px] sm:min-h-[70px] overflow-x-auto">
          <div className="flex items-center space-x-2 min-w-0 flex-shrink-0">
            {/* Mobile menu button - positioned first for easy access */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors touch-manipulation relative z-60"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <img
              src={sandwich_20logo}
              alt="Sandwich Logo"
              className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
              width="24"
              height="24"
            />
            <h1 className="text-base sm:text-lg font-semibold text-teal-800 hidden lg:block truncate">
              The Sandwich Project
            </h1>
            <h1 className="text-sm font-semibold text-teal-800 lg:hidden truncate">
              TSP
            </h1>
          </div>

          {/* Flexible spacer - min width to ensure buttons don't get pushed off */}
          <div className="flex-1 min-w-0" />

          {/* Right side container - optimized for tablets/mobile */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Compact user indicator for tablets */}
            {user && (
              <div className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 shadow-sm max-w-[120px] xs:max-w-[150px] sm:max-w-[180px] md:max-w-none">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-r from-teal-100 to-teal-200 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-xs font-medium text-teal-800">
                    {(user as any)?.firstName?.charAt(0) ||
                      (user as any)?.email?.charAt(0) ||
                      'U'}
                  </span>
                </div>
                <div className="hidden lg:flex flex-col min-w-0">
                  <span className="text-xs font-medium text-teal-800 truncate">
                    {(user as any)?.firstName
                      ? `${(user as any).firstName} ${
                          (user as any)?.lastName || ''
                        }`.trim()
                      : (user as any)?.email}
                  </span>
                  <span className="text-xs text-amber-600 truncate">
                    {(user as any)?.email}
                  </span>
                </div>
                <div className="lg:hidden min-w-0 flex-1">
                  <span className="text-xs font-medium text-teal-800 truncate block">
                    {(user as any)?.firstName
                      ? `${(user as any).firstName}`
                      : (user as any)?.email?.split('@')[0] || 'User'}
                  </span>
                </div>
              </div>
            )}

            {/* Essential buttons - always visible */}
            <div className="flex items-center gap-0.5 xs:gap-1 relative z-50 flex-shrink-0">
              <button
                onClick={() => {
                  logger.log('Messages button clicked');
                  trackButtonClick('messages', 'dashboard_header');
                  setActiveSection('messages');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-2 rounded-lg transition-colors relative z-50 pointer-events-auto touch-manipulation min-w-[44px] ${
                  activeSection === 'messages'
                    ? 'bg-brand-primary hover:bg-brand-primary-dark text-white border border-brand-primary shadow-sm'
                    : 'text-teal-600 hover:bg-teal-50 hover:text-teal-800'
                }`}
                title="Messages"
                aria-label="Messages"
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Enhanced In-App Notifications - the main notification bell */}
              {typeof window !== 'undefined' && (
                <EnhancedNotifications user={user} />
              )}

              {/* Onboarding Challenge Button */}
              <OnboardingChallengeButton onNavigate={(section) => setActiveSection(section)} />

              {/* Quick Help Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logger.log('Help button clicked');
                  trackButtonClick('help', 'dashboard_header');
                  setLocation('/help');
                  setIsMobileMenuOpen(false);
                }}
                className={`p-2 rounded-lg transition-colors relative z-50 pointer-events-auto touch-manipulation min-w-[44px] text-teal-600 hover:bg-teal-50 hover:text-teal-800`}
                title="Help & Support"
                aria-label="Help & Support"
              >
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logger.log(
                    'Profile button clicked, current section:',
                    activeSection
                  );
                  trackButtonClick('profile', 'dashboard_header');
                  setActiveSection('profile');
                  window.history.pushState(
                    {},
                    '',
                    '/dashboard?section=profile'
                  );
                  setIsMobileMenuOpen(false);
                }}
                className={`p-2 rounded-lg transition-colors relative z-50 pointer-events-auto touch-manipulation min-w-[44px] ${
                  activeSection === 'profile'
                    ? 'bg-brand-primary hover:bg-brand-primary-dark text-white border border-brand-primary shadow-sm'
                    : 'text-teal-600 hover:bg-teal-50 hover:text-teal-800'
                }`}
                title="Account Settings"
                aria-label="Account Settings"
              >
                <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Logout button - ALWAYS visible and accessible */}
              <button
                onClick={async () => {
                  try {
                    trackButtonClick('logout', 'dashboard_header');
                    await fetch('/api/auth/logout', {
                      method: 'POST',
                      credentials: 'include',
                    });
                    // Clear all cached data and force auth state refresh
                    queryClient.clear();
                    queryClient.invalidateQueries({
                      queryKey: ['/api/auth/user'],
                    });
                    queryClient.removeQueries({ queryKey: ['/api/auth/user'] });
                    // Force immediate redirect to login page
                    window.location.href = '/api/login';
                  } catch (error) {
                    logger.error('Logout error:', error);
                    queryClient.clear();
                    queryClient.invalidateQueries({
                      queryKey: ['/api/auth/user'],
                    });
                    queryClient.removeQueries({ queryKey: ['/api/auth/user'] });
                    window.location.href = '/api/login';
                  }
                }}
                className="flex items-center gap-1 px-2 py-2 text-amber-700 hover:text-amber-900 rounded-lg hover:bg-amber-50 transition-colors touch-manipulation border border-amber-200 hover:border-amber-300 flex-shrink-0 min-w-[44px]"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs hidden md:block whitespace-nowrap">
                  Logout
                </span>
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
          <div
            className={`${
              isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            } md:translate-x-0 fixed md:relative z-50 ${
              isSidebarCollapsed ? 'w-16' : 'w-56 xs:w-64 sm:w-72'
            } bg-gradient-to-b from-white to-orange-50/30 border-r-2 border-amber-200 shadow-lg flex flex-col transition-all duration-300 ease-in-out h-full`}
          >
            {/* Collapse Toggle Button */}
            <div className="hidden md:flex justify-end p-2 border-b border-amber-200">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                aria-label={
                  isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                }
                title={isSidebarCollapsed ? 'Click to expand navigation menu' : 'Click to collapse navigation menu'}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-amber-700" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-700 rotate-90" />
                )}
              </button>
            </div>

            {/* Simple Navigation with enhanced mobile scrolling */}
            <div className="flex-1 overflow-y-auto pb-6 touch-pan-y overscroll-contain">
              <SimpleNav
                navigationItems={NAV_ITEMS}
                activeSection={activeSection}
                onSectionChange={(section) => {
                  logger.log(
                    'Dashboard setActiveSection called with:',
                    section
                  );

                  // Track navigation
                  trackNavigation(section, activeSection);

                  // Handle standalone routes (navigate away from dashboard)
                  if (section === 'help') {
                    setLocation('/help');
                    setIsMobileMenuOpen(false);
                    return;
                  }

                  setActiveSection(section);
                  // Close mobile menu when navigation item is clicked
                  setIsMobileMenuOpen(false);
                  // Also update URL for back button support
                  const newUrl =
                    section === 'dashboard'
                      ? '/dashboard'
                      : `/dashboard?section=${section}`;
                  window.history.pushState({}, '', newUrl);
                }}
                isCollapsed={isSidebarCollapsed}
              />

              {/* EIN Information - Always visible at bottom */}
              {!isSidebarCollapsed && (
                <div className="px-4 mt-6 pt-4 border-t border-amber-200 space-y-3">
                  <div className="bg-gradient-to-r from-teal-50 to-teal-100 border border-teal-200 rounded-lg px-3 py-2">
                    <div className="text-xs text-teal-700 font-medium uppercase tracking-wide">
                      Organization EIN
                    </div>
                    <div className="text-sm font-bold text-teal-900 font-mono">
                      87-0939484
                    </div>
                  </div>

                  {/* Amazon Wishlist Quick Access */}
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-lg px-3 py-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-orange-700" />
                        <div className="text-xs text-orange-700 font-bold uppercase tracking-wide">
                          Amazon Wishlist
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setActiveSection('wishlist');
                          window.history.pushState({}, '', '/dashboard?section=wishlist');
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1"
                        title="View wishlist and share with supporters"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View & Share
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText('https://www.amazon.com/hz/wishlist/ls/XRSQ9EDIIIWV?ref_=wl_share');
                            // Show toast notification (you'll need to add toast hook)
                            logger.log('Wishlist link copied!');
                          } catch (err) {
                            logger.error('Copy failed:', err);
                          }
                        }}
                        className="bg-orange-200 hover:bg-orange-300 text-orange-900 px-2 py-1.5 rounded transition-colors"
                        title="Copy main wishlist link"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden w-full md:w-auto relative z-10 bg-amber-50/30 min-w-0">
            <ErrorBoundary
              fallback={
                <div className="p-4 sm:p-8 text-center">
                  <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      This section encountered an error
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Don't worry - your other sections are still working. Try switching to a different section or refreshing the page.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
                    >
                      Refresh Page
                    </button>
                  </div>
                </div>
              }
            >
              <Suspense fallback={<SectionLoader />}>
                {activeSection === 'gmail-inbox' || activeSection === 'chat' ? (
                  // Special full-height layout for inbox and chat
                  <div className="h-full">{renderContent()}</div>
                ) : (
                  // Normal layout for other content
                  <div className="h-full overflow-y-auto overflow-x-hidden w-full max-w-full">
                    <div className="w-full pb-20 min-h-full px-4 sm:px-6 pt-6">
                      {renderContent()}
                    </div>
                  </div>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
        </div>

        {/* Guided Tour System */}
        <GuidedTour />
      </DashboardNavigationProvider>
    </>
  );
}
