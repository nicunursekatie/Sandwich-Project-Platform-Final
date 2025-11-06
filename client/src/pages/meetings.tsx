import { useEffect } from 'react';
import EnhancedMeetingDashboard from '@/components/enhanced-meeting-dashboard';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';

interface MeetingsPageProps {
  onNavigate?: (section: string) => void;
}

export default function MeetingsPage({ onNavigate }: MeetingsPageProps) {
  const { track } = useOnboardingTracker();

  // Track that user has viewed meetings page
  // Note: track is not memoized in useOnboardingTracker, so we intentionally
  // use an empty dependency array to only track once on mount
  useEffect(() => {
    track('view_meetings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <EnhancedMeetingDashboard />;
}
