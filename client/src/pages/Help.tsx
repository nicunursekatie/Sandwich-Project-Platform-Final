import { useState, useMemo, useRef } from 'react';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  FolderOpen,
  Calendar,
  BarChart3,
  ListTodo,
  Users,
  FileImage,
  ClipboardList,
  TrendingUp,
  LayoutDashboard,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TOURS, TOUR_CATEGORIES, type TourCategory, type Tour } from '@/lib/tourDefinitions';

interface HelpTopic {
  id: string;
  title: string;
  description: string;
  category: TourCategory;
  icon: any;
  content: {
    summary: string;
    steps: string[];
    tips?: string[];
  };
  tourId?: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'finding-logos',
    title: 'Finding TSP Logos',
    description: 'Learn where to find all TSP brand logos and marketing assets',
    category: 'files-resources',
    icon: FileImage,
    tourId: 'find-logos',
    content: {
      summary: 'The Sandwich Project logos are stored in the LOGOS folder within the Toolkit tab of Important Documents.',
      steps: [
        'Navigate to "Important Documents" from the main menu',
        'Click on the "Toolkit" tab at the top',
        'Find and click on the "LOGOS" folder',
        'Download logos in various formats (PNG, JPG, transparent backgrounds)',
      ],
      tips: [
        'Use the transparent background logos for overlaying on different backgrounds',
        'CMYK versions are best for print materials',
        'RGB versions are optimized for digital/web use',
      ],
    },
  },
  {
    id: 'sandwich-signin-forms',
    title: 'Sandwich Sign-In Forms',
    description: 'Access forms used at sandwich collection events',
    category: 'files-resources',
    icon: ClipboardList,
    tourId: 'sandwich-signin-forms',
    content: {
      summary: 'Sign-in forms are used to track participants at sandwich collection events and are stored in the Toolkit.',
      steps: [
        'Go to "Important Documents" in the navigation',
        'Select the "Toolkit" tab',
        'Look for "SandwichSigninNoEmail.pdf" or similar sign-in form files',
        'Download and print the forms for your event',
      ],
      tips: [
        'Print enough forms for expected participants',
        'Forms help track volunteer hours and participation',
        'Submit completed forms to the admin team after events',
      ],
    },
  },
  {
    id: 'analytics-tabs',
    title: 'Analytics Dashboard Overview',
    description: 'Understanding the different analytics tabs and what they show',
    category: 'analytics-reports',
    icon: TrendingUp,
    tourId: 'analytics-overview',
    content: {
      summary: 'The Analytics dashboard provides comprehensive insights into TSP\'s impact and performance across multiple views.',
      steps: [
        'Navigate to "Analytics" from the main menu',
        'Impact Dashboard: View overall community impact, collection trends, and key metrics',
        'Host Analytics: See detailed performance metrics for individual hosts',
        'Breakdown Analytics: Analyze data by location, time period, and other dimensions',
        'Use filters and date ranges to customize your view',
      ],
      tips: [
        'Export data as CSV or PDF for reports and presentations',
        'Compare different time periods to identify trends',
        'Use the visual charts to communicate impact to stakeholders',
      ],
    },
  },
  {
    id: 'action-hub',
    title: 'Using My Actions Hub',
    description: 'Your central hub for all assigned tasks and responsibilities',
    category: 'my-work',
    icon: ListTodo,
    tourId: 'action-hub-guide',
    content: {
      summary: 'My Actions is your personal dashboard where all tasks assigned to you are collected in one place.',
      steps: [
        'Click on "My Actions" in the navigation menu',
        'View all tasks across different categories (events, projects, etc.)',
        'Use filters to see: All, Pending, Completed, or Overdue tasks',
        'Click on any task to view details and take action',
        'Mark tasks as complete when finished',
      ],
      tips: [
        'Check My Actions daily to stay on top of your responsibilities',
        'Overdue tasks are highlighted in red - prioritize these first',
        'Completed tasks remain visible for your records',
      ],
    },
  },
  {
    id: 'my-assignments-events',
    title: 'My Assignments in Event Requests',
    description: 'Find and manage events specifically assigned to you',
    category: 'my-work',
    icon: Calendar,
    tourId: 'event-requests-assignments',
    content: {
      summary: 'The My Assignments tab in Event Requests shows only events where you have specific responsibilities.',
      steps: [
        'Navigate to "Event Requests" from the menu',
        'Click on the "My Assignments" tab',
        'View all events where you are assigned',
        'Click on an event card to see your specific tasks',
        'Update status and complete required actions',
      ],
      tips: [
        'This view filters out all events not assigned to you',
        'Assignment types can include coordination, setup, or follow-up tasks',
        'Communicate with the event organizer if you have questions',
      ],
    },
  },
  {
    id: 'dashboard-assignments',
    title: 'Dashboard Assignments Widget',
    description: 'Quick overview of your assignments on the main dashboard',
    category: 'my-work',
    icon: LayoutDashboard,
    tourId: 'dashboard-assignments',
    content: {
      summary: 'The dashboard provides a quick snapshot of your current assignments without navigating to different sections.',
      steps: [
        'Go to the main "Dashboard"',
        'Locate the "My Assignments" widget',
        'See at-a-glance what needs your attention',
        'Click on any assignment to jump directly to that task',
      ],
      tips: [
        'The dashboard shows your most urgent assignments first',
        'Badges indicate the number of pending items',
        'Use this as your daily starting point',
      ],
    },
  },
  {
    id: 'calendar-view',
    title: 'Calendar View & Status Symbols',
    description: 'Understanding the event calendar and status indicators',
    category: 'events-calendar',
    icon: Calendar,
    tourId: 'calendar-symbols',
    content: {
      summary: 'The calendar view provides a visual timeline of events with color-coded status indicators.',
      steps: [
        'Navigate to "Event Requests"',
        'Click on the "Calendar" tab',
        'View events organized by date',
        'Understanding status symbols:',
        '  🟢 Green = Confirmed event',
        '  🟡 Yellow = Pending approval',
        '  🔵 Blue = In progress',
        '  ✅ Checkmark = Completed',
        'Click on any event for full details',
      ],
      tips: [
        'Use navigation arrows to view different months',
        'Hover over events for quick details',
        'Filter by status to focus on specific event types',
      ],
    },
  },
];

