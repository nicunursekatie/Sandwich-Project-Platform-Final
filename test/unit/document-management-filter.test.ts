import { documentMatchesFilters } from '@/components/document-management';
import type { Document } from '@/components/document-management';

describe('documentMatchesFilters', () => {
  const baseDocument: Document = {
    id: 1,
    title: 'Policy Handbook',
    description: null,
    fileName: 'policy.pdf',
    originalName: 'policy.pdf',
    filePath: '/uploads/policy.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    category: 'governance',
    isActive: true,
    uploadedBy: 'user-1',
    uploadedByName: 'User One',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  };

  it('matches search term even when description is null', () => {
    const document = { ...baseDocument, description: null };

    expect(() => documentMatchesFilters(document, 'policy', 'all')).not.toThrow();
    expect(documentMatchesFilters(document, 'policy', 'all')).toBe(true);
  });

  it('matches against the description when provided', () => {
    const document = {
      ...baseDocument,
      title: 'Annual Summary',
      description: 'Comprehensive update for the fiscal year',
    };

    expect(documentMatchesFilters(document, 'fiscal', 'all')).toBe(true);
  });

  it('handles undefined descriptions without throwing', () => {
    const document = { ...baseDocument, description: undefined };

    expect(() => documentMatchesFilters(document, 'policy', 'all')).not.toThrow();
    expect(documentMatchesFilters(document, 'policy', 'all')).toBe(true);
  });

  it('respects the category filter', () => {
    const document = {
      ...baseDocument,
      category: 'operations',
      title: 'Operations Checklist',
    };

    expect(documentMatchesFilters(document, '', 'operations')).toBe(true);
    expect(documentMatchesFilters(document, '', 'governance')).toBe(false);
  });
});
