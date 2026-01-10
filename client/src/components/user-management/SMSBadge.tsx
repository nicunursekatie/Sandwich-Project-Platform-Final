import { Badge } from '@/components/ui/badge';
import { Phone, Home, Calendar } from 'lucide-react';

interface SMSBadgeProps {
  smsConsent?: {
    enabled: boolean;
    phoneNumber?: string;
    displayPhone?: string;
    campaignType?: 'hosts' | 'events';
  };
}

export function SMSBadge({ smsConsent }: SMSBadgeProps) {
  if (smsConsent?.enabled) {
    const isHostsCampaign = !smsConsent.campaignType || smsConsent.campaignType === 'hosts';
    const CampaignIcon = isHostsCampaign ? Home : Calendar;
    const campaignLabel = isHostsCampaign ? 'Collection' : 'Events';
    const campaignColor = isHostsCampaign ? 'text-blue-600' : 'text-purple-600';
    
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <Phone className="h-3 w-3 mr-1" />
          Opted In
        </Badge>
        <Badge
          variant="outline"
          className={`bg-gray-50 border-gray-200 ${campaignColor}`}
        >
          <CampaignIcon className="h-3 w-3 mr-1" />
          {campaignLabel}
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
