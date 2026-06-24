import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import type { UserForPermissions } from '@shared/types';
import { getDefaultNavUserViewVisibleIds } from '@shared/nav-user-view';
import { NAV_ITEMS } from '@/nav.config';
import type { NavItem } from '@/nav.types';
import { filterNavItemsForUserView } from '@/lib/nav-view-filter';
import { apiRequest } from '@/lib/queryClient';

const NAV_VIEW_MODE_KEY = 'nav.viewMode.v1';
const ALL_NAV_IDS = NAV_ITEMS.map((item) => item.id);

export type NavViewMode = 'admin' | 'user';

interface NavUserViewConfigResponse {
  visibleNavIds: string[] | null;
  usesDefaults?: boolean;
}

interface NavViewModeContextValue {
  viewMode: NavViewMode;
  setViewMode: (mode: NavViewMode) => void;
  canUseNavViewToggle: boolean;
  isUserViewActive: boolean;
  visibleNavIds: Set<string>;
  applyUserViewFilter: (items: NavItem[]) => NavItem[];
}

const NavViewModeContext = createContext<NavViewModeContextValue | null>(null);

function loadViewMode(): NavViewMode {
  try {
    return localStorage.getItem(NAV_VIEW_MODE_KEY) === 'user' ? 'user' : 'admin';
  } catch {
    return 'admin';
  }
}

export function NavViewModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewModeState] = useState<NavViewMode>(loadViewMode);

  const canUseNavViewToggle = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return hasPermission(user as UserForPermissions, PERMISSIONS.ADMIN_PANEL_ACCESS);
  }, [user]);

  const { data: config } = useQuery<NavUserViewConfigResponse>({
    queryKey: ['/api/nav-user-view-config'],
    queryFn: async () => apiRequest('GET', '/api/nav-user-view-config'),
    enabled: canUseNavViewToggle,
    staleTime: 60_000,
  });

  const visibleNavIds = useMemo(() => {
    const ids =
      config?.visibleNavIds == null
        ? getDefaultNavUserViewVisibleIds(ALL_NAV_IDS)
        : config.visibleNavIds.filter((id) => ALL_NAV_IDS.includes(id));
    return new Set(ids);
  }, [config?.visibleNavIds]);

  const setViewMode = useCallback((mode: NavViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(NAV_VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  // If user loses admin access, fall back to admin view (no filtering).
  useEffect(() => {
    if (!canUseNavViewToggle && viewMode === 'user') {
      setViewMode('admin');
    }
  }, [canUseNavViewToggle, viewMode, setViewMode]);

  const isUserViewActive = canUseNavViewToggle && viewMode === 'user';

  const applyUserViewFilter = useCallback(
    (items: NavItem[]) => {
      if (!isUserViewActive) return items;
      return filterNavItemsForUserView(items, visibleNavIds);
    },
    [isUserViewActive, visibleNavIds],
  );

  const value = useMemo(
    () => ({
      viewMode,
      setViewMode,
      canUseNavViewToggle,
      isUserViewActive,
      visibleNavIds,
      applyUserViewFilter,
    }),
    [viewMode, setViewMode, canUseNavViewToggle, isUserViewActive, visibleNavIds, applyUserViewFilter],
  );

  return (
    <NavViewModeContext.Provider value={value}>{children}</NavViewModeContext.Provider>
  );
}

export function useNavViewMode(): NavViewModeContextValue {
  const ctx = useContext(NavViewModeContext);
  if (!ctx) {
    throw new Error('useNavViewMode must be used within NavViewModeProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside the provider. */
export function useNavViewModeOptional(): NavViewModeContextValue | null {
  return useContext(NavViewModeContext);
}

export { ALL_NAV_IDS, getDefaultNavUserViewVisibleIds };
