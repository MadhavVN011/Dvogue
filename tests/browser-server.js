import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { localChain } from '../scripts/local-chain.js';
import { seedCollection } from '../scripts/seed.js';
const chain = await localChain();
let server;
let closing = false;
async function close() {
  if (closing) return; closing = true;
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill('SIGTERM'); await exited; }
  await chain.close();
}
process.on('SIGTERM', () => { close().then(() => process.exit(0)); });
process.on('SIGINT', () => { close().then(() => process.exit(0)); });
try {
  const addresses = await seedCollection(await chain.provider.getSigner(0), 'http://127.0.0.1:3173');
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3173'], { stdio: 'inherit', env: { ...process.env, DVOGUE_CHAIN_ID: '31337', DVOGUE_CHAIN_NAME: 'Dvogue Test', DVOGUE_RPC_URL: chain.url, DVOGUE_REGISTRY_ADDRESS: addresses.registryAddress, DVOGUE_MARKET_ADDRESS: addresses.marketAddress } });
  const [code] = await once(server, 'exit');
  await close(); process.exitCode = code || 0;
} catch (error) { await close(); throw error; }
