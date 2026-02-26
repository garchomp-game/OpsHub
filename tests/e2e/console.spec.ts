import { test, expect } from '@playwright/test';

// 認証不要でアクセスしてリダイレクトされるかのテストに使用する想定
// または、admin など任意の Storage State を使っても良い
test.use({ storageState: 'playwright/.auth/user-admin.json' });

test('ダッシュボードアクセス時にブラウザコンソールエラーが出ないこと', async ({ page }) => {
    const errors: string[] = [];

    // ページ内の console.error をリッスンする
    page.on('console', msg => {
        // warning も含める場合は msg.type() === 'warning' を追加する
        if (msg.type() === 'error' || msg.type() === 'warning') {
            errors.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
        }
    });

    // ページ未捕捉の例外（JSのエラー）をリッスンする
    page.on('pageerror', err => {
        errors.push(`[PAGE_ERROR] ${err.message}`);
    });

    await page.goto('/');

    // Next.js が Hydration を完了するまで少し待機（例：ネットワークアイドル状態など）
    await page.waitForLoadState('networkidle');

    // 取得したエラーが空であることを検証
    expect(errors, `ブラウザに次のエラーがあります:\n${errors.join('\n')}`).toEqual([]);
});
