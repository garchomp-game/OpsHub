import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Supabase Admin クライアントを作成する。
 * service_role key を使用するため、RLS をバイパスする。
 * Server Action / Route Handler 内のみで使用すること。
 *
 * 用途: Auth Admin API（招待、Ban、パスワードリセット等）
 */
export function createAdminClient() {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}
