import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Eye, ExternalLink, Calculator, Share2 } from "lucide-react";
import { DocumentPreview } from "./document-preview";
import { useToast } from "@/hooks/use-toast";

interface DevelopmentDocument {
  name: string;
  path: string;
  type: 'pdf' | 'xlsx' | 'docx' | 'txt' | 'link' | 'other';
  category: string;
  description?: string;
}

const developmentDocuments: DevelopmentDocument[] = [
  // Legal Documents
  {
    name: "Articles of Incorporation",
    path: "/attached_assets/Articles of Incorporation_1750817584990.pdf",
    type: "pdf",
    category: "Legal",
    description: "Official Articles of Incorporation for The Sandwich Project"
  },
  {
    name: "IRS Tax Exempt Letter",
    path: "/attached_assets/IRS Tax Exempt Letter (Contains EIN)_1750817584990.pdf",
    type: "pdf",
    category: "Legal",
    description: "IRS Tax Exempt determination letter containing EIN"
  },
  {
    name: "The Sandwich Project Bylaws 2024",
    path: "/attached_assets/The Sandwich Project Bylaws 2024(1)_1750871081277.pdf",
    type: "pdf",
    category: "Legal",
    description: "Official bylaws document outlining organizational structure, governance, and operational procedures"
  },

  // Safety Guidelines
  {
    name: "Summer Food Safety Guidelines",
    path: "/attached_assets/Summer Food Safety Guidelines_1751569876472.pdf",
    type: "pdf",
    category: "Safety Guidelines",
    description: "Updated guidelines for no cooler collections, proper refrigeration temperatures (33-36°F), and summer heat safety protocols for home hosts"
  },
  {
    name: "Food Safety Volunteers Guide",
    path: "/attached_assets/20230525-TSP-Food Safety Volunteers_1749341933308.pdf",
    type: "pdf",
    category: "Safety Guidelines",
    description: "Comprehensive safety protocols for volunteers preparing and delivering sandwiches"
  },
  {
    name: "Food Safety Hosts Guide",
    path: "/attached_assets/20230525-TSP-Food Safety Hosts (1)_1753670644140.pdf",
    type: "pdf",
    category: "Safety Guidelines",
    description: "Safety standards and procedures for hosts collecting and storing sandwiches"
  },
  {
    name: "Food Safety Recipients Guide",
    path: "/attached_assets/20250205-TSP-Food Safety Recipients_1753670644140.pdf",
    type: "pdf",
    category: "Safety Guidelines",
    description: "Safety standards for recipient organizations handling perishable food donations"
  },
  {
    name: "Food Safety Recipients (Alternate)",
    path: "/attached_assets/Copy of Copy of Food Safety TSP.RECIPIENTS.04042023_1753670644141.pdf",
    type: "pdf",
    category: "Safety Guidelines",
    description: "Additional safety guidelines for 501(c)(3) recipient organizations"
  },

  // Labels
  {
    name: "Deli Labels",
    path: "/attached_assets/Deli labels_1749341916236.pdf",
    type: "pdf",
    category: "Labels",
    description: "Official TSP labels for deli sandwich identification and tracking"
  },
  {
    name: "PBJ Labels",
    path: "/attached_assets/20250622-TSP-PBJ Sandwich Making 101_1749341916236.pdf",
    type: "pdf",
    category: "Labels",
    description: "Labels and guidelines for peanut butter and jelly sandwiches"
  },

  // Sandwich Making Guides
  {
    name: "Deli Sandwich Making 101",
    path: "/attached_assets/20240622-TSP-Deli Sandwich Making 101_1749341916236.pdf",
    type: "pdf",
    category: "Sandwich Making",
    description: "Complete guide to preparing deli sandwiches according to TSP standards"
  },
  {
    name: "PBJ Sandwich Making 101",
    path: "/attached_assets/20250622-TSP-PBJ Sandwich Making 101_1749341916236.pdf",
    type: "pdf",
    category: "Sandwich Making",
    description: "Step-by-step instructions for making peanut butter and jelly sandwiches"
  },
  {
    name: "Sandwich Inventory List",
    path: "/attached_assets/CLEANED UP Sandwich Totals_1753480177827.pdf",
    type: "pdf",
    category: "Sandwich Making",
    description: "Comprehensive inventory tracking system for sandwich collections"
  },
  {
    name: "Inventory Calculator",
    path: "https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html",
    type: "link",
    category: "Tools",
    description: "Interactive tool for calculating sandwich inventory and planning quantities for collections"
  }
];

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />;
    case 'xlsx':
      return <FileText className="h-5 w-5 text-green-500" />;
    case 'docx':
      return <FileText className="h-5 w-5 text-blue-500" />;
    case 'txt':
      return <FileText className="h-5 w-5 text-gray-500" />;
    case 'link':
      return <Calculator className="h-5 w-5 text-blue-600" />;
    default:
      return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Legal':
      return 'bg-purple-100 text-purple-800';
    case 'Governance':
      return 'bg-blue-100 text-blue-800';
    case 'Financial':
      return 'bg-green-100 text-green-800';
    case 'Safety Guidelines':
      return 'bg-red-100 text-red-800';
    case 'Labels':
      return 'bg-orange-100 text-orange-800';
    case 'Sandwich Making':
      return 'bg-teal-100 text-teal-800';
    case 'Tools':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800'
  }
};

