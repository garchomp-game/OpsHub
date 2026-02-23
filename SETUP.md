# Starlight App - セットアップサマリ

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router, TypeScript) |
| UI ライブラリ | Ant Design (`antd` + `@ant-design/nextjs-registry`) |
| BaaS | Supabase (Docker self-hosting) |
| 認証連携 | `@supabase/ssr` (cookie ベース) |

## ディレクトリ構成

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # AntdRegistry + ConfigProvider
│   │   ├── page.tsx            # サンプルページ
│   │   └── globals.css
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts       # Client Components 用
│   │       ├── server.ts       # Server Components / Actions 用
│   │       └── middleware.ts   # セッションリフレッシュ
│   └── middleware.ts           # Next.js Middleware エントリ
├── supabase/
│   ├── docker-compose.yml      # Supabase 全サービス
│   ├── .env                    # 環境変数テンプレート
│   └── volumes/                # DB 初期化 SQL, Kong 設定
├── .env.local                  # Next.js 用 Supabase 接続情報
└── package.json
```

## Supabase クライアントの使い方

```tsx
// Server Component / Server Action
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data } = await supabase.from("table").select();

// Client Component ("use client")
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

## 起動コマンド

```bash
# Supabase (Docker)
cd supabase && docker compose up -d

# Next.js 開発サーバー
npm run dev
```

## Supabase Docker サービス

| サービス | ポート | 用途 |
|---|---|---|
| Kong (API Gateway) | `8000` | 全 API のエントリポイント |
| Studio | `3100` | 管理ダッシュボード |
| PostgreSQL | `5432` | データベース |
| Inbucket | `9000` | ローカルメールテスト UI |

> **⚠️ 注意:** `supabase/.env` のシークレット値はデモ用デフォルトです。本番利用前に必ず変更してください。
