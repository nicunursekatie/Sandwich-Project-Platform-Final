# Smart Search Setup & Troubleshooting

## Quick Start

### 1. Set OpenAI API Key (Optional but Recommended)
```bash
export OPENAI_API_KEY=your-key-here
```

Or add to your `.env` file:
```
OPENAI_API_KEY=your-key-here
```

### 2. Restart the Server
After making any changes to the search index or updating code:
```bash
# Kill existing server
pkill -f "node.*server"

# Restart
npm start
```

### 3. Test the Search
- Press `Cmd/Ctrl+K` to open search
- Try queries like:
  - "flyer" → Should find Promotion Graphics
  - "add volunteer" → Should find Add New Volunteer
  - "collections" → Should find Collections Log
  - "analytics" → Should find Analytics

## How It Works

### Search Modes

1. **Fuzzy Search (Instant)**
   - Triggers as you type (150ms debounce)
   - Fast keyword matching
   - No AI required
   - Shows results immediately

2. **Semantic Search (AI)**
   - Triggers when you press Enter
   - Uses OpenAI embeddings
   - Understands natural language
   - Requires API key
   - Shows "AI-powered results" badge

### Search Index Location
`server/data/smart-search-index.json`

## Troubleshooting

### No Results Found

**Problem:** Typing a search term returns 0 results

**Solutions:**
1. **Restart the server** - The index is loaded once on startup
   ```bash
   pkill -f "node.*server" && npm start
   ```

2. **Check server logs** - Look for:
   ```
   [Smart Search] Loading index from: /path/to/server/data/smart-search-index.json
   [Smart Search] ✓ Index loaded: 45 features
   ```

3. **Check if file exists**:
   ```bash
   ls -la server/data/smart-search-index.json
   ```

4. **Test the search API directly**:
   ```bash
   curl -X POST http://localhost:5000/api/smart-search/fuzzy \
     -H "Content-Type: application/json" \
     -d '{"query":"flyer","limit":5}' \
     -b cookies.txt
   ```

### Empty Index

**Problem:** Server logs show "Index loaded: 0 features"

**Solutions:**
1. Check if index file is valid JSON:
   ```bash
   cat server/data/smart-search-index.json | jq .
   ```

2. Verify file permissions:
   ```bash
   chmod 644 server/data/smart-search-index.json
   ```

### AI Search Not Working

**Problem:** Press Enter but no "AI-powered results" badge appears

**Possible Causes:**
1. **No API key set** - AI falls back to fuzzy search
2. **API key invalid** - Check server logs for errors
3. **Network issues** - OpenAI API unreachable

**Solution:**
```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Check logs for OpenAI errors
tail -f logs/server.log | grep -i "openai\|smart search"
```

### Navigation Goes to 404

**Problem:** Clicking a search result navigates to a 404 page

**Solution:**
Routes should use dashboard sections format:
```json
{
  "route": "/dashboard?section=volunteers",  // ✓ Correct
  "route": "/volunteers"                     // ✗ Wrong (404)
}
```

## Debugging

### Enable Verbose Logging

Server logs will show:
```
[Smart Search] Loading index from: /home/user/project/server/data/smart-search-index.json
[Smart Search] ✓ Index loaded: 45 features
[Smart Search] Sample keywords: [...]
[Smart Search] Fuzzy search for: "flyer"
[Smart Search] Found 1 results for "flyer"
[Smart Search] Top result: Promotion Graphics (score: 0.90)
```

### Test Fuzzy Matching

Run the test script:
```bash
node test-search.js
```

Should output:
```
"flyer" -> "flyers": 0.9
Should match? (score > 0.3): true
```

## Adding New Searchable Features

Edit `server/data/smart-search-index.json`:

```json
{
  "id": "unique-id",
  "title": "Feature Name",
  "description": "What this feature does",
  "category": "Operations",
  "route": "/dashboard?section=feature-name",
  "keywords": [
    "keyword1",
    "keyword2",
    "singular",
    "plural",
    "synonyms"
  ],
  "requiredPermissions": ["permission:name"]  // Optional
}
```

**Tips:**
- Include both singular and plural forms: ["volunteer", "volunteers"]
- Add common variations: ["graphic", "graphics", "image", "images"]
- Include synonyms: ["chat", "messaging", "talk", "discuss"]
- Test with: `node test-search.js` after adding

## Performance

- **Fuzzy search**: <10ms (client-side feel)
- **Semantic search**: 200-500ms (requires OpenAI API call)
- **Index loading**: <50ms (happens once on startup)
- **Memory usage**: ~100KB for full index

## Support

If search still doesn't work:
1. Check browser console for errors (F12)
2. Check server logs for Smart Search errors
3. Verify API endpoint is accessible: `GET /api/smart-search/features`
4. Test with a known working query like "dashboard"
