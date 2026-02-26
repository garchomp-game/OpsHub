"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, hasRole } from "@/lib/auth";
import { withAuth, writeAuditLog } from "@/lib/actions";
import type { ActionResult } from "@/types";

// ─── Types ──────────────────────────────────────────

export type TenantUser = {
    id: string;
    email: string;
    name: string | null;
    roles: string[];
    status: "active" | "invited" | "disabled";
    last_sign_in_at: string | null;
    created_at: string;
};

export type GetUsersInput = {
    tenantId: string;
    search?: string;
    roleFilter?: string;
    statusFilter?: string;
    page?: number;
    perPage?: number;
};

// ─── ユーザー一覧取得 ───────────────────────────────

export async function getUsers(
    input: GetUsersInput
): Promise<ActionResult<{ data: TenantUser[]; count: number }>> {
    try {
        await requireRole(input.tenantId, ["tenant_admin", "it_admin"]);

        const supabase = await createClient();
        const adminClient = createAdminClient();
        const page = input.page ?? 1;
        const perPage = input.perPage ?? 25;
        const offset = (page - 1) * perPage;

        // user_roles からテナント内のユーザーIDs取得
        let rolesQuery = supabase
            .from("user_roles")
            .select("user_id, role")
            .eq("tenant_id", input.tenantId);

        if (input.roleFilter && input.roleFilter !== "all") {
            rolesQuery = rolesQuery.eq("role", input.roleFilter);
        }

        const { data: roleData, error: rolesError } = await rolesQuery;

        if (rolesError) {
            return {
                success: false,
                error: {
                    code: "ERR-SYS-001",
                    message: "ユーザーロール情報の取得に失敗しました",
                },
            };
        }

        // ユーザーIDごとにロールをグループ化
        const userRolesMap = new Map<string, string[]>();
        for (const r of roleData ?? []) {
            const existing = userRolesMap.get(r.user_id) ?? [];
            existing.push(r.role);
            userRolesMap.set(r.user_id, existing);
        }

        const userIds = [...userRolesMap.keys()];
        if (userIds.length === 0) {
            return { success: true, data: { data: [], count: 0 } };
        }

        // Supabase Auth からユーザー情報を取得
        const {
            data: { users: authUsers },
        } = await adminClient.auth.admin.listUsers({
            page,
            perPage: 1000,
        });

        // テナント内ユーザーのみフィルタ
        let tenantUsers: TenantUser[] = (authUsers ?? [])
            .filter((u) => userIds.includes(u.id))
            .map((u) => {
                const roles = userRolesMap.get(u.id) ?? [];
                let status: TenantUser["status"] = "active";
                if (u.banned_until && new Date(u.banned_until) > new Date()) {
                    status = "disabled";
                } else if (
                    !u.email_confirmed_at &&
                    u.invited_at
                ) {
                    status = "invited";
                }

                return {
                    id: u.id,
                    email: u.email ?? "",
                    name: (u.user_metadata?.name as string) ?? null,
                    roles,
                    status,
                    last_sign_in_at: u.last_sign_in_at ?? null,
                    created_at: u.created_at,
                };
            });

        // 検索フィルタ
        if (input.search) {
            const searchLower = input.search.toLowerCase();
            tenantUsers = tenantUsers.filter(
                (u) =>
                    u.email.toLowerCase().includes(searchLower) ||
                    (u.name && u.name.toLowerCase().includes(searchLower))
            );
        }

        // ステータスフィルタ
        if (input.statusFilter && input.statusFilter !== "all") {
            tenantUsers = tenantUsers.filter(
                (u) => u.status === input.statusFilter
            );
        }

        const total = tenantUsers.length;
        const pagedUsers = tenantUsers.slice(offset, offset + perPage);

        return {
            success: true,
            data: { data: pagedUsers, count: total },
        };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "予期しないエラーが発生しました";
        return {
            success: false,
            error: {
                code: message.startsWith("ERR-")
                    ? message.split(":")[0].trim()
                    : "ERR-SYS-001",
                message,
            },
        };
    }
}

