import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle, Clock, Users, Award, Mail, ChevronDown, ChevronRight, Heart } from 'lucide-react';
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
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const sendKudosMutation = useMutation({
    mutationFn: async ({ userId, challengeId }: { userId: string; challengeId: number }) => {
      return await apiRequest('POST', '/api/kudos/send', {
        recipientId: userId,
        contextType: 'onboarding_challenge',
        contextId: challengeId,
        message: 'Great work completing this onboarding challenge!',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Kudos Sent!',
        description: 'Recognition has been sent successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/admin/users-progress'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send kudos. Please try again.',
        variant: 'destructive',
      });
    },
  });

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
              const isExpanded = expandedUsers.has(user.userId);

              return (
                <div key={user.userId} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  {/* User Header - Clickable */}
                  <div
                    onClick={() => toggleUserExpanded(user.userId)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{user.userName}</h3>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Progress</p>
                        <p className="text-lg font-bold text-brand-primary">
                          {user.completionCount}
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

                  {/* Expanded Content - Challenge Details */}
                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50">
                      {completedChallenges.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Completed Challenges ({completedChallenges.length})
                          </h4>
                          {completedChallenges.map((challenge) => (
                            <div
                              key={challenge.challengeId}
                              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{challenge.challengeTitle}</p>
                                  <p className="text-xs text-gray-500">
                                    Completed: {challenge.completedAt ? new Date(challenge.completedAt).toLocaleDateString() : 'N/A'}
                                  </p>
                                  <p className="text-xs text-gray-600">Points: {challenge.points}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {challenge.kudosSent ? (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                    <Heart className="w-3 h-3 mr-1 fill-green-600" />
                                    Kudos Sent
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendKudosMutation.mutate({ userId: user.userId, challengeId: challenge.challengeId })}
                                    disabled={sendKudosMutation.isPending}
                                    className="text-xs"
                                  >
                                    <Heart className="w-3 h-3 mr-1" />
                                    Send Kudos
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 italic text-sm">
                          No challenges completed yet
                        </div>
                      )}
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
