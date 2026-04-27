import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

export interface ViewPanel {
  id: string;
  section: string;
  title?: string;
}

interface MultiViewContextType {
  panels: ViewPanel[];
  activePanel: string | null;
  maxPanels: number;
  addPanel: (section: string, title?: string) => void;
  removePanel: (id: string) => void;
  updatePanelSection: (id: string, section: string, title?: string) => void;
  setActivePanel: (id: string) => void;
  canAddPanel: boolean;
  isMultiViewEnabled: boolean;
  setMultiViewEnabled: (enabled: boolean) => void;
  splitLayout: 'horizontal' | 'vertical';
  setSplitLayout: (layout: 'horizontal' | 'vertical') => void;
  navigateActivePanel: (section: string, title?: string) => void;
}

const MultiViewContext = createContext<MultiViewContextType | undefined>(undefined);

const MAX_PANELS = 4;

// Persisted to sessionStorage so the multi-view layout survives reloads
// (especially auto-reloads from the stale-chunk recovery path). sessionStorage
// is the right scope: lasts as long as the tab is open, but a brand-new tab
// starts fresh — we don't want a multi-view layout from yesterday surprising
// the user when they come back.
const STORAGE_KEY = 'tsp.multiView.v1';

interface PersistedState {
  panels: ViewPanel[];
  activePanel: string | null;
  isMultiViewEnabled: boolean;
  splitLayout: 'horizontal' | 'vertical';
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    // Validate shape — if anything is off, drop the snapshot rather than
    // crash the app on restore.
    if (
      !Array.isArray(parsed.panels) ||
      parsed.panels.length === 0 ||
      typeof parsed.isMultiViewEnabled !== 'boolean' ||
      (parsed.splitLayout !== 'horizontal' && parsed.splitLayout !== 'vertical')
    ) {
      return null;
    }
    // Each panel must have id+section
    if (!parsed.panels.every(p => p && typeof p.id === 'string' && typeof p.section === 'string')) {
      return null;
    }
    return {
      panels: parsed.panels as ViewPanel[],
      activePanel: typeof parsed.activePanel === 'string' ? parsed.activePanel : null,
      isMultiViewEnabled: parsed.isMultiViewEnabled,
      splitLayout: parsed.splitLayout,
    };
  } catch {
    return null;
  }
}

