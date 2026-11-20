import assert from 'node:assert/strict';
import { ContractFactory, id } from 'ethers';
import solc from 'solc';
import { compileContracts } from '../scripts/compile.js';
import { quoteBag, purchase, readWardrobe } from '../lib/commerce.js';
import { variantKey } from '../lib/chain-config.js';
export async function runMarketTests({ chain, registry, owner, buyer, product }) {
  const artifacts = await compileContracts();
  const market = await new ContractFactory(artifacts.DvogueMarket.abi, artifacts.DvogueMarket.bytecode, owner).deploy(await registry.getAddress());
  await market.waitForDeployment();
  const buyerAddress = await buyer.getAddress();
  const recipientAddress = await (await chain.provider.getSigner(2)).getAddress();
  const sku = id(product.sku), variant = id(variantKey(product.sku, 'M'));
  const passportURI = 'http://localhost:3000/api/passports/' + product.sku;
  const expectRevert = action => assert.rejects(async () => { const tx = await action(); await tx.wait(); });
  await expectRevert(() => market.connect(buyer).setListing(variant, sku, 1000n, 3, passportURI));
  await expectRevert(() => market.setListing(variant, id('missing'), 1000n, 3, passportURI));
  await expectRevert(() => market.setListing(variant, sku, 0n, 3, passportURI));
  await (await market.setListing(variant, sku, 1000n, 3, passportURI)).wait();
  await assert.rejects(market.quote([], []));
  await assert.rejects(market.quote([variant, variant], [1, 1]));
  await assert.rejects(market.quote([variant], [0]));
  await assert.rejects(market.quote([variant], [4]));
  await assert.rejects(market.quote([variant], [11]));
  await assert.rejects(market.quote([variant], []));
  await expectRevert(() => market.connect(buyer).buy([variant], [1], [], { value: 1000n }));
  await expectRevert(() => market.connect(buyer).buy([variant], [1], [1000n], { value: 999n }));
  await expectRevert(() => market.connect(buyer).buy([variant], [1], [1000n], { value: 1001n }));
  await expectRevert(() => market.connect(buyer).buy([variant], [1], [999n], { value: 1000n }));
  await (await market.connect(buyer).buy([variant], [2], [1000n], { value: 2000n })).wait();
  assert.equal(await market.orderCount(), 1n);
  assert.equal(await market.orderCountOf(buyerAddress), 1n);
  assert.equal(await market.balanceOf(buyerAddress), 2n);
  assert.equal(await market.ownerOf(1), buyerAddress);
  assert.equal((await market.getListing(variant)).stock, 1n);
  assert.equal((await market.orders(1)).total, 2000n);
  assert.equal((await market.getOrderLines(1))[0].unitPrice, 1000n);
  assert.equal(await market.tokenURI(1), passportURI);
  await (await market.setListing(variant, sku, 2000n, 2, passportURI + '?version=2')).wait();
  assert.equal(await market.tokenURI(1), passportURI, 'A sold passport URI must not change with its listing');
  await expectRevert(() => market.connect(buyer).buy([variant], [1], [1000n], { value: 2000n }));
  await (await market.connect(buyer).transferFrom(buyerAddress, recipientAddress, 1)).wait();
  assert.equal(await market.ownerOf(1), recipientAddress);
  await expectRevert(() => market.connect(buyer).withdraw());
  await (await market.withdraw()).wait();
  assert.equal(await chain.provider.getBalance(await market.getAddress()), 0n);
  const config = { enabled: true, rpcUrl: chain.url, chainId: '31337', registryAddress: await registry.getAddress(), marketAddress: await market.getAddress() };
  const quote = await quoteBag(config, [{ sku: product.sku, size: 'M', quantity: 1 }]);
  assert.equal(quote.total, 2000n);
  const injected = { request: ({ method, params }) => chain.provider.send(method, params || []) };
  let submitted = '';
  const result = await purchase(config, injected, buyerAddress, quote, hash => { submitted = hash; });
  assert.equal(result.orderId, '2'); assert.equal(result.hash, submitted);
  const wardrobe = await readWardrobe(config, buyerAddress);
  assert.equal(wardrobe.orderCount, 2); assert.equal(wardrobe.tokenCount, 2);
  const recipientWardrobe = await readWardrobe(config, recipientAddress);
  assert.equal(recipientWardrobe.tokenCount, 1); assert.equal(recipientWardrobe.orderCount, 0);
  const source = `pragma solidity ^0.8.39;
  interface IMarket { function buy(bytes32[] calldata,uint256[] calldata,uint256[] calldata) external payable returns(uint256); }
  contract ReceiverProbe {
    IMarket market; bool public blocked; bool rejecting; bytes32 variant;
    constructor(address m,bytes32 v,bool r) payable {market=IMarket(m);variant=v;rejecting=r;}
    function start() external payable {bytes32[] memory v=new bytes32[](1);v[0]=variant;uint256[] memory q=new uint256[](1);q[0]=1;uint256[] memory p=new uint256[](1);p[0]=2000;market.buy{value:msg.value}(v,q,p);}
    function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4) {
      require(!rejecting);bytes32[] memory v=new bytes32[](1);v[0]=variant;uint256[] memory q=new uint256[](1);q[0]=1;uint256[] memory p=new uint256[](1);p[0]=2000;
      try market.buy{value:2000}(v,q,p) {blocked=false;} catch(bytes memory reason) {blocked=bytes4(reason)==bytes4(keccak256('ReentrancyGuardReentrantCall()'));}
      return bytes4(keccak256('onERC721Received(address,address,uint256,bytes)'));
    }
  }`;
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'Probe.sol': { content: source } }, settings: { evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
  const probeArtifact = output.contracts['Probe.sol'].ReceiverProbe;
  const factory = new ContractFactory(probeArtifact.abi, '0x' + probeArtifact.evm.bytecode.object, owner);
  await (await market.setListing(variant, sku, 2000n, 3, passportURI)).wait();
  const probe = await factory.deploy(await market.getAddress(), variant, false, { value: 2000n }); await probe.waitForDeployment();
  await (await probe.start({ value: 2000n })).wait(); assert.equal(await probe.blocked(), true);
  const rejected = await factory.deploy(await market.getAddress(), variant, true); await rejected.waitForDeployment();
  const beforeOrders = await market.orderCount(), beforeStock = (await market.getListing(variant)).stock;
  await expectRevert(() => rejected.start({ value: 2000n }));
  assert.equal(await market.orderCount(), beforeOrders); assert.equal((await market.getListing(variant)).stock, beforeStock);
  console.log('PASS: checkout, exact prices, inventory, ERC721 ownership/transfers, URI snapshots, withdrawals, on-chain wardrobe, reentrancy guard and atomic rollback.');
}
