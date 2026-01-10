import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Phone, Home, Calendar } from 'lucide-react';
import type { User } from '@/types/user';

interface SMSDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSMS: (userId: string, phoneNumber: string, enabled: boolean, campaignType?: 'hosts' | 'events') => void;
  isPending?: boolean;
}

export function SMSDialog({
  user,
  open,
  onOpenChange,
  onUpdateSMS,
  isPending = false,
}: SMSDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [campaignType, setCampaignType] = useState<'hosts' | 'events'>('hosts');

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.metadata?.smsConsent?.displayPhone || '');
      setCampaignType(user.metadata?.smsConsent?.campaignType || 'hosts');
    }
  }, [user]);

  const handleEnable = () => {
    if (user && phoneNumber) {
      onUpdateSMS(user.id, phoneNumber, true, campaignType);
    }
  };

  const handleDisable = () => {
    if (user) {
      onUpdateSMS(user.id, '', false, campaignType);
    }
  };

  const handleClose = () => {
    setPhoneNumber('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Manage SMS Notifications for {user?.firstName} {user?.lastName}
          </DialogTitle>
          <DialogDescription>
            Update SMS notification preferences for this user. Users can also
            manage their own preferences in their profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="h-5 w-5 text-brand-primary" />
              <div>
                <p className="font-medium">Current Status</p>
                <p className="text-sm text-gray-600">
                  {(() => {
                    const smsConsent = user?.metadata?.smsConsent;
                    const status = smsConsent?.status || (smsConsent?.enabled ? 'confirmed' : 'not_opted_in');
                    
                    if (status === 'confirmed' && smsConsent?.enabled) {
                      return <span className="text-green-700">Confirmed - SMS enabled</span>;
                    } else if (status === 'pending_confirmation') {
                      return <span className="text-yellow-700">Pending confirmation</span>;
                    } else {
                      return <span className="text-gray-500">Not opted in to SMS notifications</span>;
                    }
                  })()}
                </p>
                {user?.metadata?.smsConsent?.phoneNumber && (
                  <p className="text-sm text-gray-500">
                    Phone:{' '}
                    {user.metadata.smsConsent.displayPhone ||
                      user.metadata.smsConsent.phoneNumber}
                  </p>
                )}
                {user?.metadata?.smsConsent?.confirmedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Confirmed: {new Date(user.metadata.smsConsent.confirmedAt).toLocaleDateString()}
                  </p>
                )}
                {user?.metadata?.smsConsent?.confirmationMethod && (
                  <p className="text-xs text-gray-400">
                    Method: {user.metadata.smsConsent.confirmationMethod === 'admin_override' ? 'Admin override' : 'Verification code'}
                  </p>
                )}
                {user?.metadata?.smsConsent?.campaignType && (
                  <p className="text-xs text-gray-400">
                    Campaign: {user.metadata.smsConsent.campaignType === 'hosts' ? 'Collection Reminders' : 'Event Notifications'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="sms-phone">Phone Number</Label>
              <Input
                id="sms-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required for SMS notifications. Include area code.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Notification Type</Label>
              <RadioGroup
                value={campaignType}
                onValueChange={(value) => setCampaignType(value as 'hosts' | 'events')}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="hosts" id="campaign-hosts" />
                  <Label htmlFor="campaign-hosts" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Home className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Collection Reminders</p>
                      <p className="text-xs text-gray-500">Weekly reminders about sandwich collection submissions</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="events" id="campaign-events" />
                  <Label htmlFor="campaign-events" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="font-medium">Event Notifications</p>
                      <p className="text-xs text-gray-500">Reminders about volunteer events and assignments</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleEnable}
              disabled={isPending || !phoneNumber}
              className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
            >
              <Phone className="h-4 w-4 mr-2" />
              {isPending ? 'Updating...' : 'Enable SMS'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDisable}
              disabled={isPending}
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
            >
              {isPending ? 'Updating...' : 'Disable SMS'}
            </Button>
          </div>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
