import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Bell, MessageSquare } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

const ANNOUNCEMENT_ID = 'sms_alerts_launch_2024';

export function SMSAnnouncementModal() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Check if user has dismissed this announcement
  const { data: dismissStatus, isLoading } = useQuery({
    queryKey: ['/api/announcements/dismissed', ANNOUNCEMENT_ID],
    queryFn: () =>
      apiRequest('GET', `/api/announcements/dismissed/${ANNOUNCEMENT_ID}`),
  });

  // Mutation to dismiss the announcement
  const dismissMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/announcements/dismiss', {
        announcementId: ANNOUNCEMENT_ID,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/announcements/dismissed', ANNOUNCEMENT_ID],
      });
      setIsOpen(false);
    },
  });

  // Show modal if user hasn't dismissed it
  useEffect(() => {
    if (!isLoading && dismissStatus && !dismissStatus.dismissed) {
      setIsOpen(true);
    }
  }, [dismissStatus, isLoading]);

  const handleGoToSettings = () => {
    dismissMutation.mutate();
    setLocation('/profile-settings');
  };

  const handleDismiss = () => {
    dismissMutation.mutate();
  };

  if (isLoading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-3 rounded-full">
              <Smartphone className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                SMS Alerts Are Now Live! 🎉
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  New
                </Badge>
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-base space-y-3 pt-2">
            <p className="font-medium text-gray-700">
              Stay connected with instant text message notifications!
            </p>
            
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <p className="text-sm text-blue-900 font-medium mb-2">
                What you'll receive:
              </p>
              <ul className="text-sm text-blue-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Event assignment alerts with direct links</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Important reminders when you need them</span>
                </li>
                <li className="flex items-start gap-2">
                  <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Simple, friendly messages – no spam!</span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 italic">
              Signing up is quick and easy – just add your phone number in your profile settings.
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={dismissMutation.isPending}
            className="flex-1"
            data-testid="button-dismiss-announcement"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleGoToSettings}
            disabled={dismissMutation.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700"
            data-testid="button-setup-sms"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Set Up SMS Alerts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
