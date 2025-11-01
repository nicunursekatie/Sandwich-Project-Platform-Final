/**
 * Smart Search Service
 * Provides intelligent app-wide navigation using hybrid search:
 * 1. Fuzzy matching for instant results
 * 2. OpenAI embeddings for semantic understanding
 * 3. Analytics-driven learning
 */

import OpenAI from 'openai';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  SmartSearchIndex,
  SmartSearchQuery,
  SmartSearchResult,
  SearchableFeature,
  SearchAnalytics
} from '../types/smart-search';

export class SmartSearchService {
  private index: SmartSearchIndex | null = null;
  private openai: OpenAI | null = null;
  private indexPath: string;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(openaiApiKey?: string) {
    this.indexPath = path.join(__dirname, '../data/smart-search-index.json');

    if (openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: openaiApiKey
      });
    }
  }

  /**
   * Load search index from JSON file
   */
  async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(data);
      console.log(`✓ Smart search index loaded: ${this.index?.features.length} features`);
    } catch (error) {
      console.error('Failed to load smart search index:', error);
      // Initialize with empty index
      this.index = { features: [], commonQuestions: [] };
    }
  }

  /**
   * Save search index to JSON file
   */
  async saveIndex(): Promise<void> {
    if (!this.index) return;

    try {
      await fs.writeFile(
        this.indexPath,
        JSON.stringify(this.index, null, 2),
        'utf-8'
      );
      console.log('✓ Smart search index saved');
    } catch (error) {
      console.error('Failed to save smart search index:', error);
    }
  }

  /**
   * Get embedding vector from OpenAI
   */
  private async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) return null;

    // Check cache first
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text)!;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });

      const embedding = response.data[0].embedding;
      this.embeddingCache.set(text, embedding);
      return embedding;
    } catch (error) {
      console.error('Failed to get embedding:', error);
      return null;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate fuzzy match score between query and text
   * Returns a score between 0 and 1
   */
  private fuzzyMatch(query: string, text: string): number {
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    // Exact match
    if (t === q) return 1.0;

    // Starts with
    if (t.startsWith(q)) return 0.9;

    // Contains
    if (t.includes(q)) return 0.7;

    // Calculate Levenshtein distance ratio
    const distance = this.levenshteinDistance(q, t);
    const maxLength = Math.max(q.length, t.length);
    const similarity = 1 - (distance / maxLength);

    // Only return meaningful similarities
    return similarity > 0.6 ? similarity * 0.6 : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Perform fuzzy search (client-side, instant)
   */
  async fuzzySearch(query: SmartSearchQuery): Promise<SmartSearchResult[]> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index || !query.query.trim()) {
      return [];
    }

    const q = query.query.toLowerCase().trim();
    const results: SmartSearchResult[] = [];

    for (const feature of this.index.features) {
      // Skip if user doesn't have required permissions
      if (feature.requiredPermissions && feature.requiredPermissions.length > 0) {
        if (query.userRole !== 'admin' && !feature.requiredPermissions.includes(query.userRole || '')) {
          continue;
        }
      }

      let maxScore = 0;
      let matchedKeywords: string[] = [];

      // Check title
      const titleScore = this.fuzzyMatch(q, feature.title);
      maxScore = Math.max(maxScore, titleScore * 1.2); // Title matches get bonus

      // Check description
      const descScore = this.fuzzyMatch(q, feature.description);
      maxScore = Math.max(maxScore, descScore * 0.8);

      // Check category
      const categoryScore = this.fuzzyMatch(q, feature.category);
      maxScore = Math.max(maxScore, categoryScore * 0.9);

      // Check keywords
      for (const keyword of feature.keywords) {
        const keywordScore = this.fuzzyMatch(q, keyword);
        if (keywordScore > 0.7) {
          matchedKeywords.push(keyword);
          maxScore = Math.max(maxScore, keywordScore);
        }
      }

      // Only include results with meaningful scores
      if (maxScore > 0.3) {
        results.push({
          feature,
          score: maxScore,
          matchType: maxScore > 0.9 ? 'exact' : 'fuzzy',
          matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    return results.slice(0, query.limit || 10);
  }

  /**
   * Perform semantic search using OpenAI embeddings
   */
  async semanticSearch(query: SmartSearchQuery): Promise<SmartSearchResult[]> {
    if (!this.openai || !this.index) {
      // Fallback to fuzzy search if AI not available
      return this.fuzzySearch(query);
    }

    // Get query embedding
    const queryEmbedding = await this.getEmbedding(query.query);
    if (!queryEmbedding) {
      return this.fuzzySearch(query);
    }

    const results: SmartSearchResult[] = [];

    for (const feature of this.index.features) {
      // Skip if user doesn't have required permissions
      if (feature.requiredPermissions && feature.requiredPermissions.length > 0) {
        if (query.userRole !== 'admin' && !feature.requiredPermissions.includes(query.userRole || '')) {
          continue;
        }
      }

      // Create searchable text from feature
      const searchableText = `${feature.title} ${feature.description} ${feature.keywords.join(' ')}`;

      // Get or compute embedding for this feature
      let featureEmbedding = feature.embedding;
      if (!featureEmbedding) {
        featureEmbedding = await this.getEmbedding(searchableText);
        if (featureEmbedding) {
          feature.embedding = featureEmbedding;
        }
      }

      if (featureEmbedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, featureEmbedding);

        if (similarity > 0.5) { // Threshold for semantic relevance
          results.push({
            feature,
            score: similarity,
            matchType: 'semantic'
          });
        }
      }
    }

    // Save updated index with embeddings
    if (results.length > 0) {
      await this.saveIndex();
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    return results.slice(0, query.limit || 10);
  }

  /**
   * Hybrid search: combines fuzzy and semantic results
   */
  async hybridSearch(query: SmartSearchQuery): Promise<SmartSearchResult[]> {
    const [fuzzyResults, semanticResults] = await Promise.all([
      this.fuzzySearch(query),
      this.semanticSearch(query)
    ]);

    // Merge results, prioritizing exact/fuzzy matches but including semantic ones
    const resultMap = new Map<string, SmartSearchResult>();

    // Add fuzzy results first (higher priority)
    for (const result of fuzzyResults) {
      resultMap.set(result.feature.id, result);
    }

    // Add semantic results, boosting scores if already present
    for (const result of semanticResults) {
      const existing = resultMap.get(result.feature.id);
      if (existing) {
        // Boost score if both fuzzy and semantic match
        existing.score = Math.min(1.0, existing.score * 1.2 + result.score * 0.3);
        existing.matchType = 'semantic';
      } else {
        resultMap.set(result.feature.id, result);
      }
    }

    // Convert back to array and sort
    const results = Array.from(resultMap.values());
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, query.limit || 10);
  }

  /**
   * Check common questions for quick answers
   */
  async checkCommonQuestions(query: string): Promise<SearchableFeature | null> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) return null;

    const q = query.toLowerCase().trim();

    for (const cq of this.index.commonQuestions) {
      if (this.fuzzyMatch(q, cq.question) > 0.8) {
        const feature = this.index.features.find(f => f.id === cq.targetId);
        if (feature) return feature;
      }
    }

    return null;
  }

  /**
   * Get all features (for display/debugging)
   */
  async getAllFeatures(): Promise<SearchableFeature[]> {
    if (!this.index) {
      await this.loadIndex();
    }
    return this.index?.features || [];
  }

  /**
   * Regenerate all embeddings (admin only)
   */
  async regenerateEmbeddings(): Promise<void> {
    if (!this.openai || !this.index) {
      throw new Error('OpenAI not configured or index not loaded');
    }

    console.log('Regenerating embeddings for all features...');

    for (const feature of this.index.features) {
      const searchableText = `${feature.title} ${feature.description} ${feature.keywords.join(' ')}`;
      const embedding = await this.getEmbedding(searchableText);

      if (embedding) {
        feature.embedding = embedding;
        console.log(`✓ Generated embedding for: ${feature.title}`);
      }
    }

    await this.saveIndex();
    console.log('✓ All embeddings regenerated');
  }
}
