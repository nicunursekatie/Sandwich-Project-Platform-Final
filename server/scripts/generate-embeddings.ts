/**
 * Generate and Persist OpenAI Embeddings
 *
 * This script pre-generates embeddings for all searchable features
 * to avoid slow first-time searches and persist them in the index.
 *
 * Run with: npx ts-node server/scripts/generate-embeddings.ts
 */

import { SmartSearchService } from '../services/smart-search.service';

async function generateAllEmbeddings() {
  console.log('🚀 Starting embedding generation...\n');

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY environment variable not set');
    console.error('Please set your OpenAI API key:');
    console.error('  export OPENAI_API_KEY=your-key-here');
    process.exit(1);
  }

  const searchService = new SmartSearchService(apiKey);

  try {
    // Load the index
    await searchService.loadIndex();
    console.log('✓ Search index loaded\n');

    // Generate embeddings for all features
    console.log('Generating embeddings for all features...');
    console.log('This may take a few minutes depending on the number of features.\n');

    await searchService.regenerateEmbeddings();

    console.log('\n✅ All embeddings generated and saved!');
    console.log('Search index is now optimized for fast semantic search.');

  } catch (error) {
    console.error('\n❌ Error generating embeddings:', error);
    process.exit(1);
  }
}

// Run the script
generateAllEmbeddings();
