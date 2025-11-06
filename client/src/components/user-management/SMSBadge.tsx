import { Badge } from '@/components/ui/badge';
import { Phone } from 'lucide-react';

interface SMSBadgeProps {
  smsConsent?: {
    enabled: boolean;
    phoneNumber?: string;
    displayPhone?: string;
  };
}

export function SMSBadge({ smsConsent }: SMSBadgeProps) {
  if (smsConsent?.enabled) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <Phone className="h-3 w-3 mr-1" />
          Opted In
        </Badge>
        <span className="text-xs text-gray-500">
          {smsConsent.displayPhone || smsConsent.phoneNumber}
        </span>
      </div>
    );
  }

  return (
    <Badge variant="outline" className="bg-gray-50 text-gray-600">
      <Phone className="h-3 w-3 mr-1" />
      Not Opted In
    </Badge>
  );
}
