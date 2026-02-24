import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Role } from "@/types";

// ─── Types ──────────────────────────────────────────

export type CurrentUser = {
    id: string;
    email: string;
    tenantIds: string[];
    roles: { tenantId: string; role: Role }[];
};

// ─── Auth Helpers ───────────────────────────────────

/**
 * 現在の認証済みユーザーを取得する。
 * 未認証の場合は /login にリダイレクト。
 */
export async function requireAuth(): Promise<CurrentUser> {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    // ユーザーのロール情報を取得
    const { data: userRoles } = await supabase
        .from("user_roles")
        .select("tenant_id, role");

    const roles = (userRoles ?? []).map((r) => ({
        tenantId: r.tenant_id as string,
        role: r.role as Role,
    }));

    const tenantIds = [...new Set(roles.map((r) => r.tenantId))];

    return {
        id: user.id,
        email: user.email ?? "",
        tenantIds,
        roles,
    };
}

/**
 * 指定テナント内で指定ロールのいずれかを持っているか検証する。
 * 持っていない場合は例外をスロー。
 */
export async function requireRole(
    tenantId: string,
    allowedRoles: Role[]
): Promise<CurrentUser> {
    const currentUser = await requireAuth();

    const hasAllowedRole = currentUser.roles.some(
        (r) => r.tenantId === tenantId && allowedRoles.includes(r.role)
    );

    if (!hasAllowedRole) {
        throw new Error("ERR-AUTH-003: 権限がありません");
    }

    return currentUser;
}

/**
 * 指定テナント内で指定ロールのいずれかを持っているかチェックする。
 * throw せず boolean を返す。Server Component での UI 分岐に利用。
 */
export function hasRole(
    user: CurrentUser,
    tenantId: string,
    allowedRoles: Role[]
): boolean {
    return user.roles.some(
        (r) => r.tenantId === tenantId && allowedRoles.includes(r.role)
    );
}

/**
 * 現在のユーザー情報を取得する（未認証でも null を返す）。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: userRoles } = await supabase
        .from("user_roles")
        .select("tenant_id, role");

    const roles = (userRoles ?? []).map((r) => ({
        tenantId: r.tenant_id as string,
        role: r.role as Role,
    }));

    const tenantIds = [...new Set(roles.map((r) => r.tenantId))];

    return {
        id: user.id,
        email: user.email ?? "",
        tenantIds,
        roles,
    };
}
