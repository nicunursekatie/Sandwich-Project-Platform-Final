import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotes, type NotesFilters, type MeetingNote } from '../hooks/useNotes';
import { formatDateForDisplay } from '@/lib/date-utils';
import {
  Search,
  Plus,
  FileText,
  MessageSquare,
  Calendar,
  User,
  Filter,
  MoreVertical,
  Edit3,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  Clock,
  Tag,
  Lightbulb,
  Users,
  AlertCircle,
} from 'lucide-react';
import type { UseMutationResult, QueryClient } from '@tanstack/react-query';
import type { ToastActionElement } from '@/components/ui/toast';

// Import types from hooks
import type { Meeting } from '../hooks/useMeetings';
import type { Project } from '../hooks/useProjects';

// Toast function type
type ToastFunction = (props: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  action?: ToastActionElement;
}) => void;

interface NotesTabProps {
  // State
  selectedMeeting: Meeting | null;
  meetings: Meeting[];
  allProjects: Project[];
  
  // Handlers (for agenda integration)
  handleSendToAgenda?: (projectId: number) => void;
  
  // Dependencies
  queryClient: QueryClient;
  toast: ToastFunction;
}

export function NotesTab({
  selectedMeeting,
  meetings,
  allProjects,
  handleSendToAgenda,
  queryClient,
  toast,
}: NotesTabProps) {
  // Local state for filters and UI
  const [filters, setFilters] = useState<NotesFilters>({
    type: 'all',
    status: 'active',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<MeetingNote | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<MeetingNote | null>(null);
  
  // Form states
  const [createFormData, setCreateFormData] = useState({
    projectId: '',
    meetingId: selectedMeeting?.id?.toString() || '',
    type: 'discussion' as 'discussion' | 'meeting',
    content: '',
    status: 'active' as 'active' | 'archived',
  });
  const [editFormData, setEditFormData] = useState({
    content: '',
    type: 'discussion' as 'discussion' | 'meeting',
    status: 'active' as 'active' | 'archived',
  });

  // Use the notes hook with current filters
  const {
    notes,
    notesLoading,
    createNoteMutation,
    updateNoteMutation,
    deleteNoteMutation,
    bulkUpdateStatusMutation,
    bulkDeleteMutation,
  } = useNotes({
    ...filters,
    search: searchQuery,
  });

  // Memoized data for performance
  const notesWithProjectInfo = useMemo(() => {
    return notes.map(note => {
      const project = allProjects.find(p => p.id === note.projectId);
      const meeting = meetings.find(m => m.id === note.meetingId);
      return {
        ...note,
        projectTitle: project?.title || 'Unknown Project',
        meetingTitle: meeting?.title || null,
      };
    });
  }, [notes, allProjects, meetings]);

  const filteredNotes = useMemo(() => {
    return notesWithProjectInfo.filter(note => {
      if (!searchQuery) return true;
      const searchLower = searchQuery.toLowerCase();
      return (
        note.content.toLowerCase().includes(searchLower) ||
        note.projectTitle.toLowerCase().includes(searchLower) ||
        note.meetingTitle?.toLowerCase().includes(searchLower) ||
        note.createdByName?.toLowerCase().includes(searchLower)
      );
    });
  }, [notesWithProjectInfo, searchQuery]);

  // Handler functions
  const handleFilterChange = (key: keyof NotesFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCreateNote = () => {
    if (!createFormData.projectId || !createFormData.content.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a project and enter note content.',
        variant: 'destructive',
      });
      return;
    }

    createNoteMutation.mutate({
      projectId: parseInt(createFormData.projectId),
      meetingId: createFormData.meetingId ? parseInt(createFormData.meetingId) : undefined,
      type: createFormData.type,
      content: createFormData.content.trim(),
      status: createFormData.status,
    }, {
      onSuccess: () => {
        setShowCreateDialog(false);
        setCreateFormData({
          projectId: '',
          meetingId: selectedMeeting?.id?.toString() || '',
          type: 'discussion',
          content: '',
          status: 'active',
        });
      }
    });
  };

  const handleEditNote = (note: MeetingNote) => {
    setNoteToEdit(note);
    setEditFormData({
      content: note.content,
      type: note.type,
      status: note.status,
    });
    setShowEditDialog(true);
  };

  const handleUpdateNote = () => {
    if (!noteToEdit || !editFormData.content.trim()) return;

    updateNoteMutation.mutate({
      id: noteToEdit.id,
      updates: {
        content: editFormData.content.trim(),
        type: editFormData.type,
        status: editFormData.status,
      },
    }, {
      onSuccess: () => {
        setShowEditDialog(false);
        setNoteToEdit(null);
      }
    });
  };

  const handleDeleteNote = (note: MeetingNote) => {
    setNoteToDelete(note);
    setShowDeleteDialog(true);
  };

  const confirmDeleteNote = () => {
    if (!noteToDelete) return;

    deleteNoteMutation.mutate(noteToDelete.id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        setNoteToDelete(null);
        setSelectedNoteIds(prev => prev.filter(id => id !== noteToDelete.id));
      }
    });
  };

  const handleBulkStatusChange = (status: 'active' | 'archived') => {
    if (selectedNoteIds.length === 0) return;

    bulkUpdateStatusMutation.mutate({
      noteIds: selectedNoteIds,
      status,
    }, {
      onSuccess: () => {
        setSelectedNoteIds([]);
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedNoteIds.length === 0) return;

    bulkDeleteMutation.mutate(selectedNoteIds, {
      onSuccess: () => {
        setSelectedNoteIds([]);
      }
    });
  };

  const handleSelectNote = (noteId: number, checked: boolean) => {
    setSelectedNoteIds(prev => {
      if (checked) {
        return [...prev, noteId];
      } else {
        return prev.filter(id => id !== noteId);
      }
    });
  };

  const handleSelectAllNotes = (checked: boolean) => {
    if (checked) {
      setSelectedNoteIds(filteredNotes.map(note => note.id));
    } else {
      setSelectedNoteIds([]);
    }
  };

  const toggleNoteExpanded = (noteId: number) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleUseInAgenda = (note: MeetingNote) => {
    if (handleSendToAgenda) {
      handleSendToAgenda(note.projectId);
      toast({
        title: 'Added to Agenda',
        description: `Note for "${note.projectTitle}" has been added to agenda planning.`,
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'discussion':
        return 'bg-gradient-to-r from-[#47B3CB]/20 to-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/30 shadow-[#007E8C]/10';
      case 'meeting':
        return 'bg-gradient-to-r from-[#A31C41]/20 to-[#A31C41]/30 text-[#A31C41] border-[#A31C41]/40 shadow-[#A31C41]/10';
      default:
        return 'bg-gradient-to-r from-[#D1D3D4]/20 to-[#646464]/10 text-[#646464] border-[#D1D3D4]/30 shadow-[#D1D3D4]/10';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' 
      ? 'bg-gradient-to-r from-[#007E8C]/20 to-[#47B3CB]/20 text-[#007E8C] border-[#007E8C]/30 shadow-[#007E8C]/10'
      : 'bg-gradient-to-r from-[#D1D3D4]/20 to-[#646464]/10 text-[#646464] border-[#D1D3D4]/30 shadow-[#D1D3D4]/10';
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Parse and render structured note content
  const renderNoteContent = (note: MeetingNote) => {
    try {
      // Try to parse as JSON for structured notes
      const parsed = JSON.parse(note.content);

      // Check if it's a structured note from agenda planning
      if (parsed.projectTitle || parsed.title) {
        return (
          <div className="space-y-4">
            {/* Project/Item Card with enhanced styling */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Project/Item Title with badges */}
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-lg text-gray-900">
                    {parsed.projectTitle || parsed.title}
                  </span>
                  {parsed.category && (
                    <Badge variant="outline" className="text-xs">
                      {parsed.category}
                    </Badge>
                  )}
                  {parsed.priority && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        parsed.priority === 'high' ? 'border-red-500 text-red-700' :
                        parsed.priority === 'medium' ? 'border-yellow-500 text-yellow-700' :
                        'border-gray-400 text-gray-600'
                      }`}
                    >
                      {parsed.priority}
                    </Badge>
                  )}
                  {parsed.status === 'tabled' && (
                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                      Tabled
                    </Badge>
                  )}
                  {parsed.type === 'off-agenda' && (
                    <Badge className="bg-purple-100 text-purple-700 text-xs">
                      Off-Agenda
                    </Badge>
                  )}
                </div>

                {/* Discussion Points Card */}
                {parsed.discussionPoints && (
                  <Card className="mb-3 bg-teal-50 border-teal-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-teal-600 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-teal-700 mb-1">Discussion Points</p>
                          <p className="text-gray-700 whitespace-pre-wrap text-sm">{parsed.discussionPoints}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Decision Items Card */}
                {parsed.decisionItems && (
                  <Card className="mb-3 bg-rose-50 border-rose-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-rose-600 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-rose-700 mb-1">Decision Items</p>
                          <p className="text-gray-700 whitespace-pre-wrap text-sm">{parsed.decisionItems}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Off-Agenda Content Card */}
                {parsed.type === 'off-agenda' && parsed.content && (
                  <Card className="mb-3 bg-purple-50 border-purple-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-purple-600 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-purple-700 mb-1">Content</p>
                          <p className="text-gray-700 whitespace-pre-wrap text-sm">{parsed.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Metadata Bar */}
                {(parsed.assignee || parsed.supportPeople || parsed.reviewInNextMeeting) && (
                  <div className="flex flex-wrap gap-3 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200">
                    {parsed.assignee && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-blue-500" />
                        <span>Assigned: {parsed.assignee}</span>
                      </div>
                    )}
                    {parsed.supportPeople && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-green-500" />
                        <span>Support: {parsed.supportPeople}</span>
                      </div>
                    )}
                    {parsed.reviewInNextMeeting && (
                      <Badge variant="secondary" className="text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        Review Next Meeting
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }

      // If it's not our structured format, return the parsed content as-is
      return <p className="text-gray-900 whitespace-pre-wrap">{note.content}</p>;
    } catch {
      // If it's not JSON, render as plain text
      return (
        <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">
          {expandedNotes.has(note.id)
            ? note.content
            : truncateText(note.content)
          }
        </div>
      );
    }
  };

  if (notesLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-notes-search"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            data-testid="button-create-note"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="project-filter" className="text-sm font-medium">
            Project:
          </Label>
          <Select
            value={filters.projectId ? filters.projectId.toString() : 'all'}
            onValueChange={(value) => handleFilterChange('projectId', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="w-48" data-testid="select-project-filter">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {allProjects.map(project => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="type-filter" className="text-sm font-medium">
            Type:
          </Label>
          <Select
            value={filters.type || 'all'}
            onValueChange={(value) => handleFilterChange('type', value)}
          >
            <SelectTrigger className="w-32" data-testid="select-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="discussion">Discussion Points</SelectItem>
              <SelectItem value="meeting">Decision Items</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="text-sm font-medium">
            Status:
          </Label>
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger className="w-32" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="meeting-filter" className="text-sm font-medium">
            Meeting:
          </Label>
          <Select
            value={filters.meetingId ? filters.meetingId.toString() : 'all'}
            onValueChange={(value) => handleFilterChange('meetingId', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="w-48" data-testid="select-meeting-filter">
              <SelectValue placeholder="All Meetings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Meetings</SelectItem>
              {meetings.map(meeting => (
                <SelectItem key={meeting.id} value={meeting.id.toString()}>
                  {meeting.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedNoteIds.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">
            {selectedNoteIds.length} note(s) selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkStatusChange('active')}
            data-testid="button-bulk-activate"
          >
            <ArchiveRestore className="w-4 h-4 mr-1" />
            Activate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkStatusChange('archived')}
            data-testid="button-bulk-archive"
          >
            <Archive className="w-4 h-4 mr-1" />
            Archive
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 mb-4">
                {searchQuery ? 'No notes match your search' : 'No notes found'}
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                data-testid="button-create-first-note"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Note
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Select All Checkbox */}
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                checked={selectedNoteIds.length === filteredNotes.length}
                onCheckedChange={handleSelectAllNotes}
                data-testid="checkbox-select-all-notes"
              />
              <Label className="text-sm text-gray-600">
                Select all visible notes
              </Label>
            </div>

            {/* Notes */}
            {filteredNotes.map((note) => (
              <Card key={note.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={selectedNoteIds.includes(note.id)}
                        onCheckedChange={(checked) => handleSelectNote(note.id, checked as boolean)}
                        data-testid={`checkbox-note-${note.id}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getTypeColor(note.type)}>
                            {note.type === 'discussion' ? (
                              <>
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Discussion Points
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Decision Items
                              </>
                            )}
                          </Badge>
                          <Badge className={getStatusColor(note.status)}>
                            {note.status === 'active' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Active
                              </>
                            ) : (
                              <>
                                <Archive className="w-3 h-3 mr-1" />
                                Archived
                              </>
                            )}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium text-teal-700 mb-1">
                          {note.projectTitle}
                        </div>
                        {note.meetingTitle && (
                          <div className="text-sm text-gray-600 mb-2">
                            Meeting: {note.meetingTitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditNote(note)}
                        data-testid={`button-edit-note-${note.id}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteNote(note)}
                        data-testid={`button-delete-note-${note.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-4">
                    <div data-testid={`text-note-content-${note.id}`}>
                      {renderNoteContent(note)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {note.createdByName && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {note.createdByName}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateForDisplay(note.createdAt)}
                      </div>
                    </div>
                    
                    {handleSendToAgenda && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUseInAgenda(note)}
                        className="text-teal-600 border-teal-200 hover:bg-teal-50"
                        data-testid={`button-use-in-agenda-${note.id}`}
                      >
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Use in Next Agenda
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Create Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-create-note">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>
              Add a new meeting note for project discussion or decisions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-select">Project *</Label>
              <Select
                value={createFormData.projectId}
                onValueChange={(value) => setCreateFormData(prev => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger data-testid="select-create-note-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {allProjects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="meeting-select">Meeting (Optional)</Label>
              <Select
                value={createFormData.meetingId}
                onValueChange={(value) => setCreateFormData(prev => ({ ...prev, meetingId: value }))}
              >
                <SelectTrigger data-testid="select-create-note-meeting">
                  <SelectValue placeholder="No specific meeting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific meeting</SelectItem>
                  {meetings.map(meeting => (
                    <SelectItem key={meeting.id} value={meeting.id.toString()}>
                      {meeting.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type-select">Note Type</Label>
              <Select
                value={createFormData.type}
                onValueChange={(value: 'discussion' | 'meeting') => setCreateFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger data-testid="select-create-note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discussion">Discussion Points</SelectItem>
                  <SelectItem value="meeting">Decision Items</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="note-content">Note Content *</Label>
              <Textarea
                id="note-content"
                placeholder="Enter your note content..."
                value={createFormData.content}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
                className="resize-none"
                data-testid="textarea-create-note-content"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              data-testid="button-cancel-create-note"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={createNoteMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
              data-testid="button-save-create-note"
            >
              {createNoteMutation.isPending ? 'Creating...' : 'Create Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-edit-note">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Update the note content, type, or status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-type-select">Note Type</Label>
              <Select
                value={editFormData.type}
                onValueChange={(value: 'discussion' | 'meeting') => setEditFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger data-testid="select-edit-note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discussion">Discussion Points</SelectItem>
                  <SelectItem value="meeting">Decision Items</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-status-select">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value: 'active' | 'archived') => setEditFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger data-testid="select-edit-note-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-note-content">Note Content *</Label>
              <Textarea
                id="edit-note-content"
                placeholder="Enter your note content..."
                value={editFormData.content}
                onChange={(e) => setEditFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
                className="resize-none"
                data-testid="textarea-edit-note-content"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="button-cancel-edit-note"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateNote}
              disabled={updateNoteMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
              data-testid="button-save-edit-note"
            >
              {updateNoteMutation.isPending ? 'Updating...' : 'Update Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-note-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-note">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteNote}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-note"
            >
              {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}