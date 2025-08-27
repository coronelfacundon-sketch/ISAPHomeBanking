import { createClient } from '@supabase/supabase-js';

/*
 * This helper creates a single Supabase client on the browser that can be
 * reused across your React components. The URL and anonymous key are
 * provided via environment variables. During development you should add
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your
 * .env.local file (excluded from version control) with the credentials from
 * your Supabase project. See the Supabase docs for more information.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
