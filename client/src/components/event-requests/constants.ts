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

// Status color scheme - VIBRANT BRAND COLORS: Using TSP brand palette with high saturation
export const statusColors = {
  new: 'bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border-2 border-[#007E8C] shadow-md',
  in_process:
    'bg-gradient-to-br from-[#FBAD3F] to-[#ffc966] text-white border-2 border-[#FBAD3F] shadow-md',
  scheduled:
    'bg-gradient-to-br from-[#236383] to-[#2d7da5] text-white border-2 border-[#236383] shadow-md',
  completed:
    'bg-gradient-to-br from-[#47B3CB] to-[#6bc4d4] text-white border-2 border-[#47B3CB] shadow-md',
  declined:
    'bg-gradient-to-br from-[#A31C41] to-[#c5245a] text-white border-2 border-[#A31C41] font-bold shadow-lg',
  postponed:
    'bg-gradient-to-br from-[#A31C41] to-[#c5245a] text-white border-2 border-[#A31C41] font-bold shadow-lg',
  cancelled:
    'bg-gradient-to-br from-[#A31C41] to-[#c5245a] text-white border-2 border-[#A31C41] font-bold shadow-lg',
};

// Card border colors for left border accent - VIBRANT BRAND COLORS
export const statusBorderColors = {
  new: '#007E8C', // Vibrant teal
  in_process: '#FBAD3F', // Vibrant orange
  scheduled: '#236383', // Vibrant dark blue
  completed: '#47B3CB', // Vibrant light blue
  declined: '#A31C41', // Vibrant red
  postponed: '#A31C41', // Vibrant red
  cancelled: '#A31C41', // Vibrant red
};

// Card background colors - SOLID LIGHTER TINTS (no opacity mixing)
export const statusBgColors = {
  new: 'bg-[#E2F5F6]', // Solid light teal
  in_process: 'bg-[#FFF4E5]', // Solid light gold
  scheduled: 'bg-[#E4EFF6]', // Solid light navy
  completed: 'bg-[#E8F7FB]', // Solid light sky blue
  declined: 'bg-[#FAE7ED]', // Solid light crimson
  postponed: 'bg-[#FAE7ED]', // Solid light crimson
  cancelled: 'bg-[#FAE7ED]', // Solid light crimson
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