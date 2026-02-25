"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { Tables } from "@/types/database";

// ─── Types ─────────────────────────────────────────

export type NotificationRow = Tables<"notifications">;

// ─── Server Actions ────────────────────────────────

/**
 * 通知一覧を取得する（最新20件）。
 */
export async function getNotifications(): Promise<NotificationRow[]> {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        logger.error("通知の取得に失敗しました", { supabaseError: error });
        return [];
    }

    return data ?? [];
}

/**
 * 未読件数を取得する。
 */
export async function getUnreadCount(): Promise<number> {
    const user = await requireAuth();
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

    if (error) {
        logger.error("未読件数の取得に失敗しました", { supabaseError: error });
        return 0;
    }

    return count ?? 0;
}

/**
 * 通知を個別に既読にする。
 */
export async function markAsRead(notificationId: string): Promise<void> {
    const user = await requireAuth();
    const supabase = await createClient();

    await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user.id);
}

/**
 * すべての通知を既読にする。
 */
export async function markAllAsRead(): Promise<void> {
    const user = await requireAuth();
    const supabase = await createClient();

    await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
}
