import { db } from '../db';
import { organizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Fix school classifications for known private schools that were incorrectly
 * categorized as "public" or left uncategorized.
 *
 * This is based on research of Atlanta-area schools that partner with
 * The Sandwich Project. These are verified private/charter schools.
 *
 * Run this with: npx tsx server/scripts/fix-school-classifications.ts
 */

const logger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
};

interface SchoolFix {
  id: number;
  name: string;
  category: string;
  schoolClassification: string;
  isReligious: boolean;
}

// Schools that need their classification corrected
// Verified via research of Atlanta-area private schools
const schoolFixes: SchoolFix[] = [
  // === PRIVATE SCHOOLS currently misclassified as "public" ===
  { id: 92, name: 'Pace Academy', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 170, name: 'The Davis Academy', category: 'school', schoolClassification: 'private', isReligious: true }, // Jewish
  { id: 470, name: 'Davis Academy', category: 'school', schoolClassification: 'private', isReligious: true }, // Jewish (duplicate entry)
  { id: 502, name: 'Paideia Junior High School', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 256, name: 'Acton Academy Marietta', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 112, name: 'Cornerstone Christian Academy MS', category: 'school', schoolClassification: 'private', isReligious: true },
  { id: 244, name: 'Cornerstone Christian Academy', category: 'school', schoolClassification: 'private', isReligious: true },
  { id: 385, name: 'Valor Christian Academy', category: 'school', schoolClassification: 'private', isReligious: true },
  { id: 563, name: 'Johnson Ferry Christian Academy', category: 'school', schoolClassification: 'private', isReligious: true },
  { id: 596, name: 'Eagles Landing Christian Academy: Young Men of Distinction', category: 'school', schoolClassification: 'private', isReligious: true },
  { id: 337, name: 'FCS Innovation Academy', category: 'school', schoolClassification: 'private', isReligious: true }, // Fellowship Christian School network
  { id: 329, name: 'William & Reed Academy', category: 'school', schoolClassification: 'private', isReligious: false },

  // === PRIVATE SCHOOLS currently misclassified as "public" (universities) ===
  { id: 121, name: 'Oglethorpe University', category: 'school', schoolClassification: 'private', isReligious: false },

  // === CHARTER SCHOOLS currently misclassified as "public" ===
  { id: 441, name: 'Fulton Science Academy', category: 'school', schoolClassification: 'charter', isReligious: false },
  { id: 411, name: 'International Charter Academy of Georgia', category: 'school', schoolClassification: 'charter', isReligious: false },
  { id: 181, name: 'Cumberland Academy of GA', category: 'school', schoolClassification: 'charter', isReligious: false },
  { id: 527, name: 'Capstone Academy', category: 'school', schoolClassification: 'charter', isReligious: false },
  { id: 354, name: 'Global Leadership Academy-Gwinnett Beta Club', category: 'school', schoolClassification: 'charter', isReligious: false },
  { id: 404, name: 'Collective Learning Academy', category: 'school', schoolClassification: 'private', isReligious: false },

  // === SCHOOLS that have NO category set at all (missing from school list) ===
  { id: 47, name: 'Christ the King School', category: 'school', schoolClassification: 'private', isReligious: true }, // Catholic
  { id: 53, name: 'Marist', category: 'school', schoolClassification: 'private', isReligious: true }, // Catholic
  { id: 606, name: 'Marist', category: 'school', schoolClassification: 'private', isReligious: true }, // Catholic (duplicate)
  { id: 481, name: 'Westminster', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 226, name: 'The Swift School', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 318, name: 'Weber School', category: 'school', schoolClassification: 'private', isReligious: true }, // Jewish
  { id: 365, name: 'Galloway School', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 418, name: 'The Museum School', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 457, name: 'The Lovett School', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 545, name: 'The Wood Acres School', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 330, name: 'Paideia', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 140, name: 'Atlanta International School', category: 'school', schoolClassification: 'private', isReligious: false },
  { id: 442, name: 'IHM Catholic', category: 'school', schoolClassification: 'private', isReligious: true },
  { id: 532, name: 'Cristo Rey School', category: 'school', schoolClassification: 'private', isReligious: true }, // Jesuit Catholic

  // === Fix Mt. Vernon Presbyterian religious flag ===
  { id: 189, name: 'Mt. Vernon Presbyterian School', category: 'school', schoolClassification: 'private', isReligious: true },
];

async function fixSchoolClassifications() {
  try {
    logger.info('Starting school classification fixes...\n');

    let fixedCount = 0;
    let errorCount = 0;

    for (const fix of schoolFixes) {
      try {
        await db
          .update(organizations)
          .set({
            category: fix.category,
            schoolClassification: fix.schoolClassification,
            isReligious: fix.isReligious,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, fix.id));

        logger.info(
          `  Fixed: "${fix.name}" (ID: ${fix.id}) -> ${fix.schoolClassification}${fix.isReligious ? ' [RELIGIOUS]' : ''}`
        );
        fixedCount++;
      } catch (err) {
        logger.error(`  ERROR fixing "${fix.name}" (ID: ${fix.id}):`, err);
        errorCount++;
      }
    }

    logger.info(`\nSummary:`);
    logger.info(`  Fixed: ${fixedCount}`);
    logger.info(`  Errors: ${errorCount}`);
    logger.info(`  Total: ${schoolFixes.length}`);
    logger.info('\nSchool classification fixes complete!');

    process.exit(0);
  } catch (error) {
    logger.error('Failed to fix school classifications:', error);
    process.exit(1);
  }
}

fixSchoolClassifications();
