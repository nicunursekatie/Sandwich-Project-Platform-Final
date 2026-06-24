/**
 * UnifiedTopSearch
 *
 * One search bar that lives in the dark top navigation header. Searches BOTH:
 *   - App features / pages   (via /api/smart-search/fuzzy — previously the
 *                             sidebar's SmartSearch component)
 *   - People + organizations (via /api/people/search    — previously the
 *                             dashboard's DashboardSearch component)
 *
 * Results are queried in parallel and merged into a single dropdown grouped
 * by type: "Pages & Actions" first (faster to land on a screen), then
 * "People & Organizations". A consolidated bar lets the user search for
 * "recipients" and see both the Recipients Management section AND any
 * recipient records matching the query without remembering which search to
 * use.
 *
 * Lives in the persistent dark top header so a single, predictable spot
 * works on every page — Dashboard, Calendars, Collection Log, etc.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Search,
  X,
  Loader2,
  Building2,
  Mail,
  Phone,
  User,
  Truck,
  Heart,
  Users,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

// ── Result types ────────────────────────────────────────────────────────
// Matches the two upstream APIs verbatim so we can reuse their responses.

interface PageResult {
  kind: 'page';
  id: string;
  title: string;
  description?: string;
  route: string;
  action?: string;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'keyword';
}

interface PersonResult {
  kind: 'person';
  id: number | string;
  name: string;
  email: string | null;
  phone: string | null;
  sourceType: string;
  sourceLabel: string;
  organization?: string | null;
  link: string;
}

type UnifiedResult = PageResult | PersonResult;

// People-source iconography (mirrors DashboardSearch).
const PERSON_ICONS: Record<string, typeof User> = {
  user: User,
  driver: Truck,
  volunteer: Heart,
  host: Building2,
  hostContact: Building2,
  recipient: Users,
  recipientTspContact: Users,
  contact: Users,
};

const PERSON_BADGE_COLORS: Record<string, string> = {
  'Team Member': 'bg-blue-100 text-blue-700',
  Driver: 'bg-amber-100 text-amber-700',
  Volunteer: 'bg-green-100 text-green-700',
  Host: 'bg-purple-100 text-purple-700',
  'Host Contact': 'bg-purple-50 text-purple-600',
  Recipient: 'bg-rose-100 text-rose-700',
  'Recipient Contact': 'bg-rose-50 text-rose-600',
  'TSP Contact': 'bg-indigo-100 text-indigo-700',
  Contact: 'bg-gray-100 text-gray-700',
  'Event Request Org': 'bg-orange-100 text-orange-700',
  'Event Request Contact': 'bg-orange-50 text-orange-600',
  Organization: 'bg-teal-100 text-teal-700',
};

/**
 * Custom events the old SmartSearch used to dispatch when a "page result"
 * also carried an action like "open the add dialog." Preserved verbatim so
 * existing listeners (event-requests/index.tsx, etc.) keep working.
 */
function triggerFeatureAction(action: string | undefined, route: string) {
  if (!action || action !== 'openAddDialog') return;
  if (route.startsWith('/collections')) {
    window.dispatchEvent(new Event('openCollectionForm'));
  } else if (route.startsWith('/event-requests')) {
    window.dispatchEvent(new Event('openEventRequestCreateDialog'));
  } else if (route.startsWith('/projects')) {
    window.dispatchEvent(new Event('openProjectCreateDialog'));
  } else if (route.includes('section=hosts')) {
    window.dispatchEvent(new Event('openHostCreateDialog'));
  } else if (route.includes('section=volunteers')) {
    window.dispatchEvent(new Event('openVolunteerCreateDialog'));
  }
}

