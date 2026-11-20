import { Contract, ContractFactory, getCreateAddress, id, parseEther } from 'ethers';
import { compileContracts } from './compile.js';
import { products, productMetadata } from '../lib/catalog.js';
import { variantKey } from '../lib/chain-config.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Errors that waiting cannot fix, such as an unfunded deployer, fail immediately instead of retrying.
const FATAL = new Set(['INSUFFICIENT_FUNDS', 'INVALID_ARGUMENT', 'UNSUPPORTED_OPERATION', 'ACTION_REJECTED']);

/**
 * Deploys (or resumes) the registry and marketplace, then registers and stocks the sample collection.
 * Every step first checks on-chain state and is skipped when already done, so a failed run can be
 * resumed by passing the addresses it printed. On public networks, load-balanced RPC endpoints can
 * briefly answer from a node one block behind; failed steps are re-checked and retried, and nonces
 * are tracked locally instead of trusting a possibly stale node.
 */
export async function seedCollection(signer, baseURL = 'http://localhost:3000', { registryAddress, marketAddress, log = () => {} } = {}) {
  const provider = signer.provider;
  const from = await signer.getAddress();
  const local = (await provider.getNetwork()).chainId === 31337n;
  const attempts = local ? 1 : 8;
  const retryDelay = 6000;
  const artifacts = await compileContracts();

  // Highest confirmed nonce seen across a few reads, since a lagging node may report an older one.
  const confirmedNonce = async () => {
    let nonce = 0;
    for (let read = 0; read < (local ? 1 : 3); read++) nonce = Math.max(nonce, await provider.getTransactionCount(from, 'latest'));
    return nonce;
  };
  let nonce = await confirmedNonce();
  let sent = 0;

  // Runs one transaction when `needed()` reports it is still missing on-chain.
  async function step(label, needed, send) {
    for (let attempt = 1; ; attempt++) {
      try {
        if (!(await needed())) return;
        const tx = await send({ nonce });
        nonce++;
        const receipt = await tx.wait(1, 180_000);
        if (receipt?.status !== 1) throw new Error('Transaction reverted: ' + label);
        sent++;
        log('ok  ' + label);
        return;
      } catch (error) {
        if (attempt >= attempts || FATAL.has(error.code)) throw error;
        log('retry ' + attempt + ' ' + label + ': ' + (error.shortMessage || error.message).slice(0, 100));
        await sleep(retryDelay);
        nonce = await confirmedNonce();
      }
    }
  }

  async function deploy(label, artifact, args, existing) {
    let address = existing;
    const hasCode = async () => !!address && (await provider.getCode(address)) !== '0x';
    if (existing && !(await hasCode())) throw new Error(label + ' has no contract code at ' + existing + '.');
    await step('deploy ' + label, async () => !(await hasCode()), async overrides => {
      address = getCreateAddress({ from, nonce: overrides.nonce });
      const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args, overrides);
      return contract.deploymentTransaction();
    });
    if (!existing) log(label + ' address: ' + address);
    return address;
  }

  const registryAt = await deploy('DvogueRegistry', artifacts.DvogueRegistry, [], registryAddress);
  const marketAt = await deploy('DvogueMarket', artifacts.DvogueMarket, [registryAt], marketAddress);
  const registry = new Contract(registryAt, artifacts.DvogueRegistry.abi, signer);
  const market = new Contract(marketAt, artifacts.DvogueMarket.abi, signer);
  const registered = async key => { try { return await registry.getProduct(key); } catch { return null; } };

  const base = new URL(baseURL);
  for (const product of products) {
    const key = id(product.sku);
    const metadataURI = new URL('/api/products/' + product.sku, base).href;
    await step(product.sku + ' register', async () => !(await registered(key)),
      overrides => registry.registerProduct(key, id(JSON.stringify(productMetadata(product))), metadataURI, overrides));
    // These are sample issuer attestations, not third-party certifications.
    for (let stage = 1; stage <= 3; stage++) {
      await step(product.sku + ' checkpoint ' + stage, async () => {
        const current = await registered(key);
        if (!current) throw new Error('Product not visible yet: ' + product.sku);
        return Number(current.stage) < stage;
      }, overrides => registry.addCheckpoint(key, stage, id(product.sku + ':sample:' + stage), overrides));
    }
    const passportURI = new URL('/api/passports/' + product.sku, base).href;
    const price = parseEther(product.cryptoPrice);
    for (const size of product.sizes) {
      const variant = id(variantKey(product.sku, size));
      // An existing listing keeps its current stock, so a resumed run never restocks sold units.
      await step(product.sku + ' listing ' + size, async () => {
        const listing = await market.getListing(variant);
        return listing.productId !== key || listing.price !== price || listing.passportURI !== passportURI;
      }, overrides => market.setListing(variant, key, price, 12, passportURI, overrides));
    }
  }
  log('Seeding complete: ' + sent + ' new transaction' + (sent === 1 ? '' : 's') + '.');
  return { registryAddress: registryAt, marketAddress: marketAt };
}
