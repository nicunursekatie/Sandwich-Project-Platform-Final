import { db } from '../db';
import { organizations } from '../../shared/schema';
import { eq, isNull, or } from 'drizzle-orm';

/**
 * Auto-categorize organizations based on their name patterns
 * Run this with: npx tsx server/scripts/auto-categorize-organizations.ts
 */

// Simple console logger for scripts (avoids Winston initialization issues)
const logger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
};

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
  /\bst\.?\s+[A-Z]/i, // St. as in Saint (followed by capital letter to avoid "1st Street")
  /\bsaint\s+[A-Z]/i, // Saint (followed by capital letter)
  /\bholy\b/i,
  /\bblessed\b/i,
  /\bdivine\b/i,
  /\bgospel\b/i,
];

// Known private schools in the Atlanta area that can't be detected by name patterns alone
// These are well-known independent/private schools whose names don't contain religious
// or other obvious private-school keywords
const knownPrivateSchools: { pattern: RegExp; isReligious: boolean }[] = [
  { pattern: /\bpace academy\b/i, isReligious: false },
  { pattern: /\b(the )?lovett school\b/i, isReligious: false },
  { pattern: /\bpaideia\b/i, isReligious: false },
  { pattern: /\bgalloway school\b/i, isReligious: false },
  { pattern: /\bweber school\b/i, isReligious: true }, // Jewish day school
  { pattern: /\b(the )?davis academy\b/i, isReligious: true }, // Jewish day school
  { pattern: /\b(the )?swift school\b/i, isReligious: false },
  { pattern: /\b(the )?wood acres school\b/i, isReligious: false },
  { pattern: /\b(the )?museum school\b/i, isReligious: false },
  { pattern: /\bwestminster\b/i, isReligious: false },
  { pattern: /\bmarist\b/i, isReligious: true }, // Catholic
  { pattern: /\batlanta international school\b/i, isReligious: false },
  { pattern: /\bcristo rey\b/i, isReligious: true }, // Jesuit Catholic
  { pattern: /\bihm\s*(catholic)?\b/i, isReligious: true }, // Immaculate Heart of Mary
  { pattern: /\bchrist the king school\b/i, isReligious: true },
  { pattern: /\bspringmont\b/i, isReligious: false }, // Montessori-based
  { pattern: /\bacton academy\b/i, isReligious: false },
  { pattern: /\bvalor christian academy\b/i, isReligious: true },
  { pattern: /\bjohnson ferry christian academy\b/i, isReligious: true },
  { pattern: /\beagles landing christian academy\b/i, isReligious: true },
  { pattern: /\bcornerstone christian academy\b/i, isReligious: true },
  { pattern: /\bfcs innovation academy\b/i, isReligious: true }, // Fellowship Christian School network
  { pattern: /\bkings ridge christian school\b/i, isReligious: true },
  { pattern: /\bmount pisgah christian school\b/i, isReligious: true },
  { pattern: /\bmt\.?\s+pisgah christian\b/i, isReligious: true },
  { pattern: /\bfellowship christian school\b/i, isReligious: true },
  { pattern: /\bgreater atlanta christian\b/i, isReligious: true },
  { pattern: /\bholy innocents\b/i, isReligious: true },
  { pattern: /\bmt\.?\s+bethel christian academy\b/i, isReligious: true },
  { pattern: /\bst\.?\s*pius\b/i, isReligious: true },
  { pattern: /\bst\.?\s*joseph catholic\b/i, isReligious: true },
  { pattern: /\bmt\.?\s+vernon presbyterian\b/i, isReligious: true },
];

// Known charter schools
const knownCharterSchools: RegExp[] = [
  /\bcherokee charter\b/i,
  /\binternational charter academy\b/i,
  /\bfulton science academy\b/i,
  /\bcumberland academy of ga\b/i,
  /\bglobal leadership academy\b/i,
];

