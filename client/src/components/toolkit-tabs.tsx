import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, Eye, ExternalLink, Shield, Tag, Sandwich, Calculator } from "lucide-react";
import { DocumentPreview } from "./document-preview";

interface ToolkitDocument {
  name: string;
  path: string;
  type: 'pdf' | 'xlsx' | 'docx' | 'txt' | 'link' | 'other';
  category: string;
  description?: string;
}

const safetyDocuments: ToolkitDocument[] = [
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
  }
];

const labelDocuments: ToolkitDocument[] = [
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
  }
];

const sandwichMakingDocuments: ToolkitDocument[] = [
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
    category: "Sandwich Making",
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
    case 'Safety Guidelines':
      return 'bg-red-100 text-red-800';
    case 'Labels':
      return 'bg-blue-100 text-blue-800';
    case 'Sandwich Making':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
};

function DocumentCard({ document: doc, onPreview }: { document: ToolkitDocument; onPreview: (doc: ToolkitDocument) => void }) {
  const handleDownload = (path: string, name: string) => {
    const link = window.document.createElement('a');
    link.href = path;
    link.download = name;
    link.target = '_blank';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 h-full flex flex-col relative">
      <CardHeader className="pb-3">
        <div className="flex items-start space-x-3">
          <div className="shrink-0">
            {getFileIcon(doc.type)}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
              {doc.name}
            </CardTitle>
            <Badge variant="secondary" className={`mt-2 text-xs ${getCategoryColor(doc.category)}`}>
              {doc.category}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col pt-0">
        {doc.description && (
          <CardDescription className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-3">
            {doc.description}
          </CardDescription>
        )}
        
        <div className="flex flex-col gap-2 mt-auto">
          {doc.type === 'link' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(doc.path, '_blank')}
              className="w-full text-sm h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Open Tool
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPreview(doc)}
                className="flex-1 text-sm h-9"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(doc.path, doc.name)}
                className="flex-1 text-sm h-9"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ToolkitTabs() {
  const [previewDocument, setPreviewDocument] = useState<ToolkitDocument | null>(null);

  if (previewDocument) {
    return (
      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-start space-x-2 sm:space-x-3">
            {getFileIcon(previewDocument.type)}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-gray-900 leading-tight">
                {previewDocument.name}
              </h2>
              <Badge variant="secondary" className={`mt-1 sm:mt-2 text-xs ${getCategoryColor(previewDocument.category)}`}>
                {previewDocument.category}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col xs:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = previewDocument.path;
                link.download = previewDocument.name;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
              <span className="sm:hidden">DL</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setPreviewDocument(null)}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              <span className="hidden sm:inline">Back to Toolkit</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
        </div>
        <DocumentPreview 
          documentPath={previewDocument.path}
          documentName={previewDocument.name}
          documentType={previewDocument.type}
          onClose={() => setPreviewDocument(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6">
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-[#FBAD3F] rounded-lg flex items-center justify-center shrink-0">
          <FileText className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 font-roboto leading-tight">
            Toolkit & Resources
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 leading-tight mt-0.5 sm:mt-1">
            Essential documents, guidelines, and resources for volunteers and hosts
          </p>
        </div>
      </div>

      <Tabs defaultValue="safety" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="safety" className="flex items-center gap-1 sm:gap-2 py-2 sm:py-3 px-1 sm:px-2 md:px-4 text-xs sm:text-sm font-medium">
            <Shield className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden xs:inline sm:hidden">Safe</span>
            <span className="hidden sm:inline">Safety</span>
          </TabsTrigger>
          <TabsTrigger value="labels" className="flex items-center gap-1 sm:gap-2 py-2 sm:py-3 px-1 sm:px-2 md:px-4 text-xs sm:text-sm font-medium">
            <Tag className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            <span>Labels</span>
          </TabsTrigger>
          <TabsTrigger value="sandwich-making" className="flex items-center gap-1 sm:gap-2 py-2 sm:py-3 px-1 sm:px-2 md:px-4 text-xs sm:text-sm font-medium">
            <Sandwich className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden xs:inline sm:hidden">Making</span>
            <span className="hidden sm:inline">Sandwich Making</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="safety" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {safetyDocuments.map((document, index) => (
              <DocumentCard
                key={index}
                document={document}
                onPreview={setPreviewDocument}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="labels" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {labelDocuments.map((document, index) => (
              <DocumentCard
                key={index}
                document={document}
                onPreview={setPreviewDocument}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sandwich-making" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {sandwichMakingDocuments.map((document, index) => (
              <DocumentCard
                key={index}
                document={document}
                onPreview={setPreviewDocument}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}