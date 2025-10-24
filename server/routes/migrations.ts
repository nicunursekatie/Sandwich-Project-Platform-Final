import { Router } from 'express';
import { neon } from '@neondatabase/serverless';
import { requirePermission } from '../middleware/auth.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/production-safe-logger';

const router = Router();

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run sandwich range fields migration
router.post('/sandwich-range-fields', requirePermission('ADMIN'), async (req: any, res: any) => {
  try {
    const DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

    if (!DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not configured' });
    }

    logger.log('🔄 Running sandwich range fields migration...');

    // Connect to database using Neon HTTP
    const sql = neon(DATABASE_URL);

    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_sandwich_range_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    logger.log('📝 Executing SQL:\n', migrationSQL);

    // Execute the migration
    await sql(migrationSQL);

    logger.log('✅ Migration completed successfully!');

    res.json({
      success: true,
      message: 'Sandwich range fields migration completed successfully',
      sql: migrationSQL
    });
  } catch (error: any) {
    logger.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

export default router;
