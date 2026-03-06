import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, User, Building2, Truck, Heart, Users, Phone, Mail, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  id: number | string;
  name: string;
  email: string | null;
  phone: string | null;
  sourceType: string;
  sourceLabel: string;
  organization?: string | null;
  role?: string | null;
  link: string;
}

const sourceIcons: Record<string, typeof User> = {
  user: User,
  driver: Truck,
  volunteer: Heart,
  host: Building2,
  hostContact: Building2,
  recipient: Users,
  recipientTspContact: Users,
  contact: Users,
};

const sourceColors: Record<string, string> = {
  'Team Member': 'bg-blue-100 text-blue-700',
  'Driver': 'bg-amber-100 text-amber-700',
  'Volunteer': 'bg-green-100 text-green-700',
  'Host': 'bg-purple-100 text-purple-700',
  'Host Contact': 'bg-purple-50 text-purple-600',
  'Recipient': 'bg-rose-100 text-rose-700',
  'Recipient Contact': 'bg-rose-50 text-rose-600',
  'TSP Contact': 'bg-indigo-100 text-indigo-700',
  'Contact': 'bg-gray-100 text-gray-700',
  'Event Request Org': 'bg-orange-100 text-orange-700',
  'Event Request Contact': 'bg-orange-50 text-orange-600',
  'Organization': 'bg-teal-100 text-teal-700',
};

export function DashboardSearch({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen(true);
      }
    } catch {
      // Silently handle network errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);

    // Use pushState for client-side navigation so dashboard detects the URL change
    // without a full page reload
    window.history.pushState({}, '', result.link);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search contacts, organizations, hosts, recipients, drivers, volunteers..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          className="pl-10 pr-10 py-3 text-base rounded-xl border-2 border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20 shadow-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border shadow-lg max-h-[400px] overflow-y-auto z-50">
          {isLoading && results.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-1">
              {results.map((result, index) => {
                const Icon = sourceIcons[result.sourceType] || Users;
                const badgeColor = sourceColors[result.sourceLabel] || 'bg-gray-100 text-gray-700';

                return (
                  <button
                    key={`${result.sourceType}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-3 flex items-start gap-3 text-left transition-colors ${
                      index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 truncate">
                          {result.name}
                        </span>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${badgeColor}`}>
                          {result.sourceLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        {result.organization && (
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="w-3 h-3" />
                            {result.organization}
                          </span>
                        )}
                        {result.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {result.email}
                          </span>
                        )}
                        {result.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {result.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
