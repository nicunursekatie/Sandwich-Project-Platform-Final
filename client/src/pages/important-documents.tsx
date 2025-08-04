import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, ExternalLink } from 'lucide-react';
import { DocumentPreview } from '@/components/document-preview';

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
            Important Documents
          </h1>
          <p className="text-gray-600 mb-6">
            Key documents for The Sandwich Project, including our nonprofit paperwork and bylaws.
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="text-sm"
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
                    className="w-full h-11 text-base font-medium"
                  >
                    <Eye className="h-5 w-5 mr-2" />
                    Preview
                  </Button>
                  <Button
                    size="default"
                    variant="default"
                    onClick={() => handleDownload(doc)}
                    className="w-full h-11 text-base font-medium"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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