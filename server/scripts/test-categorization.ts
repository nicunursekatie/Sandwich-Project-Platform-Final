/**
 * Test the auto-categorization logic with sample organization names
 * Run this with: npx tsx server/scripts/test-categorization.ts
 */

interface CategoryPattern {
  category: string;
  schoolClassification?: string;
  patterns: RegExp[];
}

// Patterns that indicate religious affiliation (independent of category)
const religiousPatterns: RegExp[] = [
  /\bchurch\b/i,
  /\bchapel\b/i,
  /\bsynagogue\b/i,
  /\bmosque\b/i,
  /\btemple\b/i,
  /\bparish\b/i,
  /\bcathedral\b/i,
  /\bministry\b/i,
  /\bfellowship\b/i,
  /\bcongregation\b/i,
  /\breligious\b/i,
  /\bfaith\b/i,
  /\bbible\b/i,
  /\bchristian\b/i,
  /\bcatholic\b/i,
  /\bjewish\b/i,
  /\bislamic\b/i,
  /\bbuddhist\b/i,
  /\bhindu\b/i,
  /\bst\.?\s+/i, // St. as in Saint
  /\bsaint\s+/i,
  /\bholy\b/i,
  /\bblessed\b/i,
  /\bdivine\b/i,
  /\bgospel\b/i,
];

const categoryPatterns: CategoryPattern[] = [
  // Schools - Elementary
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\belementary\b/i,
      /\belem\.?\b/i,
      /\bgrade school\b/i,
      /\bprimary school\b/i,
    ],
  },
  // Schools - Middle
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\bmiddle school\b/i,
      /\bjunior high\b/i,
      /\bintermediate school\b/i,
    ],
  },
  // Schools - High School
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\bhigh school\b/i,
      /\bsecondary school\b/i,
      /\bhigh\b.*\bschool\b/i,
    ],
  },
  // Schools - University/College
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\buniversity\b/i,
      /\bcollege\b/i,
      /\bacademy\b/i,
      /\binstitute\b/i,
    ],
  },
  // Schools - Private indicators
  {
    category: 'school',
    schoolClassification: 'private',
    patterns: [
      /\bprivate school\b/i,
      /\bprep school\b/i,
      /\bpreparatory\b/i,
      /\bmontessori\b/i,
      /\bchristian school\b/i,
      /\bcatholic school\b/i,
      /\bst\.?\s+\w+'?s?\s+school\b/i,
      /\bsaint\s+\w+'?s?\s+school\b/i,
    ],
  },
  // Schools - Charter
  {
    category: 'school',
    schoolClassification: 'charter',
    patterns: [
      /\bcharter school\b/i,
      /\bcharter\b/i,
    ],
  },
  // Churches and Faith Organizations
  {
    category: 'church_faith',
    patterns: [
      /\bchurch\b/i,
      /\bchapel\b/i,
      /\bsynagogue\b/i,
      /\bmosque\b/i,
      /\btemple\b/i,
      /\bparish\b/i,
      /\bcathedral\b/i,
      /\bministry\b/i,
      /\bfellowship\b/i,
      /\bcongregation\b/i,
      /\breligious\b/i,
      /\bfaith\b/i,
      /\bbible\b/i,
      /\bchristian\b/i,
      /\bcatholic\b/i,
      /\bjewish\b/i,
      /\bislamic\b/i,
      /\bst\.?\s+\w+\s+church\b/i,
      /\bsaint\s+\w+\s+church\b/i,
    ],
  },
  // Neighborhoods and Community Groups
  {
    category: 'neighborhood',
    patterns: [
      /\bneighborhood\b/i,
      /\bcommunity\s+group\b/i,
      /\bcommunity\s+center\b/i,
      /\bcommunity\s+association\b/i,
      /\bhomeowners\b/i,
      /\bhoa\b/i,
      /\bresidents\b/i,
      /\bneighbors\b/i,
      /\bblock\s+club\b/i,
      /\bcivic\s+association\b/i,
    ],
  },
  // Clubs
  {
    category: 'club',
    patterns: [
      /\bclub\b/i,
      /\brotary\b/i,
      /\bkiwanis\b/i,
      /\blions\s+club\b/i,
      /\bboy\s+scouts\b/i,
      /\bgirl\s+scouts\b/i,
      /\b4-h\b/i,
      /\byouth\s+group\b/i,
      /\bsports\s+club\b/i,
      /\bathletic\s+club\b/i,
      /\bsocial\s+club\b/i,
      /\brecreation\b/i,
    ],
  },
  // Large Corporations
  {
    category: 'large_corp',
    patterns: [
      /\bcorporation\b/i,
      /\bcorp\.?\b/i,
      /\binc\.?\b/i,
      /\bllc\b/i,
      /\bltd\.?\b/i,
      /\benterprise\b/i,
      /\bglobal\b/i,
      /\binternational\b/i,
      /\bgroup\b/i,
      /\bholdings\b/i,
      /\bcompany\b/i,
      /\bindustries\b/i,
    ],
  },
  // Small/Medium Corporations
  {
    category: 'small_medium_corp',
    patterns: [
      /\bbusiness\b/i,
      /\bservices\b/i,
      /\bsolutions\b/i,
      /\bconsulting\b/i,
      /\bpartners\b/i,
      /\bassociates\b/i,
    ],
  },
];

