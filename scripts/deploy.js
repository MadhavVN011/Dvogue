import { JsonRpcProvider, Wallet, isAddress } from 'ethers';
import { mkdir, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { seedCollection } from './seed.js';
import { products } from '../lib/catalog.js';

dotenv.config({ path: '.env.local', quiet: true });
const rpc = process.env.DEPLOY_RPC_URL || 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
try {
  const { chainId } = await provider.getNetwork();
  const local = chainId === 31337n;
  if (!local && !process.env.DEPLOYER_PRIVATE_KEY) throw new Error('An external deployment requires DEPLOYER_PRIVATE_KEY.');
  // Optional: resume an interrupted run with the addresses it printed.
  const resume = { registryAddress: process.env.DEPLOY_REGISTRY_ADDRESS || undefined, marketAddress: process.env.DEPLOY_MARKET_ADDRESS || undefined };
  for (const [name, value] of Object.entries(resume)) if (value && !isAddress(value)) throw new Error('Invalid ' + name + ' to resume: ' + value);
  if (resume.marketAddress && !resume.registryAddress) throw new Error('Resuming a marketplace also requires DEPLOY_REGISTRY_ADDRESS.');
  const signer = local && !process.env.DEPLOYER_PRIVATE_KEY ? await provider.getSigner(0) : new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const addresses = await seedCollection(signer, process.env.CATALOG_BASE_URL || 'http://localhost:3000', { ...resume, log: local ? undefined : message => console.log(message) });
  const config = { chainId: chainId.toString(), chainName: local ? 'Dvogue Local' : 'Configured network', rpcUrl: rpc, ...addresses };
  // Local preview only; real-network configuration stays explicitly managed by the operator.
  if (local) { await mkdir('.dvogue', { recursive: true }); await writeFile('.dvogue/deployment.json', JSON.stringify(config, null, 2) + '\n'); }
  console.log('Registered ' + products.length + ' sample products and stocked all size variants.');
  console.log(JSON.stringify({ ...config, rpcUrl: '[configured RPC]' }, null, 2));
} finally { provider.destroy(); }
