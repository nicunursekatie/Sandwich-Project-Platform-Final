import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import SimpleNav from '@/components/simple-nav';
import AnalyticsDashboard from '@/components/analytics-dashboard';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { NAV_ITEMS } from '@/nav.config';
import { useLocation } from 'wouter';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { ResponsivePageLayout } from '@/components/layout/responsive-page-layout';

export default function AnalyticsPage() {
  const { trackView } = useActivityTracker();
  const [, setLocation] = useLocation();

  useEffect(() => {
    trackView(
      'Analytics',
      'Analytics',
      'Analytics Page',
      'User accessed analytics page'
    );
  }, [trackView]);

  const handleSectionChange = (section: string) => {
    if (section === 'analytics') {
      // Already on analytics page
      return;
    }
    // Navigate to dashboard with the selected section
    if (section === 'dashboard') {
      setLocation('/dashboard');
    } else {
      setLocation(`/dashboard?section=${section}`);
    }
  };

  return (
    <ResponsivePageLayout title="Analytics" showBack showNav>
      <div className="bg-slate-50 min-h-screen flex flex-col">
        {/* Top Header - hidden on mobile (MobileShell provides header) */}
        <div className="hidden md:block bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src="/sandwich-icon-optimized.svg" alt="Logo" className="w-8 h-8" />
              <span className="text-lg sm:text-xl font-semibold text-slate-900">
                The Sandwich Project
              </span>
            </div>
            <Button variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="flex flex-1">
          {/* Sidebar - hidden on mobile (MobileShell provides navigation) */}
          <div className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col">
            <SimpleNav
              navigationItems={NAV_ITEMS}
              onSectionChange={handleSectionChange}
              activeSection="analytics"
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 sm:p-6">
            <div className="hidden sm:block">
              <PageBreadcrumbs
                segments={[
                  { label: 'Analytics & Reports', href: '/dashboard?section=analytics' },
                  { label: 'Analytics' }
                ]}
              />
            </div>
            <AnalyticsDashboard />
          </div>
        </div>
      </div>
    </ResponsivePageLayout>
  );
}
