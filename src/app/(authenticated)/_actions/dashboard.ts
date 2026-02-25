"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { Tables } from "@/types/database";

// ─── Types ─────────────────────────────────────────

export type NotificationRow = Tables<"notifications">;

export type ProjectProgress = {
    name: string;
    progress: number;
};

// ─── KPI Data Fetching ─────────────────────────────

/**
 * 承認待ち申請数を取得する（承認者向け）。
 */
export async function getPendingApprovalsCount(): Promise<number> {
    const user = await requireAuth();
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("workflows")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted")
        .eq("approver_id", user.id);

    if (error) {
        logger.error("承認待ち件数の取得に失敗", { supabaseError: error });
        return 0;
    }

    return count ?? 0;
}

/**
 * 自分が作成した申請の未完了件数を取得する。
 */
export async function getMyWorkflowsCount(): Promise<number> {
    const user = await requireAuth();
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("workflows")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id)
        .in("status", ["draft", "submitted"]);

    if (error) {
        logger.error("自分の申請数の取得に失敗", { supabaseError: error });
        return 0;
    }

    return count ?? 0;
}

/**
 * 自分に割り当てられた未完了タスク数を取得する。
 */
export async function getMyTasksCount(): Promise<number> {
    const user = await requireAuth();
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assignee_id", user.id)
        .neq("status", "done");

    if (error) {
        logger.error("担当タスク数の取得に失敗", { supabaseError: error });
        return 0;
    }

    return count ?? 0;
}

/**
 * 今週（月〜日）の合計工数を取得する。
 */
export async function getWeeklyHours(): Promise<number> {
    const user = await requireAuth();
    const supabase = await createClient();

    // 今週の月曜〜日曜を算出
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=日, 1=月, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayStr = monday.toISOString().split("T")[0];
    const sundayStr = sunday.toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("timesheets")
        .select("hours")
        .eq("user_id", user.id)
        .gte("work_date", mondayStr)
        .lte("work_date", sundayStr);

    if (error) {
        logger.error("週次工数の取得に失敗", { supabaseError: error });
        return 0;
    }

    return (data ?? []).reduce((sum, row) => sum + Number(row.hours), 0);
}

/**
 * PM が担当するプロジェクトの進捗率を取得する。
 */
export async function getProjectProgress(): Promise<ProjectProgress[]> {
    const user = await requireAuth();
    const supabase = await createClient();

    // PM として担当しているプロジェクトを取得
    const { data: projects, error: projError } = await supabase
        .from("projects")
        .select("id, name")
        .eq("pm_id", user.id)
        .in("status", ["planning", "active"]);

    if (projError || !projects || projects.length === 0) {
        return [];
    }

    // プロジェクトごとのタスク集計を並列実行
    const results = await Promise.all(
        projects.map(async (project) => {
            const [{ count: totalCount }, { count: doneCount }] = await Promise.all([
                supabase
                    .from("tasks")
                    .select("*", { count: "exact", head: true })
                    .eq("project_id", project.id),
                supabase
                    .from("tasks")
                    .select("*", { count: "exact", head: true })
                    .eq("project_id", project.id)
                    .eq("status", "done"),
            ]);

            const total = totalCount ?? 0;
            const done = doneCount ?? 0;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;

            return { name: project.name, progress };
        })
    );

    return results;
}

/**
 * 未読通知を最新5件取得する。
 */
export async function getUnreadNotifications(): Promise<NotificationRow[]> {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        logger.error("未読通知の取得に失敗", { supabaseError: error });
        return [];
    }

    return data ?? [];
}
