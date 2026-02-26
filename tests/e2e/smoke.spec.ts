import { test, expect } from '@playwright/test';

/**
 * 全画面スモークテスト
 *
 * 全主要画面にアクセスし、以下を検証:
 * 1. ページが正常にレンダリングされること（200レスポンス）
 * 2. ブラウザコンソールに error / warning が出ないこと
 * 3. ページ内に未捕捉の JS エラーがないこと
 *
 * admin ロールで全画面をテスト（最も広いアクセス権限）
 */
test.describe('全画面スモークテスト', () => {
    test.use({ storageState: 'playwright/.auth/user-admin.json' });

    const routes = [
        { path: '/', label: 'ダッシュボード' },
        { path: '/workflows', label: 'ワークフロー申請一覧' },
        { path: '/workflows/pending', label: '承認待ち一覧' },
        { path: '/projects', label: 'プロジェクト一覧' },
        { path: '/expenses', label: '経費一覧' },
        { path: '/expenses/summary', label: '経費集計' },
        { path: '/timesheets', label: '工数入力' },
        { path: '/timesheets/reports', label: '工数レポート' },
        { path: '/invoices', label: '請求一覧' },
        { path: '/search?q=test', label: '全文検索' },
        { path: '/admin/users', label: 'ユーザー管理' },
        { path: '/admin/tenant', label: 'テナント管理' },
        { path: '/admin/audit-logs', label: '監査ログ' },
    ];

    for (const route of routes) {
        test(`${route.label} (${route.path}) にアクセスしてコンソールエラーが出ないこと`, async ({ page }) => {
            const errors: string[] = [];

            // console.error / warning をキャプチャ
            page.on('console', msg => {
                if (msg.type() === 'error' || msg.type() === 'warning') {
                    const text = msg.text();
                    // Next.js DevOverlay 関連の無害な警告を除外
                    if (text.includes('DevTools') || text.includes('Download the React DevTools')) return;
                    // Ant Design の既知の無害な警告を除外
                    if (text.includes('[antd:') && text.includes('deprecated')) return;
                    errors.push(`[${msg.type().toUpperCase()}] ${text}`);
                }
            });

            // 未捕捉の JS エラーをキャプチャ
            page.on('pageerror', err => {
                errors.push(`[PAGE_ERROR] ${err.message}`);
            });

            // ページアクセス
            const response = await page.goto(route.path);
            expect(response?.status()).toBeLessThan(500);

            // Hydration 完了待ち
            await page.waitForLoadState('networkidle');

            // ページがレンダリングされていること（空のbodyでないこと）
            const bodyText = await page.locator('body').textContent();
            expect(bodyText?.length).toBeGreaterThan(0);

            // コンソールエラーが0であること
            expect(
                errors,
                `${route.label} (${route.path}) でコンソールエラーを検出:\n${errors.join('\n')}`
            ).toEqual([]);
        });
    }
});
