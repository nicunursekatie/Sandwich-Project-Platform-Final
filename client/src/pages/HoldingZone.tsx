import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
  Users,
  Wifi,
  WifiOff,
  ArrowRight,
  Edit2,
  Trash2,
  Check,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollaboration } from '@/hooks/use-collaboration';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  isPrivate: boolean;
  details: string | null;
  dueDate: Date | string | null;
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
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['/api/team-board', itemId, 'comments'],
    queryFn: async () => {
      return await apiRequest('GET', `/api/team-board/${itemId}/comments`);
    },
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

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: number; content: string }) => {
      return await apiRequest('PATCH', `/api/team-board/comments/${commentId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board', itemId, 'comments'] });
      setEditingCommentId(null);
      setEditContent('');
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update comment',
        variant: 'destructive',
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      return await apiRequest('DELETE', `/api/team-board/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board', itemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been deleted',
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

  const handleSubmitComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment.trim());
  };

  const handleEditComment = (commentId: number) => {
    editCommentMutation.mutate({ commentId, content: editContent.trim() });
  };

  const handleDeleteComment = (commentId: number) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate(commentId);
    }
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
              {comments.map((comment) => {
                const isOwner = user?.id === comment.userId;
                const commentUserPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
                const canEdit = isOwner && (commentUserPermissions.includes('EDIT_OWN_COMMENTS_HOLDING_ZONE') || commentUserPermissions.includes('MANAGE_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin');
                const canDelete = isOwner && (commentUserPermissions.includes('DELETE_OWN_COMMENTS_HOLDING_ZONE') || commentUserPermissions.includes('MANAGE_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin');
                const isEditing = editingCommentId === comment.id;

                return (
                  <div
                    key={comment.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                    data-testid={`comment-${comment.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
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
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      {(canEdit || canDelete) && !isEditing && (
                        <div className="flex gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditContent(comment.content);
                              }}
                              data-testid={`button-edit-comment-${comment.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={deleteCommentMutation.isPending}
                              data-testid={`button-delete-comment-${comment.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <MentionTextarea
                          value={editContent}
                          onChange={setEditContent}
                          placeholder="Edit comment..."
                          className="min-h-[60px] text-sm"
                          data-testid={`textarea-edit-comment-${comment.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleEditComment(comment.id)}
                            disabled={editCommentMutation.isPending || !editContent.trim()}
                            className="bg-[#236383] hover:bg-[#007E8C] h-7"
                            data-testid={`button-save-edit-${comment.id}`}
                          >
                            {editCommentMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><Check className="h-3 w-3 mr-1" /> Save</>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditContent('');
                            }}
                            className="h-7"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        <MessageWithMentions content={comment.content} />
                      </div>
                    )}
                  </div>
                );
              })}
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

// Presence Indicators Component
function PresenceIndicators({ 
  presentUsers, 
  isConnected 
}: { 
  presentUsers: Array<{ userId: string; userName: string }>;
  isConnected: boolean;
}) {
  const { user } = useAuth();
  
  // Filter out current user from the list
  const otherUsers = presentUsers.filter(u => u.userId !== user?.id);
  const totalViewers = presentUsers.length;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" data-testid="icon-connected" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" data-testid="icon-disconnected" />
              )}
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isConnected ? 'Connected' : 'Disconnected'}</p>
          </TooltipContent>
        </Tooltip>

        {/* User Count and Avatars */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {totalViewers} {totalViewers === 1 ? 'person' : 'people'} viewing
          </span>
        </div>

        {/* Avatar Stack */}
        {otherUsers.length > 0 && (
          <div className="flex -space-x-2">
            {otherUsers.slice(0, 5).map((u, index) => (
              <Tooltip key={u.userId}>
                <TooltipTrigger asChild>
                  <Avatar 
                    className={`h-8 w-8 border-2 border-white dark:border-gray-800 ${getAvatarColor(u.userName)}`}
                    data-testid={`avatar-presence-${index}`}
                  >
                    <AvatarFallback className="text-white text-xs">
                      {getInitials(u.userName)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{u.userName}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {otherUsers.length > 5 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 border-2 border-white dark:border-gray-800 bg-gray-500">
                    <AvatarFallback className="text-white text-xs">
                      +{otherUsers.length - 5}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{otherUsers.slice(5).map(u => u.userName).join(', ')}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Main Holding Zone component
export default function HoldingZone() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemType, setNewItemType] = useState<'task' | 'note' | 'idea'>('task');
  const [newItemCategoryId, setNewItemCategoryId] = useState<string>('none');
  const [newItemIsUrgent, setNewItemIsUrgent] = useState(false);
  const [newItemIsPrivate, setNewItemIsPrivate] = useState(false);
  const [newItemDetails, setNewItemDetails] = useState('');
  const [newItemDueDate, setNewItemDueDate] = useState('');
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string[]>([]);
  const [newItemAssignedToNames, setNewItemAssignedToNames] = useState<string[]>([]);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#236383');
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [itemToPromote, setItemToPromote] = useState<HoldingZoneItem | null>(null);
  const [promotePriority, setPromotePriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<HoldingZoneItem | null>(null);
  const [editItemContent, setEditItemContent] = useState('');
  const [editItemType, setEditItemType] = useState<'task' | 'note' | 'idea'>('task');
  const [editItemCategoryId, setEditItemCategoryId] = useState<string>('none');
  const [editItemIsUrgent, setEditItemIsUrgent] = useState(false);
  const [editItemIsPrivate, setEditItemIsPrivate] = useState(false);
  const [editItemDetails, setEditItemDetails] = useState('');
  const [editItemDueDate, setEditItemDueDate] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [itemToAssign, setItemToAssign] = useState<HoldingZoneItem | null>(null);
  const [editingDetailsItemId, setEditingDetailsItemId] = useState<number | null>(null);
  const [editingDetailsContent, setEditingDetailsContent] = useState('');

  // Permission checks
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canView = userPermissions.includes('VIEW_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';
  const canSubmit = userPermissions.includes('SUBMIT_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';
  const canManage = userPermissions.includes('MANAGE_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';

  // Real-time collaboration hook - called unconditionally (hook rules)
  const collaboration = useCollaboration({
    resourceType: 'holding-zone',
    resourceId: 'main',
  });
  
  // Only use collaboration if user can view
  const isConnected = user && canView && collaboration ? collaboration.isConnected : false;
  const presentUsers = user && canView && collaboration ? collaboration.presentUsers : [];
  const onFieldUpdate = user && canView && collaboration ? collaboration.onFieldUpdate : () => () => {};

  // Listen for real-time updates and refresh the items list
  useEffect(() => {
    if (!canView) return;

    const unsubscribe = onFieldUpdate(() => {
      // Invalidate queries to refresh items when any field is updated
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      
      // Show a subtle toast notification
      toast({
        title: 'Updates available',
        description: 'The holding zone has been updated by another team member',
        duration: 3000,
      });
    });

    return unsubscribe;
  }, [canView, onFieldUpdate, toast]);

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

    // Filter by active/archived status
    if (selectedStatus === 'active') {
      filtered = filtered.filter(item => item.status !== 'done' && !item.completedAt);
    } else if (selectedStatus === 'archived') {
      filtered = filtered.filter(item => item.status === 'done' || item.completedAt);
    } else if (selectedStatus !== 'all') {
      filtered = filtered.filter(item => item.status === selectedStatus);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => String(item.categoryId) === selectedCategory);
    }

    if (showUrgentOnly) {
      filtered = filtered.filter(item => item.isUrgent);
    }

    return filtered;
  }, [items, selectedCategory, selectedStatus, showUrgentOnly]);

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return await apiRequest('POST', '/api/holding-zone/categories', data);
    },
    onSuccess: (newCategory: HoldingZoneCategory) => {
      queryClient.invalidateQueries({ queryKey: ['/api/holding-zone/categories'] });
      setNewItemCategoryId(String(newCategory.id));
      setIsCreatingNewCategory(false);
      setNewCategoryName('');
      setNewCategoryColor('#236383');
      toast({
        title: 'Category created',
        description: 'Your new category has been created',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create category',
        variant: 'destructive',
      });
    },
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      type: 'task' | 'note' | 'idea';
      categoryId: number | null;
      isUrgent: boolean;
      isPrivate: boolean;
      details: string | null;
      dueDate: string | null;
      assignedTo: string[] | null;
      assignedToNames: string[] | null;
    }) => {
      return await apiRequest('POST', '/api/team-board', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setIsSubmitDialogOpen(false);
      setNewItemContent('');
      setNewItemType('task');
      setNewItemCategoryId('none');
      setNewItemIsUrgent(false);
      setNewItemIsPrivate(false);
      setNewItemDetails('');
      setNewItemDueDate('');
      setNewItemAssignedTo([]);
      setNewItemAssignedToNames([]);
      setIsCreatingNewCategory(false);
      setNewCategoryName('');
      setNewCategoryColor('#236383');
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

  // Edit item mutation
  const editItemMutation = useMutation({
    mutationFn: async ({ id, content, type, categoryId, isUrgent, isPrivate, details, dueDate }: {
      id: number;
      content: string;
      type: 'task' | 'note' | 'idea';
      categoryId: number | null;
      isUrgent: boolean;
      isPrivate: boolean;
      details?: string | null;
      dueDate?: string | null;
    }) => {
      return await apiRequest('PATCH', `/api/team-board/${id}`, { content, type, categoryId, isUrgent, isPrivate, details, dueDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setEditDialogOpen(false);
      setItemToEdit(null);
      setEditItemContent('');
      setEditItemType('task');
      setEditItemCategoryId('none');
      setEditItemIsUrgent(false);
      setEditItemIsPrivate(false);
      setEditItemDetails('');
      setEditItemDueDate('');
      toast({
        title: 'Item updated',
        description: 'Your item has been updated successfully',
      });
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
        title: 'Item deleted',
        description: 'Your item has been deleted',
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

  // Promote to task mutation
  const promoteToTaskMutation = useMutation({
    mutationFn: async ({ id, priority }: { id: number; priority: 'low' | 'medium' | 'high' }) => {
      return await apiRequest('POST', `/api/team-board/${id}/promote`, {
        projectId: null, // Standalone task
        priority,
        dueDate: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setPromoteDialogOpen(false);
      setItemToPromote(null);
      setPromotePriority('medium');
      toast({
        title: 'Item promoted',
        description: 'The item has been promoted to a standalone task',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to promote item to task',
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

  // Update details mutation (for inline editing)
  const updateDetailsMutation = useMutation({
    mutationFn: async ({ id, details }: { id: number; details: string | null }) => {
      return await apiRequest('PATCH', `/api/team-board/${id}`, { details });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setEditingDetailsItemId(null);
      setEditingDetailsContent('');
      toast({
        title: 'Details updated',
        description: 'Item details have been updated',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update details',
        variant: 'destructive',
      });
    },
  });

  // Fetch team members for assignment
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-board/users'],
    enabled: canSubmit || canManage,
  });

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: 'Category name required',
        description: 'Please enter a category name',
        variant: 'destructive',
      });
      return;
    }

    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      color: newCategoryColor,
    });
  };

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
      categoryId: newItemCategoryId && newItemCategoryId !== 'none' ? parseInt(newItemCategoryId) : null,
      isUrgent: newItemIsUrgent,
      isPrivate: newItemIsPrivate,
      details: newItemDetails.trim() || null,
      dueDate: newItemDueDate ? new Date(newItemDueDate).toISOString() : null,
      assignedTo: newItemAssignedTo.length > 0 ? newItemAssignedTo : null,
      assignedToNames: newItemAssignedToNames.length > 0 ? newItemAssignedToNames : null,
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

  const handleOpenAssignDialog = (item: HoldingZoneItem) => {
    setItemToAssign(item);
    setAssignDialogOpen(true);
  };

  const handleAssignFromDialog = (userId: string) => {
    if (!itemToAssign) return;
    handleAssignToUser(itemToAssign, userId);
    setAssignDialogOpen(false);
    setItemToAssign(null);
  };

  const handleStartEditingDetails = (item: HoldingZoneItem) => {
    setEditingDetailsItemId(item.id);
    setEditingDetailsContent(item.details || '');
  };

  const handleSaveDetails = (itemId: number) => {
    updateDetailsMutation.mutate({
      id: itemId,
      details: editingDetailsContent.trim() || null,
    });
  };

  const handleCancelEditingDetails = () => {
    setEditingDetailsItemId(null);
    setEditingDetailsContent('');
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
        <PageBreadcrumbs segments={[{ label: 'Holding Zone' }]} />
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
      <PageBreadcrumbs segments={[{ label: 'Holding Zone' }]} />

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

      {/* Presence and Filters Row */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Presence Indicators */}
        <PresenceIndicators presentUsers={presentUsers} isConnected={isConnected} />
        
        {/* Filters */}
        <Card className="flex-1">
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
                  <SelectValue placeholder="Active Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="all">All Items</SelectItem>
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
      </div>

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
              <CardContent className="p-4">
                {/* Header: Title, Badges, Actions */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {item.content}
                    </h3>
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
                      {item.status === 'done' && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Done
                        </Badge>
                      )}
                      {item.status === 'claimed' && (
                        <Badge variant="secondary" className="capitalize">
                          Claimed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {canManage && item.status !== 'done' && !item.completedAt && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setItemToEdit(item);
                          setEditItemContent(item.content);
                          setEditItemType(item.type);
                          setEditItemCategoryId(item.categoryId ? String(item.categoryId) : 'none');
                          setEditItemIsUrgent(item.isUrgent);
                          setEditItemIsPrivate(item.isPrivate);
                          setEditItemDetails(item.details || '');
                          setEditItemDueDate(item.dueDate ? (typeof item.dueDate === 'string' ? item.dueDate : new Date(item.dueDate).toISOString().split('T')[0]) : '');
                          setEditDialogOpen(true);
                        }}
                        className="h-8 w-8 p-0"
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this item?')) {
                            deleteItemMutation.mutate(item.id);
                          }
                        }}
                        disabled={deleteItemMutation.isPending}
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Details Section with Inline Editing */}
                <div className="mb-3">
                  {editingDetailsItemId === item.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingDetailsContent}
                        onChange={(e) => setEditingDetailsContent(e.target.value)}
                        placeholder="Add details..."
                        className="min-h-[80px] text-sm"
                        data-testid={`textarea-details-${item.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveDetails(item.id)}
                          disabled={updateDetailsMutation.isPending}
                          className="h-7 text-xs"
                        >
                          {updateDetailsMutation.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEditingDetails}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Details</span>
                        {(canSubmit || canManage) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEditingDetails(item)}
                            className="h-6 px-2 text-xs"
                            data-testid={`button-edit-details-${item.id}`}
                          >
                            {item.details ? <Edit2 className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                            {item.details ? 'Edit' : 'Add'}
                          </Button>
                        )}
                      </div>
                      {item.details ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {item.details}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No details added</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="font-medium">Created:</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  {item.dueDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium">Due:</span>
                      <span>{formatDate(typeof item.dueDate === 'string' ? new Date(item.dueDate) : item.dueDate)}</span>
                    </div>
                  )}
                </div>

                {/* Assignment Section */}
                {(canSubmit || canManage) && (
                  <div className="mb-3">
                    {item.assignedTo && item.assignedToNames && item.assignedTo.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.assignedToNames.map((name, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md text-xs"
                              data-testid={`assigned-user-${item.id}-${index}`}
                            >
                              <Avatar className={`h-4 w-4 ${getAvatarColor(name)}`}>
                                <AvatarFallback className="text-white text-[8px]">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-gray-700 dark:text-gray-300">{name}</span>
                              {canManage && (
                                <button
                                  onClick={() => handleUnassign(item, item.assignedTo![index])}
                                  className="ml-1 text-gray-400 hover:text-red-500"
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAssignDialog(item)}
                      className="h-8 text-xs"
                      data-testid={`button-assign-${item.id}`}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Assign to team member
                    </Button>
                  </div>
                )}

                {/* Like and Comments */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  {canSubmit && (
                    <div className="flex items-center gap-2">
                      <LikeButton itemId={item.id} />
                      {item.commentCount > 0 && (
                        <span className="text-xs text-gray-500">
                          {item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Creator: <span className="font-medium">{item.createdByName}</span>
                  </div>
                </div>

                {/* Comments Section */}
                {canView && (
                  <div className="mt-3">
                    <ItemComments itemId={item.id} initialCommentCount={item.commentCount} canView={canView} canSubmit={canSubmit} />
                  </div>
                )}

                {/* Action Buttons for Manage */}
                {canManage && item.status !== 'done' && !item.completedAt && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setItemToPromote(item);
                        setPromoteDialogOpen(true);
                      }}
                      disabled={promoteToTaskMutation.isPending}
                      className="text-xs"
                      data-testid={`button-promote-${item.id}`}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Promote to Task
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateItemMutation.mutate({ id: item.id, status: 'done' })}
                      disabled={updateItemMutation.isPending}
                      className="text-xs"
                      data-testid={`button-mark-done-${item.id}`}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Mark Done
                    </Button>
                  </div>
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
              {!isCreatingNewCategory ? (
                <Select
                  value={newItemCategoryId}
                  onValueChange={(value) => {
                    if (value === 'create-new') {
                      setIsCreatingNewCategory(true);
                      setNewItemCategoryId('none');
                    } else {
                      setNewItemCategoryId(value);
                    }
                  }}
                >
                  <SelectTrigger id="item-category" data-testid="select-new-item-category">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="create-new" className="text-[#236383] font-medium">
                      + Create New Category...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-3 p-4 border border-[#236383] rounded-lg bg-[#E6F4F6]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#236383]">Create New Category</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreatingNewCategory(false);
                        setNewCategoryName('');
                        setNewCategoryColor('#236383');
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-category-name" className="text-xs">Category Name</Label>
                    <Input
                      id="new-category-name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Enter category name..."
                      className="text-sm"
                      data-testid="input-new-category-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-category-color" className="text-xs">Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="new-category-color"
                        type="color"
                        value={newCategoryColor}
                        onChange={(e) => setNewCategoryColor(e.target.value)}
                        className="w-20 h-9 cursor-pointer"
                        data-testid="input-new-category-color"
                      />
                      <Input
                        type="text"
                        value={newCategoryColor}
                        onChange={(e) => setNewCategoryColor(e.target.value)}
                        className="flex-1 text-sm"
                        placeholder="#236383"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateCategory}
                    disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                    className="w-full bg-[#236383] hover:bg-[#007E8C] text-sm"
                    size="sm"
                    data-testid="button-create-category"
                  >
                    {createCategoryMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      'Create Category'
                    )}
                  </Button>
                </div>
              )}
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="item-private"
                checked={newItemIsPrivate}
                onCheckedChange={(checked) => setNewItemIsPrivate(checked as boolean)}
                data-testid="checkbox-new-item-private"
              />
              <Label htmlFor="item-private" className="cursor-pointer">
                Private (only visible to you and admins)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-content">Content</Label>
              <MentionTextarea
                value={newItemContent}
                onChange={setNewItemContent}
                placeholder="Describe the task, note, or idea in detail... Use @ to mention team members"
                className="min-h-[150px] text-base"
                data-testid="textarea-new-item-content"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-details">Details (Optional)</Label>
              <Textarea
                id="item-details"
                value={newItemDetails}
                onChange={(e) => setNewItemDetails(e.target.value)}
                placeholder="Add additional details..."
                className="min-h-[100px]"
                data-testid="textarea-new-item-details"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-due-date">Due Date (Optional)</Label>
              <Input
                id="item-due-date"
                type="date"
                value={newItemDueDate}
                onChange={(e) => setNewItemDueDate(e.target.value)}
                data-testid="input-new-item-due-date"
              />
            </div>

            <div className="space-y-2">
              <Label>Assign to Team Members (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-select-assignees"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {newItemAssignedToNames.length === 0
                      ? 'Select team members...'
                      : `${newItemAssignedToNames.length} member${newItemAssignedToNames.length > 1 ? 's' : ''} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search team members..." />
                    <CommandList>
                      <CommandEmpty>No team members found.</CommandEmpty>
                      <CommandGroup>
                        {teamMembers.map((member) => {
                          const isSelected = newItemAssignedTo.includes(member.id);
                          return (
                            <CommandItem
                              key={member.id}
                              onSelect={() => {
                                if (isSelected) {
                                  // Remove from selection
                                  setNewItemAssignedTo(newItemAssignedTo.filter(id => id !== member.id));
                                  setNewItemAssignedToNames(
                                    newItemAssignedToNames.filter((_, idx) => newItemAssignedTo[idx] !== member.id)
                                  );
                                } else {
                                  // Add to selection
                                  setNewItemAssignedTo([...newItemAssignedTo, member.id]);
                                  setNewItemAssignedToNames([...newItemAssignedToNames, member.name]);
                                }
                              }}
                            >
                              <div className="flex items-center w-full">
                                <div
                                  className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground'
                                      : 'opacity-50 [&_svg]:invisible'
                                  }`}
                                >
                                  <Check className="h-4 w-4" />
                                </div>
                                <User className="h-4 w-4 mr-2 text-gray-500" />
                                <span>{member.name}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {newItemAssignedToNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newItemAssignedToNames.map((name, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => {
                          const newAssignedTo = [...newItemAssignedTo];
                          const newAssignedToNames = [...newItemAssignedToNames];
                          newAssignedTo.splice(index, 1);
                          newAssignedToNames.splice(index, 1);
                          setNewItemAssignedTo(newAssignedTo);
                          setNewItemAssignedToNames(newAssignedToNames);
                        }}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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

      {/* Edit Item Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Holding Zone Item</DialogTitle>
            <DialogDescription>
              Update the content and settings for this item
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-type">Type</Label>
              <Select value={editItemType} onValueChange={(v) => setEditItemType(v as any)}>
                <SelectTrigger id="edit-item-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-item-urgent"
                checked={editItemIsUrgent}
                onCheckedChange={setEditItemIsUrgent}
              />
              <Label htmlFor="edit-item-urgent" className="font-normal cursor-pointer">
                Mark as urgent
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-item-private"
                checked={editItemIsPrivate}
                onCheckedChange={setEditItemIsPrivate}
              />
              <Label htmlFor="edit-item-private" className="font-normal cursor-pointer">
                Private (only visible to you and admins)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-item-content">Content</Label>
              <MentionTextarea
                value={editItemContent}
                onChange={setEditItemContent}
                placeholder="Describe the task, note, or idea in detail... Use @ to mention team members"
                className="min-h-[150px] text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-item-details">Details (Optional)</Label>
              <Textarea
                id="edit-item-details"
                value={editItemDetails}
                onChange={(e) => setEditItemDetails(e.target.value)}
                placeholder="Add additional details..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-item-due-date">Due Date (Optional)</Label>
              <Input
                id="edit-item-due-date"
                type="date"
                value={editItemDueDate}
                onChange={(e) => setEditItemDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-item-category">Category (Optional)</Label>
              <Select value={editItemCategoryId} onValueChange={setEditItemCategoryId}>
                <SelectTrigger id="edit-item-category">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setItemToEdit(null);
                setEditItemContent('');
                setEditItemType('task');
                setEditItemCategoryId('none');
                setEditItemIsUrgent(false);
                setEditItemIsPrivate(false);
                setEditItemDetails('');
                setEditItemDueDate('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (itemToEdit) {
                  editItemMutation.mutate({
                    id: itemToEdit.id,
                    content: editItemContent.trim(),
                    type: editItemType,
                    categoryId: editItemCategoryId && editItemCategoryId !== 'none' ? parseInt(editItemCategoryId) : null,
                    isUrgent: editItemIsUrgent,
                    isPrivate: editItemIsPrivate,
                    details: editItemDetails.trim() || null,
                    dueDate: editItemDueDate ? new Date(editItemDueDate).toISOString() : null,
                  });
                }
              }}
              disabled={editItemMutation.isPending || !editItemContent.trim()}
              className="bg-[#236383] hover:bg-[#007E8C]"
            >
              {editItemMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <>Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Team Member Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign to Team Member</DialogTitle>
            <DialogDescription>
              Select a team member to assign this item to
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {teamMembers.map(member => (
                <Button
                  key={member.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleAssignFromDialog(member.id)}
                >
                  <User className="h-4 w-4 mr-2" />
                  {member.name}
                </Button>
              ))}
              {teamMembers.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No team members available</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignDialogOpen(false);
              setItemToAssign(null);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Task Dialog */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Promote to Task</DialogTitle>
            <DialogDescription>
              Convert this holding zone item into a standalone task
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {itemToPromote && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item Content:
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {itemToPromote.content}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="promote-priority">Priority</Label>
              <Select value={promotePriority} onValueChange={(v) => setPromotePriority(v as any)}>
                <SelectTrigger id="promote-priority" data-testid="select-promote-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This will create a standalone task (not attached to any project).
                The holding zone item will be marked as done, and you can find the new task in the Projects section.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPromoteDialogOpen(false);
                setItemToPromote(null);
                setPromotePriority('medium');
              }}
              data-testid="button-cancel-promote"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (itemToPromote) {
                  promoteToTaskMutation.mutate({
                    id: itemToPromote.id,
                    priority: promotePriority,
                  });
                }
              }}
              disabled={promoteToTaskMutation.isPending || !itemToPromote}
              className="bg-[#236383] hover:bg-[#007E8C]"
              data-testid="button-confirm-promote"
            >
              {promoteToTaskMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Promoting...</>
              ) : (
                <>Promote to Task</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
