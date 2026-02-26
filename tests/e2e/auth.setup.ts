import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = (role: string) => path.join(__dirname, `../../playwright/.auth/user-${role}.json`);

const roles = [
    { id: 'admin', email: 'admin@test-corp.example.com' },
    { id: 'it_admin', email: 'itadmin@test-corp.example.com' },
    { id: 'pm', email: 'pm@test-corp.example.com' },
    { id: 'accounting', email: 'accounting@test-corp.example.com' },
    { id: 'approver', email: 'approver@test-corp.example.com' },
    { id: 'member', email: 'member@test-corp.example.com' },
];

for (const role of roles) {
    setup(`authenticate as ${role.id}`, async ({ page }) => {
        // Perform authentication steps. Replace these actions with your own.
        await page.goto('/login');
        await page.getByPlaceholder('メールアドレス').fill(role.email);
        await page.getByPlaceholder('パスワード').fill('password123');
        await page.getByRole('button', { name: 'ログイン' }).click();

        // Wait until the page receives the cookies.
        // Sometimes login flow sets cookies in the process of several redirects.
        // Wait for the final URL to ensure that the cookies are actually set.
        await page.waitForURL('/');
        // Alternatively, you can wait until the page reaches a state where all cookies are set.
        await expect(page.getByText('OpsHub')).toBeVisible();

        // End of authentication steps.
        await page.context().storageState({ path: authFile(role.id) });
    });
}
