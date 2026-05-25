import { neon } from '@neondatabase/serverless';
const url = process.env.PRODUCTION_DATABASE_URL;
if (!url) { console.error('No PRODUCTION_DATABASE_URL'); process.exit(1); }
const sql = neon(url);
console.log('Connected to:', new URL(url).host);
await sql(`CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by VARCHAR
)`);
console.log('table ok');
const seed = await sql`INSERT INTO app_settings (key, value, description)
VALUES ('annual_sandwich_goal', '500000', 'Annual sandwich production target for the organization')
ON CONFLICT (key) DO NOTHING RETURNING *`;
console.log('seed:', seed);
const mark = await sql`INSERT INTO _migrations (name) VALUES ('20260526_add_app_settings.sql') ON CONFLICT (name) DO NOTHING RETURNING *`;
console.log('mark:', mark);
const check = await sql`SELECT * FROM app_settings`;
console.log('rows:', check);
