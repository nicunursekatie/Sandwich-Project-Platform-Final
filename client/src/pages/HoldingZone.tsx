import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { MentionTextarea, MessageWithMentions } from '@/components/mention-input';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import {
  Loader2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  User,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  Calendar,
  Filter,
  Heart,
  UserPlus,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

// Types
interface HoldingZoneCategory {
  id: number;
  name: string;
  color: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

interface HoldingZoneItem {
  id: number;
  content: string;
  type: 'task' | 'note' | 'idea';
  status: 'open' | 'claimed' | 'done';
  createdBy: string;
  createdByName: string;
  assignedTo: string[] | null;
  assignedToNames: string[] | null;
  completedAt: Date | null;
  createdAt: Date;
  commentCount: number;
  category: HoldingZoneCategory | null;
  categoryId: number | null;
  isUrgent: boolean;
  likeCount?: number;
  userHasLiked?: boolean;
}

interface Comment {
  id: number;
  itemId: number;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
}

// Helper functions
const getInitials = (name: string | null | undefined) => {
  if (!name || typeof name !== 'string') return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (name: string | null | undefined) => {
  const colors = [
    'bg-[#236383]', 'bg-[#007E8C]', 'bg-[#47B3CB]', 'bg-[#FBAD3F]',
    'bg-[#A31C41]', 'bg-[#2E7D32]',
  ];
  if (!name || typeof name !== 'string') return colors[0];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Category badge component
function CategoryBadge({ category }: { category: HoldingZoneCategory | null }) {
  if (!category) return null;
  
  return (
    <Badge 
      className="font-medium text-white border-0" 
      style={{ backgroundColor: category.color }}
      data-testid={`badge-category-${category.id}`}
    >
      {category.name}
    </Badge>
  );
}

// Item comments component
function ItemComments({ itemId, initialCommentCount, canView, canSubmit }: { itemId: number; initialCommentCount: number; canView: boolean; canSubmit: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['/api/team-board', itemId, 'comments'],
    enabled: isExpanded && canView,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('POST', `/api/team-board/${itemId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board', itemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
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

  const handleSubmitComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment.trim());
  };

  // If user doesn't have VIEW permission, don't show comment section at all
  if (!canView) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-[#007E8C] dark:text-[#47B3CB] hover:text-[#236383] dark:hover:text-[#FBAD3F] transition-colors font-medium"
        data-testid={`button-comments-toggle-${itemId}`}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span>
            {initialCommentCount} {initialCommentCount === 1 ? 'Comment' : 'Comments'}
          </span>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                  data-testid={`comment-${comment.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className={`h-5 w-5 ${getAvatarColor(comment.userName)}`}>
                      <AvatarFallback className="text-white text-xs">
                        {getInitials(comment.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {comment.userName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    <MessageWithMentions content={comment.content} />
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">No comments yet</p>
          )}

          {canSubmit ? (
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                placeholder="Add a comment... Use @ to mention team members"
                className="flex-1 min-h-[60px] text-sm"
                data-testid={`textarea-comment-${itemId}`}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newComment.trim() || createCommentMutation.isPending}
                className="self-end"
                data-testid={`button-submit-comment-${itemId}`}
              >
                {createCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          ) : (
            <div className="text-sm text-gray-500 text-center py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              You need Submit permission to comment
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Holding Zone component
export default function HoldingZone() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemType, setNewItemType] = useState<'task' | 'note' | 'idea'>('task');
  const [newItemCategoryId, setNewItemCategoryId] = useState<string>('');
  const [newItemIsUrgent, setNewItemIsUrgent] = useState(false);

  // Permission checks
  const canView = user?.permissions?.includes('VIEW_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';
  const canSubmit = user?.permissions?.includes('SUBMIT_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';
  const canManage = user?.permissions?.includes('MANAGE_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';

  // Fetch categories
  const { data: categories = [] } = useQuery<HoldingZoneCategory[]>({
    queryKey: ['/api/holding-zone/categories'],
    enabled: canView,
  });

  // Fetch holding zone items
  const { data: items = [], isLoading } = useQuery<HoldingZoneItem[]>({
    queryKey: ['/api/team-board'],
    enabled: canView,
  });

  // Filter items
  const filteredItems = useMemo(() => {
    let filtered = items;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => String(item.categoryId) === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(item => item.status === selectedStatus);
    }

    if (showUrgentOnly) {
      filtered = filtered.filter(item => item.isUrgent);
    }

    return filtered;
  }, [items, selectedCategory, selectedStatus, showUrgentOnly]);

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      type: 'task' | 'note' | 'idea';
      categoryId: number | null;
      isUrgent: boolean;
    }) => {
      return await apiRequest('POST', '/api/team-board', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setIsSubmitDialogOpen(false);
      setNewItemContent('');
      setNewItemType('task');
      setNewItemCategoryId('');
      setNewItemIsUrgent(false);
      toast({
        title: 'Item submitted',
        description: 'Your item has been added to the holding zone',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit item',
        variant: 'destructive',
      });
    },
  });

  // Update item status mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'open' | 'claimed' | 'done' }) => {
      return await apiRequest('PATCH', `/api/team-board/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      toast({
        title: 'Status updated',
        description: 'Item status has been changed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    },
  });

  // Update item assignments mutation
  const updateAssignmentsMutation = useMutation({
    mutationFn: async ({ id, assignedTo, assignedToNames }: { 
      id: number; 
      assignedTo: string[] | null; 
      assignedToNames: string[] | null; 
    }) => {
      return await apiRequest('PATCH', `/api/team-board/${id}`, { assignedTo, assignedToNames });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      toast({
        title: 'Assignment updated',
        description: 'Team member assignments have been updated',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update assignments',
        variant: 'destructive',
      });
    },
  });

  // Like/Unlike mutation
  const toggleLikeMutation = useMutation({
    mutationFn: async ({ itemId, isLiked }: { itemId: number; isLiked: boolean }) => {
      if (isLiked) {
        return await apiRequest('DELETE', `/api/team-board/items/${itemId}/like`);
      } else {
        return await apiRequest('POST', `/api/team-board/items/${itemId}/like`);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/team-board/items/${variables.itemId}/likes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    },
  });

  // Fetch team members for assignment
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-board/users'],
    enabled: canSubmit || canManage,
  });

  const handleSubmitItem = () => {
    if (!newItemContent.trim()) {
      toast({
        title: 'Content required',
        description: 'Please enter item content',
        variant: 'destructive',
      });
      return;
    }

    createItemMutation.mutate({
      content: newItemContent.trim(),
      type: newItemType,
      categoryId: newItemCategoryId ? parseInt(newItemCategoryId) : null,
      isUrgent: newItemIsUrgent,
    });
  };

  // Assignment helpers
  const handleAssignToUser = (item: HoldingZoneItem, userId: string) => {
    const member = teamMembers.find(m => m.id === userId);
    if (!member) return;

    const currentAssignedTo = item.assignedTo || [];
    const currentAssignedToNames = item.assignedToNames || [];

    if (currentAssignedTo.includes(member.id)) {
      toast({
        title: 'Already assigned',
        description: `${member.name} is already assigned to this item`,
      });
      return;
    }

    updateAssignmentsMutation.mutate({
      id: item.id,
      assignedTo: [...currentAssignedTo, member.id],
      assignedToNames: [...currentAssignedToNames, member.name],
    });
  };

  const handleUnassign = (item: HoldingZoneItem, userId: string) => {
    const currentAssignedTo = item.assignedTo || [];
    const currentAssignedToNames = item.assignedToNames || [];
    
    const userIndex = currentAssignedTo.indexOf(userId);
    if (userIndex === -1) return;

    const newAssignedTo = currentAssignedTo.filter((_, i) => i !== userIndex);
    const newAssignedToNames = currentAssignedToNames.filter((_, i) => i !== userIndex);

    updateAssignmentsMutation.mutate({
      id: item.id,
      assignedTo: newAssignedTo.length === 0 ? null : newAssignedTo,
      assignedToNames: newAssignedToNames.length === 0 ? null : newAssignedToNames,
    });
  };

  // Like Button Component
  const LikeButton = ({ itemId }: { itemId: number }) => {
    const { data: likesData } = useQuery({
      queryKey: [`/api/team-board/items/${itemId}/likes`],
      queryFn: async () => {
        return await apiRequest('GET', `/api/team-board/items/${itemId}/likes`);
      },
    });

    const isLiked = likesData?.userHasLiked || false;
    const likeCount = likesData?.likes || 0;

    if (!canSubmit) return null;

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleLikeMutation.mutate({ itemId, isLiked })}
        className={`h-7 px-2 gap-1 ${isLiked ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
        data-testid={`button-like-${itemId}`}
      >
        <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
        {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
      </Button>
    );
  };

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <PageBreadcrumbs items={[{ label: 'Holding Zone' }]} />
        <Card className="mt-6">
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to view the Holding Zone
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <PageBreadcrumbs items={[{ label: 'Holding Zone' }]} />

      {/* Header */}
      <div className="flex items-center justify-between mt-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Holding Zone</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Submit and track tasks, notes, and ideas for the team
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCategoryManageOpen(true)}
              data-testid="button-manage-categories"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Categories
            </Button>
          )}
          {canSubmit && (
            <Button
              onClick={() => setIsSubmitDialogOpen(true)}
              size="lg"
              className="bg-[#236383] hover:bg-[#007E8C] text-white"
              data-testid="button-submit-item"
            >
              <Plus className="h-5 w-5 mr-2" />
              Submit Item
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                id="urgent-only"
                checked={showUrgentOnly}
                onCheckedChange={(checked) => setShowUrgentOnly(checked as boolean)}
                data-testid="checkbox-urgent-only"
              />
              <Label htmlFor="urgent-only" className="text-sm font-medium cursor-pointer">
                Show Urgent Only
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#236383]" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No items found. {canSubmit && "Click 'Submit Item' to add one!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`transition-all hover:shadow-md ${
                item.isUrgent ? 'border-l-4 border-l-red-500' : ''
              }`}
              data-testid={`card-item-${item.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={item.category} />
                      {item.isUrgent && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Urgent
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize">
                        {item.type}
                      </Badge>
                      <Badge
                        variant={
                          item.status === 'done' ? 'default' :
                          item.status === 'claimed' ? 'secondary' : 'outline'
                        }
                        className="capitalize"
                      >
                        {item.status === 'done' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {item.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{item.createdByName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      {item.commentCount > 0 && (
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{item.commentCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex gap-2">
                      {item.status !== 'done' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateItemMutation.mutate({ id: item.id, status: 'done' })}
                          disabled={updateItemMutation.isPending}
                          data-testid={`button-mark-done-${item.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark Done
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap mb-3">
                  {item.content}
                </p>

                {/* Assignment Section */}
                {(canSubmit || canManage) && (
                  <>
                    {item.assignedTo && item.assignedToNames && item.assignedTo.length > 0 && (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-[#E6F4F6] dark:bg-[#236383]/20 border-l-3 border-l-[#007E8C]">
                        <div className="flex items-start gap-2 text-xs mb-2">
                          <UserPlus className="h-3.5 w-3.5 mt-0.5 text-[#007E8C]" />
                          <span className="font-medium text-[#236383] dark:text-[#47B3CB]">
                            Assigned to:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.assignedToNames.map((name, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700"
                              data-testid={`assigned-user-${item.id}-${index}`}
                            >
                              <Avatar className={`h-4 w-4 ${getAvatarColor(name)}`}>
                                <AvatarFallback className="text-white text-[8px]">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-gray-700 dark:text-gray-300">{name}</span>
                              {canManage && (
                                <button
                                  onClick={() => handleUnassign(item, item.assignedTo![index])}
                                  className="ml-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                  data-testid={`button-unassign-${item.id}-${index}`}
                                  title="Remove assignee"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assignment Dropdown - Available to both SUBMIT and MANAGE users */}
                    {(canSubmit || canManage) && (
                      <div className="mb-3">
                        <Select onValueChange={(userId) => handleAssignToUser(item, userId)}>
                          <SelectTrigger className="w-full text-sm" data-testid={`select-assign-${item.id}`}>
                            <SelectValue placeholder="Assign to team member..." />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map(member => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                {/* Like Button */}
                {canSubmit && (
                  <div className="flex items-center gap-2 mb-3">
                    <LikeButton itemId={item.id} />
                  </div>
                )}

                {/* Comments Section - Only render if user has VIEW permission */}
                {canView && (
                  <ItemComments itemId={item.id} initialCommentCount={item.commentCount} canView={canView} canSubmit={canSubmit} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Submit Item Dialog */}
      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Submit to Holding Zone</DialogTitle>
            <DialogDescription>
              Add a task, note, or idea for the team to review and track
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-type">Type</Label>
              <Select value={newItemType} onValueChange={(v) => setNewItemType(v as any)}>
                <SelectTrigger id="item-type" data-testid="select-new-item-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-category">Category (Optional)</Label>
              <Select value={newItemCategoryId} onValueChange={setNewItemCategoryId}>
                <SelectTrigger id="item-category" data-testid="select-new-item-category">
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="item-urgent"
                checked={newItemIsUrgent}
                onCheckedChange={(checked) => setNewItemIsUrgent(checked as boolean)}
                data-testid="checkbox-new-item-urgent"
              />
              <Label htmlFor="item-urgent" className="cursor-pointer">
                Mark as urgent
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-content">Content</Label>
              <Textarea
                id="item-content"
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="Describe the task, note, or idea in detail..."
                className="min-h-[150px] text-base"
                data-testid="textarea-new-item-content"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSubmitDialogOpen(false)}
              data-testid="button-cancel-submit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitItem}
              disabled={createItemMutation.isPending || !newItemContent.trim()}
              className="bg-[#236383] hover:bg-[#007E8C]"
              data-testid="button-confirm-submit"
            >
              {createItemMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <>Submit</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog - Placeholder */}
      <Dialog open={isCategoryManageOpen} onOpenChange={setIsCategoryManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Create and edit holding zone categories
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Category management interface coming soon...
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCategoryManageOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
