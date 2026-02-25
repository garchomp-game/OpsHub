"use server";

import { withAuth, writeAuditLog } from "@/lib/actions";
import { hasRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Constants ──────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
] as const;

// ─── Types ──────────────────────────────────────────

type DocumentWithUploader = {
    id: string;
    tenant_id: string;
    project_id: string | null;
    name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    uploaded_by: string;
    created_at: string;
    updated_at: string;
    profiles: {
        display_name: string | null;
    };
};

// ─── getDocuments ───────────────────────────────────

export const getDocuments = withAuth(async (user, supabase, input: { project_id: string }) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // プロジェクトメンバーか確認
    const { data: membership } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", input.project_id)
        .eq("user_id", user.id)
        .limit(1)
        .single();

    const isPmOrAdmin =
        hasRole(user, tenantId, ["pm", "tenant_admin"]);

    if (!membership && !isPmOrAdmin) {
        throw new Error("ERR-AUTH-F01: このプロジェクトへのアクセス権がありません");
    }

    const { data, error } = await supabase
        .from("documents")
        .select("*, profiles!documents_uploaded_by_fkey(display_name)")
        .eq("project_id", input.project_id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(`ERR-SYS-001: ${error.message}`);

    return (data ?? []) as unknown as DocumentWithUploader[];
});

// ─── uploadDocument ─────────────────────────────────

export async function uploadDocument(projectId: string, formData: FormData) {
    const supabase = await createClient();
    const { requireAuth } = await import("@/lib/auth");
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];

    try {
        if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

        // ロール確認
        if (!hasRole(user, tenantId, ["pm", "tenant_admin"])) {
            throw new Error("ERR-AUTH-F02: ドキュメントのアップロード権限がありません");
        }

        // プロジェクト存在確認
        const { data: project } = await supabase
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .eq("tenant_id", tenantId)
            .single();

        if (!project) {
            throw new Error("ERR-VAL-F01: 指定されたプロジェクトが見つかりません");
        }

        const file = formData.get("file") as File | null;
        if (!file) {
            throw new Error("ERR-VAL-F01: ファイルが選択されていません");
        }

        // ファイルサイズチェック
        if (file.size > MAX_FILE_SIZE) {
            throw new Error("ERR-VAL-F02: ファイルサイズは10MB以下にしてください");
        }

        // MIMEタイプチェック
        if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
            throw new Error("ERR-VAL-F03: 許可されていないファイル形式です");
        }

        // ストレージパス生成
        const uuid = crypto.randomUUID();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._\-\u3000-\u9FAF\uF900-\uFAFF]/g, "_");
        const storagePath = `${tenantId}/${projectId}/${uuid}_${sanitizedName}`;

        // Supabase Storage アップロード
        const { error: uploadError } = await supabase.storage
            .from("project-documents")
            .upload(storagePath, file, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            throw new Error(`ERR-SYS-F01: ${uploadError.message}`);
        }

        // documents テーブル INSERT
        const { data: doc, error: insertError } = await supabase
            .from("documents")
            .insert({
                tenant_id: tenantId,
                project_id: projectId,
                name: file.name,
                file_path: storagePath,
                file_size: file.size,
                mime_type: file.type,
                uploaded_by: user.id,
            })
            .select()
            .single();

        if (insertError) {
            // ロールバック: Storage からファイルを削除
            await supabase.storage.from("project-documents").remove([storagePath]);
            throw new Error(`ERR-SYS-001: ${insertError.message}`);
        }

        // 監査ログ
        await writeAuditLog(supabase, user.id, {
            tenantId,
            action: "document.upload",
            resourceType: "document",
            resourceId: doc.id,
            after: {
                name: file.name,
                file_size: file.size,
                mime_type: file.type,
                project_id: projectId,
            },
        });

        revalidatePath(`/projects/${projectId}/documents`);
        return { success: true as const, data: { document: doc } };
    } catch (error) {
        const message = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return { success: false as const, error: { message } };
    }
}

// ─── deleteDocument ─────────────────────────────────

export const deleteDocument = withAuth(async (user, supabase, input: { document_id: string }) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // ロール確認
    if (!hasRole(user, tenantId, ["pm", "tenant_admin"])) {
        throw new Error("ERR-AUTH-F02: ドキュメントの削除権限がありません");
    }

    // ドキュメント存在確認
    const { data: doc, error: fetchErr } = await supabase
        .from("documents")
        .select("*")
        .eq("id", input.document_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !doc) {
        throw new Error("ERR-DOC-001: ドキュメントが見つかりません");
    }

    // Storage から削除（失敗してもログ記録して続行）
    const { error: storageError } = await supabase.storage
        .from("project-documents")
        .remove([doc.file_path]);

    if (storageError) {
        logger.error("ERR-SYS-F02: Storage deletion failed", { documentId: input.document_id, filePath: doc.file_path });
    }

    // DB から削除
    const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", input.document_id);

    if (deleteError) throw new Error(`ERR-SYS-001: ${deleteError.message}`);

    // 監査ログ
    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "document.delete",
        resourceType: "document",
        resourceId: input.document_id,
        before: {
            name: doc.name,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            project_id: doc.project_id,
        },
    });

    revalidatePath(`/projects/${doc.project_id}/documents`);
    return { success: true };
});

// ─── getDownloadUrl ─────────────────────────────────

export const getDownloadUrl = withAuth(async (user, supabase, input: { document_id: string }) => {
    const tenantId = user.tenantIds[0];
    if (!tenantId) throw new Error("ERR-AUTH-003: テナントが見つかりません");

    // ドキュメント存在確認
    const { data: doc, error: fetchErr } = await supabase
        .from("documents")
        .select("*")
        .eq("id", input.document_id)
        .eq("tenant_id", tenantId)
        .single();

    if (fetchErr || !doc) {
        throw new Error("ERR-DOC-001: ドキュメントが見つかりません");
    }

    // プロジェクトメンバーか確認
    if (doc.project_id) {
        const { data: membership } = await supabase
            .from("project_members")
            .select("id")
            .eq("project_id", doc.project_id)
            .eq("user_id", user.id)
            .limit(1)
            .single();

        const isPmOrAdmin = hasRole(user, tenantId, ["pm", "tenant_admin"]);

        if (!membership && !isPmOrAdmin) {
            throw new Error("ERR-AUTH-F01: このプロジェクトへのアクセス権がありません");
        }
    }

    // 署名付き URL 生成（60秒有効）
    const { data, error } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(doc.file_path, 60);

    if (error) throw new Error(`ERR-SYS-F01: ${error.message}`);

    // 監査ログ
    await writeAuditLog(supabase, user.id, {
        tenantId,
        action: "document.download",
        resourceType: "document",
        resourceId: input.document_id,
        after: {
            name: doc.name,
            document_id: input.document_id,
        },
    });

    return { url: data.signedUrl, filename: doc.name };
});
