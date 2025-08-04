import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  Calendar, 
  Clock, 
  Eye, 
  TrendingUp, 
  User, 
  Users, 
  MousePointer, 
  FileText, 
  MessageSquare,
  BarChart3,
  Target
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// Enhanced interfaces for granular user behavior tracking
interface DetailedUserActivity {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  totalActions: number;
  lastActive: Date | null;
  topSection: string;
  topFeature: string;
  timeSpent: number; // in minutes
  sessionsCount: number;
  featuresUsed: string[];
  sectionBreakdown: { section: string; actions: number; timeSpent: number }[];
}

interface ActivityStats {
  totalActions: number;
  sectionsUsed: string[];
  topActions: { action: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
  featureUsage: { feature: string; count: number; avgDuration: number }[];
  sectionBreakdown: { section: string; actions: number; timeSpent: number }[];
  peakUsageTimes: { hour: number; count: number }[];
}

interface ActivityLog {
  id: number;
  userId: string;
  userName: string;
  action: string;
  section: string;
  feature: string;
  page: string;
  duration: number;
  createdAt: string;
  metadata: any;
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  activeUsersLast24h?: number;
  activeUsersLast12h?: number;
  totalActions: number;
  averageActionsPerUser: number;
  topSections: { section: string; actions: number; usage?: number }[];
  topFeatures: { feature: string; usage: number }[];
  dailyActiveUsers: { date: string; users: number }[];
}

export default function EnhancedUserAnalytics() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('7');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');

