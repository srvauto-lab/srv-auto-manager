import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
}

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
}

// Shared browser client using the same cookie-based SSR session as login/proxy.
// Keeping a singleton avoids duplicate auth listeners and prevents pages from
// silently falling back to an anonymous session after RLS is hardened.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
