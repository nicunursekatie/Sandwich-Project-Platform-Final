import XLSX from 'xlsx';
import * as path from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Excel date to JavaScript date converter
function excelDateToJSDate(excelDate: number): Date {
  const EXCEL_EPOCH = new Date(1899, 11, 30);
  const jsDate = new Date(EXCEL_EPOCH.getTime() + excelDate * 86400000);
  return jsDate;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function importScottData() {
  try {
    console.log('📊 Reading Scott\'s authoritative Excel file...');
    const filePath = path.join(process.cwd(), 'attached_assets/New Sandwich Totals Scott (5)_1761847323011.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['InputData'];
    const data = XLSX.utils.sheet_to_json(sheet) as any[];
    
    console.log(`Found ${data.length} total records in Excel file`);
    
    // Clear existing data
    console.log('\n🗑️  Clearing existing authoritative data...');
    await db.execute(sql`TRUNCATE TABLE authoritative_weekly_collections RESTART IDENTITY`);
    
    // Prepare records for import
    const records = [];
    let skipped = 0;
    
    for (const row of data) {
      const year = row.Year;
      const sandwiches = typeof row.Sandwiches === 'number' ? row.Sandwiches : 0;
      
      // Skip invalid data
      if (!year || year < 2020 || year > 2026) {
        skipped++;
        continue;
      }
      if (sandwiches > 100000 || sandwiches < 0) {
        skipped++;
        continue;
      }
      
      const date = excelDateToJSDate(row.Date);
      const weekDate = formatDate(date);
      const location = row.Location || 'Unknown';
      const weekOfYear = row.WeekOfYear || 0;
      const weekOfProgram = row.WeekOfProgram || 0;
      
      records.push({
        weekDate,
        location,
        sandwiches,
        weekOfYear,
        weekOfProgram,
        year
      });
    }
    
    console.log(`\n📥 Importing ${records.length} valid records (skipped ${skipped} invalid)...`);
    
    // Import in batches of 100
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      await db.execute(sql`
        INSERT INTO authoritative_weekly_collections 
          (week_date, location, sandwiches, week_of_year, week_of_program, year)
        SELECT * FROM ${sql.raw(`(VALUES ${batch.map(r => 
          `('${r.weekDate}', '${r.location.replace(/'/g, "''")}', ${r.sandwiches}, ${r.weekOfYear}, ${r.weekOfProgram}, ${r.year})`
        ).join(', ')}) AS t`)}
      `);
      
      imported += batch.length;
      console.log(`  Imported ${imported}/${records.length} records...`);
    }
    
    // Verify import
    console.log('\n✅ Verifying import...');
    const yearTotals = await db.execute(sql`
      SELECT 
        year,
        COUNT(*) as record_count,
        SUM(sandwiches) as total_sandwiches
      FROM authoritative_weekly_collections
      GROUP BY year
      ORDER BY year
    `);
    
    console.log('\n=== IMPORT COMPLETE ===');
    console.log('Yearly totals in database:');
    for (const row of yearTotals.rows as any[]) {
      console.log(`  ${row.year}: ${row.record_count} records, ${Number(row.total_sandwiches).toLocaleString()} sandwiches`);
    }
    
    console.log('\n✅ Scott\'s authoritative data successfully imported!');
    console.log('This data is now the source of truth for analytics and reporting.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importScottData();