function generatePanelId(): string {
  return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function MultiViewProvider({
  children,
  initialSection = 'dashboard'
}: {
  children: React.ReactNode;
  initialSection?: string;
}) {
  // Restore the previous multi-view layout on mount (lazy initializer).
  // If nothing's persisted, fall back to the single-panel default.
  const persistedRef = useRef<PersistedState | null>(null);
  if (persistedRef.current === null) {
    persistedRef.current = loadPersistedState();
  }
  const persisted = persistedRef.current;

  const [panels, setPanels] = useState<ViewPanel[]>(() =>
    persisted?.panels ?? [{ id: 'primary', section: initialSection, title: 'Main View' }]
  );
  const [activePanel, setActivePanel] = useState<string | null>(() =>
    persisted?.activePanel ?? 'primary'
  );
  const [isMultiViewEnabled, setMultiViewEnabled] = useState(() =>
    persisted?.isMultiViewEnabled ?? false
  );
  const [splitLayout, setSplitLayout] = useState<'horizontal' | 'vertical'>(() =>
    persisted?.splitLayout ?? 'horizontal'
  );

  // After we've handled mount, the URL→primary sync should run as normal.
  // But on the FIRST render after a reload-with-restored-state, we skip that
  // sync once: otherwise the URL's `initialSection` would immediately clobber
  // the restored primary panel's section.
  const skipNextInitialSectionSyncRef = useRef<boolean>(persisted !== null);

  // Sync primary panel with initialSection when it changes from URL navigation
  useEffect(() => {
    if (skipNextInitialSectionSyncRef.current) {
      // Drop the first sync (restored from sessionStorage). Subsequent
      // navigations will run normally.
      skipNextInitialSectionSyncRef.current = false;
      return;
    }
    setPanels(prev => {
      const primary = prev.find(p => p.id === 'primary');
      if (primary && primary.section !== initialSection) {
        // In multi-view mode, update the active panel instead of primary
        if (isMultiViewEnabled && activePanel && activePanel !== 'primary') {
          return prev.map(p =>
            p.id === activePanel ? { ...p, section: initialSection } : p
          );
        }
        // In single-view or when primary is active, update primary panel
        return prev.map(p =>
          p.id === 'primary' ? { ...p, section: initialSection } : p
        );
      }
      return prev;
    });
  }, [initialSection, isMultiViewEnabled, activePanel]);

  // Persist whenever any piece of multi-view state changes. Cheap (small
  // payload, sessionStorage is sync but fast) and runs after render so it
  // never blocks paint.
  useEffect(() => {
    try {
      const snapshot: PersistedState = {
        panels,
        activePanel,
        isMultiViewEnabled,
        splitLayout,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // sessionStorage may be unavailable (Safari private mode, etc.). The
      // worst case is layout doesn't survive reload — same as before this
      // feature existed. Don't crash the app.
    }
  }, [panels, activePanel, isMultiViewEnabled, splitLayout]);

  const canAddPanel = useMemo(() => panels.length < MAX_PANELS, [panels.length]);

  const addPanel = useCallback((section: string, title?: string) => {
    if (!canAddPanel) return;

    setPanels(prev => {
      // Check if this section already has a panel
      const existingPanel = prev.find(p => p.section === section);
      if (existingPanel) {
        // Just focus the existing panel
        setActivePanel(existingPanel.id);
        return prev;
      }

      const newPanel: ViewPanel = {
        id: generatePanelId(),
        section,
        title: title || section,
      };

      // Auto-enable multi-view when adding a second panel
      if (prev.length === 1) {
        setMultiViewEnabled(true);
      }

      setActivePanel(newPanel.id);
      return [...prev, newPanel];
    });
  }, [canAddPanel]);

  const removePanel = useCallback((id: string) => {
    setPanels(prev => {
      // Don't allow removing the last panel
      if (prev.length <= 1) return prev;

      const newPanels = prev.filter(p => p.id !== id);

      // If we removed the active panel, activate another one
      if (activePanel === id && newPanels.length > 0) {
        setActivePanel(newPanels[newPanels.length - 1].id);
      }

      // Auto-disable multi-view when back to single panel
      if (newPanels.length === 1) {
        setMultiViewEnabled(false);
      }

      return newPanels;
    });
  }, [activePanel]);

  const updatePanelSection = useCallback((id: string, section: string, title?: string) => {
    setPanels(prev =>
      prev.map(panel =>
        panel.id === id
          ? { ...panel, section, title: title || section }
          : panel
      )
    );
  }, []);

  // Navigate whichever panel is currently focused (active)
  // This is the method sidebar navigation should call in multi-view mode
  const navigateActivePanel = useCallback((section: string, title?: string) => {
    const targetPanelId = activePanel || 'primary';
    setPanels(prev =>
      prev.map(panel =>
        panel.id === targetPanelId
          ? { ...panel, section, title: title || section }
          : panel
      )
    );
  }, [activePanel]);

  const value = useMemo(() => ({
    panels,
    activePanel,
    maxPanels: MAX_PANELS,
    addPanel,
    removePanel,
    updatePanelSection,
    setActivePanel,
    canAddPanel,
    isMultiViewEnabled,
    setMultiViewEnabled,
    splitLayout,
    setSplitLayout,
    navigateActivePanel,
  }), [
    panels,
    activePanel,
    addPanel,
    removePanel,
    updatePanelSection,
    canAddPanel,
    isMultiViewEnabled,
    splitLayout,
    navigateActivePanel,
  ]);

  return (
    <MultiViewContext.Provider value={value}>
      {children}
    </MultiViewContext.Provider>
  );
}

export function useMultiView() {
  const context = useContext(MultiViewContext);
  if (!context) {
    throw new Error('useMultiView must be used within MultiViewProvider');
  }
  return context;
}

// Hook for components that want to open content in a new panel
export function useOpenInPanel() {
  const { addPanel, canAddPanel } = useMultiView();

  return useCallback((section: string, title?: string) => {
    if (canAddPanel) {
      addPanel(section, title);
    }
  }, [addPanel, canAddPanel]);
}
