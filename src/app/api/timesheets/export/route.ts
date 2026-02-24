import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, hasRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/actions";

export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth();
        const supabase = await createClient();
        const tenantId = user.tenantIds[0];

        if (!tenantId) {
            return NextResponse.json({ error: "テナントが見つかりません" }, { status: 400 });
        }

        const { searchParams } = request.nextUrl;
        const dateFrom = searchParams.get("date_from");
        const dateTo = searchParams.get("date_to");
        const projectId = searchParams.get("project_id");
        const memberId = searchParams.get("member_id");

        if (!dateFrom || !dateTo) {
            return NextResponse.json({ error: "date_from と date_to は必須です" }, { status: 400 });
        }

        // 権限判定
        const isPm = hasRole(user, tenantId, ["pm"]);
        const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);
        const isAccounting = hasRole(user, tenantId, ["accounting"]);

        let query = supabase
            .from("timesheets")
            .select("*, projects!inner(name), tasks(title)")
            .eq("tenant_id", tenantId)
            .gte("work_date", dateFrom)
            .lte("work_date", dateTo)
            .order("work_date", { ascending: true });

        // 権限別フィルタ
        if (!isTenantAdmin && !isAccounting) {
            if (isPm) {
                const { data: managedProjects } = await supabase
                    .from("projects")
                    .select("id")
                    .eq("tenant_id", tenantId)
                    .eq("pm_id", user.id);

                const projectIds = (managedProjects ?? []).map((p) => p.id);
                if (projectIds.length > 0) {
                    query = query.in("project_id", projectIds);
                } else {
                    query = query.eq("user_id", user.id);
                }
            } else {
                query = query.eq("user_id", user.id);
            }
        }

        if (projectId) {
            query = query.eq("project_id", projectId);
        }
        if (memberId) {
            query = query.eq("user_id", memberId);
        }

        const { data: timesheets, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // メンバー名の取得
        const uniqueUserIds = [...new Set((timesheets ?? []).map((ts) => ts.user_id))];
        const { data: profilesData } = uniqueUserIds.length > 0
            ? await supabase.from("profiles").select("id, display_name").in("id", uniqueUserIds)
            : { data: [] };
        const profileMap = new Map<string, string>();
        for (const p of profilesData ?? []) {
            profileMap.set(p.id, p.display_name);
        }

        // CSV生成
        const BOM = "\uFEFF";
        const header = "プロジェクト名,メンバー名,日付,工数(h),タスク名,備考";
        const rows = (timesheets ?? []).map((ts) => {
            const projectName = (ts.projects as unknown as { name: string })?.name ?? "";
            const taskTitle = (ts.tasks as unknown as { title: string } | null)?.title ?? "";
            const hours = Number(ts.hours).toFixed(2);
            const note = (ts.note ?? "").replace(/"/g, '""');
            const memberName = profileMap.get(ts.user_id) ?? ts.user_id;

            return [
                `"${projectName}"`,
                `"${memberName}"`,
                ts.work_date,
                hours,
                `"${taskTitle}"`,
                `"${note}"`,
            ].join(",");
        });

        const csvContent = BOM + header + "\n" + rows.join("\n");
        const rowCount = rows.length;

        // 監査ログ
        await writeAuditLog(supabase, user.id, {
            tenantId,
            action: "timesheet.export",
            resourceType: "timesheet",
            metadata: { date_from: dateFrom, date_to: dateTo, project_id: projectId, row_count: rowCount },
        });

        // ファイル名生成
        const fileName = `timesheets_${dateFrom}_${dateTo}.csv`;

        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "エラーが発生しました";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
