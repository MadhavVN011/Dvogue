import { test, expect } from '@playwright/test';
import { Contract, JsonRpcProvider, id, parseEther } from 'ethers';
import { marketABI } from '../lib/chain-config.js';

async function network(request) { return (await request.get('/api/network')).json(); }
async function mockWallet(page, config, accountIndex, options = {}) {
  const provider = new JsonRpcProvider(config.rpcUrl);
  const accounts = await provider.send('eth_accounts', []); provider.destroy();
  await page.addInitScript(({ config, account, options }) => {
    let connected = !!options.connected, chain = options.wrongNetwork ? '0x1' : '0x7a69';
    const listeners = {};
    window.__rejectPurchase = false; window.__rejectConnect = false;
    window.ethereum = {
      isMetaMask: true,
      on: (name, cb) => { (listeners[name] ||= []).push(cb); },
      removeListener: (name, cb) => { listeners[name] = (listeners[name] || []).filter(item => item !== cb); },
      request: async ({ method, params = [] }) => {
        const reject = () => { const error = new Error('User rejected request'); error.code = 4001; throw error; };
        if (method === 'eth_requestAccounts') { if (window.__rejectConnect) reject(); connected = true; return [account]; }
        if (method === 'eth_accounts') return connected ? [account] : [];
        if (method === 'eth_chainId') return chain;
        if (method === 'wallet_switchEthereumChain') { chain = params[0].chainId; (listeners.chainChanged || []).forEach(cb => cb(chain)); return null; }
        if (method === 'eth_sendTransaction' && window.__rejectPurchase) reject();
        const result = await fetch(config.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then(r => r.json());
        if (result.error) { const error = new Error(result.error.message); error.code = result.error.code; error.data = result.error.data; throw error; }
        return result.result;
      },
    };
  }, { config, account: accounts[accountIndex], options });
  return accounts[accountIndex];
}
async function addTrench(page) {
  await page.goto('/products/DV-001');
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.getByRole('link', { name: 'Review & checkout' }).click();
  await expect(page.locator('.summary-total')).toContainText('0.0032 ETH');
}

test('editorial storefront, collection filters, search, sort and metadata', async ({ page, request }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Wear what');
  await expect(page.locator('.product-card')).toHaveCount(4);
  await page.locator('.passport-editorial-photo').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(img => img.getClientRects().length > 0).every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
  await page.goto('/shop');
  await expect(page.locator('.product-card')).toHaveCount(10);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Filters +' }).click();
  await page.getByRole('radio', { name: /Women/ }).check();
  await expect(page.locator('.product-card')).toHaveCount(5);
  await page.getByRole('radio', { name: /Men/ }).check();
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.getByRole('radio', { name: /All pieces/ }).check();
  await page.getByLabel('Type', { exact: true }).selectOption('Bags');
  await expect(page.locator('.product-card')).toHaveCount(2);
  await page.getByLabel('Type', { exact: true }).selectOption('All');
  await page.getByLabel('Sort products').selectOption('price-asc');
  await expect(page.locator('.product-card').first()).toContainText('The essential cotton tee');
  await page.getByRole('searchbox', { name: 'Search collection', exact: true }).fill('nothing-matches-this');
  await expect(page.getByText('No pieces found.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.locator('.product-card')).toHaveCount(10);
  const product = await request.get('/api/products/DV-001');
  expect(product.status()).toBe(200); expect((await product.json()).sku).toBe('DV-001');
  expect((await request.get('/api/products/missing')).status()).toBe(404);
  expect((await (await request.get('/api/passports/DV-001')).json()).name).toContain('The Sunday trench');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('product sizing, on-chain provenance, persisted bag and wishlist', async ({ page }, info) => {
  await page.goto('/products/DV-001');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.locator('.inline-error[role=alert]')).toContainText('Choose a size');
  await page.getByRole('button', { name: 'Size guide', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Find your fit.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Check on-chain record' }).click();
  await expect(page.locator('.verification')).toContainText('match the issuer');
  await expect(page.locator('.provenance-timeline')).toContainText('Not recorded yet');
  await page.getByRole('button', { name: 'Save The Sunday trench', exact: true }).click();
  await page.screenshot({ path: info.outputPath('product.png'), fullPage: true });
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const bag = page.getByRole('dialog', { name: /Your bag/ });
  await bag.getByRole('button', { name: 'Increase quantity of The Sunday trench' }).click();
  await expect(bag).toContainText('₹25,800');
  await page.keyboard.press('Escape'); await page.reload();
  await page.getByRole('button', { name: 'Open bag, 2 items' }).click();
  await expect(bag).toContainText('₹25,800');
  await bag.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(bag).toContainText('A little room for something good.');
  await page.keyboard.press('Escape'); await page.goto('/wishlist');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Unsave The Sunday trench', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('wallet absence and cancelled connection give actionable feedback', async ({ page, request }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Detect browser wallet' }).click();
  await expect(page.locator('.inline-error[role=alert]')).toContainText('No wallet detected');
  await mockWallet(page, await network(request), 7);
  await page.reload(); await page.evaluate(() => { window.__rejectConnect = true; });
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'MetaMask', exact: true }).click();
  await expect(page.locator('.inline-error[role=alert]')).toContainText('cancelled');
});

test('wallet network switching, rejected payment, confirmed purchase and wardrobe', async ({ page, request }, info) => {
  test.setTimeout(60000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const config = await network(request);
  await mockWallet(page, config, info.project.name === 'mobile' ? 2 : 1, { wrongNetwork: true });
  await addTrench(page);
  await page.getByRole('button', { name: 'Connect wallet to continue' }).click();
  await page.getByRole('button', { name: 'MetaMask', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Switch to Dvogue Test', exact: true }).click();
  await page.evaluate(() => { window.__rejectPurchase = true; });
  await page.getByRole('button', { name: 'Confirm wallet purchase', exact: true }).click();
  await expect(page.locator('.inline-error[role=alert]')).toContainText('cancelled');
  await expect(page.locator('.checkout-line')).toHaveCount(1);
  await page.evaluate(() => { window.__rejectPurchase = false; });
  await page.getByRole('button', { name: 'Confirm wallet purchase', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('It’s yours.', { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Open bag, 0 items' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('confirmed.png'), fullPage: true });
  await page.getByRole('link', { name: 'Open my wardrobe' }).click();
  await expect(page.locator('.owned-passport')).toHaveCount(1);
  await expect(page.locator('.owned-passport')).toContainText('The Sunday trench');
  await page.getByRole('button', { name: 'Order history', exact: true }).click();
  await expect(page.locator('.order-history article')).toHaveCount(1);
  await expect(page.locator('.order-history')).toContainText('0.0032 ETH');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('a submitted purchase is recovered after page reload without paying twice', async ({ page, request }, info) => {
  const config = await network(request), index = info.project.name === 'mobile' ? 6 : 5;
  const buyer = await mockWallet(page, config, index, { connected: true });
  const provider = new JsonRpcProvider(config.rpcUrl, undefined, { cacheTimeout: -1 });
  const market = new Contract(config.marketAddress, marketABI, await provider.getSigner(index));
  const tx = await market.buy([id('DV-007:M')], [1], [parseEther('0.0015')], { value: parseEther('0.0015') }); await tx.wait(); provider.destroy();
  await page.addInitScript(({ config, buyer, hash }) => {
    const lines = [{ sku: 'DV-007', size: 'M', quantity: 1 }];
    localStorage.setItem('dvogue-bag-v1', JSON.stringify(lines));
    sessionStorage.setItem('dvogue-pending:' + config.chainId + ':' + config.marketAddress.toLowerCase(), JSON.stringify({ buyer, hash, lines }));
  }, { config, buyer, hash: tx.hash });
  await page.goto('/checkout');
  await expect(page.locator('h1')).toHaveText('It’s yours.');
  await expect(page.locator('.confirmed-receipt')).toContainText(tx.hash);
  await expect(page.getByRole('button', { name: 'Open bag, 0 items' })).toBeVisible();
});

test('bag works with corrupt storage and blocked writes', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('dvogue-bag-v1', 'not-json'); Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.goto('/products/DV-001');
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Your bag/ })).toContainText('The Sunday trench');
});

 test('global search and navigation open the right collection and product', async ({ page }, info) => {
  await page.goto('/');
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Women', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Women.');
  await expect(page.locator('.product-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Search collection', exact: true }).click();
  const search = page.getByRole('dialog');
  await search.getByRole('searchbox', { name: 'Search products' }).fill('trench');
  await search.getByRole('link', { name: /The Sunday trench/ }).click();
  await expect(page.locator('h1')).toHaveText('The Sunday trench');
  await page.goto('/help'); await expect(page.locator('h1')).toContainText('Good questions.');
  await page.goto('/about'); await expect(page.locator('h1')).toContainText('Style is personal.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
