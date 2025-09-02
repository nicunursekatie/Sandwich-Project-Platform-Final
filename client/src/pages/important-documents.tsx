import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Eye, ExternalLink, FileImage, Palette, ImageIcon } from 'lucide-react';
import { DocumentPreview } from '@/components/document-preview';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AdminDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  path: string;
  type: 'pdf' | 'docx' | 'xlsx';
  size?: string;
  lastModified?: string;
  importance: 'critical' | 'high' | 'normal';
}

const adminDocuments: AdminDocument[] = [
  {
    id: 'tax-exempt-letter',
    name: 'IRS Tax Exempt Letter',
    description: 'Our 501(c)(3) letter',
    category: 'Legal & Tax',
    path: '/attached_assets/IRS Tax Exempt Letter (Contains EIN).pdf',
    type: 'pdf',
    importance: 'critical'
  },
  {
    id: 'articles-incorporation',
    name: 'Articles of Incorporation',
    description: 'Articles of Incorporation',
    category: 'Legal & Tax',
    path: '/attached_assets/Articles of Incorporation.pdf',
    type: 'pdf',
    importance: 'critical'
  },
  {
    id: 'georgia-code',
    name: '2020 Georgia Code Title 51',
    description: 'Georgia state legal code reference for nonprofit operations',
    category: 'Legal & Tax',
    path: '/attached_assets/2020 Georgia Code Title 51.pdf',
    type: 'pdf',
    importance: 'high'
  },
  {
    id: 'bylaws-2024',
    name: 'TSP Bylaws 2024',
    description: 'Current organizational bylaws and governance structure',
    category: 'Governance',
    path: '/attached_assets/The Sandwich Project Bylaws 2024(1)_1750871081277.pdf',
    type: 'pdf',
    importance: 'critical'
  },
  {
    id: 'volunteer-driver-agreement',
    name: 'TSP Volunteer Driver Agreement',
    description: 'Required agreement form for volunteer drivers',
    category: 'Forms',
    path: '/attached_assets/TSP Volunteer Driver Agreement (1).pdf',
    type: 'pdf',
    importance: 'critical'
  },
  {
    id: 'community-service-hours',
    name: 'TSP Community Service Hours',
    description: 'Form for tracking and documenting community service hours',
    category: 'Forms',
    path: '/attached_assets/TSP COMMUNITY SERVICE HOURS (1) (1) (1).pdf',
    type: 'pdf',
    importance: 'high'
  }
];

const categories = ['All', 'Legal & Tax', 'Governance', 'Forms'];

// Logo files information
const logoFiles = [
  {
    id: 1,
    name: "CMYK Print Logo",
    filename: "CMYK_PRINT_TSP-01-01.jpg",
    description: "High-quality CMYK version for professional printing",
    type: "JPEG",
    usage: "Print materials, brochures, professional documents",
    bgColor: "white",
    icon: <Palette className="h-5 w-5" />
  },
  {
    id: 2,
    name: "Main Transparent Logo",
    filename: "TSP_transparent.png",
    description: "Primary logo with transparent background",
    type: "PNG",
    usage: "Web, presentations, overlays on any background",
    bgColor: "#f8f9fa",
    icon: <ImageIcon className="h-5 w-5" />
  },
  {
    id: 3,
    name: "Reverse Transparent Logo",
    filename: "TSP_reverse_transparent.png", 
    description: "Inverted colors for dark backgrounds",
    type: "PNG",
    usage: "Dark backgrounds, night mode interfaces",
    bgColor: "#2d3748",
    icon: <Eye className="h-5 w-5" />
  },
  {
    id: 4,
    name: "Sandwich Logo",
    filename: "sandwich logo.png",
    description: "Simple sandwich icon logo",
    type: "PNG", 
    usage: "Icons, favicons, small applications",
    bgColor: "white",
    icon: <FileImage className="h-5 w-5" />
  },
  {
    id: 5,
    name: "Transparent Logo (Copy)",
    filename: "Copy of TSP_transparent.png",
    description: "Backup copy of transparent logo",
    type: "PNG",
    usage: "Backup version for web and digital use",
    bgColor: "#f8f9fa",
    icon: <ImageIcon className="h-5 w-5" />
  }
];