const CATEGORY_ICONS: Record<string, any> = {
  FolderOpen,
  Calendar,
  BarChart3,
  ListTodo,
  Users,
};

interface HelpProps {
  onLaunchTour?: (tourId: string) => void;
}

export default function Help({ onLaunchTour }: HelpProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TourCategory | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const filteredTopics = useMemo(() => {
    let topics = HELP_TOPICS;

    if (selectedCategory) {
      topics = topics.filter((topic) => topic.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      topics = topics.filter(
        (topic) =>
          topic.title.toLowerCase().includes(query) ||
          topic.description.toLowerCase().includes(query) ||
          topic.content.summary.toLowerCase().includes(query) ||
          topic.content.steps.some((step) => step.toLowerCase().includes(query))
      );
    }

    return topics;
  }, [searchQuery, selectedCategory]);

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const handleLaunchTour = (tourId: string) => {
    if (onLaunchTour) {
      onLaunchTour(tourId);
    } else {
      const tourButton = document.querySelector('[data-testid="tour-help-button"]');
      if (tourButton instanceof HTMLElement) {
        tourButton.click();
        setTimeout(() => {
          const tourItem = document.querySelector(`[data-testid="tour-${tourId}"]`);
          if (tourItem instanceof HTMLElement) {
            tourItem.click();
          }
        }, 300);
      }
    }
  };

  const topicsByCategory = useMemo(() => {
    const grouped: Record<TourCategory, HelpTopic[]> = {
      'files-resources': [],
      'events-calendar': [],
      'analytics-reports': [],
      'my-work': [],
      'team-management': [],
    };

    filteredTopics.forEach((topic) => {
      grouped[topic.category].push(topic);
    });

    return grouped;
  }, [filteredTopics]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#236383] to-[#007e8c] flex items-center justify-center shadow-lg">
              <HelpCircle className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100" data-testid="help-title">
                Help Center
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
                Find answers and learn how to use The Sandwich Project platform
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8 border-2 border-[#fbad3f]/20">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search help topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base border-2 focus:border-[#236383]"
                  data-testid="help-search"
                />
              </div>

              {/* Category Filters */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    'transition-all',
                    selectedCategory === null &&
                      'bg-gradient-to-r from-[#236383] to-[#007e8c] hover:from-[#1a4d66] hover:to-[#006270]'
                  )}
                  data-testid="filter-all"
                >
                  All Topics
                </Button>
                {Object.entries(TOUR_CATEGORIES).map(([key, category]) => {
                  const IconComponent = CATEGORY_ICONS[category.icon];
                  return (
                    <Button
                      key={key}
                      variant={selectedCategory === key ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(key as TourCategory)}
                      className={cn(
                        'transition-all',
                        selectedCategory === key &&
                          'bg-gradient-to-r from-[#236383] to-[#007e8c] hover:from-[#1a4d66] hover:to-[#006270]'
                      )}
                      data-testid={`filter-${key}`}
                    >
                      {IconComponent && <IconComponent className="w-4 h-4 mr-2" />}
                      {category.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Topics */}
        {filteredTopics.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                No results found
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Try adjusting your search or browse all topics
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(topicsByCategory).map(([categoryKey, topics]) => {
              if (topics.length === 0) return null;

              const category = TOUR_CATEGORIES[categoryKey as TourCategory];
              const CategoryIcon = CATEGORY_ICONS[category.icon];

              return (
                <div key={categoryKey} data-testid={`category-${categoryKey}`}>
                  <div className="flex items-center gap-3 mb-4">
                    {CategoryIcon && (
                      <div className="w-10 h-10 rounded-lg bg-[#007e8c]/10 flex items-center justify-center">
                        <CategoryIcon className="w-5 h-5 text-[#007e8c]" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {category.label}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {topics.map((topic) => {
                      const isExpanded = expandedTopics.has(topic.id);
                      const TopicIcon = topic.icon;

                      return (
                        <Collapsible
                          key={topic.id}
                          open={isExpanded}
                          onOpenChange={() => toggleTopic(topic.id)}
                        >
                          <Card
                            className={cn(
                              'transition-all hover:shadow-md border-2',
                              isExpanded ? 'border-[#fbad3f] shadow-lg' : 'border-transparent'
                            )}
                            data-testid={`topic-${topic.id}`}
                          >
                            <CollapsibleTrigger asChild>
                              <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-4 flex-1">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#236383]/10 to-[#007e8c]/10 flex items-center justify-center flex-shrink-0">
                                      <TopicIcon className="w-6 h-6 text-[#236383]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-xl mb-2 text-slate-900 dark:text-slate-100">
                                        {topic.title}
                                      </CardTitle>
                                      <CardDescription className="text-base">
                                        {topic.description}
                                      </CardDescription>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {topic.tourId && (
                                      <Badge
                                        variant="secondary"
                                        className="bg-[#fbad3f]/10 text-[#fbad3f] border-[#fbad3f]/20"
                                      >
                                        <PlayCircle className="w-3 h-3 mr-1" />
                                        Tour Available
                                      </Badge>
                                    )}
                                    <div
                                      className={cn(
                                        'w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-transform',
                                        isExpanded && 'rotate-180'
                                      )}
                                    >
                                      <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <CardContent className="pt-0 pb-6">
                                <div className="space-y-6">
                                  {/* Summary */}
                                  <div className="bg-[#007e8c]/5 border-l-4 border-[#007e8c] p-4 rounded-r-lg">
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {topic.content.summary}
                                    </p>
                                  </div>

                                  {/* Steps */}
                                  <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-md bg-[#236383] text-white flex items-center justify-center text-sm">
                                        1
                                      </div>
                                      Step-by-Step Guide
                                    </h4>
                                    <ol className="space-y-2">
                                      {topic.content.steps.map((step, index) => (
                                        <li key={index} className="flex gap-3 text-slate-700 dark:text-slate-300">
                                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#fbad3f]/20 text-[#fbad3f] flex items-center justify-center text-sm font-semibold">
                                            {index + 1}
                                          </span>
                                          <span className="flex-1 pt-0.5">{step}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  </div>

                                  {/* Tips */}
                                  {topic.content.tips && topic.content.tips.length > 0 && (
                                    <div className="bg-[#fbad3f]/5 border border-[#fbad3f]/20 rounded-lg p-4">
                                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                        <HelpCircle className="w-5 h-5 text-[#fbad3f]" />
                                        Pro Tips
                                      </h4>
                                      <ul className="space-y-2">
                                        {topic.content.tips.map((tip, index) => (
                                          <li key={index} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                                            <ChevronRight className="w-4 h-4 text-[#fbad3f] flex-shrink-0 mt-0.5" />
                                            <span>{tip}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Launch Tour Button */}
                                  {topic.tourId && (
                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                      <Button
                                        onClick={() => handleLaunchTour(topic.tourId!)}
                                        className="w-full bg-gradient-to-r from-[#236383] to-[#007e8c] hover:from-[#1a4d66] hover:to-[#006270] text-white shadow-md hover:shadow-lg transition-all"
                                        size="lg"
                                        data-testid={`launch-tour-${topic.id}`}
                                      >
                                        <PlayCircle className="w-5 h-5 mr-2" />
                                        Launch Interactive Tour
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Note */}
        <Card className="mt-8 bg-gradient-to-r from-[#236383]/5 to-[#007e8c]/5 border-2 border-[#007e8c]/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#007e8c]/10 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-6 h-6 text-[#007e8c]" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Need More Help?
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-3">
                  Can't find what you're looking for? Our interactive tours provide step-by-step guidance
                  for each feature. Click the floating help button (
                  <HelpCircle className="w-4 h-4 inline mx-1" />) in the bottom-right corner to browse
                  all available tours.
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  For additional assistance, contact your team administrator or reach out through the Team Chat.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
