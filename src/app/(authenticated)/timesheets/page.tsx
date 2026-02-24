import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import WeeklyTimesheetClient from "./_components/WeeklyTimesheetClient";

function getMonday(dateStr?: string): string {
    const date = dateStr ? new Date(dateStr) : new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split("T")[0];
}

function getWeekDates(mondayStr: string): string[] {
    const dates: string[] = [];
    const monday = new Date(mondayStr);
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

export default async function TimesheetsPage({
    searchParams,
}: {
    searchParams: Promise<{ week?: string }>;
}) {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];
    const params = await searchParams;

    const weekStart = getMonday(params.week);
    const weekDates = getWeekDates(weekStart);
    const weekEnd = weekDates[6];

    // 当週の工数データ取得
    const { data: timesheets } = await supabase
        .from("timesheets")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .gte("work_date", weekStart)
        .lte("work_date", weekEnd);

    // 所属プロジェクト一覧取得
    const { data: memberProjects } = await supabase
        .from("project_members")
        .select("project_id, projects!inner(id, name, status)")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId);

    const projects = (memberProjects ?? []).map((m) => {
        const p = m.projects as unknown as { id: string; name: string; status: string };
        return { id: p.id, name: p.name, status: p.status };
    });

    // 各プロジェクトのタスク取得
    const projectIds = projects.map((p) => p.id);
    const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, project_id, status")
        .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
        .eq("tenant_id", tenantId);

    return (
        <WeeklyTimesheetClient
            weekStart={weekStart}
            weekDates={weekDates}
            timesheets={timesheets ?? []}
            projects={projects}
            tasks={tasks ?? []}
        />
    );
}
