import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

export function createServerSupabaseClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name) {
          const cookieStore = await cookies();
          return cookieStore.get(name)?.value;
        },
        async set(name, value, options) {
          const cookieStore = await cookies();
          cookieStore.set({ name, value, ...options });
        },
        async remove(name, options) {
          const cookieStore = await cookies();
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}