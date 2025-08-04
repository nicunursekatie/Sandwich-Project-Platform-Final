import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Calendar, Users, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'event' | 'position' | 'alert' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  isActive: boolean;
  link?: string;
  linkText?: string;
}

export default function AnnouncementBanner() {
  const [dismissedBanners, setDismissedBanners] = useState<number[]>(() => {
    const saved = localStorage.getItem('dismissedBanners');
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch active announcements
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Filter active announcements that haven't been dismissed
  const activeAnnouncements = announcements.filter(announcement => {
    const now = new Date();
    const startDate = new Date(announcement.startDate);
    const endDate = new Date(announcement.endDate);
    
    return announcement.isActive && 
           now >= startDate && 
           now <= endDate && 
           !dismissedBanners.includes(announcement.id);
  });

  // Get highest priority announcement
  const currentAnnouncement = activeAnnouncements.sort((a, b) => {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  })[0];

  const dismissBanner = (id: number) => {
    const updated = [...dismissedBanners, id];
    setDismissedBanners(updated);
    localStorage.setItem('dismissedBanners', JSON.stringify(updated));
  };

  // Clear dismissed banners daily
  useEffect(() => {
    const lastClear = localStorage.getItem('lastBannerClear');
    const today = new Date().toDateString();
    
    if (lastClear !== today) {
      setDismissedBanners([]);
      localStorage.setItem('dismissedBanners', JSON.stringify([]));
      localStorage.setItem('lastBannerClear', today);
    }
  }, []);

  if (!currentAnnouncement) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'event': return <Calendar className="w-5 h-5" />;
      case 'position': return <Users className="w-5 h-5" />;
      case 'alert': return <AlertCircle className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getBannerStyles = (priority: string, type: string) => {
    const baseStyles = "border-l-4 shadow-sm";
    
    if (priority === 'urgent') {
      return `${baseStyles} bg-red-50 border-red-500 text-red-900`;
    }
    if (priority === 'high') {
      return `${baseStyles} bg-orange-50 border-orange-500 text-orange-900`;
    }
    if (type === 'event') {
      return `${baseStyles} bg-blue-50 border-blue-500 text-blue-900`;
    }
    if (type === 'position') {
      return `${baseStyles} bg-green-50 border-green-500 text-green-900`;
    }
    if (type === 'alert') {
      return `${baseStyles} bg-yellow-50 border-yellow-500 text-yellow-900`;
    }
    return `${baseStyles} bg-blue-50 border-blue-500 text-blue-900`;
  };

  return (
    <div className={`w-full px-4 py-4 ${getBannerStyles(currentAnnouncement.priority, currentAnnouncement.type)} border-b-2 shadow-md relative overflow-hidden`}>
      {/* Subtle animation for emphasis */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-30"></div>
      
      <div className="max-w-7xl mx-auto flex items-start justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5 p-1 rounded-full bg-white/20">
            {getIcon(currentAnnouncement.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-base">
                {currentAnnouncement.title}
              </h3>
              <span className="text-xs px-2 py-1 bg-white/30 rounded-full font-semibold uppercase tracking-wide">
                {currentAnnouncement.priority}
              </span>
            </div>
            <p className="text-sm leading-relaxed font-medium">
              {currentAnnouncement.message}
            </p>
            {currentAnnouncement.link && (
              <a 
                href={currentAnnouncement.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-sm font-bold underline hover:no-underline bg-white/20 px-2 py-1 rounded"
              >
                {currentAnnouncement.linkText || 'Learn More'}
              </a>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dismissBanner(currentAnnouncement.id)}
          className="flex-shrink-0 h-8 w-8 p-0 hover:bg-white/20 rounded-full border-2 border-white/30"
        >
          <X className="w-4 h-4 font-bold" />
        </Button>
      </div>
    </div>
  );
}