function checkReligiousAffiliation(name: string): boolean {
  const nameLower = name.toLowerCase();
  return religiousPatterns.some((pattern) => pattern.test(nameLower));
}

function categorizeOrganization(
  name: string
): {
  category: string;
  schoolClassification?: string;
  isReligious: boolean;
} | null {
  const nameLower = name.toLowerCase();

  // First, check if organization has religious affiliation
  const isReligious = checkReligiousAffiliation(name);

  // Prioritize schools over church_faith category
  // This ensures "St. Mary's School" is categorized as a school, not a church
  for (const pattern of categoryPatterns.filter((p) => p.category === 'school')) {
    for (const regex of pattern.patterns) {
      if (regex.test(nameLower)) {
        return {
          category: pattern.category,
          schoolClassification: pattern.schoolClassification,
          isReligious,
        };
      }
    }
  }

  // Check for church/faith organizations (only if not already categorized as school)
  for (const pattern of categoryPatterns.filter(
    (p) => p.category === 'church_faith'
  )) {
    for (const regex of pattern.patterns) {
      if (regex.test(nameLower)) {
        return {
          category: pattern.category,
          schoolClassification: pattern.schoolClassification,
          isReligious: true, // Churches are always religious
        };
      }
    }
  }

  // Then check other categories
  for (const pattern of categoryPatterns.filter(
    (p) => p.category !== 'school' && p.category !== 'church_faith'
  )) {
    for (const regex of pattern.patterns) {
      if (regex.test(nameLower)) {
        return {
          category: pattern.category,
          schoolClassification: pattern.schoolClassification,
          isReligious,
        };
      }
    }
  }

  return null;
}

// Test cases
const testOrganizations = [
  // Schools
  'Lincoln Elementary School',
  'Roosevelt Middle School',
  'Washington High School',
  'Harvard University',
  'St. Mary\'s School',
  'Montessori Academy',
  'Summit Charter School',

  // Churches
  'First Baptist Church',
  'St. John\'s Cathedral',
  'Temple Beth Shalom',
  'Islamic Center',
  'Grace Fellowship',

  // Neighborhoods
  'Oak Park Neighborhood Association',
  'Riverside Community Center',
  'Homeowners Association',

  // Clubs
  'Rotary Club',
  'Boy Scouts Troop 123',
  'Lions Club',
  'Youth Sports Club',

  // Corporations
  'Acme Corporation',
  'Global Industries Inc.',
  'Smith Consulting Services',
  'Local Business Partners',

  // Edge cases
  'Random Organization Name',
  'The Community',
];

console.log('🧪 Testing Auto-Categorization Logic\n');
console.log('='.repeat(80));

let successCount = 0;
let failCount = 0;

for (const orgName of testOrganizations) {
  const result = categorizeOrganization(orgName);

  if (result) {
    console.log(`✅ "${orgName}"`);
    console.log(`   → Category: ${result.category}`);
    if (result.schoolClassification) {
      console.log(`   → School Classification: ${result.schoolClassification}`);
    }
    console.log(`   → Religious: ${result.isReligious ? 'Yes' : 'No'}`);
    successCount++;
  } else {
    console.log(`❌ "${orgName}"`);
    console.log(`   → No category found`);
    failCount++;
  }
  console.log('');
}

console.log('='.repeat(80));
console.log(`\n📊 Results: ${successCount} categorized, ${failCount} not categorized`);
console.log(`   Success rate: ${((successCount / testOrganizations.length) * 100).toFixed(1)}%\n`);