// ─── ユーザー招待 ───────────────────────────────────

type InviteUserInput = {
    tenantId: string;
    email: string;
    roles: string[];
};

export const inviteUser = withAuth(
    async (user, supabase, input: InviteUserInput) => {
        await requireRole(input.tenantId, ["tenant_admin", "it_admin"]);

        // バリデーション
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
            throw new Error(
                "ERR-VAL-001: 有効なメールアドレスを入力してください"
            );
        }

        if (!input.roles || input.roles.length === 0) {
            throw new Error(
                "ERR-VAL-002: 最低1つのロールを指定してください"
            );
        }

        // Tenant Admin は IT Admin ロールを付与不可
        const isItAdmin = hasRole(user, input.tenantId, ["it_admin"]);
        if (!isItAdmin && input.roles.includes("it_admin")) {
            throw new Error(
                "ERR-AUTH-004: IT Admin ロールはこの画面から付与できません"
            );
        }

        // 既存ユーザー確認
        const { data: existingRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("tenant_id", input.tenantId);

        const adminClient = createAdminClient();
        const {
            data: { users: allUsers },
        } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

        const existingUserIds = new Set(
            (existingRoles ?? []).map((r) => r.user_id)
        );
        const existingUser = (allUsers ?? []).find(
            (u) =>
                u.email === input.email && existingUserIds.has(u.id)
        );
        if (existingUser) {
            throw new Error(
                "ERR-VAL-003: このメールアドレスは既に登録されています"
            );
        }

        // Supabase Auth で招待
        const { data: inviteData, error: inviteError } =
            await adminClient.auth.admin.inviteUserByEmail(input.email);

        if (inviteError) {
            throw new Error(
                `ERR-SYS-001: 招待メールの送信に失敗しました: ${inviteError.message}`
            );
        }

        const newUserId = inviteData.user.id;

        // user_roles に INSERT
        for (const role of input.roles) {
            await supabase.from("user_roles").insert({
                tenant_id: input.tenantId,
                user_id: newUserId,
                role,
            });
        }

        // 監査ログ
        await writeAuditLog(supabase, user.id, {
            tenantId: input.tenantId,
            action: "user.invite",
            resourceType: "user",
            resourceId: newUserId,
            after: { email: input.email, roles: input.roles },
            metadata: { email: input.email, roles: input.roles },
        });

        return {
            id: newUserId,
            email: input.email,
            roles: input.roles,
        };
    }
);

// ─── ロール変更 ─────────────────────────────────────

type ChangeRoleInput = {
    tenantId: string;
    userId: string;
    roles: string[];
};

