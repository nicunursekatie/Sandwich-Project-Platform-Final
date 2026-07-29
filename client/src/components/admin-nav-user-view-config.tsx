import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, RotateCcw, Save } from 'lucide-react';
import { NAV_ITEMS } from '@/nav.config';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  ALL_NAV_IDS,
  getDefaultNavUserViewVisibleIds,
} from '@/contexts/nav-view-mode-context';

interface NavUserViewConfigResponse {
  visibleNavIds: string[] | null;
  usesDefaults?: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  events: 'Events & Volunteers',
  network: 'Network',
  resources: 'Resources & Tools',
  communication: 'Communication',
  data: 'Data & Reports',
  settings: 'Settings',
};

export function AdminNavUserViewConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<NavUserViewConfigResponse>({
    queryKey: ['/api/nav-user-view-config'],
    queryFn: async () => apiRequest('GET', '/api/nav-user-view-config'),
  });

  useEffect(() => {
    const ids =
      data?.visibleNavIds == null
        ? getDefaultNavUserViewVisibleIds(ALL_NAV_IDS)
        : data.visibleNavIds.filter((id) => ALL_NAV_IDS.includes(id));
    setSelectedIds(new Set(ids));
  }, [data?.visibleNavIds]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof NAV_ITEMS>();
    for (const item of NAV_ITEMS) {
      const group = item.group || 'other';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(item);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (visibleNavIds: string[]) => {
      return apiRequest('PUT', '/api/nav-user-view-config', { visibleNavIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nav-user-view-config'] });
      toast({
        title: 'Nav user view saved',
        description: 'The sidebar User View preview will use these tabs.',
      });
    },
    onError: () => {
      toast({
        title: 'Save failed',
        description: 'Could not update nav user view settings.',
        variant: 'destructive',
      });
    },
  });

  const toggleItem = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const resetToDefaults = () => {
    setSelectedIds(new Set(getDefaultNavUserViewVisibleIds(ALL_NAV_IDS)));
  };

  const selectAll = () => setSelectedIds(new Set(ALL_NAV_IDS));
  const selectNone = () => setSelectedIds(new Set());

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        Loading nav configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-brand-primary" />
            <h2 className="text-xl font-semibold text-gray-900">Nav User View</h2>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl">
            Choose which sidebar tabs appear when you toggle <strong>User View</strong> in the top
            navigation bar. This preview helps you see the app as most volunteers and coordinators
            experience it — it does not change what real users can access (permissions still apply).
          </p>
          {data?.usesDefaults && (
            <p className="text-xs text-amber-700 mt-2">
              Using default tab selection — save to persist custom choices.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={selectNone}>
            Clear all
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetToDefaults} className="gap-1.5">
            <RotateCcw className="w-4 h-4" />
            Reset defaults
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-brand-primary hover:bg-brand-primary-dark text-white"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(Array.from(selectedIds))}
            data-testid="save-nav-user-view"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {groupedItems.map(([group, items]) => (
          <div
            key={group}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">
              {GROUP_LABELS[group] || group}
            </h3>
            <ul className="space-y-2">
              {items.map((item) => {
                const checked = selectedIds.has(item.id);
                return (
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 rounded-md px-2 py-1.5 ${
                      item.isSubItem ? 'ml-4 border-l-2 border-slate-200' : ''
                    }`}
                  >
                    <Checkbox
                      id={`nav-user-view-${item.id}`}
                      checked={checked}
                      onCheckedChange={(value) => toggleItem(item.id, value === true)}
                    />
                    <Label
                      htmlFor={`nav-user-view-${item.id}`}
                      className="text-sm font-normal leading-snug cursor-pointer"
                    >
                      {item.label}
                      {item.isSubItem && (
                        <span className="block text-xs text-muted-foreground">Sub-item</span>
                      )}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {selectedIds.size} of {ALL_NAV_IDS.length} tabs selected for User View preview.
      </p>
    </div>
  );
}
