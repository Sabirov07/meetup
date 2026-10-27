import { createClient } from "@supabase/supabase-js";

/** Optional browser client. Demo data is used until public project credentials are configured. */
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}