export function UnifiedTopSearch() {
  const [query, setQuery] = useState('');
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [, setLocation] = useLocation();

  const flatResults: UnifiedResult[] = [...pageResults, ...personResults];

  // ── Parallel search across both endpoints ─────────────────────────────
  const runSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setPageResults([]);
      setPersonResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      const [pagesRes, peopleRes] = await Promise.allSettled([
        fetch('/api/smart-search/fuzzy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query: trimmed, limit: 6 }),
        }),
        fetch(`/api/people/search?q=${encodeURIComponent(trimmed)}`, {
          credentials: 'include',
        }),
      ]);

      // Pages.
      let nextPages: PageResult[] = [];
      if (pagesRes.status === 'fulfilled' && pagesRes.value.ok) {
        try {
          const data = await pagesRes.value.json();
          nextPages = (data.results || []).map((r: any): PageResult => ({
            kind: 'page',
            id: String(r.feature?.id || r.id),
            title: r.feature?.title || r.title || '',
            description: r.feature?.description,
            route: r.feature?.route || '',
            action: r.feature?.action,
            matchType: r.matchType || 'fuzzy',
          }));
        } catch {
          // ignore parse error
        }
      }

      // People.
      let nextPeople: PersonResult[] = [];
      if (peopleRes.status === 'fulfilled' && peopleRes.value.ok) {
        try {
          const data = await peopleRes.value.json();
          nextPeople = (data.results || []).map(
            (r: any): PersonResult => ({
              kind: 'person',
              id: r.id,
              name: r.name,
              email: r.email,
              phone: r.phone,
              sourceType: r.sourceType,
              sourceLabel: r.sourceLabel,
              organization: r.organization,
              link: r.link,
            }),
          );
        } catch {
          // ignore parse error
        }
      }

      setPageResults(nextPages);
      setPersonResults(nextPeople);
      setSelectedIndex(-1);
      setIsOpen(nextPages.length + nextPeople.length > 0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced query handler.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 200);
  };

  // ── Result selection ──────────────────────────────────────────────────
  const navigateToResult = (result: UnifiedResult) => {
    setIsOpen(false);
    setQuery('');
    setPageResults([]);
    setPersonResults([]);
    if (result.kind === 'page') {
      setLocation(result.route);
      if (result.action) {
        // Defer so the route mounts before the dialog event fires.
        setTimeout(() => triggerFeatureAction(result.action, result.route), 200);
      }
    } else {
      window.history.pushState({}, '', result.link);
      // Fire a popstate so the dashboard's router-listening hook picks it up.
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen || flatResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((p) => Math.min(p + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((p) => Math.max(p - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      navigateToResult(flatResults[selectedIndex]);
    }
  };

  // ── Cmd/Ctrl+K focus shortcut ─────────────────────────────────────────
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // ── Click outside closes ──────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  // Build the per-row index lookup so keyboard nav can highlight one row
  // across the two grouped sections.
  let rowIdx = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-[420px]">
      {/* Compact dark-friendly search input designed for the top nav bar. */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search events, volunteers, or hosts..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (flatResults.length > 0) setIsOpen(true);
          }}
          className="w-full h-9 pl-8 pr-16 rounded-md text-sm bg-white/10 text-white placeholder:text-white placeholder:opacity-80 placeholder:font-normal border border-white/15 focus:outline-none focus:bg-white/20 focus:border-white/30 transition-colors"
          aria-label="Universal search"
          data-testid="unified-top-search"
        />
        {/* Trailing affordance: clear button when typing, Cmd+K hint otherwise. */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/60" />}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setPageResults([]);
                setPersonResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-0.5 rounded hover:bg-white/15 text-white/60 hover:text-white/90"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="hidden md:inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-mono text-white/40 border border-white/15">
              ⌘K
            </span>
          )}
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl max-h-[420px] overflow-y-auto z-[10000]">
          {pageResults.length === 0 && personResults.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {query.trim().length < 2 ? 'Type at least 2 characters…' : `No results for "${query}"`}
            </div>
          ) : (
            <div className="py-1">
              {pageResults.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Pages & Actions
                  </div>
                  {pageResults.map((r) => {
                    rowIdx += 1;
                    const active = rowIdx === selectedIndex;
                    return (
                      <button
                        key={`page-${r.id}`}
                        type="button"
                        onClick={() => navigateToResult(r)}
                        onMouseEnter={(() => {
                          const idx = pageResults.indexOf(r);
                          return () => setSelectedIndex(idx);
                        })()}
                        className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                          active ? 'bg-[#007E8C]/10' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-md bg-[#007E8C]/10 flex items-center justify-center shrink-0">
                          {r.matchType === 'semantic' ? (
                            <Sparkles className="w-3.5 h-3.5 text-[#007E8C]" />
                          ) : (
                            <Search className="w-3.5 h-3.5 text-[#007E8C]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {r.title}
                          </div>
                          {r.description && (
                            <div className="text-xs text-slate-500 truncate">{r.description}</div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                    );
                  })}
                </>
              )}

              {personResults.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    People & Organizations
                  </div>
                  {personResults.map((r) => {
                    rowIdx += 1;
                    const active = rowIdx === selectedIndex;
                    const Icon = PERSON_ICONS[r.sourceType] || Users;
                    const badgeColor =
                      PERSON_BADGE_COLORS[r.sourceLabel] || 'bg-gray-100 text-gray-700';
                    return (
                      <button
                        key={`person-${r.sourceType}-${r.id}`}
                        type="button"
                        onClick={() => navigateToResult(r)}
                        onMouseEnter={(() => {
                          const idx = pageResults.length + personResults.indexOf(r);
                          return () => setSelectedIndex(idx);
                        })()}
                        className={`w-full px-3 py-2 flex items-start gap-3 text-left transition-colors ${
                          active ? 'bg-[#007E8C]/10' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="mt-0.5 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {r.name}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0 rounded font-medium ${badgeColor}`}
                            >
                              {r.sourceLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                            {r.organization && (
                              <span className="flex items-center gap-1 truncate">
                                <Building2 className="w-3 h-3" />
                                {r.organization}
                              </span>
                            )}
                            {r.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3" />
                                {r.email}
                              </span>
                            )}
                            {r.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {r.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
