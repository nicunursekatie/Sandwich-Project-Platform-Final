/**
 * Host Resources Page
 *
 * A centralized hub for host volunteers to access all the tools and documents
 * they need for running their collection site.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Icons
import {
  Building2,
  MapPin,
  Users,
  FileText,
  ClipboardList,
  Download,
  ExternalLink,
  Sandwich,
  Tag,
  UserCheck,
  Phone,
  Mail,
  BookOpen,
  HelpCircle,
} from 'lucide-react';

// Resource card component
function ResourceCard({
  title,
  description,
  icon: Icon,
  href,
  isExternal = false,
  variant = 'default',
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  isExternal?: boolean;
  variant?: 'default' | 'primary' | 'secondary';
}) {
  const bgClass = variant === 'primary'
    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    : variant === 'secondary'
    ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
    : 'bg-white hover:bg-gray-50';

  const content = (
    <Card className={`${bgClass} transition-colors cursor-pointer h-full`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Icon className="w-5 h-5 text-gray-700" />
          </div>
          {isExternal && (
            <ExternalLink className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <CardTitle className="text-base mt-2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </a>
    );
  }

  return (
    <Link href={`/${href}`} className="block h-full">
      {content}
    </Link>
  );
}

// Document download card
function DocumentCard({
  title,
  description,
  fileType,
  downloadUrl,
}: {
  title: string;
  description: string;
  fileType: string;
  downloadUrl: string;
}) {
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = downloadUrl.split('/').pop() || 'document.pdf';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <Card className="bg-white hover:bg-gray-50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <FileText className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            <Badge variant="outline" className="mt-1 text-[10px]">
              {fileType}
            </Badge>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HostResources() {
  const { user } = useAuth();

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-blue-100 rounded-full">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Host Resources</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Everything you need to run your sandwich collection site.
          Access tools, download documents, and find important information all in one place.
        </p>
      </div>

      {/* Quick Links Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sandwich className="w-5 h-5 text-amber-500" />
          Collection Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ResourceCard
            title="Log Your Collections"
            description="Record sandwich collections from your site with the easy-to-use collection form."
            icon={ClipboardList}
            href="collections"
            variant="primary"
          />
          <ResourceCard
            title="Collection History"
            description="View your past collection entries and see your site's impact over time."
            icon={Sandwich}
            href="collections"
          />
          <ResourceCard
            title="Recipient Database"
            description="Browse the database of recipient organizations that receive sandwiches."
            icon={Users}
            href="recipients"
          />
        </div>
      </section>

      {/* Maps Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-500" />
          Maps & Locations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResourceCard
            title="Host Locations Map"
            description="See all host collection sites on an interactive map. Great for finding nearby hosts!"
            icon={MapPin}
            href="route-map"
            variant="secondary"
          />
          <ResourceCard
            title="All Hosts Directory"
            description="Browse the complete list of host collection sites and their details."
            icon={Building2}
            href="hosts"
          />
        </div>
      </section>

      {/* Documents Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          Downloadable Documents
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Download and print these documents for your collection site.
        </p>
        <div className="space-y-3">
          <DocumentCard
            title="Deli Sandwich Labels"
            description="Pre-formatted labels for deli meat sandwiches with ingredient info"
            fileType="PDF"
            downloadUrl="/attached_assets/Deli Labels_1756865384146.pdf"
          />
          <DocumentCard
            title="PB&J Sandwich Labels"
            description="Pre-formatted labels for peanut butter & jelly sandwiches"
            fileType="PDF"
            downloadUrl="/attached_assets/PBJ Labels_1756865384146.pdf"
          />
          <DocumentCard
            title="Volunteer Sign-In Sheet"
            description="Sign-in sheet for tracking volunteer attendance at your site"
            fileType="PDF"
            downloadUrl="/attached_assets/Sandwich Project - Sign In Sheet correct qrs.pdf"
          />
          <DocumentCard
            title="Food Safety for Hosts"
            description="Food safety guidelines and best practices for host collection sites"
            fileType="PDF"
            downloadUrl="/attached_assets/20230525-TSP-Food Safety Hosts (1)_1753670644140.pdf"
          />
          <DocumentCard
            title="Deli Sandwich Making 101"
            description="Step-by-step guide for making deli sandwiches"
            fileType="PDF"
            downloadUrl="/attached_assets/20240622-TSP-Deli Sandwich Making 101_1749341916236.pdf"
          />
          <DocumentCard
            title="PB&J Sandwich Making 101"
            description="Step-by-step guide for making peanut butter & jelly sandwiches"
            fileType="PDF"
            downloadUrl="/attached_assets/20250205-TSP-PBJ Sandwich Making 101_1753670644141.pdf"
          />
        </div>
      </section>

      {/* Contact Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-purple-500" />
          Need Help?
        </h2>
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Contact TSP Staff</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <a href="mailto:info@thesandwichproject.org" className="hover:text-primary">
                      info@thesandwichproject.org
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>Check the directory for direct contacts</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-3">Quick Resources</h3>
                <div className="space-y-2">
                  <Link href="/help">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                      <BookOpen className="w-4 h-4" />
                      Help Center
                    </Button>
                  </Link>
                  <Link href="/suggestions">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                      <HelpCircle className="w-4 h-4" />
                      Submit a Question
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Tips Section */}
      <section>
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-600" />
              Host Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                Log your collections promptly so we can track our impact accurately.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                Use the sign-in sheets to track volunteer hours for service hour verification.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                Labels should include date made and allergen info (especially for PB&J).
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                Connect with other hosts on the map to share best practices!
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
