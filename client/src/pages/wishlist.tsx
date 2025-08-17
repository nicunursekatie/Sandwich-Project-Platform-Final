import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Copy, 
  ExternalLink, 
  Share2, 
  Plus, 
  Gift,
  Users,
  TrendingUp,
  MessageCircle
} from "lucide-react";

export default function WishlistPage() {
  const { toast } = useToast();
  const [newSuggestion, setNewSuggestion] = useState({
    item: "",
    reason: "",
    priority: "medium" as "high" | "medium" | "low"
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

    // TODO: Implement suggestion submission to backend
    toast({
      title: "Suggestion Submitted",
      description: "Your wishlist suggestion has been recorded for review",
    });

    setNewSuggestion({
      item: "",
      reason: "",
      priority: "medium"
    });
  };

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
                  <p className="text-2xl font-bold">24</p>
                  <p className="text-xs text-slate-600">Items on List</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-8 h-8 text-[#FBAD3F]" />
                <div>
                  <p className="text-2xl font-bold">12</p>
                  <p className="text-xs text-slate-600">Items Purchased</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Gift className="w-8 h-8 text-[#A31C41]" />
                <div>
                  <p className="text-2xl font-bold">$450</p>
                  <p className="text-xs text-slate-600">Total Value</p>
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

              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Submit Suggestion
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
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Gift className="w-4 h-4 text-green-600" />
                  <span>Disposable Gloves (100 pack) purchased</span>
                </div>
                <span className="text-xs text-slate-500">2 days ago</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Insulated Food Containers added to wishlist</span>
                </div>
                <span className="text-xs text-slate-500">1 week ago</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Gift className="w-4 h-4 text-green-600" />
                  <span>Hand Sanitizer (6 pack) purchased</span>
                </div>
                <span className="text-xs text-slate-500">2 weeks ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}