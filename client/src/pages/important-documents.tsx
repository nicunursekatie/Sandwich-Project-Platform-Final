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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-[#236383] rounded-xl shadow-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Important Documents & Logos
              </h1>
              <p className="text-lg text-gray-600">
                Key documents, forms, and official logos for The Sandwich Project
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto p-1 mb-6 border-0">
            <TabsTrigger 
              value="documents" 
              className="flex items-center gap-2 py-3 px-6 rounded-l-md font-medium text-[#236383]"
            >
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger 
              value="logos" 
              className="flex items-center gap-2 py-3 px-6 rounded-r-md font-medium text-[#236383]"
            >
              <FileImage className="h-4 w-4" />
              Logos & Branding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            {/* Category Filter */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Filter by Category</h3>
              <div className="flex flex-wrap gap-3">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category)}
                    className={selectedCategory === category 
                      ? "px-6 py-2.5 text-sm font-medium bg-[#236383] hover:bg-[#1a4e66] border-[#236383] shadow-md transform hover:scale-105 transition-all duration-200" 
                      : "px-6 py-2.5 text-sm font-medium border-2 border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white bg-white shadow-sm transform hover:scale-105 transition-all duration-200"
                    }
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Documents Grid - Professional design */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="group hover:shadow-2xl transition-all duration-300 h-full flex flex-col bg-white border-0 shadow-md hover:shadow-[#236383]/10 hover:-translate-y-1 rounded-2xl overflow-hidden">
              <CardHeader className="pb-6 flex-shrink-0 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className="flex-shrink-0 p-3 bg-[#236383]/10 rounded-xl">
                      <FileText className="h-6 w-6 text-[#236383]" />
                    </div>
                    <CardTitle className="text-xl md:text-2xl font-bold text-gray-900 leading-tight group-hover:text-[#236383] transition-colors">
                      {doc.name}
                    </CardTitle>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="text-sm font-semibold px-4 py-1.5 bg-purple-100 text-purple-800 rounded-full">
                    {doc.category}
                  </Badge>
                  <Badge variant="outline" className="text-sm font-semibold px-4 py-1.5 border-[#236383] text-[#236383] rounded-full">
                    {doc.type.toUpperCase()}
                  </Badge>
                  {getImportanceBadge(doc.importance)}
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col px-6 pb-6">
                <CardDescription className="mb-8 flex-1 text-lg leading-relaxed text-gray-600 font-medium">
                  {doc.description}
                </CardDescription>
                {/* Action buttons - Premium design */}
                <div className="flex flex-col gap-4 mt-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => handlePreview(doc)}
                    className="w-full h-12 text-base font-semibold border-2 border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
                  >
                    <Eye className="h-5 w-5 mr-3" />
                    Preview
                  </Button>
                  <Button
                    size="lg"
                    variant="default"
                    onClick={() => handleDownload(doc)}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[#236383] to-[#1a4e66] hover:from-[#1a4e66] hover:to-[#0f3a52] text-white transition-all duration-200 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    <Download className="h-5 w-5 mr-3" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logos" className="space-y-8">
            {/* Usage Guidelines */}
            <Card className="border-0 bg-gradient-to-br from-[#236383]/5 to-blue-50/30 shadow-lg rounded-2xl">
              <CardHeader className="pb-6 bg-gradient-to-r from-[#236383]/10 to-blue-100/20 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#236383] rounded-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-[#236383] text-2xl font-bold">Brand Usage Guidelines</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-[#236383] rounded-full mt-3"></div>
                    <p className="text-gray-700 text-base leading-relaxed">
                      Use the high-resolution versions for professional printing
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-[#236383] rounded-full mt-3"></div>
                    <p className="text-gray-700 text-base leading-relaxed">
                      Choose the transparent versions when placing over photos or colored backgrounds
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logo Grid - Professional design */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {logoFiles.map((logo) => (
                <Card key={logo.id} className="group hover:shadow-2xl transition-all duration-300 h-full flex flex-col bg-white border-0 shadow-md hover:shadow-[#236383]/10 hover:-translate-y-1 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-6 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between mb-3">
                      <CardTitle className="text-[#236383] text-xl font-bold flex items-center gap-3 group-hover:text-[#1a4e66] transition-colors">
                        <div className="p-2 bg-[#236383]/10 rounded-lg">
                          {logo.icon}
                        </div>
                        {logo.name}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="w-fit px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                      {logo.type}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    {/* Logo Preview */}
                    <div 
                      className="w-full h-40 rounded-xl border-0 shadow-inner flex items-center justify-center overflow-hidden group-hover:shadow-lg transition-all duration-300"
                      style={{ backgroundColor: logo.bgColor }}
                    >
                      <img 
                        src={`/public-objects/LOGOS/${logo.filename}`}
                        alt={logo.name}
                        className="max-w-full max-h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIGZpbGw9IiNkMWQ1ZGIiLz4KPC9zdmc+';
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <p className="text-base text-gray-700 leading-relaxed font-medium">
                        {logo.description}
                      </p>
                      <div className="bg-[#236383]/5 p-4 rounded-lg">
                        <p className="text-sm text-[#236383] font-semibold">
                          Best for: {logo.usage}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="lg"
                            className="flex-1 h-11 font-semibold border-2 border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
                          >
                            <Eye className="h-5 w-5 mr-2" />
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
                        size="lg"
                        className="flex-1 h-11 font-semibold bg-gradient-to-r from-[#236383] to-[#1a4e66] hover:from-[#1a4e66] hover:to-[#0f3a52] text-white transition-all duration-200 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
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