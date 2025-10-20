export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  navigationAction?: {
    section: string;
    tab?: string;
  };
  highlightPadding?: number;
  beforeShow?: () => void;
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  category: TourCategory;
  icon: string;
  steps: TourStep[];
  estimatedTime?: string;
}

export type TourCategory = 
  | 'files-resources'
  | 'events-calendar'
  | 'analytics-reports'
  | 'my-work'
  | 'team-management';

export const TOUR_CATEGORIES: Record<TourCategory, { label: string; icon: string; description: string }> = {
  'files-resources': {
    label: 'Files & Resources',
    icon: 'FolderOpen',
    description: 'Find documents, logos, and important files'
  },
  'events-calendar': {
    label: 'Events & Calendar',
    icon: 'Calendar',
    description: 'Manage events, requests, and scheduling'
  },
  'analytics-reports': {
    label: 'Analytics & Reports',
    icon: 'BarChart3',
    description: 'View data insights and performance metrics'
  },
  'my-work': {
    label: 'My Work',
    icon: 'ListTodo',
    description: 'Track your assignments and tasks'
  },
  'team-management': {
    label: 'Team Management',
    icon: 'Users',
    description: 'Manage team members and collaboration'
  }
};

export const TOURS: Tour[] = [
  {
    id: 'find-logos',
    title: 'Finding TSP Logos',
    description: 'Learn where to find all TSP brand logos and assets',
    category: 'files-resources',
    icon: 'FileImage',
    estimatedTime: '1 min',
    steps: [
      {
        id: 'logos-nav',
        title: 'Welcome to Logo Finder!',
        description: 'Let me show you where to find all The Sandwich Project logos and brand assets. Click Next to begin.',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'logos-important-docs',
        title: 'Navigate to Important Documents',
        description: 'First, we need to go to Important Documents section. I\'ll take you there now.',
        targetSelector: '[data-nav-id="important-documents"]',
        position: 'right',
        navigationAction: {
          section: 'important-documents'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="important-documents"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'logos-tab',
        title: 'Click the Logos Tab',
        description: 'In Important Documents, click on the "Logos & Branding" tab to access all TSP brand logos.',
        targetSelector: '[data-testid="tab-logos"], [data-value="logos"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'logos-available',
        title: 'All Logos Available Here!',
        description: 'Here you\'ll find all The Sandwich Project logos in various formats - transparent backgrounds, print-ready CMYK versions, and more. Download any logo for your use.',
        targetSelector: '[data-testid="logos-grid"], .logo-card',
        position: 'top',
        highlightPadding: 12
      }
    ]
  },
  {
    id: 'sandwich-signin-forms',
    title: 'Sandwich Sign-In Forms',
    description: 'Locate sign-in forms for sandwich collection events',
    category: 'files-resources',
    icon: 'ClipboardList',
    estimatedTime: '1 min',
    steps: [
      {
        id: 'signin-nav',
        title: 'Finding Sign-In Forms',
        description: 'Let me guide you to the sandwich sign-in forms used at collection events.',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'signin-docs',
        title: 'Go to Important Documents',
        description: 'Sign-in forms are stored in Important Documents. Let\'s navigate there.',
        targetSelector: '[data-nav-id="important-documents"]',
        position: 'right',
        navigationAction: {
          section: 'important-documents'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="important-documents"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'signin-forms-filter',
        title: 'Click on Forms Category',
        description: 'In the Documents tab, click the "Forms" category button to see all available forms.',
        targetSelector: '[data-testid="category-forms"], [data-tour="category-forms"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'signin-forms-location',
        title: 'Sandwich Sign-In Form',
        description: 'Look for the "Sandwich Sign-In Form" card. This form is used at sandwich collection events to track participants without requiring email addresses.',
        targetSelector: '[data-testid="file-list"]',
        position: 'top',
        highlightPadding: 16
      }
    ]
  },
  {
    id: 'analytics-overview',
    title: 'Analytics Dashboard Tour',
    description: 'Explore impact metrics and host performance analytics',
    category: 'analytics-reports',
    icon: 'TrendingUp',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'analytics-nav',
        title: 'Welcome to Analytics!',
        description: 'Discover powerful insights about TSP\'s impact and performance. Let\'s explore the Analytics dashboard.',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'analytics-navigate',
        title: 'Open Analytics',
        description: 'Click on Analytics in the navigation to view all metrics and reports.',
        targetSelector: '[data-nav-id="analytics"]',
        position: 'right',
        navigationAction: {
          section: 'analytics'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="analytics"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'analytics-impact-tab',
        title: 'Impact Dashboard',
        description: 'The Impact Dashboard shows overall community impact, collection trends, and key metrics. This is your main analytics overview.',
        targetSelector: '[data-value="impact"], [data-testid="tab-impact"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'analytics-host-tab',
        title: 'Host Analytics',
        description: 'The Host Analytics tab provides detailed performance metrics for individual hosts, including collection history and trends.',
        targetSelector: '[data-value="hosts"], [data-testid="tab-hosts"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'analytics-metrics',
        title: 'Key Metrics',
        description: 'Use these analytics to track sandwiches collected, volunteer participation, and community impact over time. Export data for reports!',
        targetSelector: '[data-testid="metrics-container"], [data-testid="analytics-content"]',
        position: 'top',
        highlightPadding: 16
      }
    ]
  },
  {
    id: 'action-hub-guide',
    title: 'Action Hub - My Actions',
    description: 'Learn how to use your personal action hub',
    category: 'my-work',
    icon: 'ListTodo',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'action-hub-intro',
        title: 'Your Personal Action Hub',
        description: 'My Actions is your central hub for all assigned tasks and responsibilities. Let me show you around!',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'action-hub-nav',
        title: 'Navigate to My Actions',
        description: 'Find "My Actions" in the navigation menu. This is where all your tasks are collected.',
        targetSelector: '[data-nav-id="my-actions"]',
        position: 'right',
        navigationAction: {
          section: 'my-actions'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="my-actions"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'action-hub-filters',
        title: 'Filter Your Tasks',
        description: 'Use filters to view tasks by status: All, Pending, Completed, or Overdue. Stay organized!',
        targetSelector: '[data-testid="action-filters"], [data-testid="task-filters"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'action-hub-list',
        title: 'Your Task List',
        description: 'Here you\'ll see all tasks assigned to you across different categories: event requests, projects, and more.',
        targetSelector: '[data-testid="action-list"], [data-testid="task-list"]',
        position: 'left',
        highlightPadding: 16
      },
      {
        id: 'action-hub-complete',
        title: 'Complete Tasks',
        description: 'Click on any task to view details and mark it as complete. Keep your action list up-to-date!',
        targetSelector: '[data-testid="action-item"]:first-child, [data-testid="task-card"]:first-child',
        position: 'bottom',
        highlightPadding: 12
      }
    ]
  },
  {
    id: 'event-requests-assignments',
    title: 'My Assignments in Event Requests',
    description: 'Find and manage your assigned event requests',
    category: 'my-work',
    icon: 'Calendar',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'assignments-intro',
        title: 'Event Request Assignments',
        description: 'Learn how to find events that are specifically assigned to you in the Event Requests section.',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'assignments-nav',
        title: 'Open Event Requests',
        description: 'Navigate to Event Requests where all events are managed.',
        targetSelector: '[data-nav-id="event-requests"]',
        position: 'right',
        navigationAction: {
          section: 'event-requests'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="event-requests"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'assignments-my-tab',
        title: 'My Assignments Tab',
        description: 'Click on the "My Assignments" tab to see only events assigned to you. This filters out all other events.',
        targetSelector: '[data-value="my-assignments"], [data-testid="tab-my-assignments"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'assignments-list',
        title: 'Your Assigned Events',
        description: 'Here are all events where you have been assigned responsibilities. Click on any event to view details and complete your tasks.',
        targetSelector: '[data-testid="my-assignments-list"], [data-testid="event-cards"]',
        position: 'top',
        highlightPadding: 16
      },
      {
        id: 'assignments-actions',
        title: 'Take Action',
        description: 'Each event card shows your specific assignment. Click to open details, update status, or complete required actions.',
        targetSelector: '[data-testid="event-card"]:first-child',
        position: 'bottom',
        highlightPadding: 12
      }
    ]
  },
  {
    id: 'dashboard-assignments',
    title: 'Dashboard Assignments Overview',
    description: 'Quick view of your assignments on the main dashboard',
    category: 'my-work',
    icon: 'LayoutDashboard',
    estimatedTime: '1 min',
    steps: [
      {
        id: 'dash-assignments-intro',
        title: 'Dashboard Quick View',
        description: 'Your dashboard shows a quick overview of all your assignments and pending tasks.',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'dash-nav',
        title: 'Go to Dashboard',
        description: 'Let\'s navigate to the main Dashboard for an overview.',
        targetSelector: '[data-nav-id="dashboard"]',
        position: 'right',
        navigationAction: {
          section: 'dashboard'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="dashboard"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'dash-assignments-widget',
        title: 'My Assignments Widget',
        description: 'This widget displays your current assignments at a glance. See what needs your attention!',
        targetSelector: '[data-testid="assignments-widget"], [data-testid="my-assignments"]',
        position: 'top',
        highlightPadding: 16
      },
      {
        id: 'dash-quick-actions',
        title: 'Quick Actions',
        description: 'Click on any assignment to quickly jump to that task. Stay productive!',
        targetSelector: '[data-testid="assignment-item"]:first-child',
        position: 'bottom',
        highlightPadding: 12
      }
    ]
  },
  {
    id: 'calendar-symbols',
    title: 'Calendar View & Symbols',
    description: 'Understand the event calendar and status symbols',
    category: 'events-calendar',
    icon: 'Calendar',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'calendar-intro',
        title: 'Calendar Navigation',
        description: 'Learn how to read the event calendar and understand status symbols.',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'calendar-nav',
        title: 'Open Event Requests',
        description: 'The calendar view is in Event Requests. Let\'s go there.',
        targetSelector: '[data-nav-id="event-requests"]',
        position: 'right',
        navigationAction: {
          section: 'event-requests'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="event-requests"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'calendar-view-tab',
        title: 'Calendar View',
        description: 'Click on the Calendar tab to see events in a visual timeline.',
        targetSelector: '[data-value="calendar"], [data-testid="tab-calendar"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'calendar-symbols',
        title: 'Status Symbols',
        description: 'Events are color-coded: 🟢 Confirmed, 🟡 Pending, 🔵 In Progress, ✅ Completed. Use these to quickly understand event status.',
        targetSelector: '[data-testid="calendar-legend"], [data-testid="calendar-view"]',
        position: 'top',
        highlightPadding: 16
      },
      {
        id: 'calendar-interaction',
        title: 'Click to View Details',
        description: 'Click on any calendar event to view full details, assignments, and take actions. Navigate between months to plan ahead!',
        targetSelector: '[data-testid="calendar-event"]:first-child, [data-testid="calendar-grid"]',
        position: 'bottom',
        highlightPadding: 12
      }
    ]
  }
];

export function getToursByCategory(category: TourCategory): Tour[] {
  return TOURS.filter(tour => tour.category === category);
}

export function searchTours(query: string): Tour[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return TOURS;
  
  return TOURS.filter(tour => 
    tour.title.toLowerCase().includes(lowerQuery) ||
    tour.description.toLowerCase().includes(lowerQuery) ||
    tour.steps.some(step => 
      step.title.toLowerCase().includes(lowerQuery) ||
      step.description.toLowerCase().includes(lowerQuery)
    )
  );
}

export function getTourById(tourId: string): Tour | undefined {
  return TOURS.find(tour => tour.id === tourId);
}
