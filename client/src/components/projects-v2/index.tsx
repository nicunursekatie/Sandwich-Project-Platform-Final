import React from 'react';
import { ProjectProvider, useProjectContext } from './context/ProjectContext';
import { CreateProjectDialog } from './dialogs/CreateProjectDialog';
import { EditProjectDialog } from './dialogs/EditProjectDialog';
import { ProjectsTab } from './tabs/ProjectsTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  Circle,
  Play,
  CheckCircle2,
  Archive,
  Filter,
} from 'lucide-react';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { useAuth } from '@/hooks/useAuth';
import sandwichLogo from '@assets/LOGOS/Copy of TSP_transparent.png';

const ProjectsManagementContent: React.FC = () => {
  const {
    isLoading,
    activeTab,
    setActiveTab,
    projectTypeFilter,
    setProjectTypeFilter,
    searchQuery,
    setSearchQuery,
    setShowCreateDialog,
    getFilteredProjects,
    projectStats,
  } = useProjectContext();

  const { user } = useAuth();
  const filteredProjects = getFilteredProjects();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 font-roboto">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={sandwichLogo}
              alt="The Sandwich Project Logo"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-2xl font-bold text-brand-primary font-roboto">
                Project Management
              </h1>
              <p className="text-gray-600 font-roboto">
                Organize and track all team projects
              </p>
            </div>
          </div>
          {hasPermission(user, PERMISSIONS.PROJECTS_ADD) && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white font-roboto font-medium shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 font-roboto"
          />
        </div>

        {/* Project Type Filter */}
        <div className="flex gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProjectTypeFilter('all');
              // Keep current status tab when filtering by "All Projects"
            }}
            className={`transition-all ${
              projectTypeFilter === 'all'
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            All Projects
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProjectTypeFilter('meeting');
              // Show all meeting projects regardless of status
              setActiveTab('in_progress'); // Default to in_progress for better UX
            }}
            className={`transition-all ${
              projectTypeFilter === 'meeting'
                ? 'bg-brand-primary text-white hover:bg-brand-primary'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            📊 Meeting Projects ({projectStats.meeting})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProjectTypeFilter('internal');
              // Show all internal projects regardless of status
              setActiveTab('in_progress'); // Default to in_progress for better UX
            }}
            className={`transition-all ${
              projectTypeFilter === 'internal'
                ? 'bg-[#A31C41] text-white hover:bg-[#A31C41]/90'
                : 'text-[#A31C41] hover:text-[#A31C41]/80 hover:bg-[#A31C41]/10'
            }`}
          >
            🏢 Internal Projects ({projectStats.internal})
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('tabled')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'tabled'
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            <Circle className="w-4 h-4 mr-2" />
            Tabled ({projectStats.tabled})
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveTab('in_progress')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'in_progress'
                ? 'bg-[#FBAD3F] text-white hover:bg-[#FBAD3F]/90'
                : 'text-[#FBAD3F] hover:text-[#FBAD3F]/80 hover:bg-[#FBAD3F]/10'
            }`}
          >
            <Play className="w-4 h-4 mr-2" />
            In Progress ({projectStats.inProgress})
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveTab('completed')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'completed'
                ? 'bg-[#A31C41] text-white hover:bg-[#A31C41]/90'
                : 'text-[#A31C41] hover:text-[#A31C41]/80 hover:bg-[#A31C41]/10'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Completed ({projectStats.completed})
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveTab('archived')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'archived'
                ? 'bg-gray-500 text-white hover:bg-gray-600'
                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Archive className="w-4 h-4 mr-2" />
            Archived ({projectStats.archived})
          </Button>
        </div>
      </div>

      {/* Projects Display */}
      <ProjectsTab
        projects={filteredProjects}
        emptyMessage={
          searchQuery
            ? `No projects found matching "${searchQuery}"`
            : `No ${(activeTab || '').replace('_', ' ')} projects`
        }
      />

      {/* Dialogs */}
      <CreateProjectDialog />
      <EditProjectDialog />
    </div>
  );
};

// Main component with provider wrapper
export default function ProjectsManagementV2() {
  return (
    <ProjectProvider>
      <ProjectsManagementContent />
    </ProjectProvider>
  );
}