import { test, expect } from '@playwright/test';

const routes = ['/', '/writing/', '/work/', '/about/', '/work/fuxi-mini/', '/work/agent-collaboration/', '/writing/knowledge-to-output/', '/writing/docs-with-code/', '/writing/agent-handoff/', '/404.html'];
const colors = { light: 'rgb(250, 249, 246)', dark: 'rgb(16, 21, 18)' };
test.use({ colorScheme: 'light' });

test('全部页面的明暗主题、资源和响应式布局', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(request.url()));
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of info.project.name === 'desktop' ? [768, 1024, 1440] : [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route + ' at ' + width).toBe(true);
        await expect(page.locator('html')).toHaveCSS('background-color', colors[theme]);
      }
    }
    await page.goto('/');
    await page.screenshot({ path: `.tmp/browser-results/${info.project.name}-home-${theme}.png`, fullPage: true });
    await page.goto('/work/fuxi-mini/');
    await page.screenshot({ path: `.tmp/browser-results/${info.project.name}-case-${theme}.png`, fullPage: true });
  }
  const missing = await page.goto('/this-page-does-not-exist/');
  expect(missing?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('这一页，还没有内容。');
  expect(errors).toEqual([]);
});

test('正文搜索、主题、空结果、URL 恢复', async ({ page }) => {
  await page.goto('/writing/');
  await page.locator('#article-search').fill('往回织');
  await expect(page.locator('[data-post]:visible')).toHaveCount(1);
  await expect(page.locator('[data-post]:visible')).toHaveAttribute('data-post', 'knowledge-to-output');
  await page.reload();
  await expect(page.locator('#article-search')).toHaveValue('往回织');
  await page.locator('#article-search').fill('不存在的内容zzzz');
  await expect(page.locator('.archive-empty')).toBeVisible();
  await page.locator('[data-clear-search]').click();
  await expect(page.locator('[data-post]:visible')).toHaveCount(3);
  await page.locator('.topic-picker summary').click();
  await page.locator('[data-topic="知识管理"]').click();
  await expect(page.locator('[data-post]:visible')).toHaveCount(1);
  await page.locator('[data-post]:visible').click();
  await page.goBack();
  await expect(page.locator('[data-topic-label]')).toHaveText('知识管理');
});

test('开关灯跟随系统、记住选择并同步标签页', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '切换到深色主题' })).toHaveText('关灯');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('background-color', colors.dark);
  await page.getByRole('button', { name: '切换到浅色主题' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveCSS('background-color', colors.light);
  await page.goto('/writing/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goBack();
  await expect(page.locator('html')).toHaveCSS('background-color', colors.light);
  await page.reload();
  await expect(page.locator('html')).toHaveCSS('background-color', colors.light);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('background-color', colors.light);
  const other = await context.newPage();
  await other.goto('/about/');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.getByRole('button', { name: '切换到深色主题' }).click();
  await expect(page.locator('html')).toHaveCSS('background-color', colors.dark);
  await other.evaluate(() => localStorage.removeItem('mohan-theme'));
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveCSS('background-color', colors.light);
  await other.close();
});

test('首屏提前应用已保存的主题', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('mohan-theme', 'light'));
  // Block deferred modules: the head script alone must apply the saved preference.
  await page.route('**/_astro/*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('background-color', colors.light);
  await expect(page.locator('.theme-toggle')).toBeHidden();
});

test('存储不可用时仍可开关灯', async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem']) {
      Object.defineProperty(Storage.prototype, method, { value() { throw new Error('Storage unavailable'); } });
    }
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: '切换到浅色主题' }).click();
  await expect(page.locator('html')).toHaveCSS('background-color', colors.light);
  await page.getByRole('button', { name: '切换到深色主题' }).click();
  await expect(page.locator('html')).toHaveCSS('background-color', colors.dark);
});

test('菜单键盘操作、目录、阅读进度和页脚动效偏好', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('.site-header .motion-toggle')).toHaveCount(0);
  await page.locator('.site-footer .motion-toggle').click();
  await page.goto('/writing/knowledge-to-output/');
  await expect(page.locator('.motion-toggle')).toHaveAttribute('aria-pressed', 'true');
  if (info.project.name === 'mobile') {
    await page.locator('.menu-button').click();
    await expect(page.locator('.menu-button')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu-button')).toBeFocused();
    await expect(page.locator('.menu-button')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.article-toc summary').click();
  }
  await page.locator('.article-toc a[href="#judgment"]').click();
  await expect(page).toHaveURL(/#judgment$/);
  await expect(page.locator('#judgment')).toBeVisible();
  await expect(page.locator('.reading-progress')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.motion-toggle')).toBeDisabled();
  await expect(page.locator('html')).not.toHaveClass(/motion-enabled/);
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).toHaveCSS('background-color', colors.dark);
});

test('禁用 JavaScript 仍能以系统主题导航和阅读', async ({ browser }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  const page = await context.newPage();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('http://127.0.0.1:4322/writing/');
    await expect(page.locator('html')).toHaveCSS('background-color', colors[theme]);
    await expect(page.locator('.theme-toggle')).toBeHidden();
    await expect(page.locator('[data-post]')).toHaveCount(3);
    await expect(page.locator('.primary-nav')).toBeVisible();
    await page.locator('a[href="/writing/knowledge-to-output/"]').click();
    await expect(page.locator('.article-body')).toContainText('往回织');
    await expect(page.locator('#judgment')).toBeVisible();
    await page.screenshot({ path: `.tmp/browser-results/${info.project.name}-article-${theme}-no-js.png`, fullPage: true });
  }
  await context.close();
});