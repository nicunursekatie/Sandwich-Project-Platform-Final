import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Shield, FileText, Trophy } from 'lucide-react';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { DashboardDocumentSelector } from '@/components/dashboard-document-selector';
import AdminOnboardingKudos from '@/components/admin-onboarding-kudos';
import { adminDocuments } from '@/pages/important-documents';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminSettings() {
  const { user, isLoading } = useAuth();

  // Check for admin panel access permission
  if (!isLoading && (!user || !hasPermission(user, PERMISSIONS.ADMIN_PANEL_ACCESS))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white p-8">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader className="pb-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl font-sub-heading text-gray-900">Access Restricted</CardTitle>
            <CardDescription className="text-base text-gray-600 leading-relaxed">
              You don't have permission to access admin settings. Contact an
              administrator if you need access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-brand-primary to-brand-primary-dark rounded-xl shadow-[0_4px_12px_rgba(35,99,131,0.15),0_2px_4px_rgba(35,99,131,0.1)] hover:shadow-[0_8px_24px_rgba(35,99,131,0.2),0_4px_8px_rgba(35,99,131,0.15)] transition-all duration-300 ease-in-out">
              <Settings className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Admin Settings
              </h1>
              <p className="text-lg text-gray-600">
                Manage system configuration and audit logs
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="audit-log" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 mb-8 border-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-lg bg-white">
            <TabsTrigger
              value="audit-log"
              className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-brand-primary hover:bg-brand-primary/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-primary data-[state=active]:to-brand-primary-dark data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
              data-testid="tab-audit-log"
            >
              <Shield className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger
              value="dashboard-config"
              className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-brand-primary hover:bg-brand-primary/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-primary data-[state=active]:to-brand-primary-dark data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
              data-testid="tab-dashboard-config"
            >
              <FileText className="h-4 w-4" />
              Dashboard Config
            </TabsTrigger>
            <TabsTrigger
              value="onboarding-kudos"
              className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-brand-primary hover:bg-brand-primary/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-primary data-[state=active]:to-brand-primary-dark data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
              data-testid="tab-onboarding-kudos"
            >
              <Trophy className="h-4 w-4" />
              Onboarding Kudos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit-log" className="space-y-6">
            <EventRequestAuditLog showFilters data-testid="audit-log" />
          </TabsContent>

          <TabsContent value="dashboard-config" className="space-y-8">
            <DashboardDocumentSelector adminDocuments={adminDocuments} />
          </TabsContent>

          <TabsContent value="onboarding-kudos" className="space-y-8">
            <AdminOnboardingKudos />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
