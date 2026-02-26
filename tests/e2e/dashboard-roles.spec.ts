import { test, expect, type Page } from '@playwright/test';
import path from 'path';

// ─── Helpers ────────────────────────────────────────────────

const authFile = (role: string) =>
    path.join(__dirname, `../../playwright/.auth/user-${role}.json`);

/**
 * ダッシュボードにアクセスし、ページタイトルが表示されるまで待つ。
 */
async function gotoDashboard(page: Page) {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
}

/**
 * KPIカードが表示されていることをアサートする。
 * Ant Design の <Statistic title="..." /> はカード内のテキストとして表示される。
 */
async function expectCardVisible(page: Page, title: string) {
    await expect(
        page.locator('.ant-statistic-title', { hasText: title })
    ).toBeVisible();
}

/**
 * KPIカードが表示されていないことをアサートする。
 * count() === 0 を使い、DOM に存在しない要素でも安全に検証できる。
 */
async function expectCardNotVisible(page: Page, title: string) {
    await expect(
        page.locator('.ant-statistic-title', { hasText: title })
    ).toHaveCount(0);
}

/**
 * サイドバーメニューにテキストが含まれるかチェックする。
 * Sider 内の .ant-menu を対象にする。
 */
async function expectSidebarHasMenu(page: Page, menuText: string) {
    const sider = page.locator('.ant-layout-sider');
    await expect(sider.getByText(menuText, { exact: true })).toBeVisible();
}

async function expectSidebarNotHasMenu(page: Page, menuText: string) {
    const sider = page.locator('.ant-layout-sider');
    await expect(sider.getByText(menuText, { exact: true })).toHaveCount(0);
}

// ─── 1. Tenant Admin ───────────────────────────────────────

test.describe('Tenant Admin ダッシュボード', () => {
    test.use({ storageState: authFile('admin') });

    test('サイドバーに「管理」メニューが表示されること', async ({ page }) => {
        await gotoDashboard(page);
        await expectSidebarHasMenu(page, '管理');
    });

    test('KPIカード: 「自分の申請」「未処理の申請」が表示されること', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardVisible(page, '自分の申請');
        await expectCardVisible(page, '未処理の申請');
    });

    test('KPIカード: 「担当タスク」「今週の工数」「プロジェクト進捗」が表示されないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardNotVisible(page, '担当タスク');
        await expectCardNotVisible(page, '今週の工数');
        // プロジェクト進捗はカードタイトル（Card title）なので別のセレクタ
        await expect(
            page.locator('.ant-card-head-title', { hasText: 'プロジェクト進捗' })
        ).toHaveCount(0);
    });
});

// ─── 2. PM ─────────────────────────────────────────────────

test.describe('PM ダッシュボード', () => {
    test.use({ storageState: authFile('pm') });

    test('KPIカード: 「担当タスク」「今週の工数」が表示されること', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardVisible(page, '担当タスク');
        await expectCardVisible(page, '今週の工数');
    });

    test('「プロジェクト進捗」カードが表示されていること', async ({ page }) => {
        await gotoDashboard(page);
        // プロジェクト進捗は <Card title="プロジェクト進捗"> として描画される
        await expect(
            page.locator('.ant-card-head-title', { hasText: 'プロジェクト進捗' })
        ).toBeVisible();
    });

    test('サイドバーに「管理」メニューが存在しないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectSidebarNotHasMenu(page, '管理');
    });

    test('KPIカード: 「未処理の申請」が表示されないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardNotVisible(page, '未処理の申請');
    });
});

// ─── 3. Member ─────────────────────────────────────────────

test.describe('Member ダッシュボード', () => {
    test.use({ storageState: authFile('member') });

    test('KPIカード: 「自分の申請」「担当タスク」「今週の工数」が表示されること', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardVisible(page, '自分の申請');
        await expectCardVisible(page, '担当タスク');
        await expectCardVisible(page, '今週の工数');
    });

    test('KPIカード: 「プロジェクト進捗」が存在しないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expect(
            page.locator('.ant-card-head-title', { hasText: 'プロジェクト進捗' })
        ).toHaveCount(0);
    });

    test('サイドバーに「管理」メニューが存在しないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectSidebarNotHasMenu(page, '管理');
    });

    test('KPIカード: 「未処理の申請」が表示されないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardNotVisible(page, '未処理の申請');
    });
});

// ─── 4. Approver ───────────────────────────────────────────

test.describe('Approver ダッシュボード', () => {
    test.use({ storageState: authFile('approver') });

    test('KPIカード: 「未処理の申請」が表示されていること', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardVisible(page, '未処理の申請');
    });

    test('KPIカード: 「自分の申請」が表示されること', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardVisible(page, '自分の申請');
    });

    test('KPIカード: 「担当タスク」「今週の工数」「プロジェクト進捗」が表示されないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardNotVisible(page, '担当タスク');
        await expectCardNotVisible(page, '今週の工数');
        await expect(
            page.locator('.ant-card-head-title', { hasText: 'プロジェクト進捗' })
        ).toHaveCount(0);
    });
});

// ─── 5. Accounting ─────────────────────────────────────────

test.describe('Accounting ダッシュボード', () => {
    test.use({ storageState: authFile('accounting') });

    test('KPIカード: 「自分の申請」が表示されること', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardVisible(page, '自分の申請');
    });

    test('KPIカード: 「担当タスク」「今週の工数」「プロジェクト進捗」「未処理の申請」が表示されないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardNotVisible(page, '担当タスク');
        await expectCardNotVisible(page, '今週の工数');
        await expectCardNotVisible(page, '未処理の申請');
        await expect(
            page.locator('.ant-card-head-title', { hasText: 'プロジェクト進捗' })
        ).toHaveCount(0);
    });
});

// ─── 6. IT Admin ───────────────────────────────────────────

test.describe('IT Admin ダッシュボード', () => {
    test.use({ storageState: authFile('it_admin') });

    test('サイドバーメニューが表示されること', async ({ page }) => {
        await gotoDashboard(page);
        // IT Admin は it_admin ロールであり tenant_admin ではないため、
        // 「管理」サブメニューは layout.tsx の isTenantAdmin 判定により非表示。
        // ただし他の基本メニュー（ダッシュボード、ワークフロー等）は表示される。
        await expectSidebarHasMenu(page, 'ダッシュボード');
        await expectSidebarNotHasMenu(page, '管理');
    });

    test('KPIカード: 「自分の申請」が表示されること', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardVisible(page, '自分の申請');
    });

    test('KPIカード: 「担当タスク」「今週の工数」「プロジェクト進捗」「未処理の申請」が表示されないこと', async ({ page }) => {
        await gotoDashboard(page);
        await expectCardNotVisible(page, '担当タスク');
        await expectCardNotVisible(page, '今週の工数');
        await expectCardNotVisible(page, '未処理の申請');
        await expect(
            page.locator('.ant-card-head-title', { hasText: 'プロジェクト進捗' })
        ).toHaveCount(0);
    });
});
