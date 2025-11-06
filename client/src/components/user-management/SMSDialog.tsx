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
import { Phone } from 'lucide-react';
import type { User } from '@/types/user';

interface SMSDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSMS: (userId: string, phoneNumber: string, enabled: boolean) => void;
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

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.metadata?.smsConsent?.displayPhone || '');
    }
  }, [user]);

  const handleEnable = () => {
    if (user && phoneNumber) {
      onUpdateSMS(user.id, phoneNumber, true);
    }
  };

  const handleDisable = () => {
    if (user) {
      onUpdateSMS(user.id, '', false);
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
                  {user?.metadata?.smsConsent?.enabled ? (
                    <span className="text-green-700">
                      Opted in to SMS notifications
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      Not opted in to SMS notifications
                    </span>
                  )}
                </p>
                {user?.metadata?.smsConsent?.phoneNumber && (
                  <p className="text-sm text-gray-500">
                    Phone:{' '}
                    {user.metadata.smsConsent.displayPhone ||
                      user.metadata.smsConsent.phoneNumber}
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
