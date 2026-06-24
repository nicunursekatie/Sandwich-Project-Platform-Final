import { Eye, EyeOff } from 'lucide-react';
import { useNavViewMode } from '@/contexts/nav-view-mode-context';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Admin-only toggle in the top nav bar. Switches between:
 * - Admin view: full nav based on your permissions
 * - User view: preview nav limited to items configured in Admin Panel
 */
export function NavViewModeToggle() {
  const { canUseNavViewToggle, viewMode, setViewMode, isUserViewActive } = useNavViewMode();

  if (!canUseNavViewToggle) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'admin' ? 'user' : 'admin')}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors border ${
            isUserViewActive
              ? 'bg-amber-400/90 text-amber-950 border-amber-300 shadow-sm'
              : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/15'
          }`}
          aria-pressed={isUserViewActive}
          aria-label={
            isUserViewActive
              ? 'User view active. Switch to admin view.'
              : 'Admin view active. Switch to user view preview.'
          }
          data-testid="nav-view-mode-toggle"
        >
          {isUserViewActive ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          <span className="hidden lg:inline">
            {isUserViewActive ? 'User View' : 'Admin View'}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="max-w-xs">
        {isUserViewActive
          ? 'Previewing navigation as a typical user. Switch to Admin View to see everything you have access to.'
          : 'Preview what most users see in the sidebar. Configure visible tabs in Admin Panel → Nav User View.'}
      </TooltipContent>
    </Tooltip>
  );
}
