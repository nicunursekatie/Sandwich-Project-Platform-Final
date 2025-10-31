import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/auth-context';
import { ResourceAdminModal } from '../components/resource-admin-modal';
import {
  Search,
  Filter,
  Star,
  Link2,
  FileText,
  ExternalLink,
  Pin,
  TrendingUp,
  Clock,
  Plus,
  Edit,
  Trash2,
  Tag,
  Copy,
  Check,
  ChevronDown,
  Folder,
  Briefcase,
  Shield,
  FileCheck,
  BookOpen,
  FileEdit,
  X,
} from 'lucide-react';

// Category definitions with icons and colors (using brand color scheme)
const CATEGORIES = [
  {
    id: 'legal_governance',
    label: 'Legal & Governance',
    icon: Shield,
    color: 'text-[#236383]', // Brand dark blue
    bgColor: 'bg-[#236383]/10',
    borderColor: 'border-[#236383]/30',
  },
  {
    id: 'brand_marketing',
    label: 'Brand & Marketing',
    icon: Briefcase,
    color: 'text-[#FBAD3F]', // Brand orange
    bgColor: 'bg-[#FBAD3F]/10',
    borderColor: 'border-[#FBAD3F]/30',
  },
  {
    id: 'operations_safety',
    label: 'Operations & Safety',
    icon: Shield,
    color: 'text-[#007E8C]', // Brand teal
    bgColor: 'bg-[#007E8C]/10',
    borderColor: 'border-[#007E8C]/30',
  },
  {
    id: 'forms_templates',
    label: 'Forms & Templates',
    icon: FileCheck,
    color: 'text-[#47B3CB]', // Brand light blue
    bgColor: 'bg-[#47B3CB]/10',
    borderColor: 'border-[#47B3CB]/30',
  },
  {
    id: 'training',
    label: 'Training Materials',
    icon: BookOpen,
    color: 'text-[#236383]', // Brand dark blue
    bgColor: 'bg-[#236383]/10',
    borderColor: 'border-[#236383]/30',
  },
  {
    id: 'master_documents',
    label: 'Master Documents',
    icon: FileEdit,
    color: 'text-[#A31C41]', // Brand red/maroon
    bgColor: 'bg-[#A31C41]/10',
    borderColor: 'border-[#A31C41]/30',
  },
];

interface Resource {
  resource: {
    id: number;
    title: string;
    description: string | null;
    type: 'file' | 'link' | 'google_drive';
    category: string;
    documentId: number | null;
    url: string | null;
    icon: string | null;
    iconColor: string | null;
    isPinnedGlobal: boolean;
    pinnedOrder: number | null;
    accessCount: number;
    lastAccessedAt: string | null;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
  };
  isFavorite: boolean;
  tags: Array<{ id: number; name: string; color: string | null }>;
}

interface Tag {
  tag: {
    id: number;
    name: string;
    color: string | null;
    description: string | null;
  };
  usageCount: number;
}

