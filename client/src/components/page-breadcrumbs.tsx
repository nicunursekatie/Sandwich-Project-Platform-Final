import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'wouter';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface PageBreadcrumbsProps {
  segments: BreadcrumbSegment[];
  className?: string;
}

export function PageBreadcrumbs({ segments, className = '' }: PageBreadcrumbsProps) {
  return (
    <Breadcrumb className={`mb-4 ${className}`}>
      <BreadcrumbList>
        {/* Home/Dashboard link */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">
              <a className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </a>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <div key={index} className="flex items-center gap-1.5">
              <BreadcrumbSeparator>
                <ChevronRight className="w-4 h-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast || !segment.href ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href}>
                      <a className="hover:text-primary transition-colors">
                        {segment.label}
                      </a>
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
