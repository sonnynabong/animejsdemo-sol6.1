import { expect, test, type Page } from '@playwright/test';

async function waitForAsset(page: Page) {
  await expect(page.locator('#scroll-study')).toHaveAttribute('data-asset', 'ready');
  await page.evaluate(() => document.fonts.ready);
}

async function scrollToProgress(page: Page, progress: number) {
  await page.evaluate((p) => {
    const section = document.querySelector<HTMLElement>('#scroll-study')!;
    const stage = document.querySelector<HTMLElement>('.stage')!;
    window.scrollTo({ top: (section.offsetHeight - stage.offsetHeight) * p, behavior: 'instant' });
  }, progress);
  await expect.poll(async () => Number(await page.locator('#scroll-study').getAttribute('data-progress')),
    { timeout: 10000 }).toBeCloseTo(progress, 2);
}

test('all scroll stages render, and returning to the top restores the exact canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await waitForAsset(page);
  await scrollToProgress(page, 0);
  const original = await page.locator('#watch-canvas').screenshot();
  await scrollToProgress(page, 0.32);
  await expect(page.locator('#chapter-category')).toHaveText('GLASS & BEZEL');
  await scrollToProgress(page, 0.55);
  await expect(page.locator('#chapter-category')).toHaveText('DIAL & HANDS');
  await scrollToProgress(page, 1);
  await expect(page.locator('#chapter-category')).toHaveText('THE EXPLODED VIEW');
  const exploded = await page.locator('#watch-canvas').screenshot();
  expect(exploded.equals(original)).toBe(false);
  await scrollToProgress(page, 0);
  // Wait for the independently smoothed timeline's rotation to settle as well.
  await expect.poll(async () => (await page.locator('#watch-canvas').screenshot()).equals(original),
    { timeout: 10000 }).toBe(true);
  expect(errors).toEqual([]);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});

test('chapter navigation and reassembly work on a touch viewport without horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/');
  await waitForAsset(page);
  await page.getByRole('button', { name: 'View the fully disassembled watch' }).tap();
  await expect(page.locator('#scroll-study')).toHaveAttribute('data-progress', '1.0000');
  await expect(page.locator('#chapter-title')).toHaveText('A whole, in its parts.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'View the assembled watch' }).tap();
  await expect(page.locator('#scroll-study')).toHaveAttribute('data-progress', '0.0000');
  await expect(page.locator('#chapter-title')).toHaveText('Designed to come together.');
  await context.close();
});

test('reduced motion presents a static exploded view and can switch back to scroll motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await waitForAsset(page);
  await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('#scroll-study')).toHaveAttribute('data-progress', '1.0000');
  await expect(page.locator('#scroll-hint')).toHaveText('SCROLL TO THE CREDITS');
  await expect(page.locator('.chapter-nav')).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('body')).toHaveAttribute('data-motion', 'full');
  await scrollToProgress(page, 0.55);
  await expect(page.locator('#chapter-category')).toHaveText('DIAL & HANDS');
});

test('a failed model request shows its preview and retry recovers the live scene', async ({ page }) => {
  await page.route('**/models/chronograph.glb', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#scroll-study')).toHaveAttribute('data-asset', 'error');
  await expect(page.locator('.fallback-image')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.unroute('**/models/chronograph.glb');
  await page.getByRole('button', { name: 'Try again' }).click();
  await waitForAsset(page);
  await expect(page.locator('.fallback-image')).toBeHidden();
  await scrollToProgress(page, 1);
});

test('the timeline uses the current scroll position when a model finishes loading late', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/models/chronograph.glb', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('#scroll-study')!;
    const stage = document.querySelector<HTMLElement>('.stage')!;
    window.scrollTo({ top: (section.offsetHeight - stage.offsetHeight) * 0.55, behavior: 'instant' });
  });
  release();
  await waitForAsset(page);
  await expect.poll(async () => Number(await page.locator('#scroll-study').getAttribute('data-progress'))).toBeCloseTo(0.55, 2);
  await expect(page.locator('#chapter-category')).toHaveText('DIAL & HANDS');
});

test('WebGL unavailability keeps a readable preview and accessible credits', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof nativeGetContext>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return nativeGetContext.apply(this, args);
    } as typeof nativeGetContext;
  });
  await page.goto('/');
  await expect(page.locator('#scroll-study')).toHaveAttribute('data-asset', 'fallback');
  await expect(page.locator('.fallback-image')).toBeVisible();
  await expect(page.locator('#watch-canvas')).toBeHidden();
  await expect(page.locator('#chapter-description')).toContainText('Interactive 3D needs WebGL');
  await expect(page.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
});
