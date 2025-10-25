import { useEffect } from 'react';
import EnhancedMeetingDashboard from '@/components/enhanced-meeting-dashboard';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';

interface MeetingsPageProps {
  onNavigate?: (section: string) => void;
}

export default function MeetingsPage({ onNavigate }: MeetingsPageProps) {
  const { track } = useOnboardingTracker();

  // Track that user has viewed meetings page
  useEffect(() => {
    track('view_meetings');
  }, [track]);

  return <EnhancedMeetingDashboard />;
}
