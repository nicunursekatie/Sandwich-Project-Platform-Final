// Utility functions for event request management
import { Badge } from "@/components/ui/badge";

// Format time from 24-hour to 12-hour format
export const formatTime12Hour = (time24: string): string => {
  if (!time24 || typeof time24 !== "string") return "";
  
  const [hours, minutes] = time24.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24;
  
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// Format military time for display
export const formatTime = (militaryTime: string | null | undefined) => {
  if (!militaryTime) return "Not specified";
  
  try {
    // Handle both "HH:MM" and "HH:MM:SS" formats
    const timeParts = militaryTime.split(":");
    if (timeParts.length >= 2) {
      const hours24 = parseInt(timeParts[0]);
      const minutes = timeParts[1];
      
      if (hours24 === 0) {
        return `12:${minutes} AM`;
      } else if (hours24 < 12) {
        return `${hours24}:${minutes} AM`;
      } else if (hours24 === 12) {
        return `12:${minutes} PM`;
      } else {
        return `${hours24 - 12}:${minutes} PM`;
      }
    }
    return militaryTime;
  } catch (error) {
    return militaryTime;
  }
};

// Get sandwich types summary
export const getSandwichTypesSummary = (request: any) => {
  if (request.estimatedSandwichCount) {
    const total = request.estimatedSandwichCount;
    const type = request.sandwichType || 'Unknown';
    return {
      total,
      breakdown: type !== 'Unknown' ? `${total} ${type}` : `${total} sandwiches`,
    };
  }
  return { total: 0, breakdown: '' };
};

// Format event date for display
export const formatEventDate = (dateString: string) => {
  try {
    let date: Date;
    
    // Handle MM/DD/YYYY format
    if (dateString.includes('/')) {
      const [month, day, year] = dateString.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Handle YYYY-MM-DD format
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return { text: dateString, isValid: false };
    }
    
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    
    return {
      text: date.toLocaleDateString('en-US', options),
      isValid: true
    };
  } catch (error) {
    return { text: dateString, isValid: false };
  }
};

// Get status display for event requests
export const getStatusDisplay = (status: string) => {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          style={{
            backgroundColor: "#FEF3C7",
            color: "#92400E",
            borderColor: "#FBAD3F",
          }}
        >
          ⏳ Pending Review
        </Badge>
      );
    case "scheduled":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          ✓ Confirmed
        </Badge>
      );
    case "postponed":
      return (
        <Badge className="bg-orange-100 text-orange-700 border-orange-200">
          ⏸️ Postponed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200">
          ❌ Cancelled
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          ✅ Completed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-700">
          {status}
        </Badge>
      );
  }
};

// Get driver status display
export const getDriverStatus = (request: any) => {
  const assignedDrivers = request.assignedDriverIds || [];
  if (assignedDrivers.length > 0) {
    return { badge: `✓ ${assignedDrivers.length} Assigned`, color: "bg-green-100 text-green-700" };
  }
  return { badge: "⚠️ Needed", color: "bg-orange-100 text-orange-700" };
};

// Get toolkit status display
export const getToolkitStatus = (request: any) => {
  const toolkitSteps = [
    "sent",
    "received_confirmed"
  ];
  
  let completedSteps = 0;
  toolkitSteps.forEach(step => {
    if (request[step] === true) completedSteps++;
  });
  
  if (completedSteps === toolkitSteps.length) {
    return { badge: "✓ Complete", color: "bg-green-100 text-green-700" };
  } else if (completedSteps > 0) {
    return { badge: `${completedSteps}/${toolkitSteps.length} Steps`, color: "bg-yellow-100 text-yellow-700" };
  }
  return { badge: "⚠️ Pending", color: "bg-orange-100 text-orange-700" };
};

// Get refrigeration status display
export const getRefrigerationStatus = (request: any) => {
  if (request.hasRefrigeration === true)
    return { badge: "✓ Available", color: "bg-green-100 text-green-700" };
  if (request.hasRefrigeration === false)
    return { badge: "❌ None", color: "bg-red-100 text-red-700" };
  return { badge: "❓ Unknown", color: "bg-yellow-100 text-yellow-700" };
};

// Get speaker status display
export const getSpeakerStatus = (request: any) => {
  switch (request.speakerStatus) {
    case "sent":
      return { badge: "✓ Delivered", color: "bg-green-100 text-green-700 border-green-200" };
    case "received_confirmed":
      return { badge: "✓ Confirmed", color: "bg-green-100 text-green-700 border-green-200" };
    case "not_needed":
      return { badge: "N/A", color: "bg-gray-100 text-gray-600 border-gray-200" };
    case "not_sent":
      return { badge: "Not Sent", color: "bg-gray-200 text-gray-700 border-gray-300" };
    default:
      return {
        badge: "⚠️ Pending",
        color: "bg-orange-100 text-[#FBAD3F] border-orange-200",
      };
  }
};