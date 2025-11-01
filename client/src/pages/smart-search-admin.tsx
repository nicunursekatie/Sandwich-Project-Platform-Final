import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SearchableFeature {
  id: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  embedding?: number[];
  requiredPermissions?: string[];
}

interface EmbeddingStatus {
  total: number;
  withEmbeddings: number;
  percentage: number;
}

export default function SmartSearchAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);
  const [regenerationProgress, setRegenerationProgress] = useState<number>(0);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Fetch all features
  const { data: featuresData, isLoading: featuresLoading, refetch } = useQuery({
    queryKey: ['/api/smart-search/features'],
    refetchInterval: pollingInterval || false,
  });

  // Calculate embedding status
  const embeddingStatus: EmbeddingStatus | null = featuresData?.features
    ? {
        total: featuresData.features.length,
        withEmbeddings: featuresData.features.filter((f: SearchableFeature) => f.embedding).length,
        percentage: featuresData.features.length > 0
          ? Math.round((featuresData.features.filter((f: SearchableFeature) => f.embedding).length / featuresData.features.length) * 100)
          : 0,
      }
    : null;

  // Regenerate embeddings mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/smart-search/regenerate-embeddings');
    },
    onMutate: () => {
      setIsRegenerating(true);
      setRegenerationProgress(0);
      // Start polling to show progress
      setPollingInterval(2000); // Poll every 2 seconds
    },
    onSuccess: () => {
      setIsRegenerating(false);
      setPollingInterval(null);
      setRegenerationProgress(100);
      queryClient.invalidateQueries({ queryKey: ['/api/smart-search/features'] });
      toast({
        title: 'Success!',
        description: 'All AI embeddings have been generated successfully.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      setIsRegenerating(false);
      setPollingInterval(null);
      setRegenerationProgress(0);
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate embeddings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update progress based on polling data
  useEffect(() => {
    if (isRegenerating && embeddingStatus && embeddingStatus.total > 0) {
      const progress = Math.min(95, embeddingStatus.percentage); // Cap at 95% until completion
      setRegenerationProgress(progress);
    }
  }, [embeddingStatus, isRegenerating]);

  // Check admin access
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be an administrator to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleRegenerate = () => {
    if (embeddingStatus && embeddingStatus.total === 0) {
      toast({
        title: 'No Features',
        description: 'There are no features to generate embeddings for.',
        variant: 'destructive',
      });
      return;
    }

    regenerateMutation.mutate();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100">
          <Sparkles className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SmartSearch AI Admin</h1>
          <p className="text-sm text-gray-600">
            Manage AI embeddings for intelligent search functionality
          </p>
        </div>
      </div>

      {/* Status Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Embedding Status
          </CardTitle>
          <CardDescription>
            AI embeddings enable semantic search for better results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {featuresLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : embeddingStatus ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Total Features</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {embeddingStatus.total}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">With Embeddings</div>
                  <div className="text-2xl font-bold text-green-600">
                    {embeddingStatus.withEmbeddings}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Coverage</div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-purple-600">
                      {embeddingStatus.percentage}%
                    </div>
                    <Badge
                      variant={embeddingStatus.percentage === 100 ? 'default' : 'secondary'}
                      className={embeddingStatus.percentage === 100 ? 'bg-green-500' : ''}
                    >
                      {embeddingStatus.percentage === 100 ? 'Complete' : 'Incomplete'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Embedding Coverage</span>
                  <span className="font-medium">
                    {embeddingStatus.withEmbeddings} / {embeddingStatus.total}
                  </span>
                </div>
                <Progress value={embeddingStatus.percentage} className="h-2" />
              </div>

              {/* Status Alert */}
              {embeddingStatus.percentage === 100 ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>All embeddings generated</AlertTitle>
                  <AlertDescription>
                    All features have AI embeddings. SmartSearch is fully optimized!
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Embeddings incomplete</AlertTitle>
                  <AlertDescription>
                    {embeddingStatus.total - embeddingStatus.withEmbeddings} features are missing AI embeddings.
                    Generate embeddings to enable semantic search.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load feature data. Please refresh the page.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Generation Control Card */}
      <Card>
        <CardHeader>
          <CardTitle>Generate AI Embeddings</CardTitle>
          <CardDescription>
            Pre-generate embeddings for all features to improve search performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRegenerating && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating embeddings... This may take a few minutes.</span>
              </div>
              <Progress value={regenerationProgress} className="h-2" />
              <p className="text-xs text-gray-500">
                Progress: {regenerationProgress}%
              </p>
            </div>
          )}

          {!isRegenerating && regenerationProgress === 100 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Generation Complete</AlertTitle>
              <AlertDescription>
                All embeddings have been successfully generated!
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating || featuresLoading}
              className="gap-2"
              data-testid="button-regenerate-embeddings"
            >
              {isRegenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Regenerate All Embeddings
                </>
              )}
            </Button>

            {!isRegenerating && embeddingStatus && (
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={featuresLoading}
                className="gap-2"
                data-testid="button-refresh-status"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Status
              </Button>
            )}
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <strong>Note:</strong> This process will generate AI embeddings for all searchable features using OpenAI's embedding model.
            </p>
            <p>
              Embeddings enable semantic search, allowing users to find features based on meaning rather than exact keyword matches.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
