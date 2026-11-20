import { JsonRpcProvider, isAddress, parseEther } from 'ethers';
const address = process.argv[2];
if (!isAddress(address || '')) throw new Error('Usage: npm run wallet:fund -- <your development wallet address>');
// Fixed loopback endpoint. This helper is exclusively for the disposable local chain.
const provider = new JsonRpcProvider('http://127.0.0.1:8545', undefined, { cacheTimeout: -1 });
try {
  if ((await provider.getNetwork()).chainId !== 31337n) throw new Error('Refusing to fund an account outside the local development chain.');
  const signer = await provider.getSigner(0);
  await (await signer.sendTransaction({ to: address, value: parseEther('10') })).wait();
  console.log('Sent 10 local test ETH to ' + address + '. No real currency was transferred.');
} finally { provider.destroy(); }
