import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
    // セッションリフレッシュ
    const response = await updateSession(request);

    // 認証不要パス
    const publicPaths = ["/login", "/auth/callback"];
    const isPublicPath = publicPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path)
    );

    if (isPublicPath) {
        return response;
    }

    // 認証チェック：Supabaseのセッションcookieの有無で判定
    // 詳細な認証チェックはServer Component/Action側で行う
    return response;
}

export const config = {
    matcher: [
        /*
         * 以下のパスで始まるリクエスト以外すべてにマッチ:
         * - _next/static (静的ファイル)
         * - _next/image (画像最適化)
         * - favicon.ico (ファビコン)
         * - 画像・SVG などの静的アセット
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
