import { test, expect } from '@playwright/test';

// Use the admin storage state for the sanity test.
test.use({ storageState: 'playwright/.auth/user-admin.json' });

test('sanity check - dashboard title is visible', async ({ page }) => {
    await page.goto('/');
    // Basic check to see if the main layout is rendered.
    await expect(page.getByText('OpsHub').first()).toBeVisible();
});

// A test that does not use the storage state to verify the login page itself.
test.describe('Unauthenticated access', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('sanity check - unauthenticated user should be redirected to login page', async ({ page }) => {
        await page.goto('/');
        await page.waitForURL('/login');
        await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
    });
});
