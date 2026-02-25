import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/health — ヘルスチェックエンドポイント（NFR-04b）
export async function GET() {
    try {
        const supabaseAdmin = createAdminClient();
        const { error } = await supabaseAdmin.from("tenants").select("id").limit(1);

        const status = error ? "unhealthy" : "healthy";

        if (error) {
            logger.warn("Health check: database unhealthy", { supabaseError: error });
        }

        const httpStatus = error ? 503 : 200;
        return Response.json({
            status,
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || "unknown",
            database: error ? "unhealthy" : "healthy",
        }, { status: httpStatus });
    } catch (err) {
        logger.error(
            "Health check failed",
            undefined,
            err instanceof Error ? err : undefined,
        );
        return Response.json(
            {
                status: "unhealthy",
                timestamp: new Date().toISOString(),
            },
            { status: 503 },
        );
    }
}
