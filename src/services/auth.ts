import { getSupabase, isOnlineConfigured } from "@/services/supabase";

/**
 * Supabase anonymous sign-in を使用してユーザーIDを取得する。
 * 既存セッションがあればそれを返す。
 */
export async function signInAnonymous(): Promise<string> {
  if (!isOnlineConfigured()) {
    throw new Error("オンライン機能が未設定");
  }
  const sb = getSupabase();
  const { data: session } = await sb.auth.getSession();
  if (session.session?.user.id) {
    return session.session.user.id;
  }
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(`サインイン失敗: ${error?.message ?? "unknown"}`);
  }
  return data.user.id;
}

export async function getUserId(): Promise<string | null> {
  if (!isOnlineConfigured()) return null;
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}
