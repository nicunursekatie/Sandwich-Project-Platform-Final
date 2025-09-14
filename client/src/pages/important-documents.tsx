import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Download,
  Eye,
  ExternalLink,
  FileImage,
  Palette,
  ImageIcon,
  Share2,
  Copy,
  Lock,
} from 'lucide-react';
import { DocumentPreview } from '@/components/document-preview';
import { ConfidentialDocuments } from '@/components/confidential-documents';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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
    importance: 'critical',
  },
  {
    id: 'articles-incorporation',
    name: 'Articles of Incorporation',
    description: 'Articles of Incorporation',
    category: 'Legal & Tax',
    path: '/attached_assets/Articles of Incorporation.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'georgia-code',
    name: '2020 Georgia Code Title 51',
    description: 'Georgia state legal code reference for nonprofit operations',
    category: 'Legal & Tax',
    path: '/attached_assets/2020 Georgia Code Title 51.pdf',
    type: 'pdf',
    importance: 'high',
  },
  {
    id: 'bylaws-2024',
    name: 'TSP Bylaws 2024',
    description: 'Current organizational bylaws and governance structure',
    category: 'Governance',
    path: '/attached_assets/The Sandwich Project Bylaws 2024(1)_1750871081277.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'volunteer-driver-agreement',
    name: 'TSP Volunteer Driver Agreement',
    description: 'Required agreement form for volunteer drivers',
    category: 'Forms',
    path: '/attached_assets/TSP Volunteer Driver Agreement (1).pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'community-service-hours',
    name: 'TSP Community Service Hours',
    description: 'Form for tracking and documenting community service hours',
    category: 'Forms',
    path: '/attached_assets/TSP COMMUNITY SERVICE HOURS (1) (1) (1).pdf',
    type: 'pdf',
    importance: 'high',
  },
];

const categories = ['All', 'Legal & Tax', 'Governance', 'Forms'];

// Logo files information
const logoFiles = [
  {
    id: 1,
    name: 'CMYK Print Logo',
    filename: 'CMYK_PRINT_TSP-01-01.jpg',
    description: 'High-quality CMYK version for professional printing',
    type: 'JPEG',
    usage: 'Print materials, brochures, professional documents',
    bgColor: 'white',
    icon: <Palette className="h-5 w-5" />,
  },
  {
    id: 2,
    name: 'Main Transparent Logo',
    filename: 'TSP_transparent.png',
    description: 'Primary logo with transparent background',
    type: 'PNG',
    usage: 'Web, presentations, overlays on any background',
    bgColor: '#f8f9fa',
    icon: <ImageIcon className="h-5 w-5" />,
  },
  {
    id: 3,
    name: 'Reverse Transparent Logo',
    filename: 'TSP_reverse_transparent.png',
    description: 'Inverted colors for dark backgrounds',
    type: 'PNG',
    usage: 'Dark backgrounds, night mode interfaces',
    bgColor: '#2d3748',
    icon: <Eye className="h-5 w-5" />,
  },
  {
    id: 4,
    name: 'Sandwich Logo',
    filename: 'sandwich logo.png',
    description: 'Simple sandwich icon logo',
    type: 'PNG',
    usage: 'Icons, favicons, small applications',
    bgColor: 'white',
    icon: <FileImage className="h-5 w-5" />,
  },
  {
    id: 5,
    name: 'Transparent Logo (Copy)',
    filename: 'Copy of TSP_transparent.png',
    description: 'Backup copy of transparent logo',
    type: 'PNG',
    usage: 'Backup version for web and digital use',
    bgColor: '#f8f9fa',
    icon: <ImageIcon className="h-5 w-5" />,
  },
];

