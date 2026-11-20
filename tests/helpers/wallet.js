import { JsonRpcProvider } from 'ethers';

// Test-only EIP-1193 adapter. Transactions are sent to an isolated Anvil chain.
export async function mockWallet(page, config, accountIndex, options = {}) {
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
