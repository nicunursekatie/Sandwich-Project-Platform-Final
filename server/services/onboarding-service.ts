import { db } from '../db';
import { onboardingChallenges, onboardingProgress } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export interface ChallengeWithProgress {
  id: number;
  actionKey: string;
  title: string;
  description: string | null;
  category: string;
  points: number;
  icon: string | null;
  order: number;
  isCompleted: boolean;
  completedAt: Date | null;
}

export interface UserStats {
  totalPoints: number;
  completedChallenges: number;
  totalChallenges: number;
  completionPercentage: number;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  completedChallenges: number;
  rank: number;
}

export class OnboardingService {
  /**
   * Get all challenges with user's progress
   */
  async getChallengesForUser(userId: string): Promise<ChallengeWithProgress[]> {
    const challenges = await db
      .select({
        id: onboardingChallenges.id,
        actionKey: onboardingChallenges.actionKey,
        title: onboardingChallenges.title,
        description: onboardingChallenges.description,
        category: onboardingChallenges.category,
        points: onboardingChallenges.points,
        icon: onboardingChallenges.icon,
        order: onboardingChallenges.order,
        completedAt: onboardingProgress.completedAt,
      })
      .from(onboardingChallenges)
      .leftJoin(
        onboardingProgress,
        and(
          eq(onboardingProgress.challengeId, onboardingChallenges.id),
          eq(onboardingProgress.userId, userId)
        )
      )
      .where(eq(onboardingChallenges.isActive, true))
      .orderBy(onboardingChallenges.order);

    return challenges.map((c) => ({
      ...c,
      isCompleted: !!c.completedAt,
    }));
  }

  /**
   * Track challenge completion
   */
  async trackChallengeCompletion(
    userId: string,
    actionKey: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; points?: number; message?: string }> {
    try {
      // Find the challenge
      const challenge = await db
        .select()
        .from(onboardingChallenges)
        .where(
          and(
            eq(onboardingChallenges.actionKey, actionKey),
            eq(onboardingChallenges.isActive, true)
          )
        )
        .limit(1);

      if (challenge.length === 0) {
        return { success: false, message: 'Challenge not found' };
      }

      const challengeData = challenge[0];

      // Check if already completed
      const existing = await db
        .select()
        .from(onboardingProgress)
        .where(
          and(
            eq(onboardingProgress.userId, userId),
            eq(onboardingProgress.challengeId, challengeData.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return {
          success: false,
          message: 'Challenge already completed',
        };
      }

      // Record completion
      await db.insert(onboardingProgress).values({
        userId,
        challengeId: challengeData.id,
        metadata: metadata || {},
      });

      return {
        success: true,
        points: challengeData.points,
        message: `Completed: ${challengeData.title}`,
      };
    } catch (error) {
      console.error('Error tracking challenge completion:', error);
      return {
        success: false,
        message: 'Failed to track challenge completion',
      };
    }
  }

  /**
   * Get user stats
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const [completed, total] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          points: sql<number>`coalesce(sum(${onboardingChallenges.points}), 0)::int`,
        })
        .from(onboardingProgress)
        .innerJoin(
          onboardingChallenges,
          eq(onboardingProgress.challengeId, onboardingChallenges.id)
        )
        .where(eq(onboardingProgress.userId, userId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(onboardingChallenges)
        .where(eq(onboardingChallenges.isActive, true)),
    ]);

    const completedCount = completed[0]?.count || 0;
    const totalCount = total[0]?.count || 0;
    const totalPoints = completed[0]?.points || 0;

    return {
      totalPoints,
      completedChallenges: completedCount,
      totalChallenges: totalCount,
      completionPercentage:
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  }

  /**
   * Get leaderboard - includes all active users, even those with 0 points
   */
  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    const { users } = await import('@shared/schema');

    // Get all active users with their progress
    const results = await db
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        totalPoints: sql<number>`coalesce(sum(${onboardingChallenges.points}), 0)::int`,
        completedChallenges: sql<number>`coalesce(count(${onboardingProgress.id}), 0)::int`,
      })
      .from(users)
      .leftJoin(
        onboardingProgress,
        eq(users.id, onboardingProgress.userId)
      )
      .leftJoin(
        onboardingChallenges,
        eq(onboardingProgress.challengeId, onboardingChallenges.id)
      )
      .where(eq(users.isActive, true))
      .groupBy(users.id, users.firstName, users.lastName)
      .orderBy(
        desc(sql`coalesce(sum(${onboardingChallenges.points}), 0)`),
        users.firstName
      )
      .limit(limit);

