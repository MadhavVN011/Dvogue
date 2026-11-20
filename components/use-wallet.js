'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther, isAddress } from 'ethers';
import { paymentError } from '../lib/commerce.js';

export function useWallet(config) {
  const [wallets, setWallets] = useState([]);
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('');
  const [balance, setBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const provider = useRef(null), cleanup = useRef(() => {}), generation = useRef(0);
  const readAccount = useCallback(async (injected, accounts) => {
    const ticket = ++generation.current;
    const account = Array.isArray(accounts) && isAddress(accounts[0]) ? accounts[0] : '';
    setAddress(account); setBalance('');
    const [chain, amount] = await Promise.all([injected.request({ method: 'eth_chainId' }), account ? injected.request({ method: 'eth_getBalance', params: [account, 'latest'] }) : Promise.resolve('0x0')]);
    if (ticket === generation.current) { setChainId(BigInt(chain).toString()); setBalance(formatEther(amount)); }
  }, []);
  const attach = useCallback(injected => {
    cleanup.current(); provider.current = injected;
    const accountsChanged = accounts => { readAccount(injected, accounts).catch(() => setError('Unable to refresh your wallet. Reconnect to continue.')); };
    const networkChanged = () => { injected.request({ method: 'eth_accounts' }).then(accountsChanged).catch(() => {}); };
    const disconnected = () => { generation.current++; setAddress(''); setBalance(''); setChainId(''); };
    injected.on?.('accountsChanged', accountsChanged); injected.on?.('chainChanged', networkChanged); injected.on?.('disconnect', disconnected);
    cleanup.current = () => { injected.removeListener?.('accountsChanged', accountsChanged); injected.removeListener?.('chainChanged', networkChanged); injected.removeListener?.('disconnect', disconnected); };
  }, [readAccount]);
  useEffect(() => {
    let alive = true;
    const announce = event => {
      const item = event.detail;
      if (!item?.provider?.request || typeof item.info?.uuid !== 'string') return;
      setWallets(current => current.some(wallet => wallet.id === item.info.uuid) ? current : [...current, { id: item.info.uuid, name: String(item.info.name || 'Browser wallet').slice(0, 50), provider: item.provider }]);
    };
    window.addEventListener('eip6963:announceProvider', announce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    Promise.resolve().then(async () => {
      if (!alive || !window.ethereum?.request) return;
      setWallets(current => current.length ? current : [{ id: 'injected', name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', provider: window.ethereum }]);
      let disconnected = false; try { disconnected = sessionStorage.getItem('dvogue-disconnected') === 'true'; } catch { /* Storage is optional. */ }
      if (!disconnected) { const accounts = await window.ethereum.request({ method: 'eth_accounts' }); if (alive && accounts?.length) { attach(window.ethereum); await readAccount(window.ethereum, accounts); } }
    }).catch(() => {});
    return () => { alive = false; window.removeEventListener('eip6963:announceProvider', announce); cleanup.current(); };
  }, [attach, readAccount]);
  async function connect(chosen) {
    const injected = chosen || wallets[0]?.provider || window.ethereum;
    if (!injected?.request) { setError('No wallet detected. Install an Ethereum-compatible browser wallet or open this page in your wallet browser.'); return false; }
    setBusy(true); setError('');
    try { const accounts = await injected.request({ method: 'eth_requestAccounts' }); if (!accounts?.length || !isAddress(accounts[0])) throw new Error('Your wallet did not share an account.'); attach(injected); await readAccount(injected, accounts); try { sessionStorage.removeItem('dvogue-disconnected'); } catch {} return true; }
    catch (err) { setError(paymentError(err)); return false; } finally { setBusy(false); }
  }
  function disconnect() { cleanup.current(); provider.current = null; generation.current++; setAddress(''); setChainId(''); setBalance(''); setError(''); try { sessionStorage.setItem('dvogue-disconnected', 'true'); } catch {} }
  async function switchNetwork() {
    if (!provider.current || !config) return false;
    setBusy(true); setError('');
    const hex = '0x' + BigInt(config.chainId).toString(16);
    try {
      try { await provider.current.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }); }
      catch (err) { if (err.code !== 4902) throw err; await provider.current.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: config.chainName, nativeCurrency: { name: config.currency, symbol: config.currency, decimals: 18 }, rpcUrls: [config.rpcUrl], ...(config.explorerUrl ? { blockExplorerUrls: [config.explorerUrl] } : {}) }] }); await provider.current.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }); }
      await readAccount(provider.current, await provider.current.request({ method: 'eth_accounts' })); return true;
    } catch (err) { setError(paymentError(err)); return false; } finally { setBusy(false); }
  }
  async function refresh() { if (provider.current) await readAccount(provider.current, await provider.current.request({ method: 'eth_accounts' })); }
  return { refresh, wallets, address, chainId, balance, busy, error, connect, disconnect, switchNetwork, provider, wrongNetwork: !!address && !!config && chainId !== config.chainId };
}