export default function ImportantDocuments() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [previewDocument, setPreviewDocument] = useState<AdminDocument | null>(null);

  const filteredDocuments = adminDocuments.filter(doc => 
    selectedCategory === 'All' || doc.category === selectedCategory
  );

  const handleDownload = (doc: AdminDocument) => {
    const link = document.createElement('a');
    link.href = doc.path;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (doc: AdminDocument) => {
    setPreviewDocument(doc);
  };

  const handleLogoDownload = async (filename: string, displayName: string) => {
    try {
      const response = await fetch(`/public-objects/LOGOS/${filename}`);
      if (!response.ok) throw new Error('Logo not found');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download logo. Please try again.');
    }
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case 'critical':
        return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">Important</Badge>;
      case 'high':
        return <Badge variant="outline" className="text-xs">Reference</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Important Documents & Logos
          </h1>
          <p className="text-gray-600 mb-6">
            Key documents, forms, and official logos for The Sandwich Project.
          </p>
        </div>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white border border-gray-200 p-1">
            <TabsTrigger 
              value="documents" 
              className="flex items-center gap-2 bg-white text-[#646464] hover:bg-gray-50 data-[state=active]:bg-[#236383] data-[state=active]:text-white transition-colors"
            >
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger 
              value="logos" 
              className="flex items-center gap-2 bg-white text-[#646464] hover:bg-gray-50 data-[state=active]:bg-[#236383] data-[state=active]:text-white transition-colors"
            >
              <FileImage className="h-4 w-4" />
              Logos & Branding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? "text-sm bg-[#236383] hover:bg-[#1a4e66] border-[#236383]" : "text-sm border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"}
            >
              {category}
            </Button>
              ))}
            </div>

            {/* Documents Grid - Better tablet responsiveness with wider cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-8">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col border-2 hover:border-blue-200">
              <CardHeader className="pb-4 flex-shrink-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                    <CardTitle className="text-lg md:text-xl font-semibold text-gray-900 leading-tight">
                      {doc.name}
                    </CardTitle>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="text-sm font-medium px-3 py-1 bg-purple-100 text-purple-800">
                    {doc.category}
                  </Badge>
                  <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                    {doc.type.toUpperCase()}
                  </Badge>
                  {getImportanceBadge(doc.importance)}
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                <CardDescription className="mb-6 flex-1 text-base leading-relaxed text-gray-600">
                  {doc.description}
                </CardDescription>
                {/* Action buttons - optimized for tablet with larger touch targets */}
                <div className="flex flex-col gap-3 mt-auto">
                  <Button
                    size="default"
                    variant="outline"
                    onClick={() => handlePreview(doc)}
                    className="w-full h-11 text-base font-medium border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                  >
                    <Eye className="h-5 w-5 mr-2" />
                    Preview
                  </Button>
                  <Button
                    size="default"
                    variant="default"
                    onClick={() => handleDownload(doc)}
                    className="w-full h-11 text-base font-medium bg-[#236383] hover:bg-[#1a4e66] border-[#236383]"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logos" className="space-y-6">
            {/* Usage Guidelines */}
            <Card className="border-[#236383]/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#236383] text-lg">Usage Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-[#646464] text-sm">
                  • Use these logos to represent The Sandwich Project in official communications
                </p>
                <p className="text-[#646464] text-sm">
                  • Maintain proper spacing and don't modify colors or proportions
                </p>
                <p className="text-[#646464] text-sm">
                  • For print materials, use the CMYK version for best color accuracy
                </p>
                <p className="text-[#646464] text-sm">
                  • Use transparent versions when overlaying on colored backgrounds
                </p>
              </CardContent>
            </Card>

            {/* Logo Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {logoFiles.map((logo) => (
                <Card key={logo.id} className="border-[#236383]/20 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[#236383] text-lg flex items-center gap-2">
                      {logo.icon}
                      {logo.name}
                    </CardTitle>
                    <Badge variant="secondary" className="w-fit">
                      {logo.type}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Logo Preview */}
                    <div 
                      className="w-full h-32 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: logo.bgColor }}
                    >
                      <img 
                        src={`/public-objects/LOGOS/${logo.filename}`}
                        alt={logo.name}
                        className="max-w-full max-h-full object-contain p-2"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIGZpbGw9IiNkMWQ1ZGIiLz4KPC9zdmc+';
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-[#646464]">
                        {logo.description}
                      </p>
                      <p className="text-xs text-[#646464] font-medium">
                        Best for: {logo.usage}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-[#236383]">{logo.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div 
                              className="w-full h-64 rounded-lg border border-gray-200 flex items-center justify-center"
                              style={{ backgroundColor: logo.bgColor }}
                            >
                              <img 
                                src={`/public-objects/LOGOS/${logo.filename}`}
                                alt={logo.name}
                                className="max-w-full max-h-full object-contain p-4"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong className="text-[#236383]">File Type:</strong> {logo.type}
                              </div>
                              <div>
                                <strong className="text-[#236383]">Filename:</strong> {logo.filename}
                              </div>
                              <div className="col-span-2">
                                <strong className="text-[#236383]">Usage:</strong> {logo.usage}
                              </div>
                            </div>
                            <Button
                              onClick={() => handleLogoDownload(logo.filename, logo.name)}
                              className="w-full bg-[#236383] hover:bg-[#1a4e66]"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download {logo.name}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        onClick={() => handleLogoDownload(logo.filename, logo.name)}
                        size="sm"
                        className="flex-1 bg-[#236383] hover:bg-[#1a4e66]"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Document Preview Modal */}
        {previewDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-lg">{previewDocument.name}</h3>
                    <p className="text-sm text-gray-500">{previewDocument.description}</p>
                  </div>
                  {getImportanceBadge(previewDocument.importance)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewDocument)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewDocument.path, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPreviewDocument(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              
              <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                <DocumentPreview
                  documentName={previewDocument.name}
                  documentPath={previewDocument.path}
                  documentType={previewDocument.type}
                  onClose={() => setPreviewDocument(null)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}