import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function isOnlineConfigured(): boolean {
  return Boolean(url && anon);
}

export function getSupabase(): SupabaseClient {
  if (!url || !anon) {
    throw new Error(
      "Supabaseが未設定です。.envにVITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを設定してください。"
    );
  }
  if (!client) {
    client = createClient(url, anon, {
      realtime: { params: { eventsPerSecond: 30 } },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}
