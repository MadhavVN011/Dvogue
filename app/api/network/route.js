import { readFile } from 'node:fs/promises';
import { isAddress } from 'ethers';
export const dynamic = 'force-dynamic';
export async function GET() {
  let saved = {};
  try { saved = JSON.parse(await readFile(process.cwd() + '/.dvogue/deployment.json', 'utf8')); } catch { /* No local chain has been deployed. */ }
  const config = {
    chainId: process.env.DVOGUE_CHAIN_ID || saved.chainId || '31337',
    chainName: process.env.DVOGUE_CHAIN_NAME || saved.chainName || 'Dvogue Local',
    currency: process.env.DVOGUE_CURRENCY || 'ETH',
    rpcUrl: process.env.DVOGUE_RPC_URL || saved.rpcUrl || 'http://127.0.0.1:8545',
    registryAddress: process.env.DVOGUE_REGISTRY_ADDRESS || saved.registryAddress || '',
    marketAddress: process.env.DVOGUE_MARKET_ADDRESS || saved.marketAddress || '',
    explorerUrl: process.env.DVOGUE_EXPLORER_URL || '',
    testnet: process.env.DVOGUE_TESTNET !== 'false',
  };
  config.enabled = /^\d+$/.test(config.chainId) && isAddress(config.registryAddress) && isAddress(config.marketAddress);
  return Response.json(config, { headers: { 'Cache-Control': 'no-store' } });
}
