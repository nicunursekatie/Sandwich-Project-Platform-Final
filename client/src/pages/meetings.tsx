import EnhancedMeetingDashboard from "@/components/enhanced-meeting-dashboard";

interface MeetingsPageProps {
  onNavigate?: (section: string) => void;
}

export default function MeetingsPage({ onNavigate }: MeetingsPageProps) {
  return <EnhancedMeetingDashboard />;
}