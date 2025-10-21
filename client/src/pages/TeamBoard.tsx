import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import {
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Lightbulb,
  ClipboardList,
  StickyNote,
  Trash2,
  Search,
  X,
  User,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';

type BoardItemType = 'task' | 'note' | 'idea' | 'reminder';
type BoardItemStatus = 'open' | 'claimed' | 'done';

interface TeamBoardItem {
  id: number;
  content: string;
  type: BoardItemType;
  status: BoardItemStatus;
  createdBy: string;
  createdByName: string;
  assignedTo: string | null;
  assignedToName: string | null;
  completedAt: Date | null;
  createdAt: Date;
  commentCount: number;
}

interface TeamBoardComment {
  id: number;
  itemId: number;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

// Helper to get initials from name
const getInitials = (name: string) => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Helper to get consistent avatar color based on name
const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

// Comments component for team board items
function ItemComments({ itemId, initialCommentCount }: { itemId: number; initialCommentCount: number }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Fetch comments for this item
  const { data: comments = [], isLoading } = useQuery<TeamBoardComment[]>({
    queryKey: ['/api/team-board', itemId, 'comments'],
    queryFn: async () => {
      const res = await fetch(`/api/team-board/${itemId}/comments`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: isExpanded, // Only fetch when expanded
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('POST', `/api/team-board/${itemId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board', itemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] }); // Refresh item list for updated counts
      setNewComment('');
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive',
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      return await apiRequest('DELETE', `/api/team-board/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board', itemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] }); // Refresh item list for updated counts
      toast({
        title: 'Comment deleted',
        description: 'The comment has been removed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment.trim());
  };

  const handleDeleteComment = (commentId: number) => {
    if (confirm('Delete this comment?')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        data-testid={`button-comments-toggle-${itemId}`}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-medium">
            {initialCommentCount} {initialCommentCount === 1 ? 'Comment' : 'Comments'}
          </span>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Comments list */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                  data-testid={`comment-${comment.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className={`h-5 w-5 ${getAvatarColor(comment.userName)}`}>
                        <AvatarFallback className="text-white text-xs">
                          {getInitials(comment.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {comment.userName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {user?.id === comment.userId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        data-testid={`button-delete-comment-${comment.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
              No comments yet. Be the first to comment!
            </p>
          )}

          {/* Add comment form */}
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="text-sm"
              data-testid={`input-new-comment-${itemId}`}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || createCommentMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600"
              data-testid={`button-submit-comment-${itemId}`}
            >
              {createCommentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function TeamBoard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { track } = useOnboardingTracker();
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemType, setNewItemType] = useState<BoardItemType>('task');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<BoardItemType | 'all'>('all');

  // Track page visit for onboarding challenge
  useEffect(() => {
    track('view_team_board');
  }, []);

  // Fetch board items
  const { data: items = [], isLoading } = useQuery<TeamBoardItem[]>({
    queryKey: ['/api/team-board'],
  });

  // Filter items based on search and type
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.createdByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assignedToName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'all' || item.type === filterType;
      
      return matchesSearch && matchesType;
    });
  }, [items, searchQuery, filterType]);

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: { content: string; type: BoardItemType }) => {
      return await apiRequest('POST', '/api/team-board', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setNewItemContent('');
      toast({
        title: 'Posted!',
        description: 'Your item has been added to the board',
      });
      // Track challenge completion
      track('post_team_board');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create item',
        variant: 'destructive',
      });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: number; 
      updates: {
        status?: BoardItemStatus;
        assignedTo?: string | null;
        assignedToName?: string | null;
        completedAt?: string | null;
      };
    }) => {
      return await apiRequest('PATCH', `/api/team-board/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/team-board/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      toast({
        title: 'Deleted',
        description: 'Item removed from board',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemContent.trim()) return;

    createItemMutation.mutate({
      content: newItemContent.trim(),
      type: newItemType,
    });
  };

  const handleClaim = (item: TeamBoardItem) => {
    if (!user) return;
    
    const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    
    updateItemMutation.mutate({
      id: item.id,
      updates: {
        status: 'claimed',
        assignedTo: user.id,
        assignedToName: displayName,
      },
    });
  };

  const handleComplete = (item: TeamBoardItem) => {
    updateItemMutation.mutate({
      id: item.id,
      updates: {
        status: 'done',
        completedAt: new Date().toISOString(),
      },
    });
  };

  const handleReopen = (item: TeamBoardItem) => {
    updateItemMutation.mutate({
      id: item.id,
      updates: {
        status: 'open',
        assignedTo: null,
        assignedToName: null,
        completedAt: null,
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteItemMutation.mutate(id);
    }
  };

  const getTypeIcon = (type: BoardItemType) => {
    switch (type) {
      case 'task':
        return <ClipboardList className="h-4 w-4" />;
      case 'idea':
        return <Lightbulb className="h-4 w-4" />;
      case 'reminder':
        return <Clock className="h-4 w-4" />;
      case 'note':
      default:
        return <StickyNote className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: BoardItemType) => {
    switch (type) {
      case 'task':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
      case 'idea':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
      case 'reminder':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
      case 'note':
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Group items by status
  const openItems = filteredItems.filter(item => item.status === 'open');
  const claimedItems = filteredItems.filter(item => item.status === 'claimed');
  const doneItems = filteredItems.filter(item => item.status === 'done');

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Team Board
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Share tasks, ideas, and updates with the team
        </p>
      </div>

      {/* Quick Add Form */}
      <Card className="mb-6 border-teal-200 dark:border-teal-800 shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={newItemType}
                onValueChange={(value: BoardItemType) => setNewItemType(value)}
              >
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="What's on your mind? Type a task, idea, note, or reminder..."
                className="flex-1 min-h-[60px] resize-none"
                data-testid="input-content"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!newItemContent.trim() || createItemMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600"
                data-testid="button-post"
              >
                {createItemMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Post to Board
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
            data-testid="input-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={filterType}
          onValueChange={(value: BoardItemType | 'all') => setFilterType(value)}
        >
          <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
            <SelectItem value="idea">Ideas</SelectItem>
            <SelectItem value="reminder">Reminders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Board Items */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StickyNote className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-center">
              {searchQuery || filterType !== 'all' 
                ? 'No items match your search'
                : 'No items yet. Post the first one!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Open Items Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                Open
                <span className="text-sm font-normal text-gray-500">({openItems.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {openItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-gray-400" 
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="secondary" className={`capitalize ${getTypeColor(item.type)} flex items-center gap-1`}>
                        {getTypeIcon(item.type)}
                        {item.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <Avatar className={`h-6 w-6 ${getAvatarColor(item.createdByName)}`}>
                        <AvatarFallback className="text-white text-xs">
                          {getInitials(item.createdByName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{item.createdByName}</span>
                      <span>•</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    <Button
                      onClick={() => handleClaim(item)}
                      disabled={updateItemMutation.isPending}
                      className="w-full bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600 text-sm"
                      size="sm"
                      data-testid={`button-claim-${item.id}`}
                    >
                      <User className="h-3.5 w-3.5 mr-1.5" />
                      I'll Handle This
                    </Button>

                    {/* Comments section */}
                    <ItemComments itemId={item.id} initialCommentCount={item.commentCount} />
                  </CardContent>
                </Card>
              ))}
              {openItems.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No open items
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                In Progress
                <span className="text-sm font-normal text-gray-500">({claimedItems.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {claimedItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500" 
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="secondary" className={`capitalize ${getTypeColor(item.type)} flex items-center gap-1`}>
                        {getTypeIcon(item.type)}
                        {item.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Avatar className={`h-6 w-6 ${getAvatarColor(item.createdByName)}`}>
                          <AvatarFallback className="text-white text-xs">
                            {getInitials(item.createdByName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>Posted by <span className="font-medium">{item.createdByName}</span></span>
                      </div>
                      {item.assignedToName && (
                        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                          <Avatar className={`h-6 w-6 ${getAvatarColor(item.assignedToName)}`}>
                            <AvatarFallback className="text-white text-xs">
                              {getInitials(item.assignedToName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>Working on it: <span className="font-medium">{item.assignedToName}</span></span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleComplete(item)}
                        disabled={updateItemMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-sm"
                        size="sm"
                        data-testid={`button-complete-${item.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Mark Done
                      </Button>
                      <Button
                        onClick={() => handleReopen(item)}
                        disabled={updateItemMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                        data-testid={`button-reopen-${item.id}`}
                      >
                        Reopen
                      </Button>
                    </div>

                    {/* Comments section */}
                    <ItemComments itemId={item.id} initialCommentCount={item.commentCount} />
                  </CardContent>
                </Card>
              ))}
              {claimedItems.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No items in progress
                </div>
              )}
            </div>
          </div>

          {/* Done Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Done
                <span className="text-sm font-normal text-gray-500">({doneItems.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {doneItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500 opacity-90" 
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="secondary" className={`capitalize ${getTypeColor(item.type)} flex items-center gap-1`}>
                        {getTypeIcon(item.type)}
                        {item.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 whitespace-pre-wrap leading-relaxed line-through">
                      {item.content}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Avatar className={`h-6 w-6 ${getAvatarColor(item.createdByName)}`}>
                          <AvatarFallback className="text-white text-xs">
                            {getInitials(item.createdByName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>Posted by <span className="font-medium">{item.createdByName}</span></span>
                      </div>
                      {item.assignedToName && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                          <Avatar className={`h-6 w-6 ${getAvatarColor(item.assignedToName)}`}>
                            <AvatarFallback className="text-white text-xs">
                              {getInitials(item.assignedToName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>Completed by <span className="font-medium">{item.assignedToName}</span></span>
                        </div>
                      )}
                      {item.completedAt && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          Done: {new Date(item.completedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleReopen(item)}
                      disabled={updateItemMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="w-full text-sm"
                      data-testid={`button-reopen-${item.id}`}
                    >
                      Reopen
                    </Button>

                    {/* Comments section */}
                    <ItemComments itemId={item.id} initialCommentCount={item.commentCount} />
                  </CardContent>
                </Card>
              ))}
              {doneItems.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No completed items
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