const categoryPatterns: CategoryPattern[] = [
  // Schools - Private indicators (CHECK FIRST before generic patterns)
  {
    category: 'school',
    schoolClassification: 'private',
    patterns: [
      /\bprivate school\b/i,
      /\bprep school\b/i,
      /\bpreparatory\b/i,
      /\bmontessori\b/i,
      /\bchristian\s+(elementary|middle|high|school|academy)\b/i,
      /\bcatholic\s+(elementary|middle|high|school)\b/i,
      /\bepiscopal\s+(elementary|middle|high|school)\b/i,
      /\blutheran\s+(elementary|middle|high|school)\b/i,
      /\bmethodist\s+(elementary|middle|high|school)\b/i,
      /\bpresbyterian\s+(elementary|middle|high|school)\b/i,
      /\bbaptist\s+(elementary|middle|high|school)\b/i,
      /\bst\.?\s+\w+'?s?\s+(elementary|middle|high|school)\b/i, // St. Mary's Elementary/Middle/High/School
      /\bsaint\s+\w+'?s?\s+(elementary|middle|high|school)\b/i,
      /\bparochial\b/i,
      /\bwesleyan\s+(school|university|college|academy)\b/i, // Wesleyan School/University, not "First Wesleyan Church"
    ],
  },
  // Schools - Charter (CHECK SECOND)
  {
    category: 'school',
    schoolClassification: 'charter',
    patterns: [
      /\bcharter\s+school\b/i,
      /\bcharter\s+(elementary|middle|high)\b/i,
      /\bcharter\b/i,
    ],
  },
  // Schools - Elementary (Public - checked AFTER private/charter)
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\belementary\s+school\b/i,
      /\belem\.?\s+school\b/i,
      /\bgrade school\b/i,
      /\bprimary school\b/i,
      /\belementary\b/i, // More generic, so check last
    ],
  },
  // Schools - Middle (Public)
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\bmiddle school\b/i,
      /\bjunior high\b/i,
      /\bintermediate school\b/i,
    ],
  },
  // Schools - High School (Public)
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\bhigh school\b/i,
      /\bsecondary school\b/i,
    ],
  },
  // Schools - University/College (Public by default, though many are private)
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
      /\brotary\b/i, // Rotary Club, Rotary of [City] - usually local chapters
      /\bkiwanis\b/i,
      /\blions\s+club\b/i, // Only "Lions Club", not just "Lions" (sports teams)
      /\bboy\s+scouts?\b/i, // Boy Scout or Boy Scouts
      /\bgirl\s+scouts?\b/i, // Girl Scout or Girl Scouts
      /\bcub\s+scouts?\b/i, // Cub Scouts
      /\beagle\s+scouts?\b/i,
      /\bventure\s+scouts?\b/i,
      /\b4-h\s+club\b/i,
      /\byouth\s+group\b/i,
      /\bsports\s+club\b/i,
      /\bathletic\s+club\b/i,
      /\bsocial\s+club\b/i,
      /\brecreation\s+center\b/i,
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
      /\benterprise\s+(corporation|corp|inc|llc)\b/i, // Enterprise + corp indicator
      /\benterprise\s+holdings\b/i,
      /\bglobal\b/i,
      /\binternational\b/i,
      /\bgroup\b/i,
      /\bholdings\b/i,
      /\bcompany\b/i,
      /\bindustries\b/i,
      /\bstudios?\b/i,
      /\bbroadcasting\s+(corporation|corp|company|network)\b/i,
      /\bproductions?\b/i,
      /\bpictures\b/i,
      /\bfilms?\b/i,
      /\bwarner\s+bros\.?\b/i, // Warner Bros. (specific company)
      /\bwarner\s+bros\.?\s+discovery\b/i, // Warner Bros. Discovery (specific)
      /\btechnologies\b/i,
      /\bsystems?\b/i,
      /\bnetworks?\b/i,
    ],
  },
  // Small/Medium Corporations (less specific business terms)
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

export async function categorizeOrganization(
  name: string
): Promise<{
  category: string;
  schoolClassification?: string;
  isReligious: boolean;
} | null> {
  const nameLower = name.toLowerCase();

  // First, check if organization has religious affiliation
  const isReligious = checkReligiousAffiliation(name);

  // Check known private schools first (highest priority - these are manually verified)
  for (const school of knownPrivateSchools) {
    if (school.pattern.test(nameLower)) {
      return {
        category: 'school',
        schoolClassification: 'private',
        isReligious: school.isReligious || isReligious,
      };
    }
  }

  // Check known charter schools
  for (const pattern of knownCharterSchools) {
    if (pattern.test(nameLower)) {
      return {
        category: 'school',
        schoolClassification: 'charter',
        isReligious,
      };
    }
  }

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

async function autoCategorizeOrganizations() {
  try {
    logger.info('Starting auto-categorization of organizations...');

    // Get all organizations without a category
    const uncategorizedOrgs = await db
      .select()
      .from(organizations)
      .where(or(isNull(organizations.category), eq(organizations.category, '')));

    logger.info(
      `Found ${uncategorizedOrgs.length} organizations without a category`
    );

    let categorizedCount = 0;
    let skippedCount = 0;

    for (const org of uncategorizedOrgs) {
      const result = await categorizeOrganization(org.name);

      if (result) {
        await db
          .update(organizations)
          .set({
            category: result.category,
            schoolClassification: result.schoolClassification,
            isReligious: result.isReligious,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, org.id));

        logger.info(
          `✅ Categorized "${org.name}" as "${result.category}"${
            result.schoolClassification
              ? ` (${result.schoolClassification})`
              : ''
          }${result.isReligious ? ' [RELIGIOUS]' : ''}`
        );
        categorizedCount++;
      } else {
        logger.info(
          `⏭️  Skipped "${org.name}" - no matching category pattern found`
        );
        skippedCount++;
      }
    }

    logger.info('\n📊 Summary:');
    logger.info(`   Total organizations: ${uncategorizedOrgs.length}`);
    logger.info(`   ✅ Categorized: ${categorizedCount}`);
    logger.info(`   ⏭️  Skipped: ${skippedCount}`);
    logger.info('\n✨ Auto-categorization complete!');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to auto-categorize organizations', error);
    process.exit(1);
  }
}

autoCategorizeOrganizations();
