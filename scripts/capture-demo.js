import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium, devices, expect } from '@playwright/test';
import { mockWallet } from '../tests/helpers/wallet.js';

if (!existsSync('.next/BUILD_ID')) throw new Error('Run npm run build before capturing the demo.');
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error('Install ffmpeg to encode the recorded walkthrough.');
await mkdir('docs/images', { recursive: true });
await mkdir('docs/demo', { recursive: true });
await mkdir('.dvogue/recordings', { recursive: true });
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const origin = 'http://127.0.0.1:' + port;
const server = spawn(process.execPath, ['tests/browser-server.js'], { env: { ...process.env, DVOGUE_PREVIEW_PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'] });
let log = ''; server.stderr.on('data', data => { log = (log + data).slice(-2000); });
let browser, context, video;
async function imagesReady(page) {
  await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(image => {
    const bounds = image.getBoundingClientRect(); return bounds.width && bounds.top < innerHeight && bounds.bottom > 0;
  }).every(image => image.complete && image.naturalWidth > 0))).toBe(true);
}
async function screenshot(page, name, selector) {
  await imagesReady(page);
  const target = selector ? page.locator(selector) : page;
  await target.screenshot({ path: 'docs/images/' + name + '.png' });
}
// Pauses are solely for readable video pacing; automated tests use assertions instead.
const pause = page => page.waitForTimeout(3000);
try {
  let ready = false;
  for (let attempt = 0; attempt < 240; attempt++) {
    if (server.exitCode !== null) throw new Error('Demo server failed: ' + log);
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Wait for isolated chain seeding and server startup. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Demo server did not become ready. ' + log);
  const config = await (await fetch(origin + '/api/network')).json();
  const chrome = process.env.CHROMIUM_EXECUTABLE_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, recordVideo: { dir: '.dvogue/recordings', size: { width: 1440, height: 1000 } } });
  const page = await context.newPage(); video = page.video();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await mockWallet(page, config, 1);
  await page.goto(origin); await screenshot(page, 'storefront'); await pause(page);
  await page.goto(origin + '/shop');
  await expect(page.locator('.product-card')).toHaveCount(10);
  await screenshot(page, 'collection'); await pause(page);
  await page.getByRole('radio', { name: /Women/ }).check(); await pause(page);
  await page.locator('.product-card a[href="/products/DV-001"]').first().click();
  await expect(page.locator('h1')).toHaveText('The Sunday trench');
  await screenshot(page, 'product'); await pause(page);
  await page.getByRole('button', { name: 'Check on-chain record' }).click();
  await expect(page.locator('.verification')).toContainText('match the issuer'); await pause(page);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click(); await pause(page);
  await page.getByRole('link', { name: 'Review & checkout' }).click();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(page.locator('.summary-total')).toContainText('0.0032 ETH');
  await page.getByRole('button', { name: 'Connect wallet to continue' }).click(); await pause(page);
  await page.getByRole('button', { name: 'MetaMask', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await screenshot(page, 'checkout'); await pause(page);
  await page.getByRole('button', { name: 'Confirm wallet purchase', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('It’s yours.', { timeout: 30000 });
  await screenshot(page, 'receipt'); await pause(page);
  await page.getByRole('link', { name: 'Open my wardrobe' }).click();
  await expect(page.locator('.owned-passport')).toHaveCount(1);
  await screenshot(page, 'wardrobe', '.wardrobe-page'); await pause(page);
  await page.getByRole('button', { name: 'Order history', exact: true }).click();
  await expect(page.locator('.order-history article')).toHaveCount(1); await pause(page);
  if (errors.length) throw new Error('Browser runtime errors: ' + errors.join('; '));
  await context.close(); context = null;
  const mobile = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const mobilePage = await mobile.newPage(); await mobilePage.goto(origin);
  await screenshot(mobilePage, 'mobile'); await mobile.close();
  const encode = spawn('ffmpeg', ['-y', '-i', await video.path(), '-vf', 'fps=20,scale=1280:-2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', 'docs/demo/dvogue-walkthrough.mp4'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let encodingError = ''; encode.stderr.on('data', data => { encodingError = (encodingError + data).slice(-1500); });
  const [code] = await once(encode, 'exit'); if (code !== 0) throw new Error('Video encoding failed: ' + encodingError);
  console.log('Saved seven screenshots and docs/demo/dvogue-walkthrough.mp4 (' + ((await stat('docs/demo/dvogue-walkthrough.mp4')).size / 1024 / 1024).toFixed(1) + ' MB).');
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server.exitCode === null) { const exited = once(server, 'exit'); server.kill('SIGTERM'); await exited; }
}
