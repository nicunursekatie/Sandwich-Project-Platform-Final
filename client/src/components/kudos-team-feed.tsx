import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Heart, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TeamFeedKudos {
  id: number;
  content: string;
  message: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  contextType: 'task' | 'project' | 'general' | string;
  contextId: string;
  entityName: string;
  projectTitle: string;
  createdAt: string;
}

/**
 * Shared recognition feed. Shows recent kudos sent across the whole
 * team — who recognized whom, for what. Built to complement the
 * per-user "Your Kudos" inbox rather than replace it.
 *
 * Lives behind /api/messaging/kudos/team-feed which is authenticated
 * but not user-scoped — every authenticated user sees the same feed.
 */
export function KudosTeamFeed() {
  const { data: feed = [], isLoading } = useQuery<TeamFeedKudos[]>({
    queryKey: ['/api/messaging/kudos/team-feed'],
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading team kudos…
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">No kudos sent yet</p>
          <p className="text-sm mt-1">
            Recognition will appear here as the team celebrates each other's
            work.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {feed.map((k) => (
        <Card key={k.id} className="border-l-4 border-l-amber-400">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <Heart className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-snug">
                  <span className="font-semibold text-gray-900">
                    {k.senderName}
                  </span>{' '}
                  gave kudos to{' '}
                  <span className="font-semibold text-gray-900">
                    {k.recipientName}
                  </span>
                  {k.entityName && k.entityName !== 'Unknown' && (
                    <>
                      {' '}for{' '}
                      <span className="text-gray-800">{k.entityName}</span>
                    </>
                  )}
                  .
                </p>
                {k.message && (
                  <p className="text-sm text-gray-600 italic mt-1 leading-snug">
                    "{k.message}"
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(k.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
