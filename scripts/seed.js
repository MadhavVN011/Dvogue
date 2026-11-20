import { ContractFactory, id, parseEther } from 'ethers';
import { compileContracts } from './compile.js';
import { products, productMetadata } from '../lib/catalog.js';
import { variantKey } from '../lib/chain-config.js';
export async function seedCollection(signer, baseURL = 'http://localhost:3000') {
  const artifacts = await compileContracts();
  const registry = await new ContractFactory(artifacts.DvogueRegistry.abi, artifacts.DvogueRegistry.bytecode, signer).deploy();
  await registry.waitForDeployment();
  const market = await new ContractFactory(artifacts.DvogueMarket.abi, artifacts.DvogueMarket.bytecode, signer).deploy(await registry.getAddress());
  await market.waitForDeployment();
  const base = new URL(baseURL);
  for (const product of products) {
    const key = id(product.sku);
    const metadataURI = new URL('/api/products/' + product.sku, base).href;
    await (await registry.registerProduct(key, id(JSON.stringify(productMetadata(product))), metadataURI)).wait();
    // These are sample issuer attestations, not third-party certifications.
    for (let stage = 1; stage <= 3; stage++) await (await registry.addCheckpoint(key, stage, id(product.sku + ':sample:' + stage))).wait();
    const passportURI = new URL('/api/passports/' + product.sku, base).href;
    for (const size of product.sizes) await (await market.setListing(id(variantKey(product.sku, size)), key, parseEther(product.cryptoPrice), 12, passportURI)).wait();
  }
  return { registryAddress: await registry.getAddress(), marketAddress: await market.getAddress() };
}
