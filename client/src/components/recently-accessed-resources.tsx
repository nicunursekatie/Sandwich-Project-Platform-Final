import React, { useState, useEffect } from 'react';
import { Clock, ExternalLink, ArrowRight, FileText, Link2, Folder } from 'lucide-react';

interface Resource {
  resource: {
    id: number;
    title: string;
    description: string | null;
    type: 'file' | 'link' | 'google_drive';
    category: string;
    documentId: number | null;
    url: string | null;
    lastAccessedAt: string | null;
    accessCount: number;
  };
  lastAccessed: string;
  tags: Array<{ id: number; name: string; color: string | null }>;
}

export function RecentlyAccessedResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentResources();
  }, []);

  const loadRecentResources = async () => {
    try {
      const res = await fetch('/api/resources/user/recent?limit=5', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setResources(data);
      }
    } catch (error) {
      console.error('Error loading recent resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const openResource = async (resource: Resource) => {
    // Track access
    try {
      await fetch(`/api/resources/${resource.resource.id}/access`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error tracking access:', error);
    }

    // Open resource
    if (resource.resource.type === 'file' && resource.resource.documentId) {
      window.open(`/api/documents/${resource.resource.documentId}`, '_blank');
    } else if (resource.resource.url) {
      window.open(resource.resource.url, '_blank');
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'file':
        return FileText;
      case 'google_drive':
        return Folder;
      case 'link':
        return Link2;
      default:
        return FileText;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-[#47B3CB]" />
          <h2 className="font-semibold text-gray-900">Continue where you left off</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-[#47B3CB]" />
          <h2 className="font-semibold text-gray-900">Continue where you left off</h2>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">
            Nothing here yet — the files and links you open will show up here for quick access.
          </p>
          <a
            href="/dashboard?section=resources"
            className="inline-flex items-center gap-1 text-sm text-[#236383] hover:text-[#007E8C] font-medium"
          >
            Browse resources
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-[#47B3CB]" />
        <h2 className="font-semibold text-gray-900">Continue where you left off</h2>
      </div>

      <div className="space-y-1">
        {resources.map((resource) => {
          const Icon = getResourceIcon(resource.resource.type);

          return (
            <button
              key={resource.resource.id}
              onClick={() => openResource(resource)}
              className="w-full text-left p-2 rounded hover:bg-[#236383]/5 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate group-hover:text-[#236383] transition-colors">
                    {resource.resource.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-500">
                      {new Date(resource.lastAccessed).toLocaleDateString()}
                    </p>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs text-gray-500">
                      {resource.resource.accessCount} views
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <a
          href="/dashboard?section=resources"
          className="text-sm text-[#236383] hover:text-[#007E8C] font-medium flex items-center justify-center gap-1"
        >
          View all resources
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