export function DevelopmentDocuments() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewDocument, setPreviewDocument] = useState<DevelopmentDocument | null>(null);
  const { toast } = useToast();

  const categories = ['All', ...Array.from(new Set(developmentDocuments.map(doc => doc.category)))];
  
  const filteredDocs = selectedCategory === 'All' 
    ? developmentDocuments 
    : developmentDocuments.filter(doc => doc.category === selectedCategory);

  const handleDownload = (path: string, name: string) => {
    const link = document.createElement('a');
    link.href = path;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (doc: DevelopmentDocument) => {
    setPreviewDocument(doc);
  };

  const handleOpenInNewTab = (path: string) => {
    window.open(path, '_blank');
  };

  const handleShare = async (doc: DevelopmentDocument) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: doc.name,
          text: doc.description || `Check out this tool: ${doc.name}`,
          url: doc.path,
        });
      } catch (error) {
        // User cancelled the share or error occurred, fallback to clipboard
        handleCopyLink(doc.path);
      }
    } else {
      // Fallback to clipboard for browsers that don't support Web Share API
      handleCopyLink(doc.path);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "The inventory calculator link has been copied to your clipboard.",
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Document Grid - FIXED tablet responsiveness with wider cards like governance documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {filteredDocs.map((doc, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col border-2 hover:border-blue-200">
            <CardHeader className="pb-4 flex-shrink-0">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {getFileIcon(doc.type)}
                  </div>
                  <CardTitle className="text-lg md:text-xl font-semibold text-gray-900 leading-tight">
                    {doc.name}
                  </CardTitle>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`text-xs font-medium px-2 py-0.5 ${getCategoryColor(doc.category)}`}>
                  {doc.category}
                </Badge>
                <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                  {doc.type.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col">
              {doc.description && (
                <CardDescription className="mb-6 flex-1 text-base leading-relaxed text-gray-600">
                  {doc.description}
                </CardDescription>
              )}
              {/* Action buttons - fixed to stay within card bounds */}
              <div className="flex flex-col gap-2 mt-auto">
                {doc.type === 'link' ? (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleOpenInNewTab(doc.path)}
                      className="w-full h-9 text-sm font-medium"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Tool
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare(doc)}
                      className="w-full h-9 text-sm font-medium"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Link
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(doc)}
                      className="w-full h-9 text-sm font-medium"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleDownload(doc.path, doc.name)}
                      className="w-full h-9 text-sm font-medium"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No documents found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try selecting a different category
          </p>
        </div>
      )}

      {previewDocument && (
        <DocumentPreview
          documentPath={previewDocument.path}
          documentName={previewDocument.name}
          documentType={previewDocument.type}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}