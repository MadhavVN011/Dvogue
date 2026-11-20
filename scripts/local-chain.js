import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider } from 'ethers';

export async function localChain() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  const executable = fileURLToPath(new URL('../node_modules/@foundry-rs/anvil/bin.mjs', import.meta.url));
  const child = spawn(process.execPath, [executable, '--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337', '--silent'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let failure = '';
  child.stderr.on('data', data => { failure = (failure + data).slice(-2000); });
  const url = 'http://127.0.0.1:' + port;
  const provider = new JsonRpcProvider(url, 31337, { staticNetwork: true, pollingInterval: 50, cacheTimeout: -1 });
  async function close() {
    provider.destroy();
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error('Anvil could not start: ' + failure);
      try { await provider.getBlockNumber(); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    if (!ready) throw new Error('The local test chain did not become ready. ' + failure);
    return { provider, url, close };
  } catch (error) { await close(); throw error; }
}
