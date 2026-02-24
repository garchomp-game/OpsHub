"use server";

import { withAuth } from "@/lib/actions";
import { hasRole } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────

type ReportFilter = {
    date_from: string;
    date_to: string;
    project_id?: string;
    member_id?: string;
};

type ProjectSummary = {
    project_id: string;
    project_name: string;
    total_hours: number;
    member_count: number;
};

type MemberSummary = {
    user_id: string;
    display_name: string;
    total_hours: number;
    project_count: number;
};

type ReportData = {
    projects: ProjectSummary[];
    members: MemberSummary[];
    grand_total: number;
};

// ─── Get Report Data ────────────────────────────────

export const getReportData = withAuth(async (user, supabase, input: ReportFilter): Promise<ReportData> => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // 権限に基づくフィルタリング
    const isPm = hasRole(user, tenantId, ["pm"]);
    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);
    const isAccounting = hasRole(user, tenantId, ["accounting"]);

    let query = supabase
        .from("timesheets")
        .select("*, projects!inner(id, name)")
        .eq("tenant_id", tenantId)
        .gte("work_date", input.date_from)
        .lte("work_date", input.date_to);

    // 権限別フィルタ
    if (!isTenantAdmin && !isAccounting) {
        if (isPm) {
            // PMは管轄PJのみ
            const { data: managedProjects } = await supabase
                .from("projects")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("pm_id", user.id);

            const projectIds = (managedProjects ?? []).map((p) => p.id);
            if (projectIds.length > 0) {
                query = query.in("project_id", projectIds);
            } else {
                // 管轄PJがない場合は自分のみ
                query = query.eq("user_id", user.id);
            }
        } else {
            // Member: 自分の工数のみ
            query = query.eq("user_id", user.id);
        }
    }

    // 追加フィルタ
    if (input.project_id) {
        query = query.eq("project_id", input.project_id);
    }
    if (input.member_id) {
        query = query.eq("user_id", input.member_id);
    }

    const { data: timesheets, error } = await query;

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    const entries = timesheets ?? [];

    // プロジェクト別集計
    const projectMap = new Map<string, { name: string; hours: number; members: Set<string> }>();
    for (const entry of entries) {
        const proj = entry.projects as unknown as { id: string; name: string };
        const existing = projectMap.get(proj.id) || { name: proj.name, hours: 0, members: new Set<string>() };
        existing.hours += Number(entry.hours);
        existing.members.add(entry.user_id);
        projectMap.set(proj.id, existing);
    }

    const projects: ProjectSummary[] = Array.from(projectMap.entries()).map(([id, data]) => ({
        project_id: id,
        project_name: data.name,
        total_hours: Math.round(data.hours * 100) / 100,
        member_count: data.members.size,
    }));

    // メンバー別集計
    const memberMap = new Map<string, { hours: number; projects: Set<string> }>();
    for (const entry of entries) {
        const existing = memberMap.get(entry.user_id) || { hours: 0, projects: new Set<string>() };
        existing.hours += Number(entry.hours);
        existing.projects.add(entry.project_id);
        memberMap.set(entry.user_id, existing);
    }

    // メンバーの display_name を取得
    const memberIds = Array.from(memberMap.keys());
    const { data: profilesData } = memberIds.length > 0
        ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
        : { data: [] };
    const profileMap = new Map<string, string>();
    for (const p of profilesData ?? []) {
        profileMap.set(p.id, p.display_name);
    }

    const members: MemberSummary[] = Array.from(memberMap.entries()).map(([id, data]) => ({
        user_id: id,
        display_name: profileMap.get(id) ?? id.slice(0, 8) + "...",
        total_hours: Math.round(data.hours * 100) / 100,
        project_count: data.projects.size,
    }));

    const grand_total = Math.round(entries.reduce((sum, e) => sum + Number(e.hours), 0) * 100) / 100;

    return { projects, members, grand_total };
});

// ─── Get Projects for Filter ────────────────────────

export const getFilterProjects = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");

    return data ?? [];
});

// ─── Get Members for Filter ─────────────────────────

export const getFilterMembers = withAuth(async (user, supabase, _input: void) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(display_name)")
        .eq("tenant_id", tenantId);

    // 重複排除
    const uniqueUsers = new Map<string, { role: string; display_name: string }>();
    for (const ur of data ?? []) {
        uniqueUsers.set(ur.user_id, {
            role: ur.role,
            display_name: (ur.profiles as unknown as { display_name: string }).display_name,
        });
    }

    return Array.from(uniqueUsers.entries()).map(([userId, info]) => ({
        user_id: userId,
        role: info.role,
        display_name: info.display_name,
    }));
});
