import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  Upload,
  Image as ImageIcon,
  Calendar,
  Users,
  Trash2,
  Eye,
  Send,
  Archive,
  Download,
  Plus,
} from 'lucide-react';
import { hasPermission } from '@shared/auth-utils';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';

interface PromotionGraphic {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  intendedUseDate?: string | null;
  targetAudience: string;
  status: string;
  notificationSent: boolean;
  notificationSentAt?: string | null;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

export default function PromotionGraphics() {
  const { trackView } = useActivityTracker();
  const [selectedGraphic, setSelectedGraphic] = useState<PromotionGraphic | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [intendedUseDate, setIntendedUseDate] = useState('');
  const [targetAudience, setTargetAudience] = useState('hosts');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');

  // Ref to track the current preview URL for cleanup on unmount
  const previewUrlRef = useRef<string>('');

  useEffect(() => {
    trackView(
      'Promotion Graphics',
      'Promotion',
      'Social Media Graphics',
      'User accessed promotion graphics page'
    );
  }, [trackView]);

  // Clean up local preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user'],
    enabled: true,
  });

  // Check permissions
  const canUpload = hasPermission(currentUser, 'ADMIN_ACCESS');
  const canDelete = hasPermission(currentUser, 'ADMIN_ACCESS');

  // Fetch promotion graphics
  const { data: graphics = [], isLoading } = useQuery<PromotionGraphic[]>({
    queryKey: ['/api/promotion-graphics'],
    enabled: true,
  });

  // Filter to show only active graphics
  const activeGraphics = graphics.filter((g) => g.status === 'active');

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      imageUrl: string;
      fileName: string;
      fileSize?: number;
      fileType?: string;
      intendedUseDate?: string;
      targetAudience: string;
    }) => {
      return apiRequest('POST', '/api/promotion-graphics', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-graphics'] });
      setShowUploadDialog(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Graphic uploaded successfully! Notifications are being sent to the team.',
      });
    },
    onError: (error: any) => {
      logger.error('Failed to upload graphic', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload graphic. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest('DELETE', `/api/promotion-graphics/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-graphics'] });
      setShowDeleteDialog(false);
      setSelectedGraphic(null);
      toast({
        title: 'Success',
        description: 'Graphic deleted successfully.',
      });
    },
    onError: (error: any) => {
      logger.error('Failed to delete graphic', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete graphic. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest('PUT', `/api/promotion-graphics/${id}`, { status: 'archived' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-graphics'] });
      toast({
        title: 'Success',
        description: 'Graphic archived successfully.',
      });
    },
    onError: (error: any) => {
      logger.error('Failed to archive graphic', error);
      toast({
        title: 'Archive Failed',
        description: error.message || 'Failed to archive graphic. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10485760) {
      toast({
        title: 'File Too Large',
        description: 'Please select an image smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Store the file and create a local preview URL
    setUploadedFile(file);

    // Clean up previous preview URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    // Create a local preview URL
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setLocalPreviewUrl(previewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadedFile) {
      toast({
        title: 'Missing Image',
        description: 'Please select an image first',
        variant: 'destructive',
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: 'Missing Title',
        description: 'Please provide a title for the graphic',
        variant: 'destructive',
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: 'Missing Description',
        description: 'Please provide a description for the graphic',
        variant: 'destructive',
      });
      return;
    }

    // Upload the file first
    setIsUploading(true);
    try {
      // Get upload URL from backend
      const uploadResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL } = await uploadResponse.json();

      // Upload file directly to object storage
      const uploadFileResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: uploadedFile,
        headers: {
          'Content-Type': uploadedFile.type,
        },
      });

      if (!uploadFileResponse.ok) {
        throw new Error(`Failed to upload ${uploadedFile.name}`);
      }

      // Get the permanent URL (without query parameters)
      const permanentUrl = uploadURL.split('?')[0];
      setUploadedFileUrl(permanentUrl);

      // Now submit the form with the uploaded file URL
      uploadMutation.mutate({
        title,
        description,
        imageUrl: permanentUrl,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        intendedUseDate: intendedUseDate || undefined,
        targetAudience,
      });
    } catch (error) {
      logger.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIntendedUseDate('');
    setTargetAudience('hosts');
    setUploadedFile(null);
    setUploadedFileUrl('');

    // Clean up the local preview URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
      setLocalPreviewUrl('');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#236383' }}>
            Social Media Graphics
          </h1>
          <p className="text-gray-600 mt-2">
            Share promotional graphics with the team to amplify our message
          </p>
        </div>
        {canUpload && (
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: '#007E8C', color: 'white' }}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Graphic
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload New Graphic</DialogTitle>
                <DialogDescription>
                  Upload a social media graphic and notify the team
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">Image File *</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                  {uploadedFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: {uploadedFile.name} ({formatFileSize(uploadedFile.size)})
                    </p>
                  )}
                </div>

                {localPreviewUrl && (
                  <div>
                    <Label>Preview</Label>
                    <img
                      src={localPreviewUrl}
                      alt="Preview"
                      className="mt-2 max-w-full h-auto rounded-lg border"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Spring 2024 Fundraiser"
                    maxLength={200}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this graphic is for and how it should be used..."
                    rows={4}
                    maxLength={1000}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {description.length}/1000 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="intended-use-date">Intended Use Date (Optional)</Label>
                  <Input
                    id="intended-use-date"
                    type="date"
                    value={intendedUseDate}
                    onChange={(e) => setIntendedUseDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hosts">Hosts</SelectItem>
                      <SelectItem value="volunteers">All Volunteers</SelectItem>
                      <SelectItem value="all">Everyone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowUploadDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!uploadedFile || isUploading || uploadMutation.isPending}
                    style={{ backgroundColor: '#007E8C', color: 'white' }}
                  >
                    {isUploading || uploadMutation.isPending ? 'Uploading...' : 'Upload & Notify'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Graphics Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading graphics...</p>
        </div>
      ) : activeGraphics.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">No graphics available yet</p>
            {canUpload && (
              <Button
                onClick={() => setShowUploadDialog(true)}
                style={{ backgroundColor: '#007E8C', color: 'white' }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Upload First Graphic
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeGraphics.map((graphic) => (
            <Card key={graphic.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video w-full overflow-hidden bg-gray-100">
                <img
                  src={`/api/objects/proxy?url=${encodeURIComponent(graphic.imageUrl)}`}
                  alt={graphic.title}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setSelectedGraphic(graphic)}
                />
              </div>
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="text-lg">{graphic.title}</span>
                  {graphic.notificationSent && (
                    <Badge variant="outline" className="ml-2">
                      <Send className="h-3 w-3 mr-1" />
                      Sent
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {graphic.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {graphic.intendedUseDate && (
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" style={{ color: '#FBAD3F' }} />
                      <span>
                        Use by: {format(new Date(graphic.intendedUseDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-2" style={{ color: '#47B3CB' }} />
                    <span className="capitalize">{graphic.targetAudience}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Uploaded by {graphic.uploadedByName}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedGraphic(graphic)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(graphic.imageUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => archiveMutation.mutate(graphic.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail View Dialog */}
      <Dialog open={!!selectedGraphic} onOpenChange={() => setSelectedGraphic(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedGraphic && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedGraphic.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <img
                  src={`/api/objects/proxy?url=${encodeURIComponent(selectedGraphic.imageUrl)}`}
                  alt={selectedGraphic.title}
                  className="w-full h-auto rounded-lg"
                />
                <div>
                  <Label>Description</Label>
                  <p className="text-gray-700 mt-1">{selectedGraphic.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {selectedGraphic.intendedUseDate && (
                    <div>
                      <Label>Intended Use Date</Label>
                      <p className="text-gray-700 mt-1">
                        {format(new Date(selectedGraphic.intendedUseDate), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label>Target Audience</Label>
                    <p className="text-gray-700 mt-1 capitalize">
                      {selectedGraphic.targetAudience}
                    </p>
                  </div>
                  <div>
                    <Label>Uploaded By</Label>
                    <p className="text-gray-700 mt-1">{selectedGraphic.uploadedByName}</p>
                  </div>
                  <div>
                    <Label>Upload Date</Label>
                    <p className="text-gray-700 mt-1">
                      {format(new Date(selectedGraphic.createdAt), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
                {selectedGraphic.notificationSent && selectedGraphic.notificationSentAt && (
                  <div>
                    <Label>Notification Status</Label>
                    <p className="text-gray-700 mt-1">
                      Sent on {format(new Date(selectedGraphic.notificationSentAt), 'MMMM d, yyyy h:mm a')}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedGraphic.imageUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                {canDelete && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        archiveMutation.mutate(selectedGraphic.id);
                        setSelectedGraphic(null);
                      }}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Graphic?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this graphic? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedGraphic && deleteMutation.mutate(selectedGraphic.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