    return results.map((r, index) => ({
      userId: r.userId,
      userName: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'User',
      totalPoints: r.totalPoints,
      completedChallenges: r.completedChallenges,
      rank: index + 1,
    }));
  }

  /**
   * Initialize default challenges
   */
  async initializeDefaultChallenges(): Promise<void> {
    const defaultChallenges = [
      // Communication challenges
      {
        actionKey: 'chat_first_message',
        title: 'Send your first chat message',
        description: 'Join the conversation! Send a message in the team chat.',
        category: 'communication',
        points: 10,
        icon: 'MessageCircle',
        order: 1,
      },
      {
        actionKey: 'chat_read_messages',
        title: 'Read team messages',
        description: 'Stay informed! Check out messages in the team chat.',
        category: 'communication',
        points: 5,
        icon: 'Eye',
        order: 2,
      },
      {
        actionKey: 'inbox_send_email',
        title: 'Send an inbox message',
        description: 'Reach out to a team member through the inbox.',
        category: 'communication',
        points: 10,
        icon: 'Mail',
        order: 3,
      },

      // Documents challenges
      {
        actionKey: 'view_important_documents',
        title: 'View Important Documents',
        description: 'Check out the Important Documents section on the dashboard.',
        category: 'documents',
        points: 10,
        icon: 'FileText',
        order: 4,
      },
      {
        actionKey: 'view_important_links',
        title: 'Explore Important Links',
        description: 'Visit the Important Links page to find useful resources.',
        category: 'documents',
        points: 10,
        icon: 'Link',
        order: 5,
      },

      // Team challenges
      {
        actionKey: 'view_team_board',
        title: 'Check the Team Board',
        description: 'See what the team is working on! Visit the Team Board.',
        category: 'team',
        points: 15,
        icon: 'Users',
        order: 6,
      },
      {
        actionKey: 'post_team_board',
        title: 'Post to Team Board',
        description: 'Share an update! Create a post on the Team Board.',
        category: 'team',
        points: 20,
        icon: 'PlusCircle',
        order: 7,
      },
      {
        actionKey: 'like_team_board_post',
        title: 'Like a Team Board post',
        description: 'Show appreciation! Like a post on the Team Board.',
        category: 'team',
        points: 5,
        icon: 'Heart',
        order: 8,
      },

      // Project challenges
      {
        actionKey: 'view_projects',
        title: 'Explore Projects',
        description: 'See what projects are in the works! Visit the Projects page.',
        category: 'projects',
        points: 10,
        icon: 'Briefcase',
        order: 9,
      },
      {
        actionKey: 'view_meetings',
        title: 'Check Meeting Notes',
        description: 'Stay in the loop! Review the Meetings page.',
        category: 'projects',
        points: 10,
        icon: 'Calendar',
        order: 10,
      },
    ];

    // Insert challenges if they don't exist
    for (const challenge of defaultChallenges) {
      const existing = await db
        .select()
        .from(onboardingChallenges)
        .where(eq(onboardingChallenges.actionKey, challenge.actionKey))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(onboardingChallenges).values(challenge);
      }
    }

    console.log('✅ Default onboarding challenges initialized');
  }
}

export const onboardingService = new OnboardingService();
