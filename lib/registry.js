import { productMetadata } from './catalog.js';

export async function verifyProduct(product, config) {
  const address = config?.registryAddress || process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const rpc = config?.rpcUrl || process.env.NEXT_PUBLIC_RPC_URL;
  if (!address || !rpc) return { matched: false, message: 'On-chain records are not enabled for this sample collection yet.' };
  const { Contract, JsonRpcProvider, FetchRequest, id, isAddress } = await import('ethers');
  if (!isAddress(address)) throw new Error('The product registry is not configured correctly.');
  const request = new FetchRequest(rpc);
  request.timeout = 7000;
  const provider = new JsonRpcProvider(request, undefined, { batchMaxCount: 1 });
  let timer;
  try {
    return await Promise.race([(async () => {
      const network = await provider.getNetwork();
      const expectedChain = config?.chainId || process.env.NEXT_PUBLIC_CHAIN_ID;
      if (expectedChain && network.chainId !== BigInt(expectedChain)) throw new Error('The registry network does not match this collection.');
      if (await provider.getCode(address) === '0x') throw new Error('No product registry was found at the configured address.');
      const registry = new Contract(address, [
        'function getProduct(bytes32) view returns (tuple(bytes32 metadataHash,string metadataURI,uint64 registeredAt,uint8 stage))',
        'function owner() view returns (address)',
      ], provider);
      const [record, issuer] = await Promise.all([registry.getProduct(id(product.sku)), registry.owner()]);
      const matched = record.metadataHash === id(JSON.stringify(productMetadata(product)));
      return { matched, issuer, stage: Number(record.stage), message: matched ? 'The catalog details match the issuer’s on-chain record.' : 'The current catalog does not match the registered product details.' };
    })(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Unable to reach the registry. Please try again later.')), 8000); })]);
  } catch (error) {
    if (error.code === 'CALL_EXCEPTION') return { matched: false, message: 'This piece does not have a record in the selected registry.' };
    throw new Error(error.message?.startsWith('The ') || error.message?.startsWith('No product') ? error.message : 'Unable to reach the registry. Please try again later.');
  } finally { clearTimeout(timer); provider.destroy(); }
}
