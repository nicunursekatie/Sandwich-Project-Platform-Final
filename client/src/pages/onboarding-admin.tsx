import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle, Clock, Users, Award, Mail } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ChallengeCompletion {
  challengeId: number;
  challengeTitle: string;
  points: number;
  completedAt: string | null;
  kudosSent: boolean;
}

interface UserProgress {
  userId: string;
  userName: string;
  email: string;
  role: string;
  completedChallenges: ChallengeCompletion[];
  totalPoints: number;
  completionCount: number;
}

export default function OnboardingAdmin() {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const { data: usersProgress = [], isLoading } = useQuery<UserProgress[]>({
    queryKey: ['/api/onboarding/admin/users-progress'],
  });

  const sendAnnouncementMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/onboarding/admin/send-announcement', {});
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Emails Sent!',
        description: `Successfully sent ${data.successCount} emails to active users.${data.failedCount > 0 ? ` ${data.failedCount} failed.` : ''}`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send announcement emails. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSendAnnouncement = () => {
    const confirmed = window.confirm(
      `This will send the onboarding challenge announcement email to ${totalUsers} active users.\n\nThe email emphasizes that challenges are optional, self-paced, and have zero pressure.\n\nDo you want to proceed?`
    );

    if (confirmed) {
      sendAnnouncementMutation.mutate();
    }
  };

  // Filter users based on search
  const filteredUsers = usersProgress.filter((user) =>
    user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalUsers = usersProgress.length;
  const usersWithProgress = usersProgress.filter(u => u.completionCount > 0).length;
  const avgChallengesCompleted = usersProgress.length > 0
    ? (usersProgress.reduce((sum, u) => sum + u.completionCount, 0) / usersProgress.length).toFixed(1)
    : 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary mb-2">
            Onboarding Challenge Progress
          </h1>
          <p className="text-gray-600">
            Track user engagement with onboarding challenges across the platform
          </p>
        </div>
        <Button
          onClick={handleSendAnnouncement}
          disabled={sendAnnouncementMutation.isPending}
          className="bg-brand-primary hover:bg-brand-teal"
        >
          <Mail className="w-4 h-4 mr-2" />
          {sendAnnouncementMutation.isPending ? 'Sending...' : 'Send Announcement Email'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-brand-primary">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Users with Progress</p>
                <p className="text-2xl font-bold text-green-600">{usersWithProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg. Challenges Completed</p>
                <p className="text-2xl font-bold text-brand-orange">{avgChallengesCompleted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      {/* Users Progress Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Challenge Completion Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              // Create a map of completed challenge IDs for quick lookup
              const completedChallenges = Array.isArray(user.completedChallenges)
                ? user.completedChallenges
                : [];
              const completedChallengeIds = new Set(
                completedChallenges.map(c => c.challengeId)
              );

              return (
                <div key={user.userId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  {/* User Header */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.userName}</h3>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Progress</p>
                        <p className="text-lg font-bold text-brand-primary">
                          {user.completionCount}/10
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Points</p>
                        <p className="text-lg font-bold text-brand-orange">
                          {user.totalPoints}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Challenge Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {completedChallenges.map((challenge) => (
                      <div
                        key={challenge.challengeId}
                        className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-2 py-1.5"
                        title={`Completed: ${challenge.completedAt ? new Date(challenge.completedAt).toLocaleDateString() : 'N/A'}`}
                      >
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-xs text-green-900 truncate">
                          {challenge.challengeTitle}
                        </span>
                      </div>
                    ))}
                  </div>

                  {user.completionCount === 0 && (
                    <div className="text-center py-6 text-gray-400 italic text-sm">
                      No challenges completed yet
                    </div>
                  )}
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No users found matching your search.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
