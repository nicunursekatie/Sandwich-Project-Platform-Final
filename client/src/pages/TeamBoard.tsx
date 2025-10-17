import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, CheckCircle2, Clock, Lightbulb, ClipboardList, StickyNote, Trash2 } from 'lucide-react';
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
}

export default function TeamBoard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemType, setNewItemType] = useState<BoardItemType>('note');

  // Fetch board items
  const { data: items = [], isLoading } = useQuery<TeamBoardItem[]>({
    queryKey: ['/api/team-board'],
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: { content: string; type: BoardItemType }) => {
      return await apiRequest('/api/team-board', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setNewItemContent('');
      setNewItemType('note');
      toast({
        title: 'Posted!',
        description: 'Your item has been added to the board',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create item',
        variant: 'destructive',
      });
    },
  });

  // Update item mutation (claim, complete)
  const updateItemMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: number; 
      updates: {
        status?: BoardItemStatus;
        assignedTo?: string;
        assignedToName?: string;
        completedAt?: string | null;
      };
    }) => {
      return await apiRequest(`/api/team-board/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
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
      return await apiRequest(`/api/team-board/${id}`, {
        method: 'DELETE',
      });
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

  const getStatusBadge = (status: BoardItemStatus) => {
    switch (status) {
      case 'claimed':
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">In Progress</Badge>;
      case 'done':
        return <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">Done</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 dark:bg-gray-800">Open</Badge>;
    }
  };

  // Group items by status
  const openItems = items.filter(item => item.status === 'open');
  const claimedItems = items.filter(item => item.status === 'claimed');
  const doneItems = items.filter(item => item.status === 'done');

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Team Board
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Share tasks, ideas, notes, and reminders with the team
        </p>
      </div>

      {/* Quick Add Form */}
      <Card className="mb-8 border-teal-200 dark:border-teal-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Post to Board</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <Select
                value={newItemType}
                onValueChange={(value: BoardItemType) => setNewItemType(value)}
              >
                <SelectTrigger className="w-[140px]" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="Type anything - a task someone can claim, a note, an idea, a reminder..."
                className="flex-1 min-h-[80px]"
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

      {/* Board Items */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Open Items */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Open ({openItems.length})
            </h2>
            <div className="space-y-3">
              {openItems.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow" data-testid={`card-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        <Badge variant="secondary" className="capitalize">{item.type}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                      {item.content}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span>{item.createdByName}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    <Button
                      onClick={() => handleClaim(item)}
                      disabled={updateItemMutation.isPending}
                      className="w-full bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600"
                      size="sm"
                      data-testid={`button-claim-${item.id}`}
                    >
                      I'll Handle This
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {openItems.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No open items
                </p>
              )}
            </div>
          </div>

          {/* Claimed Items */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              In Progress ({claimedItems.length})
            </h2>
            <div className="space-y-3">
              {claimedItems.map((item) => (
                <Card key={item.id} className="border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow" data-testid={`card-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        {getStatusBadge(item.status)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                      {item.content}
                    </p>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <div className="flex justify-between">
                        <span>Posted by: {item.createdByName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Claimed by: {item.assignedToName}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleComplete(item)}
                        disabled={updateItemMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        size="sm"
                        data-testid={`button-complete-${item.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Done
                      </Button>
                      <Button
                        onClick={() => handleReopen(item)}
                        disabled={updateItemMutation.isPending}
                        variant="outline"
                        size="sm"
                        data-testid={`button-reopen-${item.id}`}
                      >
                        Reopen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {claimedItems.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No items in progress
                </p>
              )}
            </div>
          </div>

          {/* Done Items */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Done ({doneItems.length})
            </h2>
            <div className="space-y-3">
              {doneItems.map((item) => (
                <Card key={item.id} className="border-green-200 dark:border-green-800 opacity-75 hover:opacity-100 transition-opacity" data-testid={`card-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        {getStatusBadge(item.status)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap line-through">
                      {item.content}
                    </p>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <div>Posted by: {item.createdByName}</div>
                      {item.assignedToName && (
                        <div>Completed by: {item.assignedToName}</div>
                      )}
                      {item.completedAt && (
                        <div>Done: {new Date(item.completedAt).toLocaleDateString()}</div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleReopen(item)}
                      disabled={updateItemMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      data-testid={`button-reopen-${item.id}`}
                    >
                      Reopen
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {doneItems.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No completed items
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
