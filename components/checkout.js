'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useStore } from './store-provider.js';
import { productBySku, formatPrice } from '../lib/catalog.js';
import { bagTotal } from '../lib/bag.js';
import { quoteBag, purchase, recoverPurchase, cryptoAmount, paymentError } from '../lib/commerce.js';
import { shortAddress } from '../lib/chain-config.js';
import Icon from './icon.js';
export default function Checkout() {
  const { bag, wallet, config, setWalletOpen, setBagOpen } = useStore();
  const [quoteState, setQuoteState] = useState(null), [refresh, setRefresh] = useState(0), [phase, setPhase] = useState('idle'), [hash, setHash] = useState(''), [receipt, setReceipt] = useState(null), [error, setError] = useState('');
  const pending = useRef(null), settled = useRef(new Set());
  const { completePurchase } = bag;
  const pendingKey = config?.enabled ? 'dvogue-pending:' + config.chainId + ':' + config.marketAddress.toLowerCase() : '';
  const remember = useCallback(value => { pending.current = value; try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch { /* Wallet activity remains available when storage is blocked. */ } }, [pendingKey]);
  const finish = useCallback((result, lines) => { if (settled.current.has(result.hash)) return; settled.current.add(result.hash); completePurchase(lines); remember(null); setReceipt(result); setPhase('confirmed'); setError(''); }, [completePurchase, remember]);
  const checkPending = useCallback(async value => {
    setHash(value.hash); setPhase('pending'); setError('');
    try { const result = await recoverPurchase(config, value); if (result) finish(result, value.lines); else setError('The transaction is still pending. Check its status again before placing another order.'); }
    catch (err) { if (err.code === 'CALL_EXCEPTION') { remember(null); setPhase('idle'); } setError(paymentError(err)); }
  }, [config, finish, remember]);
  useEffect(() => {
    if (!pendingKey) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try { const value = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); if (value?.hash?.match(/^0x[0-9a-f]{64}$/i) && Array.isArray(value.lines) && value.buyer) { pending.current = value; checkPending(value); } } catch { /* Storage is optional. */ }
    });
    return () => { active = false; };
  }, [pendingKey, checkPending]);
  const quoteKey = JSON.stringify(bag.lines) + config?.marketAddress + ':' + refresh;
  const quote = quoteState?.key === quoteKey ? quoteState.quote : null;
  const quoteError = quoteState?.key === quoteKey ? quoteState.error : '';
  useEffect(() => {
    if (!config?.enabled || !bag.lines.length) return;
    let active = true;
    quoteBag(config, bag.lines).then(value => { if (active) setQuoteState({ key: quoteKey, quote: value }); }).catch(err => { if (active) setQuoteState({ key: quoteKey, error: paymentError(err) }); });
    return () => { active = false; };
  }, [quoteKey, config, bag.lines]);
  async function confirm() {
    if (!wallet.address) { setWalletOpen(true); return; }
    if (wallet.wrongNetwork) { await wallet.switchNetwork(); return; }
    if (!quote || phase !== 'idle') return;
    const purchased = bag.lines.map(line => ({ ...line }));
    setError(''); setPhase('wallet');
    let submitted = false;
    try {
      const result = await purchase(config, wallet.provider.current, wallet.address, quote, tx => { submitted = true; remember({ hash: tx, buyer: wallet.address, lines: purchased }); setHash(tx); setPhase('pending'); });
      finish(result, purchased); wallet.refresh().catch(() => {});
    } catch (err) { if (!submitted || err.code === 'CALL_EXCEPTION') { remember(null); setPhase('idle'); setError(paymentError(err)); } else { setPhase('pending'); setError('Your transaction was submitted. Check its status before placing another order.'); } }
  }
  if (receipt) return <section className="section-wrap confirmation"><div className="confirmation-symbol"><Icon name="check" size={38} /></div><p className="eyebrow">A NEW CHAPTER FOR YOUR WARDROBE</p><h1>It’s yours<em>.</em></h1><p>Your wallet purchase is confirmed. {receipt.units} digital {receipt.units === 1 ? 'passport has' : 'passports have'} been minted to <strong>{shortAddress(receipt.buyer)}</strong>.</p><div className="confirmed-receipt"><span>On-chain order <strong>#{receipt.orderId}</strong></span><span>Network <strong>{config.chainName}</strong></span><span>Transaction <code>{receipt.hash}</code></span></div><Link className="button dark" href={'/account?order=' + receipt.orderId}>Open my wardrobe <Icon name="hanger" size={18} /></Link><Link className="underlined" href="/shop">Find your next favourite</Link><p className="small-note">Sample collection · test-network digital receipt. Physical shipping is not enabled.</p></section>;
  if (!bag.lines.length && phase !== 'pending') return <section className="section-wrap"><div className="empty-state"><Icon name="bag" size={42} /><h1>Your next favourite is waiting.</h1><p>Add a piece to your bag before checking out.</p><Link className="button dark" href="/shop">Explore the collection</Link></div></section>;
  const busy = phase === 'wallet' || phase === 'pending';
  return <section className="section-wrap checkout-page"><div className="breadcrumb"><Link href="/shop">The collection</Link><span>/</span><span>Checkout</span></div><div className="page-intro"><p className="eyebrow">YOUR KEYS. YOUR PIECES.</p><h1>A little closer to <em>yours.</em></h1><p>Review your edit. Connect your wallet. Own the story.</p></div><div className="checkout-layout"><div><div className="checkout-section"><div className="checkout-section-title"><h2>Your edit <span>({bag.lines.reduce((n, line) => n + line.quantity, 0)} {bag.lines.reduce((n, line) => n + line.quantity, 0) === 1 ? 'piece' : 'pieces'})</span></h2><button className="underlined" onClick={() => setBagOpen(true)} disabled={busy}>Edit bag</button></div>{bag.lines.map(line => { const p = productBySku(line.sku); const item = quote?.lines.find(q => q.sku === line.sku && q.size === line.size); return <article className="checkout-line" key={line.sku + line.size}><Link href={'/products/' + line.sku} className="checkout-photo"><Image src={p.image} alt={p.name} fill sizes="100px" /></Link><div><Link href={'/products/' + line.sku}><h3>{p.name}</h3></Link><p>{p.color} · {line.size} · Qty {line.quantity}</p><span className="passport-included"><Icon name="shield" size={13} /> Digital passport included</span></div><strong>{item ? cryptoAmount(item.price * BigInt(item.quantity)) + ' ' + config.currency : formatPrice(p.price * line.quantity)}</strong></article>; })}</div><div className="checkout-section"><h2>Your wallet</h2><div className="checkout-wallet"><div className="wallet-emblem"><Icon name="wallet" /></div><div><strong>{wallet.address ? shortAddress(wallet.address) : 'A wardrobe without a password.'}</strong><p>{wallet.address ? wallet.wrongNetwork ? 'Switch to the collection network to continue.' : config?.chainName + ' · ' + Number(wallet.balance || 0).toFixed(4) + ' ' + config?.currency : 'Your wallet holds your purchase receipts and product passports.'}</p></div><button className="underlined" onClick={() => setWalletOpen(true)}>{wallet.address ? 'Manage' : 'Connect'}</button></div>{wallet.error && <p className="inline-error" role="alert">{wallet.error}</p>}</div><div className="checkout-privacy"><Icon name="shield" size={22} /><div><h3>Only what belongs on-chain.</h3><p>Your wallet address and digital purchase are public. No shipping address, email, or personal delivery details are collected or written to the blockchain.</p></div></div></div><aside className="order-summary"><p className="eyebrow">THE FINAL DETAILS</p><h2>Order summary</h2><div className="summary-line"><span>Catalog reference</span><span>{formatPrice(bagTotal(bag.lines))}</span></div><div className="summary-line"><span>Wallet subtotal</span><strong>{quote ? cryptoAmount(quote.total) + ' ' + config.currency : config?.enabled ? 'Fetching on-chain quote…' : 'Not available'}</strong></div><div className="summary-line"><span>Product passports</span><span>Included</span></div><div className="summary-line"><span>Network fee</span><span>Shown in your wallet</span></div><div className="summary-total"><span>Pay from your wallet</span><strong>{quote ? cryptoAmount(quote.total) + ' ' + config.currency : '—'}</strong></div><p className="small-note">Wallet prices are independently set on-chain, not converted from the INR catalog. Review the exact total and network fee in your wallet.</p>{config?.testnet && <div className="checkout-demo"><Icon name="globe" size={17} /><span>{config.chainName} · test currency<br />No physical delivery for this sample collection.</span></div>}{quoteError && <p className="inline-error" role="alert">{quoteError}</p>}{!config?.enabled && <p className="inline-error">Wallet checkout has not been enabled for this collection.</p>}{error && <p className="inline-error" role="alert">{error}</p>}<button className="button dark full-width" disabled={busy || !config?.enabled || (!!wallet.address && !wallet.wrongNetwork && !quote)} onClick={confirm}>{phase === 'wallet' ? 'Confirm in your wallet…' : phase === 'pending' ? 'Confirming on-chain…' : !wallet.address ? 'Connect wallet to continue' : wallet.wrongNetwork ? 'Switch to ' + config?.chainName : 'Confirm wallet purchase'}<Icon name="wallet" size={17} /></button>{phase === 'pending' && error && <button className="text-button refresh-quote" onClick={() => checkPending(pending.current)}>Check transaction status</button>}{!busy && config?.enabled && <button className="text-button refresh-quote" onClick={() => { setError(''); setRefresh(refresh + 1); }}>Refresh on-chain quote</button>}{hash && <div className="tx-status" role="status"><span>{phase === 'pending' ? 'Transaction submitted' : 'Latest transaction'}</span><code>{hash}</code>{config?.explorerUrl && <a href={config.explorerUrl.replace(/\/$/, '') + '/tx/' + hash} target="_blank" rel="noreferrer">View transaction</a>}</div>}<p className="secure-caption"><Icon name="shield" size={14} /> Nothing is charged until you approve in your wallet.</p></aside></div></section>;
}
