import React from 'react';
import {
  Plus,
  Columns,
  Rows,
  PanelLeft,
  X,
  ExternalLink,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMultiView } from '@/contexts/multi-view-context';
import { useFloatingViews } from '@/contexts/floating-views-context';
import { NAV_ITEMS } from '@/nav.config';
import { cn } from '@/lib/utils';

interface MultiViewToolbarProps {
  currentSection: string;
  className?: string;
}

// Group all nav items by their group for the dropdown
function getGroupedNavItems() {
  const groups: Record<string, typeof NAV_ITEMS> = {};

  NAV_ITEMS.forEach(item => {
    if (!item.href || item.external || item.topNav) return;

    const group = item.group || 'other';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
  });

  return groups;
}

const GROUP_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard',
  'quick-links': 'Quick Links',
  'workspace': 'Workspace',
  'logistics': 'Logistics',
  'network': 'Network',
  'operations': 'Operations',
  'admin': 'Admin & Resources',
};

export function MultiViewToolbar({ currentSection, className }: MultiViewToolbarProps) {
  const {
    panels,
    addPanel,
    canAddPanel,
    isMultiViewEnabled,
    setMultiViewEnabled,
    splitLayout,
    setSplitLayout,
  } = useMultiView();
  const { openView, views } = useFloatingViews();

  const groupedItems = getGroupedNavItems();

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200',
      className
    )}>
      {/* Multi-View Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isMultiViewEnabled ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setMultiViewEnabled(!isMultiViewEnabled)}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">
              {isMultiViewEnabled ? 'Multi-View On' : 'Multi-View'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isMultiViewEnabled
            ? 'Click to disable multi-view mode'
            : 'Enable multi-view to see multiple sections at once'}
        </TooltipContent>
      </Tooltip>

      {/* Add Panel Dropdown */}
      {isMultiViewEnabled && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={!canAddPanel}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Add Panel</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
              {Object.entries(groupedItems).map(([group, items]) => (
                <React.Fragment key={group}>
                  <DropdownMenuLabel className="text-xs text-slate-500">
                    {GROUP_LABELS[group] || group}
                  </DropdownMenuLabel>
                  {items.map(item => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => addPanel(item.href, item.label)}
                      disabled={panels.some(p => p.section === item.href)}
                      className="flex items-center gap-2"
                    >
                      {item.icon && <item.icon className="h-4 w-4 opacity-60" />}
                      <span className="truncate">{item.label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Layout Toggle */}
          <div className="flex items-center border rounded-md">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={splitLayout === 'horizontal' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-r-none"
                  onClick={() => setSplitLayout('horizontal')}
                >
                  <Columns className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split horizontally (side by side)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={splitLayout === 'vertical' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-l-none"
                  onClick={() => setSplitLayout('vertical')}
                >
                  <Rows className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split vertically (stacked)</TooltipContent>
            </Tooltip>
          </div>

          {/* Panel Count Indicator */}
          <span className="text-xs text-slate-500 hidden sm:inline">
            {panels.length} of 4 panels
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Pop-out current view */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const navItem = NAV_ITEMS.find(item => item.href === currentSection);
              const title = navItem?.label || currentSection;
              openView(currentSection, title);
            }}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Pop Out</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open current view in a floating window</TooltipContent>
      </Tooltip>

      {/* Floating Windows Indicator */}
      {views.length > 0 && (
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
          {views.length} floating {views.length === 1 ? 'window' : 'windows'}
        </span>
      )}
    </div>
  );
}
