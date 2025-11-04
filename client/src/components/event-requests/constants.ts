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
  { value: 'deli', label: 'Deli' },
  { value: 'deli_turkey', label: 'Turkey' },
  { value: 'deli_ham', label: 'Ham' },
  { value: 'unknown', label: 'Unknown' },
] as const;

// Status color scheme - VIBRANT VERSION: Bright, saturated colors for maximum visibility
export const statusColors = {
  new: 'bg-gradient-to-br from-[#00C9FF] to-[#0AF] text-white border-2 border-[#00C9FF] shadow-md',
  in_process:
    'bg-gradient-to-br from-[#FF9500] to-[#FFB000] text-white border-2 border-[#FF9500] shadow-md',
  scheduled:
    'bg-gradient-to-br from-[#007AFF] to-[#0096FF] text-white border-2 border-[#007AFF] shadow-md',
  completed:
    'bg-gradient-to-br from-[#34C759] to-[#30D158] text-white border-2 border-[#34C759] shadow-md',
  declined:
    'bg-gradient-to-br from-[#FF3B30] to-[#FF453A] text-white border-2 border-[#FF3B30] font-bold shadow-lg',
  postponed:
    'bg-gradient-to-br from-[#FF3B30] to-[#FF453A] text-white border-2 border-[#FF3B30] font-bold shadow-lg',
  cancelled:
    'bg-gradient-to-br from-[#FF3B30] to-[#FF453A] text-white border-2 border-[#FF3B30] font-bold shadow-lg',
};

// Card border colors for left border accent - VIBRANT VERSION
export const statusBorderColors = {
  new: '#00C9FF', // Bright cyan
  in_process: '#FF9500', // Bright orange
  scheduled: '#007AFF', // Bright blue
  completed: '#34C759', // Bright green
  declined: '#FF3B30', // Bright red
  postponed: '#FF3B30', // Bright red
  cancelled: '#FF3B30', // Bright red
};

// Card background accent colors - VIBRANT VERSION (brighter tints)
export const statusBgColors = {
  new: 'bg-[#00C9FF]/10', // Bright cyan tint
  in_process: 'bg-[#FF9500]/10', // Bright orange tint
  scheduled: 'bg-[#007AFF]/10', // Bright blue tint
  completed: 'bg-[#34C759]/10', // Bright green tint
  declined: 'bg-[#FF3B30]/10', // Bright red tint
  postponed: 'bg-[#FF3B30]/10', // Bright red tint
  cancelled: 'bg-[#FF3B30]/10', // Bright red tint
};

// My Assignment highlight color
export const myAssignmentColor = '#47B3CB'; // Light blue/cyan

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
  { value: 'declined', label: 'Declined/Postponed' },
];