import {
  Clock,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Standardized sandwich types - only these 5 options allowed
export const SANDWICH_TYPES = [
  { value: 'pbj', label: 'PB&J' },
  { value: 'deli', label: 'Deli (General)' },
  { value: 'deli_turkey', label: 'Deli (Turkey)' },
  { value: 'deli_ham', label: 'Deli (Ham)' },
  { value: 'unknown', label: 'Unknown' },
] as const;

export const statusColors = {
  new: 'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-primary border border-teal-200',
  in_process:
    'bg-gradient-to-r from-teal-50 to-cyan-100 text-brand-teal border border-teal-200',
  scheduled:
    'bg-white border border-slate-200 shadow-sm',
  completed:
    'bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.3)]',
  declined:
    'bg-gradient-to-r from-[hsl(var(--accent)/0.1)] to-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))] border-2 border-[hsl(var(--accent)/0.4)] font-bold shadow-lg',
};

export const SANDWICH_DESTINATIONS = [
  'Atlanta Community Food Bank',
  'Atlanta Mission',
  'Covenant House Georgia',
  'Gateway Center',
  'Hosea Helps',
  'Mercy Care',
  'Open Hand Atlanta',
  'Salvation Army',
  'St. Vincent de Paul',
  'The Atlanta Day Center',
  'The Extension',
  "The Shepherd's Inn",
  'Zaban Paradies Center',
];

export const statusIcons = {
  new: Clock,
  in_process: Phone,
  scheduled: Calendar,
  completed: CheckCircle,
  declined: XCircle,
};

export const previouslyHostedOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'i_dont_know', label: 'Unknown' },
];

export const statusOptions = [
  { value: 'new', label: 'New Request' },
  { value: 'in_process', label: 'In Process' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: '🚫 EVENT POSTPONED' },
];