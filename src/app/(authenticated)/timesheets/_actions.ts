"use server";

import { withAuth, writeAuditLog } from "@/lib/actions";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────

type CreateTimesheetInput = {
    project_id: string;
    task_id?: string;
    work_date: string;
    hours: number;
    note?: string;
};

type UpdateTimesheetInput = {
    timesheet_id: string;
    hours: number;
    note?: string;
};

type DeleteTimesheetInput = {
    timesheet_id: string;
};

type BulkEntry = {
    id?: string;
    project_id: string;
    task_id?: string;
    work_date: string;
    hours: number;
    note?: string;
};

type BulkTimesheetInput = {
    entries: BulkEntry[];
    deleted_ids?: string[];
};

// ─── Validation Helpers ─────────────────────────────

function validateHours(hours: number) {
    if (hours < 0.25 || hours > 24) {
        throw new Error("ERR-VAL-001: 工数は0.25〜24の範囲で入力してください");
    }
    if (hours % 0.25 !== 0) {
        throw new Error("ERR-VAL-002: 工数は15分（0.25h）単位で入力してください");
    }
}

// ─── Create ─────────────────────────────────────────

export const createTimesheet = withAuth(async (user, supabase, input: CreateTimesheetInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // バリデーション
    validateHours(input.hours);

    // PJメンバーチェック
    const { data: memberExists } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", input.project_id)
        .eq("user_id", user.id)
        .limit(1)
        .single();

    if (!memberExists) {
        throw new Error("ERR-VAL-003: このプロジェクトのメンバーではありません");
    }

    // task_id のPJ所属チェック
    if (input.task_id) {
        const { data: taskExists } = await supabase
            .from("tasks")
            .select("id")
            .eq("id", input.task_id)
            .eq("project_id", input.project_id)
            .limit(1)
            .single();

        if (!taskExists) {
            throw new Error("ERR-VAL-004: 指定したタスクはこのプロジェクトに属していません");
        }
    }

    // 1日合計24h超過チェック
    const { data: existingEntries } = await supabase
        .from("timesheets")
        .select("hours")
        .eq("user_id", user.id)
        .eq("work_date", input.work_date);

    const currentTotal = (existingEntries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);
    if (currentTotal + input.hours > 24) {
        throw new Error("ERR-VAL-005: 1日の合計工数が24時間を超えています");
    }

    const { data, error } = await supabase
        .from("timesheets")
        .insert({
            project_id: input.project_id,
            task_id: input.task_id || null,
            work_date: input.work_date,
            hours: input.hours,
            note: input.note || null,
            user_id: user.id,
            tenant_id: tenantId,
        })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            throw new Error("ERR-VAL-006: この組み合わせの工数は既に登録されています");
        }
        throw new Error(`ERR-SYS-001: ${error.message}`);
    }

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "timesheet.create",
        resourceType: "timesheet",
        resourceId: data.id,
        after: data as unknown as Record<string, unknown>,
    });

    revalidatePath("/timesheets");
    return data;
});

// ─── Update ─────────────────────────────────────────

export const updateTimesheet = withAuth(async (user, supabase, input: UpdateTimesheetInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    validateHours(input.hours);

    // 既存レコード取得
    const { data: current } = await supabase
        .from("timesheets")
        .select("*")
        .eq("id", input.timesheet_id)
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .single();

    if (!current) throw new Error("ERR-TS-001: 工数レコードが見つかりません");

    // 1日合計24h超過チェック（自分のレコード除外）
    const { data: existingEntries } = await supabase
        .from("timesheets")
        .select("hours")
        .eq("user_id", user.id)
        .eq("work_date", current.work_date)
        .neq("id", input.timesheet_id);

    const otherTotal = (existingEntries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);
    if (otherTotal + input.hours > 24) {
        throw new Error("ERR-VAL-005: 1日の合計工数が24時間を超えています");
    }

    const { data, error } = await supabase
        .from("timesheets")
        .update({
            hours: input.hours,
            note: input.note ?? current.note,
        })
        .eq("id", input.timesheet_id)
        .select()
        .single();

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "timesheet.update",
        resourceType: "timesheet",
        resourceId: input.timesheet_id,
        before: current as unknown as Record<string, unknown>,
        after: data as unknown as Record<string, unknown>,
    });

    revalidatePath("/timesheets");
    return data;
});

// ─── Delete ─────────────────────────────────────────

export const deleteTimesheet = withAuth(async (user, supabase, input: DeleteTimesheetInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data: current } = await supabase
        .from("timesheets")
        .select("*")
        .eq("id", input.timesheet_id)
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .single();

    if (!current) throw new Error("ERR-TS-001: 工数レコードが見つかりません");

    const { error } = await supabase
        .from("timesheets")
        .delete()
        .eq("id", input.timesheet_id);

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "timesheet.delete",
        resourceType: "timesheet",
        resourceId: input.timesheet_id,
        before: current as unknown as Record<string, unknown>,
    });

    revalidatePath("/timesheets");
    return { success: true };
});

// ─── Bulk Update ────────────────────────────────────

export const bulkUpdateTimesheets = withAuth(async (user, supabase, input: BulkTimesheetInput) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // 全エントリのバリデーション
    for (const entry of input.entries) {
        if (entry.hours > 0) {
            validateHours(entry.hours);
        }
    }

    // 日別合計チェック
    const dailyTotals: Record<string, number> = {};
    for (const entry of input.entries) {
        if (entry.hours > 0) {
            dailyTotals[entry.work_date] = (dailyTotals[entry.work_date] || 0) + entry.hours;
        }
    }
    for (const [date, total] of Object.entries(dailyTotals)) {
        if (total > 24) {
            throw new Error(`ERR-VAL-005: ${date} の合計工数が24時間を超えています`);
        }
    }

    // 削除処理
    if (input.deleted_ids && input.deleted_ids.length > 0) {
        const { error: delError } = await supabase
            .from("timesheets")
            .delete()
            .in("id", input.deleted_ids)
            .eq("user_id", user.id);

        if (delError) throw new Error(`ERR-SYS-001: ${delError.message}`);
    }

    // INSERT/UPDATE処理
    for (const entry of input.entries) {
        if (entry.hours <= 0) continue;

        if (entry.id) {
            // UPDATE
            const { error } = await supabase
                .from("timesheets")
                .update({
                    hours: entry.hours,
                    note: entry.note || null,
                })
                .eq("id", entry.id)
                .eq("user_id", user.id);

            if (error) throw new Error(`ERR-SYS-001: ${error.message}`);
        } else {
            // INSERT
            const { error } = await supabase
                .from("timesheets")
                .insert({
                    project_id: entry.project_id,
                    task_id: entry.task_id || null,
                    work_date: entry.work_date,
                    hours: entry.hours,
                    note: entry.note || null,
                    user_id: user.id,
                    tenant_id: tenantId,
                });

            if (error) {
                if (error.code === "23505") continue; // 重複はスキップ
                throw new Error(`ERR-SYS-001: ${error.message}`);
            }
        }
    }

    revalidatePath("/timesheets");
    return { success: true };
});
