import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/user-admin.json' });

test('ログアウトすると /login にリダイレクトされること', async ({ page }) => {
    // ダッシュボードにアクセスして認証済みであることを確認
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();

    // /auth/logout にアクセス
    await page.goto('/auth/logout');

    // /login にリダイレクトされることを検証
    await expect(page).toHaveURL(/\/login/);
});