export function Resources() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.permissions?.includes('manage_resources');

  const [resources, setResources] = useState<Resource[]>([]);
  const [favorites, setFavorites] = useState<Resource[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('smart');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load resources
  const loadResources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sort: sortBy,
        ...(selectedCategory && { category: selectedCategory }),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
      });

      const [resourcesRes, favoritesRes, recentRes, tagsRes] = await Promise.all([
        fetch(`/api/resources?${params}`, { credentials: 'include' }),
        fetch('/api/resources/user/favorites', { credentials: 'include' }),
        fetch('/api/resources/user/recent?limit=5', { credentials: 'include' }),
        fetch('/api/resources/tags/all', { credentials: 'include' }),
      ]);

      if (resourcesRes.ok) {
        const data = await resourcesRes.json();
        setResources(data);
      }

      if (favoritesRes.ok) {
        const data = await favoritesRes.json();
        setFavorites(data);
      }

      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecentResources(data);
      }

      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data);
      }
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [sortBy, selectedCategory, searchTerm, selectedTags]);

  // Track resource access
  const trackAccess = async (resourceId: number) => {
    try {
      await fetch(`/api/resources/${resourceId}/access`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error tracking access:', error);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (resourceId: number) => {
    try {
      const res = await fetch(`/api/resources/${resourceId}/favorite`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        await loadResources();
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Open resource
  const openResource = (resource: Resource) => {
    trackAccess(resource.resource.id);

    if (resource.resource.type === 'file' && resource.resource.documentId) {
      window.open(`/api/documents/${resource.resource.documentId}`, '_blank');
    } else if (resource.resource.url) {
      window.open(resource.resource.url, '_blank');
    }
  };

  // Copy link
  const copyLink = async (resource: Resource) => {
    let link = '';
    if (resource.resource.type === 'file' && resource.resource.documentId) {
      link = `${window.location.origin}/api/documents/${resource.resource.documentId}`;
    } else if (resource.resource.url) {
      link = resource.resource.url;
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(resource.resource.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  // Get category info
  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  };

  // Render resource card
  const ResourceCard = ({ item }: { item: Resource }) => {
    const category = getCategoryInfo(item.resource.category);
    const CategoryIcon = category.icon;
    const isCopied = copiedId === item.resource.id;

    return (
      <div
        className={`border ${category.borderColor} ${category.bgColor} rounded-lg p-4 hover:shadow-md transition-shadow relative`}
      >
        {/* Pinned badge */}
        {item.resource.isPinnedGlobal && (
          <div className="absolute top-2 right-2">
            <Pin className="w-4 h-4 text-[#FBAD3F] fill-[#FBAD3F]" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`${category.bgColor} p-2 rounded`}>
            <CategoryIcon className={`w-5 h-5 ${category.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1 truncate">
              {item.resource.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              {item.resource.description || 'No description'}
            </p>
          </div>
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700"
                style={
                  tag.color
                    ? { backgroundColor: `${tag.color}20`, color: tag.color }
                    : undefined
                }
              >
                <Tag className="w-3 h-3" />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {item.resource.accessCount} views
          </span>
          {item.resource.lastAccessedAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(item.resource.lastAccessedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openResource(item)}
            className="flex-1 bg-[#236383] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#007E8C] transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open
          </button>

          <button
            onClick={() => copyLink(item)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              isCopied
                ? 'bg-[#007E8C]/20 text-[#007E8C]'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Copy link"
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={() => toggleFavorite(item.resource.id)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              item.isFavorite
                ? 'bg-[#FBAD3F]/20 text-[#FBAD3F]'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`w-4 h-4 ${item.isFavorite ? 'fill-[#FBAD3F]' : ''}`}
            />
          </button>
        </div>
      </div>
    );
  };

  // Group resources by category
  const groupedResources = useMemo(() => {
    const groups: Record<string, Resource[]> = {};
    resources.forEach((resource) => {
      const cat = resource.resource.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(resource);
    });
    return groups;
  }, [resources]);

  // Pinned resources
  const pinnedResources = useMemo(() => {
    return resources.filter((r) => r.resource.isPinnedGlobal);
  }, [resources]);

  if (loading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading resources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Admin Modal */}
      <ResourceAdminModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadResources}
        availableTags={tags}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Resources</h1>
              <p className="text-gray-600 mt-1">
                Your central hub for all important documents, links, and materials
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-[#236383] text-white px-4 py-2 rounded-lg hover:bg-[#007E8C] transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Resource
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="smart">Smart Sort</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="recent">Recently Accessed</option>
                <option value="popular">Most Popular</option>
                <option value="newest">Newest First</option>
              </select>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Filter className="w-5 h-5" />
                Filters
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showFilters ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {/* Category Filter */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedCategory === null
                          ? 'bg-[#236383] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                            selectedCategory === cat.id
                              ? `${cat.bgColor} ${cat.color} border ${cat.borderColor}`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tag Filter */}
                {tags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const isSelected = selectedTags.includes(tag.tag.name);
                        return (
                          <button
                            key={tag.tag.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(
                                  selectedTags.filter((t) => t !== tag.tag.name)
                                );
                              } else {
                                setSelectedTags([...selectedTags, tag.tag.name]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#236383] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            style={
                              tag.tag.color && !isSelected
                                ? {
                                    backgroundColor: `${tag.tag.color}20`,
                                    color: tag.tag.color,
                                  }
                                : undefined
                            }
                          >
                            <Tag className="w-3 h-3" />
                            {tag.tag.name} ({tag.usageCount})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Access Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Pinned Resources */}
          {pinnedResources.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Pin className="w-5 h-5 text-[#FBAD3F]" />
                <h2 className="font-semibold text-gray-900">Pinned</h2>
              </div>
              <div className="space-y-2">
                {pinnedResources.slice(0, 3).map((resource) => (
                  <button
                    key={resource.resource.id}
                    onClick={() => openResource(resource)}
                    className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {resource.resource.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {resource.resource.accessCount} views
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Favorites */}
          {favorites.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-[#FBAD3F] fill-[#FBAD3F]" />
                <h2 className="font-semibold text-gray-900">Your Favorites</h2>
              </div>
              <div className="space-y-2">
                {favorites.slice(0, 3).map((fav) => (
                  <button
                    key={fav.resource.id}
                    onClick={() => openResource(fav)}
                    className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {fav.resource.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {fav.resource.accessCount} views
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recently Accessed */}
          {recentResources.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-[#47B3CB]" />
                <h2 className="font-semibold text-gray-900">Recently Accessed</h2>
              </div>
              <div className="space-y-2">
                {recentResources.slice(0, 3).map((recent) => (
                  <button
                    key={recent.resource.id}
                    onClick={() => openResource(recent)}
                    className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {recent.resource.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {recent.lastAccessed &&
                        new Date(recent.lastAccessed).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* All Resources */}
        {resources.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No resources found
            </h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory || selectedTags.length > 0
                ? 'Try adjusting your filters'
                : isAdmin
                ? 'Get started by adding your first resource'
                : 'Resources will appear here once they are added'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((category) => {
              const categoryResources = groupedResources[category.id] || [];
              if (categoryResources.length === 0) return null;

              const CategoryIcon = category.icon;

              return (
                <div key={category.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`${category.bgColor} p-2 rounded`}>
                      <CategoryIcon className={`w-6 h-6 ${category.color}`} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {category.label}
                    </h2>
                    <span className="text-sm text-gray-500">
                      ({categoryResources.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryResources.map((resource) => (
                      <ResourceCard key={resource.resource.id} item={resource} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
