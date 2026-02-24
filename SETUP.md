# OpsHub — セットアップガイド

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router, TypeScript) |
| UI ライブラリ | Ant Design (`antd` + `@ant-design/nextjs-registry`) |
| BaaS | Supabase (CLI ローカル開発) |
| 認証連携 | `@supabase/ssr` (cookie ベース) |

## 前提条件

| ツール | バージョン |
|---|---|
| Node.js | 22 LTS |
| Docker / Docker Compose | 最新安定版 |
| pnpm / npm | 最新安定版 |

## 起動手順

```bash
# 1. 依存インストール
npm install

# 2. Supabase ローカル環境を起動
npx supabase start

# 3. .env.local にキーを設定（supabase start の出力から）
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<Publishable key>
# SUPABASE_SERVICE_ROLE_KEY=<Secret key>

# 4. Next.js 開発サーバー起動
npm run dev
```

## ローカルサービス一覧

| サービス | URL | 用途 |
|---|---|---|
| Next.js | http://localhost:3000 | アプリケーション |
| Supabase Studio | http://127.0.0.1:54323 | DB管理ダッシュボード |
| Supabase API | http://127.0.0.1:54321 | REST / GraphQL API |
| PostgreSQL | postgresql://postgres:postgres@127.0.0.1:54322/postgres | DB直接接続 |
| Mailpit | http://127.0.0.1:54324 | ローカルメールテスト |

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

## 停止・リセット

```bash
# Supabase 停止
npx supabase stop

# Supabase 停止 + データ削除
npx supabase stop --no-backup
```

> **⚠️ 注意:** `.env.local` のキーはローカル開発用です。本番利用前に必ず変更してください。
