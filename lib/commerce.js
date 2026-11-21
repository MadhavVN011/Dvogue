import { Contract, JsonRpcProvider, FetchRequest, BrowserProvider, Interface, id, formatEther } from 'ethers';
import { products } from './catalog.js';
import { marketABI, variantKey } from './chain-config.js';

export function describeVariant(key) {
  for (const product of products) for (const size of product.sizes) if (id(variantKey(product.sku, size)) === key) return { product, size };
  return null;
}
export function cryptoAmount(value) { return Number(formatEther(value)).toLocaleString('en-US', { maximumFractionDigits: 6 }); }
export async function readChain(config, action) {
  if (!config?.enabled) throw new Error('Wallet checkout is not available for this collection yet.');
  const request = new FetchRequest(config.rpcUrl); request.timeout = 6000;
  const provider = new JsonRpcProvider(request, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
  let timer;
  try {
    return await Promise.race([(async () => {
      if ((await provider.getNetwork()).chainId !== BigInt(config.chainId)) throw new Error('The collection network is unavailable.');
      if (await provider.getCode(config.marketAddress) === '0x') throw new Error('The collection contracts are not available on this network.');
      const market = new Contract(config.marketAddress, marketABI, provider);
      if ((await market.registry()).toLowerCase() !== config.registryAddress.toLowerCase()) throw new Error('The collection registry does not match the marketplace.');
      return action(market, provider);
    })(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The network is taking too long to respond. Please try again.')), 8000); })]);
  } finally { clearTimeout(timer); provider.destroy(); }
}
export async function quoteBag(config, lines) {
  if (!lines.length) throw new Error('Your bag is empty.');
  return readChain(config, async market => {
    const variants = lines.map(line => id(variantKey(line.sku, line.size)));
    const quantities = lines.map(line => line.quantity);
    const listings = await Promise.all(variants.map(variant => market.getListing(variant)));
    if (listings.some((listing, index) => listing.stock < BigInt(quantities[index]) || listing.price === 0n)) throw new Error('A size in your bag is no longer available. Please update your bag.');
    if (listings.some((listing, i) => listing.productId !== id(lines[i].sku))) throw new Error('A product listing does not match this collection.');
    if (quantities.reduce((sum, qty) => sum + qty, 0) > 20) throw new Error('Please keep wallet orders to 20 pieces or fewer.');
    const total = await market.quote(variants, quantities);
    return { lines: lines.map((line, i) => ({ ...line, price: listings[i].price, stock: Number(listings[i].stock) })), variants, quantities, prices: listings.map(listing => listing.price), total };
  });
}
export async function purchase(config, injected, address, quote, onSubmitted) {
  const provider = new BrowserProvider(injected, 'any');
  try {
    if ((await provider.getNetwork()).chainId !== BigInt(config.chainId)) throw new Error('Switch to the collection network before confirming.');
    const signer = await provider.getSigner(address);
    if ((await signer.getAddress()).toLowerCase() !== address.toLowerCase()) throw new Error('Your wallet account changed. Please review your order again.');
    const market = new Contract(config.marketAddress, marketABI, signer);
    const tx = await market.buy(quote.variants, quote.quantities, quote.prices, { value: quote.total });
    onSubmitted(tx.hash);
    let receipt;
    try { receipt = await tx.wait(); }
    catch (error) {
      if (error.code !== 'TRANSACTION_REPLACED') throw error;
      if (error.cancelled) { const cancelled = new Error('Your transaction was replaced or cancelled. Your bag has been kept.'); cancelled.code = 'CALL_EXCEPTION'; throw cancelled; }
      receipt = error.receipt;
      onSubmitted(receipt.hash);
    }
    return verifyPurchaseReceipt(config, receipt, address);
  } finally { provider.destroy(); }
}
export function verifyPurchaseReceipt(config, receipt, address) {
  if (receipt.status !== 1) { const error = new Error('The transaction did not complete. Your bag has been kept.'); error.code = 'CALL_EXCEPTION'; throw error; }
  const contractInterface = new Interface(marketABI);
  const placed = receipt.logs.filter(log => log.address.toLowerCase() === config.marketAddress.toLowerCase()).map(log => { try { return contractInterface.parseLog(log); } catch { return null; } }).find(event => event?.name === 'OrderPlaced');
  if (!placed || placed.args.buyer.toLowerCase() !== address.toLowerCase()) throw new Error('The order receipt could not be verified. Check your wallet activity.');
  return { hash: receipt.hash, orderId: placed.args.orderId.toString(), units: Number(placed.args.units), buyer: address };
}
export async function recoverPurchase(config, pending) {
  return readChain(config, async (_, provider) => {
    const receipt = await provider.getTransactionReceipt(pending.hash);
    return receipt ? verifyPurchaseReceipt(config, receipt, pending.buyer) : null;
  });
}
// Right after a purchase, a load-balanced public RPC can answer some of these parallel reads from a node
// one block behind, so a lookup of the newest order or passport reverts. A short retry lets it catch up.
export async function readWardrobe(config, address, offset = 0) {
  for (let attempt = 1; ; attempt++) {
    try { return await readWardrobeOnce(config, address, offset); }
    catch (error) {
      if (attempt >= 3 || !config?.enabled) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
async function readWardrobeOnce(config, address, offset) {
  return readChain(config, async market => {
    const [ordersTotal, passportTotal] = await Promise.all([market.orderCountOf(address), market.balanceOf(address)]);
    const orderCount = Number(ordersTotal), tokenCount = Number(passportTotal);
    const orders = await Promise.all(Array.from({ length: Math.max(0, Math.min(12, orderCount - offset)) }, async (_, i) => {
      const orderId = await market.orderIdAt(address, orderCount - 1 - offset - i);
      const [order, lines] = await Promise.all([market.orders(orderId), market.getOrderLines(orderId)]);
      return { id: orderId.toString(), total: order.total, timestamp: Number(order.placedAt), units: Number(order.units), lines: lines.map(line => ({ ...describeVariant(line.variantId), quantity: Number(line.quantity), price: line.unitPrice })) };
    }));
    const passports = await Promise.all(Array.from({ length: Math.max(0, Math.min(12, tokenCount - offset)) }, async (_, i) => {
      const tokenId = await market.tokenOfOwnerByIndex(address, offset + i);
      const [passport, uri] = await Promise.all([market.passports(tokenId), market.tokenURI(tokenId)]);
      return { id: tokenId.toString(), orderId: passport.orderId.toString(), uri, ...describeVariant(passport.variantId) };
    }));
    return { orders, passports, orderCount, tokenCount };
  });
}
export function paymentError(error) {
  const message = (error.shortMessage || error.message || '').toString();
  if (error.code === 4001 || error.code === 'ACTION_REJECTED') return 'Request cancelled in your wallet. Your bag is still here.';
  if (error.code === 'INSUFFICIENT_FUNDS') return 'Your wallet needs enough native currency for the order and network fees.';
  if (/PriceChanged/.test(message)) return 'A price changed. Refresh the quote and review the new total.';
  if (/Unavailable/.test(message)) return 'A selected size just sold out. Refresh your bag to continue.';
  if (/InvalidCart/.test(message)) return 'This bag cannot be checked out. Choose at most 20 pieces and remove duplicate lines.';
  if (/^The |^A |^Your |^Switch |^Please |^Wallet /.test(message)) return message;
  return 'Unable to complete this request. Check your wallet and network, then try again.';
}
