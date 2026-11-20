import { JsonRpcProvider, Wallet } from 'ethers';
import { mkdir, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { seedCollection } from './seed.js';
import { products } from '../lib/catalog.js';

dotenv.config({ path: '.env.local', quiet: true });
const rpc = process.env.DEPLOY_RPC_URL || 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
try {
  const { chainId } = await provider.getNetwork();
  if (chainId !== 31337n && !process.env.DEPLOYER_PRIVATE_KEY) throw new Error('An external deployment requires DEPLOYER_PRIVATE_KEY.');
  const signer = chainId === 31337n && !process.env.DEPLOYER_PRIVATE_KEY ? await provider.getSigner(0) : new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const addresses = await seedCollection(signer, process.env.CATALOG_BASE_URL || 'http://localhost:3000');
  const config = { chainId: chainId.toString(), chainName: chainId === 31337n ? 'Dvogue Local' : 'Configured network', rpcUrl: rpc, ...addresses };
  // Local preview only; real-network configuration stays explicitly managed by the operator.
  if (chainId === 31337n) { await mkdir('.dvogue', { recursive: true }); await writeFile('.dvogue/deployment.json', JSON.stringify(config, null, 2) + '\n'); }
  console.log('Registered ' + products.length + ' sample products and stocked all size variants.');
  console.log(JSON.stringify({ ...config, rpcUrl: '[configured RPC]' }, null, 2));
} finally { provider.destroy(); }
