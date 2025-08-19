import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { 
  Copy, 
  ExternalLink, 
  Share2, 
  Plus, 
  Gift,
  Users,
  TrendingUp,
  MessageCircle,
  CheckCircle,
  XCircle,
  Clock,
  Shield
} from "lucide-react";

export default function WishlistPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [newSuggestion, setNewSuggestion] = useState({
    item: "",
    reason: "",
    priority: "medium" as "high" | "medium" | "low"
  });

  // Fetch wishlist suggestions
  const { data: suggestions = [], isLoading, error: suggestionsError } = useQuery({
    queryKey: ["/api/wishlist-suggestions"],
    retry: 1,
    staleTime: 30000,
  });

  // Fetch recent activity
  const { data: activity = [], error: activityError } = useQuery({
    queryKey: ["/api/wishlist-activity"],
    retry: 1,
    staleTime: 30000,
  });

  // Create suggestion mutation
  const createSuggestionMutation = useMutation({
    mutationFn: async (data: typeof newSuggestion) => {
      return apiRequest("POST", "/api/wishlist-suggestions", {
        item: data.item,
        reason: data.reason,
        priority: data.priority,
        status: "pending"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist-activity"] });
      toast({
        title: "Suggestion Submitted",
        description: "Your wishlist suggestion has been recorded for review",
      });
      setNewSuggestion({
        item: "",
        reason: "",
        priority: "medium"
      });
    },
    onError: (error) => {
      console.error("Wishlist submission error:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your suggestion. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Admin review mutation
  const reviewSuggestionMutation = useMutation({
    mutationFn: async ({ id, action, notes }: { id: number, action: 'approve' | 'reject', notes?: string }) => {
      return apiRequest("PATCH", `/api/wishlist-suggestions/${id}`, {
        status: action === 'approve' ? 'approved' : 'rejected',
        adminNotes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist-suggestions"] });
      toast({
        title: "Review Completed",
        description: "Suggestion status has been updated",
      });
    },
    onError: (error) => {
      console.error("Review error:", error);
      toast({
        title: "Review Failed",
        description: "There was an error updating the suggestion",
        variant: "destructive",
      });
    }
  });

  // Amazon wishlist URL
  const WISHLIST_URL = "https://www.amazon.com/hz/wishlist/ls/XRSQ9EDIIIWV?ref_=wl_share";

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Wishlist link copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const shareWishlist = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "The Sandwich Project - Amazon Wishlist",
          text: "Help support The Sandwich Project by checking out our Amazon wishlist!",
          url: WISHLIST_URL,
        });
      } catch (err) {
        // User cancelled sharing or sharing failed
        copyToClipboard(WISHLIST_URL);
      }
    } else {
      // Fallback to copying
      copyToClipboard(WISHLIST_URL);
    }
  };

  const handleSuggestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestion.item.trim()) return;
    
    createSuggestionMutation.mutate(newSuggestion);
  };

  // Show error states if needed
  if (suggestionsError || activityError) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Error Loading Wishlist</h1>
          <p className="text-slate-600">
            {suggestionsError && "Failed to load suggestions. "}
            {activityError && "Failed to load activity. "}
            Please refresh the page or try again later.
          </p>
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-3">
            <Gift className="w-8 h-8 text-[#FBAD3F]" />
            Amazon Wishlist
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Help support The Sandwich Project! Our Amazon wishlist contains essential supplies 
            and equipment that help us serve our community more effectively.
          </p>
        </div>

        {/* Quick Share Section */}
        <Card className="border-[#236383] border-2">
          <CardHeader className="bg-[#236383] text-white">
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share Our Wishlist
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 text-sm font-mono text-slate-700 break-all">
                  {WISHLIST_URL}
                </div>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(WISHLIST_URL)}
                  className="flex-shrink-0"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={shareWishlist}
                  className="flex-1"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Wishlist
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open(WISHLIST_URL, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on Amazon
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Users className="w-8 h-8 text-[#236383]" />
                <div>
                  <p className="text-2xl font-bold">{suggestions.length}</p>
                  <p className="text-xs text-slate-600">Items Suggested</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-8 h-8 text-[#FBAD3F]" />
                <div>
                  <p className="text-2xl font-bold">{suggestions.filter(s => s.status === 'approved').length}</p>
                  <p className="text-xs text-slate-600">Items Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Gift className="w-8 h-8 text-[#A31C41]" />
                <div>
                  <p className="text-2xl font-bold">{suggestions.filter(s => s.priority === 'high').length}</p>
                  <p className="text-xs text-slate-600">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Suggest New Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#236383]" />
              Suggest New Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSuggestionSubmit} className="space-y-4">
              <div>
                <Label htmlFor="item">Item Name/Description</Label>
                <Input
                  id="item"
                  value={newSuggestion.item}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, item: e.target.value })}
                  placeholder="e.g., Disposable gloves (size L), Insulated food containers"
                />
              </div>
              
              <div>
                <Label htmlFor="reason">Why is this needed?</Label>
                <Textarea
                  id="reason"
                  value={newSuggestion.reason}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, reason: e.target.value })}
                  placeholder="Explain how this item would help our operations..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Priority Level</Label>
                <div className="flex gap-2 mt-2">
                  {['high', 'medium', 'low'].map((priority) => (
                    <Button
                      key={priority}
                      type="button"
                      variant={newSuggestion.priority === priority ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewSuggestion({ ...newSuggestion, priority: priority as any })}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={createSuggestionMutation.isPending || !newSuggestion.item.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                {createSuggestionMutation.isPending ? "Submitting..." : "Submit Suggestion"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sharing Tips */}
        <Card className="bg-gradient-to-r from-[#236383]/5 to-[#FBAD3F]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Amplify Our Reach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="text-xs">1</Badge>
                <div>
                  <p className="font-medium">Share on Social Media</p>
                  <p className="text-sm text-slate-600">Post our wishlist link on Facebook, Instagram, or LinkedIn with a personal message about our mission.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="text-xs">2</Badge>
                <div>
                  <p className="font-medium">Email Your Network</p>
                  <p className="text-sm text-slate-600">Send the wishlist to friends, family, or colleagues who might be interested in supporting our cause.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="text-xs">3</Badge>
                <div>
                  <p className="font-medium">Workplace Announcements</p>
                  <p className="text-sm text-slate-600">Share with your work team, church group, or community organizations that support local nonprofits.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Review Section - Only visible to admins */}
        {user && hasPermission(user.permissions || 0, PERMISSIONS.MANAGE_SETTINGS) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#A31C41]" />
                Admin Review - Pending Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions.filter(s => s.status === 'pending').length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No pending suggestions to review</p>
                ) : (
                  suggestions
                    .filter(s => s.status === 'pending')
                    .map((suggestion: any) => (
                      <div key={suggestion.id} className="border rounded-lg p-4 bg-yellow-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{suggestion.item}</h4>
                              <Badge variant={
                                suggestion.priority === 'high' ? 'destructive' :
                                suggestion.priority === 'medium' ? 'default' : 'secondary'
                              }>
                                {suggestion.priority} priority
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{suggestion.reason}</p>
                            <p className="text-xs text-slate-500">
                              Suggested on {new Date(suggestion.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => reviewSuggestionMutation.mutate({
                              id: suggestion.id,
                              action: 'approve'
                            })}
                            disabled={reviewSuggestionMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => reviewSuggestionMutation.mutate({
                              id: suggestion.id,
                              action: 'reject'
                            })}
                            disabled={reviewSuggestionMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {activity.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No recent activity to show</p>
              ) : (
                activity.map((item: any, index: number) => (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
                    item.type === 'suggestion' ? 'bg-blue-50' : 
                    item.status === 'approved' ? 'bg-green-50' : 'bg-orange-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      {item.type === 'suggestion' ? (
                        <Plus className={`w-4 h-4 ${
                          item.status === 'approved' ? 'text-green-600' : 
                          item.status === 'pending' ? 'text-blue-600' : 'text-orange-600'
                        }`} />
                      ) : (
                        <Gift className="w-4 h-4 text-green-600" />
                      )}
                      <span>{item.description || `${item.item} ${item.type === 'suggestion' ? 'suggested' : 'updated'}`}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}