  // System-wide analytics
  const { data: systemStats, isLoading: isLoadingStats } = useQuery<SystemStats>({
    queryKey: ['/api/enhanced-user-activity/enhanced-stats', selectedTimeframe],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/enhanced-stats?days=${selectedTimeframe}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch system stats');
      return res.json();
    },
    staleTime: 60000,
  });

  // Detailed user activities
  const { data: detailedActivities, isLoading: isLoadingUsers } = useQuery<DetailedUserActivity[]>({
    queryKey: ['/api/enhanced-user-activity/detailed-users', selectedTimeframe],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/detailed-users?days=${selectedTimeframe}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch user activities');
      return res.json();
    },
    staleTime: 30000,
  });

  // Activity logs for detailed view
  const { data: activityLogs, isLoading: isLoadingLogs } = useQuery<ActivityLog[]>({
    queryKey: ['/api/enhanced-user-activity/logs', selectedUser, activityFilter, selectedTimeframe],
    queryFn: async () => {
      const params = new URLSearchParams({
        days: selectedTimeframe,
        ...(selectedUser !== 'all' && { userId: selectedUser }),
        ...(activityFilter !== 'all' && { action: activityFilter })
      });
      const res = await fetch(`/api/enhanced-user-activity/logs?${params}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    },
    staleTime: 15000,
  });

  // Individual user stats
  const { data: userStats, isLoading: isLoadingUserStats } = useQuery<ActivityStats>({
    queryKey: ['/api/enhanced-user-activity/user-stats', selectedUser, selectedTimeframe],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/user-stats/${selectedUser}?days=${selectedTimeframe}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch user stats');
      return res.json();
    },
    enabled: selectedUser !== 'all',
    staleTime: 30000,
  });

  const getSectionColor = (section: string) => {
    const colors: Record<string, string> = {
      'Dashboard': 'bg-blue-100 text-blue-800',
      'Collections': 'bg-green-100 text-green-800',
      'Communication': 'bg-purple-100 text-purple-800',
      'Directory': 'bg-orange-100 text-orange-800',
      'Projects': 'bg-teal-100 text-teal-800',
      'Analytics': 'bg-yellow-100 text-yellow-800',
      'Admin': 'bg-red-100 text-red-800',
      'Meetings': 'bg-indigo-100 text-indigo-800'
    };
    return colors[section] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'View': return <Eye className="h-4 w-4" />;
      case 'Create': return <FileText className="h-4 w-4" />;
      case 'Update': return <MousePointer className="h-4 w-4" />;
      case 'Delete': return <Target className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (isLoadingStats || isLoadingUsers) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select user" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {detailedActivities?.map((user) => (
              <SelectItem key={user.userId} value={user.userId}>
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="flex items-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Overview Stats Cards - Compact design with better spacing */}
      {systemStats && (
        <div className="space-y-8">
          <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
            <div className="bg-white  p-3 sm:p-4 rounded-lg border border-[#236383]/20 hover:border-[#236383]/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <Users className="h-4 w-4 text-[#236383]" />
                <span className="text-xs text-green-600 font-medium">
                  ↑{Math.round(((systemStats.activeUsersLast24h || systemStats.activeUsers) / systemStats.totalUsers) * 100)}%
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#236383] mb-1">{systemStats.totalUsers}</div>
              <p className="text-xs text-gray-600">Total Users</p>
              <p className="text-xs text-gray-500 mt-1">
                {systemStats.activeUsersLast24h || systemStats.activeUsers} active today
              </p>
            </div>

            <div className="bg-white  p-3 sm:p-4 rounded-lg border border-[#236383]/20 hover:border-[#236383]/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <Activity className="h-4 w-4 text-[#236383]" />
                <span className="text-xs text-blue-600 font-medium">
                  {Math.round(systemStats.averageActionsPerUser)}/user
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#236383] mb-1">{systemStats.totalActions.toLocaleString()}</div>
              <p className="text-xs text-gray-600">Total Actions</p>
            </div>

            <div className="bg-white  p-3 sm:p-4 rounded-lg border border-[#236383]/20 hover:border-[#236383]/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <BarChart3 className="h-4 w-4 text-[#236383]" />
                <span className="text-xs text-orange-600 font-medium">Most Used</span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#236383] mb-1 truncate">
                {systemStats.topSections?.[0]?.section || 'N/A'}
              </div>
              <p className="text-xs text-gray-600">Top Section</p>
              <p className="text-xs text-gray-500 mt-1">
                {systemStats.topSections?.[0]?.actions || 0} actions
              </p>
            </div>

            <div className="bg-white  p-3 sm:p-4 rounded-lg border border-[#236383]/20 hover:border-[#236383]/40 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <Target className="h-4 w-4 text-[#236383]" />
                <span className="text-xs text-purple-600 font-medium">Popular</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-[#236383] mb-1 line-clamp-2">
                {systemStats.topFeatures?.[0]?.feature || 'N/A'}
              </div>
              <p className="text-xs text-gray-600">Top Feature</p>
              <p className="text-xs text-gray-500 mt-1">
                {systemStats.topFeatures?.[0]?.usage || 0} uses
              </p>
            </div>
          </div>

          {/* Actionable Insights Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50   p-4 sm:p-6 rounded-lg border border-blue-200 ">
            <h3 className="text-base font-semibold text-gray-900  mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Action Items
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white  p-3 rounded-md border">
                <p className="text-sm font-medium text-gray-900 ">Need Check-ins</p>
                <p className="text-xs text-gray-600  mt-1">
                  {systemStats.totalUsers - (systemStats.activeUsersLast24h || systemStats.activeUsers)} users haven't logged in today
                </p>
                <p className="text-xs text-blue-600 font-medium mt-1">→ Send engagement reminders</p>
              </div>
              <div className="bg-white  p-3 rounded-md border">
                <p className="text-sm font-medium text-gray-900 ">Feature Adoption</p>
                <p className="text-xs text-gray-600  mt-1">
                  {systemStats.topSections?.[0]?.section} dominates usage
                </p>
                <p className="text-xs text-green-600 font-medium mt-1">→ Promote other features</p>
              </div>
              <div className="bg-white  p-3 rounded-md border">
                <p className="text-sm font-medium text-gray-900 ">Training Opportunity</p>
                <p className="text-xs text-gray-600  mt-1">
                  Focus on {systemStats.topFeatures?.[0]?.feature} best practices
                </p>
                <p className="text-xs text-purple-600 font-medium mt-1">→ Create tutorial</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">User Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="behavior">Behavior Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">User Activity Summary</h3>
              <p className="text-sm text-muted-foreground">
                Overview of all users and their platform engagement
              </p>
            </div>
            <Badge variant="outline">
              {detailedActivities?.length || 0} total users
            </Badge>
          </div>

          <ScrollArea className="h-[700px]">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {detailedActivities?.map((user) => (
                <Card key={user.userId} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#236383] to-[#1a4b5c] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {user.firstName?.[0] || user.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.email}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                      <Badge variant={user.totalActions > 0 ? "default" : "secondary"} className="text-xs">
                        {user.totalActions}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Sessions</p>
                        <p className="text-lg font-bold">{user.sessionsCount}</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Time Spent</p>
                        <p className="text-lg font-bold">{Math.round(user.timeSpent)}m</p>
                      </div>
                    </div>

                    {/* Top Activity */}
                    {user.totalActions > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">TOP SECTION</span>
                          <Badge className={getSectionColor(user.topSection)} variant="outline">
                            {user.topSection}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">TOP FEATURE</span>
                          <span className="text-xs font-medium truncate max-w-[120px]">
                            {user.topFeature}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Last Active */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Last Active</span>
                        <span className="text-xs font-medium">
                          {user.lastActive 
                            ? formatDistanceToNow(new Date(user.lastActive), { addSuffix: true })
                            : 'Never'
                          }
                        </span>
                      </div>
                    </div>

                    {/* Features Preview */}
                    {user.featuresUsed.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">FEATURES USED</span>
                        <div className="flex flex-wrap gap-1">
                          {user.featuresUsed.slice(0, 3).map((feature, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs px-2 py-0">
                              {feature}
                            </Badge>
                          ))}
                          {user.featuresUsed.length > 3 && (
                            <Badge variant="outline" className="text-xs px-2 py-0 bg-muted">
                              +{user.featuresUsed.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity Log</CardTitle>
              <div className="flex gap-2">
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="View">View</SelectItem>
                    <SelectItem value="Create">Create</SelectItem>
                    <SelectItem value="Update">Update</SelectItem>
                    <SelectItem value="Delete">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {activityLogs?.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <Badge variant="outline">{log.action}</Badge>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{log.userName || 'Unknown User'}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.feature} in {log.section}
                          {log.page && ` (${log.page})`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {format(new Date(log.createdAt), 'MMM dd, HH:mm')}
                        </p>
                        {log.duration && (
                          <p className="text-xs text-muted-foreground">
                            {log.duration}s duration
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Most Used Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Most Used Features
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Features with highest user engagement
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemStats?.topFeatures?.filter(f => f.feature && f.feature !== 'Unknown').slice(0, 6).map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          idx === 0 ? 'bg-green-500' : 
                          idx === 1 ? 'bg-blue-500' : 
                          idx === 2 ? 'bg-purple-500' : 'bg-gray-400'
                        }`} />
                        <span className="text-sm font-medium">{feature.feature}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold">{feature.usage}</span>
                        <p className="text-xs text-muted-foreground">
                          {feature.feature !== 'Unknown' ? 'uses' : 'unknown'}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No feature data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Most Visited Sections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Most Visited Sections
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Platform areas with highest traffic
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemStats?.topSections?.filter(s => s.section && s.section !== 'General' && s.section !== 'Unknown').slice(0, 6).map((section, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <Badge className={getSectionColor(section.section)} variant="outline">
                        {section.section.replace('/api/', '').replace('/', '')}
                      </Badge>
                      <div className="text-right">
                        <span className="text-sm font-bold">{section.actions || section.usage}</span>
                        <p className="text-xs text-muted-foreground">actions</p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No section data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* User Engagement Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  User Engagement
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Overall platform activity patterns
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Active Users</span>
                      <span>{systemStats?.activeUsers || 0} of {systemStats?.totalUsers || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ 
                          width: `${systemStats?.totalUsers ? (systemStats.activeUsers / systemStats.totalUsers) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium">Average Actions per User</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round(systemStats?.averageActionsPerUser || 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Total Sessions</p>
                    <p className="text-lg font-bold">
                      {detailedActivities?.reduce((sum, user) => sum + user.sessionsCount, 0) || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analysis for All Users or Selected User */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-600" />
                  {selectedUser === 'all' ? 'All Users Activity Breakdown' : 'Individual User Analysis'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedUser === 'all' 
                    ? 'Comprehensive platform usage overview' 
                    : 'Detailed activity analysis for selected user'
                  }
                </p>
              </CardHeader>
              <CardContent>
                {selectedUser === 'all' ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Active vs Inactive Users</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Active Users (with activity)</span>
                          <span className="font-bold text-green-600">
                            {detailedActivities?.filter(u => u.totalActions > 0).length || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Inactive Users (no activity)</span>
                          <span className="font-bold text-red-600">
                            {detailedActivities?.filter(u => u.totalActions === 0).length || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Top Active Users</h4>
                      <div className="space-y-2">
                        {detailedActivities
                          ?.filter(u => u.totalActions > 0)
                          .slice(0, 5)
                          .map((user, idx) => (
                            <div key={user.userId} className="flex justify-between">
                              <span className="text-sm">
                                {user.firstName} {user.lastName}
                              </span>
                              <span className="font-bold">
                                {user.totalActions} actions
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  // Individual user analysis would go here when a specific user is selected
                  <div className="space-y-3">
                    {selectedUser !== 'all' && detailedActivities && (
                      (() => {
                        const user = detailedActivities.find(u => u.userId === selectedUser);
                        if (!user) return <p>User not found</p>;
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Total Actions</p>
                                <p className="text-2xl font-bold">{user.totalActions}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Sessions</p>
                                <p className="text-2xl font-bold">{user.sessionsCount}</p>
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Features Used</p>
                              <div className="flex flex-wrap gap-1">
                                {user.featuresUsed.map((feature, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {feature}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Section Activity</p>
                              <div className="space-y-2">
                                {user.sectionBreakdown?.map((section, idx) => (
                                  <div key={idx} className="flex justify-between">
                                    <span className="text-sm">{section.section}</span>
                                    <span className="font-medium">{section.actions} actions</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-red-600" />
                  Areas Needing Attention
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Features and sections that may need improvement
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 text-red-600">Unused Features</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Platform features that haven't been accessed recently
                    </p>
                    <div className="space-y-1">
                      {/* This would need to be calculated based on all available features vs used features */}
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                        Unknown Features
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Consider user training or interface improvements
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2 text-orange-600">Low Engagement</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Users with 0 actions</span>
                        <span className="font-bold text-orange-600">
                          {detailedActivities?.filter(u => u.totalActions === 0).length || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Users with 1-2 actions</span>
                        <span className="font-bold text-orange-600">
                          {detailedActivities?.filter(u => u.totalActions > 0 && u.totalActions <= 2).length || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2 text-green-600">Recommendations</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Focus on onboarding inactive users</li>
                      <li>• Improve discoverability of unused features</li>
                      <li>• Analyze user paths to identify friction points</li>
                      <li>• Consider user feedback for feature improvements</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}