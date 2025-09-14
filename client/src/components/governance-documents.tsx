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
import { Download, FileText, Eye, ExternalLink } from 'lucide-react';
import { DocumentPreview } from './document-preview';

interface GovernanceDocument {
  name: string;
  path: string;
  type: 'pdf' | 'xlsx' | 'docx' | 'txt' | 'other';
  category: string;
  description?: string;
}

const governanceDocuments: GovernanceDocument[] = [
  {
    name: 'Articles of Incorporation',
    path: '/attached_assets/Articles of Incorporation.pdf',
    type: 'pdf',
    category: 'Legal Foundation',
    description:
      'Official Articles of Incorporation establishing The Sandwich Project as a legal entity',
  },
  {
    name: '2020 Georgia Code Title 51',
    path: '/attached_assets/2020 Georgia Code Title 51.pdf',
    type: 'pdf',
    category: 'Legal Reference',
    description:
      'Georgia state code governing nonprofit organizations and corporate governance',
  },
  {
    name: 'IRS Tax Exempt Letter',
    path: '/attached_assets/IRS Tax Exempt Letter (Contains EIN).pdf',
    type: 'pdf',
    category: 'Tax Status',
    description:
      'IRS determination letter granting 501(c)(3) tax-exempt status with EIN information',
  },
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
    default:
      return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Legal Foundation':
      return 'bg-teal-100 text-teal-800';
    case 'Legal Reference':
      return 'bg-blue-100 text-blue-800';
    case 'Tax Status':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function GovernanceDocuments() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewDocument, setPreviewDocument] =
    useState<GovernanceDocument | null>(null);

  const categories = [
    'All',
    ...Array.from(new Set(governanceDocuments.map((doc) => doc.category))),
  ];

  const filteredDocuments =
    selectedCategory === 'All'
      ? governanceDocuments
      : governanceDocuments.filter((doc) => doc.category === selectedCategory);

  const handlePreview = (document: GovernanceDocument) => {
    setPreviewDocument(document);
  };

  const handleDownload = (document: GovernanceDocument) => {
    const link = window.document.createElement('a');
    link.href = document.path;
    link.download = document.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleExternalOpen = (document: GovernanceDocument) => {
    window.open(document.path, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Governance Documents
        </h1>
        <p className="text-gray-600">
          Essential legal and governance documents for The Sandwich Project
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            className={selectedCategory === category ? 'bg-[#236383] hover:bg-[#1d5470] text-white border-[#236383]' : 'text-[#236383] border-[#236383] hover:bg-[#f0f9ff]'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="text-sm"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Documents Grid - Better tablet responsiveness with wider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {filteredDocuments.map((document, index) => (
          <Card
            key={index}
            className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col border-2 hover:border-[#236383]"
          >
            <CardHeader className="pb-4 flex-shrink-0">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {getFileIcon(document.type)}
                  </div>
                  <CardTitle className="text-lg md:text-xl font-semibold text-gray-900 leading-tight">
                    {document.name}
                  </CardTitle>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={`text-xs font-medium px-2 py-0.5 ${getCategoryColor(
                    document.category
                  )}`}
                >
                  {document.category}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs font-medium px-2 py-0.5"
                >
                  {document.type.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col">
              {document.description && (
                <CardDescription className="mb-6 flex-1 text-base leading-relaxed text-gray-600">
                  {document.description}
                </CardDescription>
              )}
              {/* Action buttons - fixed to stay within card bounds */}
              <div className="flex flex-col gap-2 mt-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreview(document)}
                  className="w-full h-9 text-sm font-medium text-[#236383] border-[#236383] hover:bg-[#f0f9ff]"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownload(document)}
                  className="w-full h-9 text-sm font-medium bg-[#236383] hover:bg-[#1d5470] text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDocuments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            No documents found in the selected category.
          </p>
        </div>
      )}

      {/* Document Preview Modal */}
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
