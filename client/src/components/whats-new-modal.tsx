import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lightbulb, Settings, HelpCircle, FileSpreadsheet, Users, ArrowRight, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'navigation_update_2024_seen';

export function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already seen this announcement
    const hasSeenAnnouncement = localStorage.getItem(STORAGE_KEY);

    if (!hasSeenAnnouncement) {
      // Show modal after a short delay so the page loads first
      setTimeout(() => {
        setIsOpen(true);
      }, 1000);
    }
  }, []);

  const handleDismiss = () => {
    // Mark as seen in localStorage
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-brand-primary to-brand-primary-dark rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Navigation Updates!
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-gray-600">
            We've reorganized the navigation to make things easier to find.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Top Nav Items */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-4 border-2 border-teal-200">
            <h3 className="font-semibold text-lg text-gray-900 mb-3 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-brand-primary" />
              Moved to Top Navigation Bar
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              These items are now in the top navigation bar (next to your profile) for quick access:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-white rounded-md p-3 shadow-sm">
                <div className="p-2 bg-yellow-100 rounded-md">
                  <Lightbulb className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">Suggestions</span>
                  <p className="text-xs text-gray-600">Submit feedback and ideas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-md p-3 shadow-sm">
                <div className="p-2 bg-blue-100 rounded-md">
                  <Settings className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">Admin Panel</span>
                  <p className="text-xs text-gray-600">System settings and configuration</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-md p-3 shadow-sm">
                <div className="p-2 bg-purple-100 rounded-md">
                  <HelpCircle className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">Help</span>
                  <p className="text-xs text-gray-600">Support and documentation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Collections Reports Organization */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border-2 border-orange-200">
            <h3 className="font-semibold text-lg text-gray-900 mb-3 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-brand-orange" />
              Collections Reports Grouped Together
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Your collection reports are now organized under Collections Log. Click Collections Log in the sidebar to see:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-white rounded-md p-3 shadow-sm">
                <div className="p-2 bg-teal-100 rounded-md">
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                </div>
                <span className="font-medium text-gray-900">Weekly Collections Report</span>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-md p-3 shadow-sm">
                <div className="p-2 bg-teal-100 rounded-md">
                  <Users className="w-4 h-4 text-teal-600" />
                </div>
                <span className="font-medium text-gray-900">Group Collections Viewer</span>
              </div>
            </div>
          </div>

          {/* Visual Guide */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-700">
              <strong>💡 Tip:</strong> Look for new buttons in the top right corner of your screen,
              between the notification bell and your profile icon.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            onClick={handleDismiss}
            className="bg-gradient-to-r from-brand-primary to-brand-primary-dark hover:from-brand-primary-dark hover:to-brand-primary text-white px-6"
          >
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