export default function ImportantDocuments() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [previewDocument, setPreviewDocument] = useState<AdminDocument | null>(
    null
  );

  // Show confidential tab to all authenticated users - server handles access control
  const hasConfidentialAccess = !!user && !isAuthLoading;

  const filteredDocuments = adminDocuments.filter(
    (doc) => selectedCategory === 'All' || doc.category === selectedCategory
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
      const response = await fetch(`/attached_assets/LOGOS/${filename}`);
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

      toast({
        title: 'Download Complete',
        description: `${displayName} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download logo. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleLogoShare = async (filename: string, displayName: string) => {
    const logoUrl = `${window.location.origin}/attached_assets/LOGOS/${filename}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `The Sandwich Project - ${displayName}`,
          text: `Check out this logo from The Sandwich Project`,
          url: logoUrl,
        });
        toast({
          title: 'Shared Successfully',
          description: `${displayName} has been shared.`,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share failed:', error);
          toast({
            title: 'Share Failed',
            description:
              'Failed to share logo. The link has been copied instead.',
            variant: 'destructive',
          });
          await navigator.clipboard.writeText(logoUrl);
        }
      }
    } else {
      await navigator.clipboard.writeText(logoUrl);
      toast({
        title: 'Link Copied',
        description: `Link to ${displayName} has been copied to clipboard.`,
      });
    }
  };

  const handleLogoCopy = async (filename: string, displayName: string) => {
    try {
      const response = await fetch(`/attached_assets/LOGOS/${filename}`);
      if (!response.ok) throw new Error('Logo not found');

      const blob = await response.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);

      toast({
        title: 'Image Copied',
        description: `${displayName} has been copied to clipboard.`,
      });
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback to copying the URL
      const logoUrl = `${window.location.origin}/attached_assets/LOGOS/${filename}`;
      await navigator.clipboard.writeText(logoUrl);
      toast({
        title: 'Link Copied',
        description: `Link to ${displayName} has been copied to clipboard instead.`,
      });
    }
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case 'critical':
        return (
          <Badge
            variant="secondary"
            className="text-xs bg-blue-100 text-blue-800"
          >
            Important
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="outline" className="text-xs">
            Reference
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-[#236383] to-[#1a4e66] rounded-xl shadow-[0_4px_12px_rgba(35,99,131,0.15),0_2px_4px_rgba(35,99,131,0.1)] hover:shadow-[0_8px_24px_rgba(35,99,131,0.2),0_4px_8px_rgba(35,99,131,0.15)] transition-all duration-300 ease-in-out">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Important Documents & Logos
              </h1>
              <p className="text-lg text-gray-600">
                Key documents, forms, and official logos for The Sandwich
                Project
              </p>
              <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 inline-block">
                <div className="text-xs text-teal-700 font-medium uppercase tracking-wide">
                  Organization EIN
                </div>
                <div className="text-lg font-bold text-teal-900 font-mono">
                  87-0939484
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList className={`grid w-full ${hasConfidentialAccess ? 'grid-cols-3' : 'grid-cols-2'} h-auto p-1 mb-8 border-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-lg bg-white`}>
            <TabsTrigger
              value="documents"
              className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-[#236383] hover:bg-[#236383]/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#236383] data-[state=active]:to-[#1a4e66] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
            >
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="logos"
              className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-[#236383] hover:bg-[#236383]/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#236383] data-[state=active]:to-[#1a4e66] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
            >
              <FileImage className="h-4 w-4" />
              Logos & Branding
            </TabsTrigger>
            {hasConfidentialAccess && (
              <TabsTrigger
                value="confidential"
                className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-[#236383] hover:bg-[#236383]/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#236383] data-[state=active]:to-[#1a4e66] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
                data-testid="tab-confidential"
              >
                <Lock className="h-4 w-4" />
                Confidential
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            {/* Category Filter */}
            <div className="mb-12">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                Filter by Category
              </h3>
              <div className="flex flex-wrap gap-4">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={
                      selectedCategory === category ? 'default' : 'outline'
                    }
                    onClick={() => setSelectedCategory(category)}
                    className={
                      selectedCategory === category
                        ? 'px-6 py-3 text-sm font-medium bg-gradient-to-r from-[#236383] to-[#1a4e66] text-white border-0 shadow-[0_4px_12px_rgba(35,99,131,0.25),0_2px_4px_rgba(35,99,131,0.1)] transform hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(35,99,131,0.3),0_4px_8px_rgba(35,99,131,0.15)] transition-all duration-200 ease-in-out rounded-lg'
                        : 'px-6 py-3 text-sm font-medium border-2 border-[#236383] text-[#236383] hover:bg-[#236383] hover:text-white bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transform hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(35,99,131,0.15)] transition-all duration-200 ease-in-out rounded-lg'
                    }
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Documents Grid - Professional design */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-16">
              {filteredDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  className="group transition-all duration-300 ease-in-out h-full flex flex-col bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(35,99,131,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08),0_16px_48px_rgba(35,99,131,0.08)] hover:-translate-y-2 rounded-lg overflow-hidden"
                >
                  <CardHeader className="pb-6 flex-shrink-0 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4 min-w-0 flex-1">
                        <div className="flex-shrink-0 p-3 bg-gradient-to-br from-[#236383]/10 to-[#236383]/5 rounded-xl shadow-inner">
                          <FileText className="h-5 w-5 text-[#236383]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg font-bold text-gray-900 leading-tight group-hover:text-[#236383] transition-colors break-words">
                            {doc.name}
                          </CardTitle>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-800 rounded-full shadow-sm">
                        {doc.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold px-3 py-1 border border-[#236383] text-[#236383] rounded-full bg-white shadow-sm"
                      >
                        {doc.type.toUpperCase()}
                      </Badge>
                      {getImportanceBadge(doc.importance)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col px-6 pb-6">
                    <CardDescription className="mb-6 flex-1 text-base leading-relaxed text-gray-600 line-clamp-3">
                      {doc.description}
                    </CardDescription>
                    {/* Action buttons - Better mobile responsive design */}
                    <div className="flex flex-col gap-3 mt-auto">
                      <Button
                        variant="ghost"
                        onClick={() => handlePreview(doc)}
                        className="w-full h-11 text-sm font-medium text-[#236383] hover:bg-[#236383]/10 hover:text-[#236383] transition-all duration-200 ease-in-out rounded-lg py-3 px-4"
                      >
                        <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Preview</span>
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => handleDownload(doc)}
                        className="w-full h-11 text-sm font-medium bg-[#236383] hover:bg-[#1a4e66] text-white transition-all duration-200 ease-in-out rounded-lg py-3 px-4 shadow-sm hover:shadow-md"
                      >
                        <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Download</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logos" className="space-y-8">
            {/* Logo Grid - Professional design */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {logoFiles.map((logo) => (
                <Card
                  key={logo.id}
                  className="group transition-all duration-300 ease-in-out h-full flex flex-col bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(35,99,131,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08),0_16px_48px_rgba(35,99,131,0.08)] hover:-translate-y-2 rounded-lg overflow-hidden"
                >
                  <CardHeader className="pb-8 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between mb-3">
                      <CardTitle className="text-[#236383] text-xl font-bold flex items-center gap-4 group-hover:text-[#1a4e66] transition-colors duration-200">
                        <div className="p-2 bg-gradient-to-br from-[#236383]/10 to-[#236383]/5 rounded-lg shadow-inner">
                          {logo.icon}
                        </div>
                        {logo.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className="w-fit px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-800 rounded-full font-medium shadow-sm"
                    >
                      {logo.type}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-8 p-8">
                    {/* Logo Preview */}
                    <div
                      className="w-full h-40 rounded-lg border-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center overflow-hidden group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out"
                      style={{ backgroundColor: logo.bgColor }}
                    >
                      <img
                        src={`/attached_assets/LOGOS/${logo.filename}`}
                        alt={logo.name}
                        className="max-w-full max-h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300 ease-in-out"
                        onError={(e) => {
                          e.currentTarget.src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIGZpbGw9IiNkMWQ1ZGIiLz4KPC9zdmc+';
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

                    <div className="grid grid-cols-1 gap-3 pt-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full h-10 text-sm font-medium text-[#236383] hover:bg-[#236383]/10 hover:text-[#236383] transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4"
                          >
                            <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Preview</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-[#236383]">
                              {logo.name}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div
                              className="w-full h-64 rounded-lg border border-gray-200 flex items-center justify-center"
                              style={{ backgroundColor: logo.bgColor }}
                            >
                              <img
                                src={`/attached_assets/LOGOS/${logo.filename}`}
                                alt={logo.name}
                                className="max-w-full max-h-full object-contain p-4"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong className="text-[#236383]">
                                  File Type:
                                </strong>{' '}
                                {logo.type}
                              </div>
                              <div>
                                <strong className="text-[#236383]">
                                  Filename:
                                </strong>{' '}
                                {logo.filename}
                              </div>
                              <div className="col-span-2">
                                <strong className="text-[#236383]">
                                  Usage:
                                </strong>{' '}
                                {logo.usage}
                              </div>
                            </div>
                            <Button
                              onClick={() =>
                                handleLogoDownload(logo.filename, logo.name)
                              }
                              className="w-full bg-[#236383] hover:bg-[#1a4e66]"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download {logo.name}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        onClick={() =>
                          handleLogoDownload(logo.filename, logo.name)
                        }
                        className="w-full h-10 text-sm font-medium bg-[#236383] hover:bg-[#1a4e66] text-white transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4 shadow-sm hover:shadow-md"
                      >
                        <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Download</span>
                      </Button>

                      <Button
                        onClick={() =>
                          handleLogoShare(logo.filename, logo.name)
                        }
                        variant="outline"
                        className="w-full h-10 text-sm font-medium border border-[#FBAD3F] text-[#FBAD3F] hover:bg-[#FBAD3F] hover:text-white transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4 shadow-sm hover:shadow-md"
                      >
                        <Share2 className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Share</span>
                      </Button>

                      <Button
                        onClick={() => handleLogoCopy(logo.filename, logo.name)}
                        variant="outline"
                        className="w-full h-10 text-sm font-medium border border-gray-400 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4 shadow-sm hover:shadow-md"
                      >
                        <Copy className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Copy</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {hasConfidentialAccess && (
            <TabsContent value="confidential" className="space-y-8">
              <ConfidentialDocuments />
            </TabsContent>
          )}
        </Tabs>

        {/* Document Preview Modal */}
        {previewDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.1)] max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-lg">
                      {previewDocument.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {previewDocument.description}
                    </p>
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

              <div
                className="p-4 overflow-auto"
                style={{ maxHeight: 'calc(90vh - 120px)' }}
              >
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
