// Post-deploy smoke test: checks that a deployed storefront is alive and wired to its contracts.
// Read-only (no wallet, no transactions) and dependency-free, so it starts in seconds.
//
//   SMOKE_URL=https://dvogue.vercel.app node scripts/smoke.js
//
// SMOKE_URL                         deployment to test (https:// optional)
// EXPECTED_CHAIN_ID                 chain the deployment must use (default 11155111, Sepolia)
// VERCEL_AUTOMATION_BYPASS_SECRET   optional, gets past Vercel Deployment Protection on unique deployment URLs

const target = process.env.SMOKE_URL;
if (!target) throw new Error('Set SMOKE_URL to the deployment to test.');
const base = new URL(/^https?:\/\//.test(target) ? target : 'https://' + target);
const expectedChainId = BigInt(process.env.EXPECTED_CHAIN_ID || '11155111');
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
const REGISTRY_SELECTOR = '0x7b103999'; // registry()

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Public endpoints and RPC nodes can blip; retry each check a few times before failing.
async function retry(label, fn, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try { const result = await fn(); console.log('ok   ' + label); return result; }
    catch (error) {
      if (attempt >= attempts) { console.error('FAIL ' + label + ': ' + error.message); process.exit(1); }
      await sleep(3000);
    }
  }
}
async function page(path, mustContain) {
  const response = await fetch(new URL(path, base), { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (response.status !== 200) throw new Error('HTTP ' + response.status + (response.status === 302 || response.status === 401 ? ' (deployment protection? check the bypass secret)' : ''));
  const body = await response.text();
  if (!body.includes(mustContain)) throw new Error('response does not contain "' + mustContain + '"');
  return body;
}
async function rpc(url, method, params) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  const { result, error } = await response.json();
  if (error) throw new Error(method + ': ' + error.message);
  return result;
}
const isAddress = value => /^0x[0-9a-fA-F]{40}$/.test(value || '');

console.log('Smoke testing ' + base.origin);
await retry('home page renders', () => page('/', 'dvogue'));
await retry('product page renders', () => page('/products/DV-001', 'The Sunday trench'));
const config = await retry('checkout is configured', async () => {
  const response = await fetch(new URL('/api/network', base), { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (response.status !== 200) throw new Error('HTTP ' + response.status);
  const data = await response.json();
  if (!data.enabled) throw new Error('/api/network reports checkout disabled (missing DVOGUE_* environment variables?)');
  if (BigInt(data.chainId) !== expectedChainId) throw new Error('chain ' + data.chainId + ', expected ' + expectedChainId);
  if (!isAddress(data.registryAddress) || !isAddress(data.marketAddress)) throw new Error('invalid contract addresses');
  if (!/^https:\/\//.test(data.rpcUrl)) throw new Error('RPC URL must use https');
  return data;
});
await retry('RPC serves the configured chain', async () => {
  const chainId = BigInt(await rpc(config.rpcUrl, 'eth_chainId', []));
  if (chainId !== expectedChainId) throw new Error('RPC is on chain ' + chainId);
});
await retry('contracts are deployed and linked', async () => {
  for (const [name, address] of [['registry', config.registryAddress], ['market', config.marketAddress]]) {
    if ((await rpc(config.rpcUrl, 'eth_getCode', [address, 'latest'])) === '0x') throw new Error('no ' + name + ' contract at ' + address);
  }
  const linked = await rpc(config.rpcUrl, 'eth_call', [{ to: config.marketAddress, data: REGISTRY_SELECTOR }, 'latest']);
  if ('0x' + linked.slice(-40).toLowerCase() !== config.registryAddress.toLowerCase()) throw new Error('market points to a different registry');
});
console.log('Smoke test passed.');
