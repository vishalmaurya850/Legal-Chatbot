import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "legal-chatbot-auth",
      },
    }
  );

// Export the Supabase instance
export const supabase = createClient();