export const changeUserRoles = withAuth(
    async (user, supabase, input: ChangeRoleInput) => {
        await requireRole(input.tenantId, ["tenant_admin", "it_admin"]);

        // 自分自身の変更不可
        if (input.userId === user.id) {
            throw new Error(
                "ERR-VAL-004: 自分のロールは変更できません"
            );
        }

        // ロール空配列不可
        if (!input.roles || input.roles.length === 0) {
            throw new Error(
                "ERR-VAL-005: 最低1つのロールを指定してください"
            );
        }

        // Tenant Admin が IT Admin ロール変更不可
        const isItAdmin = hasRole(user, input.tenantId, ["it_admin"]);
        if (!isItAdmin && input.roles.includes("it_admin")) {
            throw new Error(
                "ERR-AUTH-005: IT Admin ロールの変更権限がありません"
            );
        }

        // 最後の Tenant Admin 削除防止
        if (!input.roles.includes("tenant_admin")) {
            const { data: tenantAdmins } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("tenant_id", input.tenantId)
                .eq("role", "tenant_admin");

            const otherAdmins = (tenantAdmins ?? []).filter(
                (r) => r.user_id !== input.userId
            );
            const currentUserHasTenantAdmin = (tenantAdmins ?? []).some(
                (r) => r.user_id === input.userId
            );

            if (currentUserHasTenantAdmin && otherAdmins.length === 0) {
                throw new Error(
                    "ERR-VAL-006: テナントには最低1人のTenant Adminが必要です"
                );
            }
        }

        // 変更前ロール取得
        const { data: beforeRoles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("tenant_id", input.tenantId)
            .eq("user_id", input.userId);

        const oldRoles = (beforeRoles ?? []).map((r) => r.role);

        // 全量置換: 既存削除 → 新規INSERT
        await supabase
            .from("user_roles")
            .delete()
            .eq("tenant_id", input.tenantId)
            .eq("user_id", input.userId);

        for (const role of input.roles) {
            await supabase.from("user_roles").insert({
                tenant_id: input.tenantId,
                user_id: input.userId,
                role,
            });
        }

        // 監査ログ
        await writeAuditLog(supabase, user.id, {
            tenantId: input.tenantId,
            action: "user.role_change",
            resourceType: "user",
            resourceId: input.userId,
            before: { roles: oldRoles },
            after: { roles: input.roles },
        });

        return { userId: input.userId, roles: input.roles };
    }
);

// ─── 無効化/再有効化 ────────────────────────────────

type ChangeUserStatusInput = {
    tenantId: string;
    userId: string;
    action: "disable" | "enable";
};

export const changeUserStatus = withAuth(
    async (user, supabase, input: ChangeUserStatusInput) => {
        await requireRole(input.tenantId, ["tenant_admin", "it_admin"]);

        // 自分自身の無効化不可
        if (input.userId === user.id && input.action === "disable") {
            throw new Error(
                "ERR-VAL-007: 自分のアカウントは無効化できません"
            );
        }

        // 最後の Tenant Admin 無効化防止
        if (input.action === "disable") {
            const { data: tenantAdmins } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("tenant_id", input.tenantId)
                .eq("role", "tenant_admin");

            const targetIsAdmin = (tenantAdmins ?? []).some(
                (r) => r.user_id === input.userId
            );
            const otherAdmins = (tenantAdmins ?? []).filter(
                (r) => r.user_id !== input.userId
            );

            if (targetIsAdmin && otherAdmins.length === 0) {
                throw new Error(
                    "ERR-VAL-008: テナントには最低1人の有効なTenant Adminが必要です"
                );
            }
        }

        const adminClient = createAdminClient();
        const banned = input.action === "disable";

        const { error } = await adminClient.auth.admin.updateUserById(
            input.userId,
            { ban_duration: banned ? "876000h" : "none" }
        );

        if (error) {
            throw new Error(
                `ERR-SYS-001: ユーザーの${banned ? "無効化" : "再有効化"}に失敗しました`
            );
        }

        // 監査ログ
        await writeAuditLog(supabase, user.id, {
            tenantId: input.tenantId,
            action:
                input.action === "disable"
                    ? "user.deactivate"
                    : "user.reactivate",
            resourceType: "user",
            resourceId: input.userId,
        });

        return {
            userId: input.userId,
            status: banned ? "disabled" : "active",
        };
    }
);

// ─── パスワードリセット ─────────────────────────────

type ResetPasswordInput = {
    tenantId: string;
    userId: string;
    email: string;
};

export const resetPassword = withAuth(
    async (user, supabase, input: ResetPasswordInput) => {
        await requireRole(input.tenantId, ["tenant_admin", "it_admin"]);

        const adminClient = createAdminClient();

        const { error } = await adminClient.auth.admin.generateLink({
            type: "recovery",
            email: input.email,
        });

        if (error) {
            throw new Error(
                `ERR-SYS-001: パスワードリセットリンクの生成に失敗しました: ${error.message}`
            );
        }

        // 監査ログ
        await writeAuditLog(supabase, user.id, {
            tenantId: input.tenantId,
            action: "user.password_reset",
            resourceType: "user",
            resourceId: input.userId,
        });

        return { success: true };
    }
);
