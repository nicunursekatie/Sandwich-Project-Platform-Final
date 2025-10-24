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
  waitForElement?: boolean; // If true, wait longer for element to load (useful after filtering/navigation)
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  category: TourCategory;
  icon: string;
  steps: TourStep[];
  estimatedTime?: string;
  afterComplete?: () => void; // Optional callback to run after tour completes
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
    ],
    afterComplete: () => {
      // Auto-open Logos & Branding tab
      setTimeout(() => {
        const logosTab = document.querySelector('[data-testid="tab-logos"]');
        if (logosTab instanceof HTMLElement) {
          logosTab.click();
        }
      }, 300);
    }
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
        highlightPadding: 8,
        beforeShow: () => {
          // Click Forms category and wait for it to load
          const formsButton = document.querySelector('[data-testid="category-forms"]');
          if (formsButton instanceof HTMLElement) {
            formsButton.click();
          }
        }
      },
      {
        id: 'signin-forms-location',
        title: 'Sandwich Sign-In Form',
        description: 'Here it is! This form is used at sandwich collection events to track participants without requiring email addresses. Click Download to get it.',
        targetSelector: '[data-testid="document-sandwich-signin-form"]',
        position: 'top',
        highlightPadding: 16,
        waitForElement: true // Wait for Forms category to finish loading
      }
    ],
    afterComplete: () => {
      // After tour completes, automatically open the Forms category
      setTimeout(() => {
        const formsButton = document.querySelector('[data-testid="category-forms"]');
        if (formsButton instanceof HTMLElement) {
          formsButton.click();
        }
      }, 300);
    }
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
    ],
    afterComplete: () => {
      // User is already on Analytics - ensure Impact tab is selected
      setTimeout(() => {
        const impactTab = document.querySelector('[data-value="impact"]');
        if (impactTab instanceof HTMLElement) {
          impactTab.click();
        }
      }, 300);
    }
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
    ],
    afterComplete: () => {
      // User is already on My Actions - stay there
      setTimeout(() => {
        const navItem = document.querySelector('[data-nav-id="my-actions"]');
        if (navItem instanceof HTMLElement) {
          navItem.click();
        }
      }, 300);
    }
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
    ],
    afterComplete: () => {
      // Auto-open My Assignments tab
      setTimeout(() => {
        const myAssignmentsTab = document.querySelector('[data-value="my-assignments"]');
        if (myAssignmentsTab instanceof HTMLElement) {
          myAssignmentsTab.click();
        }
      }, 300);
    }
  },
  {
    id: 'dashboard-assignments',
    title: 'My Action Tracker Overview',
    description: 'Quick view of your assignments and action items on the dashboard',
    category: 'my-work',
    icon: 'LayoutDashboard',
    estimatedTime: '1 min',
    steps: [
      {
        id: 'dash-assignments-intro',
        title: 'Dashboard Quick View',
        description: 'Your dashboard shows a quick overview of all your assigned projects, events, tasks, and messages.',
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
        id: 'dash-action-tracker',
        title: 'My Action Tracker',
        description: 'This widget shows all your assigned work and communications. It displays projects, events, tasks, and messages that need your attention.',
        targetSelector: '[data-testid="dashboard-action-tracker"]',
        position: 'top',
        highlightPadding: 16
      },
      {
        id: 'dash-action-cards',
        title: 'Action Categories',
        description: 'Your assignments are organized into cards: Projects, Events, Tasks, and Messages. Click on any item to jump directly to it!',
        targetSelector: '[data-testid="projects-card"], [data-testid="events-card"]',
        position: 'bottom',
        highlightPadding: 12
      }
    ],
    afterComplete: () => {
      // User is already on Dashboard - stay there
      setTimeout(() => {
        const navItem = document.querySelector('[data-nav-id="dashboard"]');
        if (navItem instanceof HTMLElement) {
          navItem.click();
        }
      }, 300);
    }
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
        highlightPadding: 8,
        beforeShow: () => {
          // Click Calendar tab to switch the view
          const calendarTab = document.querySelector('[data-value="calendar"]');
          if (calendarTab instanceof HTMLElement) {
            calendarTab.click();
          }
        }
      },
      {
        id: 'calendar-symbols',
        title: 'Status Symbols',
        description: 'Events are color-coded: 🟢 Confirmed, 🟡 Pending, 🔵 In Progress, ✅ Completed. Use these to quickly understand event status.',
        targetSelector: '[data-testid="calendar-legend"], [data-testid="calendar-view"]',
        position: 'top',
        highlightPadding: 16,
        waitForElement: true // Wait for calendar to load after tab switch
      },
      {
        id: 'calendar-interaction',
        title: 'Click to View Details',
        description: 'Click on any calendar event to view full details, assignments, and take actions. Navigate between months to plan ahead!',
        targetSelector: '[data-testid="calendar-event"]:first-child, [data-testid="calendar-grid"]',
        position: 'bottom',
        highlightPadding: 12,
        waitForElement: true // Wait for calendar events to render
      }
    ],
    afterComplete: () => {
      // Auto-open Calendar tab
      setTimeout(() => {
        const calendarTab = document.querySelector('[data-value="calendar"]');
        if (calendarTab instanceof HTMLElement) {
          calendarTab.click();
        }
      }, 300);
    }
  },
  {
    id: 'team-chat-guide',
    title: 'Using Team Chat',
    description: 'Learn how to communicate with your team using chat rooms',
    category: 'team-management',
    icon: 'MessageSquare',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'chat-intro',
        title: 'Team Communication Hub',
        description: 'Team Chat is where you can message teammates, join conversations, and stay connected. Let me show you around!',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'chat-nav',
        title: 'Open Team Chat',
        description: 'Click on "Team Chat" in the navigation to access all your conversations.',
        targetSelector: '[data-nav-id="chat"]',
        position: 'right',
        navigationAction: {
          section: 'chat'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="chat"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'chat-rooms-list',
        title: 'Your Chat Rooms',
        description: 'On the left, you\'ll see all chat rooms you have access to - General team chat, committee chats, and direct messages.',
        targetSelector: '[data-testid="chat-rooms-list"], [data-testid="channel-list"]',
        position: 'right',
        highlightPadding: 12
      },
      {
        id: 'chat-general',
        title: 'General Chat',
        description: 'The General chat room is for team-wide announcements and casual conversation. Everyone can see messages here.',
        targetSelector: '[data-testid="chat-general"], [data-channel="general"]',
        position: 'right',
        highlightPadding: 8
      },
      {
        id: 'chat-compose',
        title: 'Send Messages',
        description: 'Type your message in the box at the bottom. Use @name to mention someone, and they\'ll get a notification!',
        targetSelector: '[data-testid="chat-input"], [data-testid="message-input"]',
        position: 'top',
        highlightPadding: 12
      }
    ]
  },
  {
    id: 'team-board-guide',
    title: 'Using Team Board',
    description: 'Post tasks, ideas, and notes for the team',
    category: 'team-management',
    icon: 'Trello',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'board-intro',
        title: 'Team Board - Shared Task Hub',
        description: 'Team Board is like a virtual bulletin board where anyone can post tasks, ideas, notes, or reminders for the team.',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'board-nav',
        title: 'Open Team Board',
        description: 'Find Team Board in the navigation menu.',
        targetSelector: '[data-nav-id="team-board"]',
        position: 'right',
        navigationAction: {
          section: 'team-board'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="team-board"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'board-create',
        title: 'Create New Items',
        description: 'Click here to post a new task, idea, note, or reminder for the team. Choose the type that fits best!',
        targetSelector: '[data-testid="create-board-item"], [data-testid="new-item-button"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'board-columns',
        title: 'Three Status Columns',
        description: 'Items are organized by status: Open (available to claim), In Progress (being worked on), and Done (completed).',
        targetSelector: '[data-testid="board-columns"], [data-testid="status-columns"]',
        position: 'top',
        highlightPadding: 16
      },
      {
        id: 'board-claim',
        title: 'Claim Tasks',
        description: 'See a task you want to help with? Click "Claim" to assign yourself, or assign it to a teammate!',
        targetSelector: '[data-testid="claim-button"], [data-testid^="button-claim-"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'board-comments',
        title: 'Add Comments',
        description: 'Click on any item to view details and add comments. Keep conversations organized per task!',
        targetSelector: '[data-testid="board-item"]:first-child',
        position: 'left',
        highlightPadding: 12
      }
    ]
  },
  {
    id: 'collections-log-guide',
    title: 'Logging Sandwich Collections',
    description: 'Record sandwich collections from events',
    category: 'events-calendar',
    icon: 'ClipboardCheck',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'collections-intro',
        title: 'Collections Log',
        description: 'After a sandwich collection event, log the sandwiches collected here to track our community impact!',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'collections-nav',
        title: 'Open Collections Log',
        description: 'Navigate to Collections Log in the menu.',
        targetSelector: '[data-nav-id="collections-log"]',
        position: 'right',
        navigationAction: {
          section: 'collections-log'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="collections-log"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'collections-add',
        title: 'Add New Collection',
        description: 'Click here to log a new collection. You\'ll enter the date, host, number of sandwiches, and any notes.',
        targetSelector: '[data-testid="add-collection"], [data-testid="new-collection-button"]',
        position: 'bottom',
        highlightPadding: 8
      },
      {
        id: 'collections-form',
        title: 'Collection Details',
        description: 'Fill in the collection date, select the host organization, enter sandwich counts, and add any special notes about the event.',
        targetSelector: '[data-testid="collection-form"], [data-testid="sandwich-form"]',
        position: 'right',
        highlightPadding: 16
      },
      {
        id: 'collections-history',
        title: 'View History',
        description: 'All past collections are listed here. Filter by date or host to find specific events. Great for tracking trends!',
        targetSelector: '[data-testid="collections-table"], [data-testid="collections-list"]',
        position: 'top',
        highlightPadding: 12
      }
    ]
  },
  {
    id: 'inbox-messages-guide',
    title: 'Using Your Inbox',
    description: 'Send messages and kudos to team members',
    category: 'team-management',
    icon: 'Mail',
    estimatedTime: '2 min',
    steps: [
      {
        id: 'inbox-intro',
        title: 'Your Personal Inbox',
        description: 'The Inbox is for important messages and kudos. It\'s like email, but just for our team!',
        targetSelector: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'inbox-nav',
        title: 'Open Inbox',
        description: 'Click on Inbox in the navigation.',
        targetSelector: '[data-nav-id="inbox"]',
        position: 'right',
        navigationAction: {
          section: 'gmail-inbox'
        },
        beforeShow: () => {
          const navItem = document.querySelector('[data-nav-id="inbox"]');
          if (navItem instanceof HTMLElement) {
            navItem.click();
          }
        }
      },
      {
        id: 'inbox-folders',
        title: 'Message Folders',
        description: 'Your messages are organized into folders: Inbox, Sent, Starred, Kudos, and more. Just like Gmail!',
        targetSelector: '[data-testid="inbox-folders"], [data-testid="folder-list"]',
        position: 'right',
        highlightPadding: 12
      },
      {
        id: 'inbox-kudos',
        title: 'Kudos Folder',
        description: 'The Kudos folder is special - it\'s where all appreciation messages are stored. Send kudos to recognize great work!',
        targetSelector: '[data-testid="folder-kudos"], [data-folder="kudos"]',
        position: 'right',
        highlightPadding: 8
      },
      {
        id: 'inbox-compose',
        title: 'Compose New Message',
        description: 'Click here to send a new message or kudos. Choose the recipient, write your message, and optionally mark it as kudos!',
        targetSelector: '[data-testid="compose-button"], [data-testid="new-message"]',
        position: 'left',
        highlightPadding: 8
      },
      {
        id: 'inbox-kudos-toggle',
        title: 'Send Kudos',
        description: 'When composing, toggle "Send as Kudos" to publicly recognize someone\'s great work. Kudos show up on their profile!',
        targetSelector: '[data-testid="kudos-toggle"], [data-testid="is-kudos-checkbox"]',
        position: 'top',
        highlightPadding: 8
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
