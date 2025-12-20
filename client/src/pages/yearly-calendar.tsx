import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import {
  Loader2,
  Plus,
  Calendar,
  CheckCircle2,
  Edit2,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';

interface YearlyCalendarItem {
  id: number;
  month: number; // 1-12
  year: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  createdBy: string;
  createdByName: string;
  assignedTo: string[] | null;
  assignedToNames: string[] | null;
  isRecurring: boolean;
  isCompleted: boolean;
  completedAt: Date | string | null;
  completedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CATEGORY_COLORS: Record<string, string> = {
  preparation: 'bg-blue-100 text-blue-800 border-blue-300',
  'event-rush': 'bg-red-100 text-red-800 border-red-300',
  staffing: 'bg-orange-100 text-orange-800 border-orange-300',
  board: 'bg-purple-100 text-purple-800 border-purple-300',
  seasonal: 'bg-green-100 text-green-800 border-green-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-600',
  medium: 'text-blue-600',
  high: 'text-red-600',
};

export default function YearlyCalendar() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<YearlyCalendarItem | null>(null);
  
  // Form state
  const [formMonth, setFormMonth] = useState<number>(new Date().getMonth() + 1);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>('preparation');
  const [formPriority, setFormPriority] = useState<string>('medium');
  const [formIsRecurring, setFormIsRecurring] = useState(true);

  // Permission checks
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canView = userPermissions.includes('VIEW_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';
  const canSubmit = userPermissions.includes('SUBMIT_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';
  const canManage = userPermissions.includes('MANAGE_HOLDING_ZONE') || user?.role === 'admin' || user?.role === 'super_admin';

  // Fetch calendar items for selected year
  const { data: items = [], isLoading } = useQuery<YearlyCalendarItem[]>({
    queryKey: ['/api/yearly-calendar', selectedYear],
    queryFn: async () => {
      return await apiRequest('GET', `/api/yearly-calendar?year=${selectedYear}`);
    },
    enabled: canView,
  });

  // Group items by month and sort them
  const itemsByMonth = useMemo(() => {
    const grouped: Record<number, YearlyCalendarItem[]> = {};
    for (let i = 1; i <= 12; i++) {
      grouped[i] = [];
    }
    items.forEach(item => {
      if (!grouped[item.month]) {
        grouped[item.month] = [];
      }
      grouped[item.month].push(item);
    });
    // Sort items within each month: incomplete first, then by priority (high -> medium -> low), then by creation date
    Object.keys(grouped).forEach(month => {
      const monthNum = parseInt(month);
      grouped[monthNum].sort((a, b) => {
        // Incomplete items first
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        // Then by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) - 
                            (priorityOrder[a.priority as keyof typeof priorityOrder] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        // Finally by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    return grouped;
  }, [items]);

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: {
      month: number;
      year: number;
      title: string;
      description: string | null;
      category: string;
      priority: string;
      isRecurring: boolean;
    }) => {
      return await apiRequest('POST', '/api/yearly-calendar', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      setIsCreateDialogOpen(false);
      setFormTitle('');
      setFormDescription('');
      setFormCategory('preparation');
      setFormPriority('medium');
      setFormIsRecurring(true);
      toast({
        title: 'Calendar item created',
        description: 'Your calendar item has been added',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create calendar item',
        variant: 'destructive',
      });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<YearlyCalendarItem> & { id: number }) => {
      return await apiRequest('PATCH', `/api/yearly-calendar/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      toast({
        title: 'Calendar item updated',
        description: 'Your calendar item has been updated',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update calendar item',
        variant: 'destructive',
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/yearly-calendar/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      toast({
        title: 'Calendar item deleted',
        description: 'Your calendar item has been deleted',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete calendar item',
        variant: 'destructive',
      });
    },
  });

  // Copy to next year mutation
  const copyToNextYearMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/yearly-calendar/${id}/copy-to-next-year`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      toast({
        title: 'Item copied',
        description: 'Calendar item has been copied to next year',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to copy calendar item',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!formTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    createItemMutation.mutate({
      month: formMonth,
      year: selectedYear,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      category: formCategory,
      priority: formPriority,
      isRecurring: formIsRecurring,
    });
  };

  const handleEdit = (item: YearlyCalendarItem) => {
    setEditingItem(item);
    setFormMonth(item.month);
    setFormTitle(item.title);
    setFormDescription(item.description || '');
    setFormCategory(item.category);
    setFormPriority(item.priority);
    setFormIsRecurring(item.isRecurring);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingItem || !formTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    updateItemMutation.mutate({
      id: editingItem.id,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      category: formCategory,
      priority: formPriority,
      isRecurring: formIsRecurring,
    });
  };

  const handleToggleComplete = (item: YearlyCalendarItem) => {
    updateItemMutation.mutate({
      id: item.id,
      isCompleted: !item.isCompleted,
    });
  };

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              You don't have permission to view the yearly calendar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageBreadcrumbs items={[{ label: 'TSP Yearly Calendar' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Calendar className="h-8 w-8 text-[#236383]" />
            TSP Yearly Calendar
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Plan ahead for recurring activities and events throughout the year
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold min-w-[80px] text-center">
              {selectedYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear(selectedYear + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {canSubmit && (
            <Button
              onClick={() => {
                setFormMonth(new Date().getMonth() + 1);
                setIsCreateDialogOpen(true);
              }}
              className="bg-[#236383] hover:bg-[#007E8C]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#236383]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MONTH_NAMES.map((monthName, index) => {
            const monthNumber = index + 1;
            const monthItems = itemsByMonth[monthNumber] || [];
            const isCurrentMonth = new Date().getMonth() + 1 === monthNumber && new Date().getFullYear() === selectedYear;
            const isPastMonth = selectedYear < new Date().getFullYear() || 
              (selectedYear === new Date().getFullYear() && monthNumber < new Date().getMonth() + 1);

            return (
              <Card
                key={monthNumber}
                className={`transition-all hover:shadow-md flex flex-col ${
                  isCurrentMonth ? 'ring-2 ring-[#236383]' : ''
                } ${isPastMonth ? 'opacity-75' : ''}`}
              >
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{monthName}</span>
                    {monthItems.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {monthItems.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 flex-1 overflow-y-auto max-h-[500px] min-h-[100px]">
                  {monthItems.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-4">
                      No items planned
                    </p>
                  ) : (
                    monthItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${
                          item.isCompleted ? 'opacity-60 bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                        } ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {item.isCompleted && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              )}
                              <h4 className={`text-sm font-semibold ${item.isCompleted ? 'line-through' : ''}`}>
                                {item.title}
                              </h4>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                              <span className={`text-xs font-medium ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium}`}>
                                {item.priority}
                              </span>
                              {item.isRecurring && (
                                <Badge variant="outline" className="text-xs">
                                  Recurring
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleToggleComplete(item)}
                            >
                              {item.isCompleted ? 'Undo' : 'Complete'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this item?')) {
                                  deleteItemMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            {item.isRecurring && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => copyToNextYearMutation.mutate(item.id)}
                                title="Copy to next year"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Calendar Item</DialogTitle>
            <DialogDescription>
              Add a planning item for {MONTH_NAMES[formMonth - 1]} {selectedYear}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-month">Month</Label>
              <Select value={String(formMonth)} onValueChange={(v) => setFormMonth(parseInt(v))}>
                <SelectTrigger id="create-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Team meeting to review DHL & alloy materials"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-category">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="create-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparation">Preparation</SelectItem>
                    <SelectItem value="event-rush">Event Rush Preparation</SelectItem>
                    <SelectItem value="staffing">Staffing</SelectItem>
                    <SelectItem value="board">Board/Governance</SelectItem>
                    <SelectItem value="seasonal">Seasonal Planning</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-priority">Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger id="create-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-recurring"
                checked={formIsRecurring}
                onCheckedChange={(checked) => setFormIsRecurring(checked as boolean)}
              />
              <Label htmlFor="create-recurring" className="cursor-pointer">
                Recurring (repeats every year)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createItemMutation.isPending || !formTitle.trim()}
              className="bg-[#236383] hover:bg-[#007E8C]"
            >
              {createItemMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <>Create</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Calendar Item</DialogTitle>
            <DialogDescription>
              Update calendar item details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-month">Month</Label>
              <Select value={String(formMonth)} onValueChange={(v) => setFormMonth(parseInt(v))}>
                <SelectTrigger id="edit-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparation">Preparation</SelectItem>
                    <SelectItem value="event-rush">Event Rush Preparation</SelectItem>
                    <SelectItem value="staffing">Staffing</SelectItem>
                    <SelectItem value="board">Board/Governance</SelectItem>
                    <SelectItem value="seasonal">Seasonal Planning</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-recurring"
                checked={formIsRecurring}
                onCheckedChange={(checked) => setFormIsRecurring(checked as boolean)}
              />
              <Label htmlFor="edit-recurring" className="cursor-pointer">
                Recurring (repeats every year)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateItemMutation.isPending || !formTitle.trim()}
              className="bg-[#236383] hover:bg-[#007E8C]"
            >
              {updateItemMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
              ) : (
                <>Update</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

