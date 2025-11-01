/**
 * Smart Search Types
 * Intelligent app-wide navigation and feature discovery
 */

export interface SearchableFeature {
  id: string;
  title: string;
  description: string;
  category: string;
  route: string;
  action?: string;
  keywords: string[];
  requiredPermissions?: string[];
  embedding?: number[];
}

export interface CommonQuestion {
  question: string;
  targetId: string;
}

export interface SmartSearchIndex {
  features: SearchableFeature[];
  commonQuestions: CommonQuestion[];
}

export interface SmartSearchQuery {
  query: string;
  limit?: number;
  userRole?: string;
}

export interface SmartSearchResult {
  feature: SearchableFeature;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'keyword';
  matchedKeywords?: string[];
}

export interface SmartSearchResponse {
  results: SmartSearchResult[];
  queryTime: number;
  usedAI: boolean;
}

export interface SearchAnalytics {
  query: string;
  resultId: string | null;
  clicked: boolean;
  timestamp: Date;
  userId: string;
}
