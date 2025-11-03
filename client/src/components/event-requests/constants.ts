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

// Status color scheme: #236383, #FBAD3F, #007E8C, #A31C41, #47B3CB
export const statusColors = {
  new: 'bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border border-[#007E8C]',
  in_process:
    'bg-gradient-to-br from-[#FBAD3F] to-[#ffc966] text-white border border-[#FBAD3F]',
  scheduled:
    'bg-gradient-to-br from-[#236383] to-[#2d7da5] text-white border border-[#236383]',
  completed:
    'bg-gradient-to-br from-[#47B3CB] to-[#6bc4d4] text-white border border-[#47B3CB]',
  declined:
    'bg-gradient-to-br from-[#A31C41] to-[#c5245a] text-white border-2 border-[#A31C41] font-bold shadow-lg',
  postponed:
    'bg-gradient-to-br from-[#A31C41] to-[#c5245a] text-white border-2 border-[#A31C41] font-bold shadow-lg',
  cancelled:
    'bg-gradient-to-br from-[#A31C41] to-[#c5245a] text-white border-2 border-[#A31C41] font-bold shadow-lg',
};

// Card border colors for left border accent
export const statusBorderColors = {
  new: '#007E8C', // Teal
  in_process: '#FBAD3F', // Orange
  scheduled: '#236383', // Dark blue
  completed: '#47B3CB', // Light blue/cyan
  declined: '#A31C41', // Red/pink
  postponed: '#A31C41', // Red/pink
  cancelled: '#A31C41', // Red/pink
};

// Card background accent colors (subtle tint)
export const statusBgColors = {
  new: 'bg-[#007E8C]/5', // Teal tint
  in_process: 'bg-[#FBAD3F]/5', // Orange tint
  scheduled: 'bg-[#236383]/5', // Dark blue tint
  completed: 'bg-[#47B3CB]/5', // Light blue tint
  declined: 'bg-[#A31C41]/5', // Red/pink tint
  postponed: 'bg-[#A31C41]/5', // Red/pink tint
  cancelled: 'bg-[#A31C41]/5', // Red/pink tint
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