// Quick test of fuzzy matching logic
function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t === q) return 1.0;

  // Starts with
  if (t.startsWith(q)) return 0.9;

  // Contains
  if (t.includes(q)) return 0.7;

  // Levenshtein distance
  const distance = levenshteinDistance(q, t);
  const maxLength = Math.max(q.length, t.length);
  const similarity = 1 - (distance / maxLength);

  return similarity > 0.6 ? similarity * 0.6 : 0;
}

function levenshteinDistance(a, b) {
  const matrix = [];
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

// Test cases
console.log('Testing fuzzy matching:');
console.log(`"flyer" -> "flyers": ${fuzzyMatch("flyer", "flyers")}`);
console.log(`"flyer" -> "promotion": ${fuzzyMatch("flyer", "promotion")}`);
console.log(`"flyer" -> "graphics": ${fuzzyMatch("flyer", "graphics")}`);
console.log(`"flyer" -> "marketing": ${fuzzyMatch("flyer", "marketing")}`);
console.log(`"flyer" -> "posters": ${fuzzyMatch("flyer", "posters")}`);

// Check if 0.9 > 0.3 threshold
console.log('\nShould match? (score > 0.3):', fuzzyMatch("flyer", "flyers") > 0.3);
