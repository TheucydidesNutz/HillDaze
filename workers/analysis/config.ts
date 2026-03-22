// Load env vars from .env files. Checks (in order):
//   1. workers/analysis/.env  (worker-specific overrides)
//   2. project root .env.local (Next.js convention — has Supabase keys etc.)
//   3. project root .env
// Falls back to process.env from PM2 or shell if none found.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv');
  const path = require('path');
  const root = path.resolve(__dirname, '../..');
  // Later files don't overwrite earlier ones, so order = priority
  dotenv.config({ path: path.resolve(__dirname, '.env') });
  dotenv.config({ path: path.resolve(root, '.env.local') });
  dotenv.config({ path: path.resolve(root, '.env') });
} catch {
  // dotenv not installed — rely on process.env from PM2 or shell
}

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY || '';
export const OPENSECRETS_API_KEY = process.env.OPENSECRETS_API_KEY || '';
export const COURTLISTENER_API_KEY = process.env.COURTLISTENER_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
