import { useAuth } from '@/hooks/useAuth';
import { Clock, LogOut, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PendingApproval() {
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-lg w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-slate-700 backdrop-blur-sm">
        {/* Icon */}
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3 text-center">
          Account Pending Approval
        </h1>

        {/* User Info */}
        {user && (
          <div className="mb-6 text-center">
            <p className="text-lg text-slate-700 dark:text-slate-300 font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
          </div>
        )}

        {/* Message */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            Thank you for creating an account with The Sandwich Project! Your registration has been received and is currently being reviewed by our team.
          </p>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            We'll verify your information and send you a confirmation email once your account has been approved. This usually takes 1-2 business days.
          </p>
        </div>

        {/* What's Next */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-brand-primary" />
            What happens next?
          </h2>
          <ul className="space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-brand-primary mt-0.5">•</span>
              <span>Our admin team will review your registration details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-primary mt-0.5">•</span>
              <span>You'll receive an email notification when approved</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-primary mt-0.5">•</span>
              <span>Once approved, you'll have full access to the platform</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Support */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Questions about your application?
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Contact us if you don't hear back within 2 business days.
          </p>
        </div>
      </div>
    </div>
  );
}
