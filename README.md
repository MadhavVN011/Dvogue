# Dvogue

A fashion storefront with wallet checkout, on-chain purchase receipts, and transferable ERC-721 product passports. The editorial home page leads into collections, product pages, size guides, a wishlist, a persistent shopping bag, checkout, and a wallet-owned wardrobe. Search, category/type/size/price filters, and price sorting work on desktop and mobile.

This is a working development-chain demonstration. The ten products, photography, maker names, and provenance claims are illustrative sample content. Purchases on the local chain use test currency and create digital receipts and passports. Physical sales, shipping, returns, and refunds are not implemented. INR catalog prices and fixed on-chain ETH prices are independent; there is no live exchange-rate conversion.

## Run locally

Use Node.js 24 LTS (`.nvmrc`) and npm. Browsing does not require a wallet or blockchain service.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>. For a production preview, run `npm run build` and `npm start`.

## Enable local wallet checkout

In a separate terminal, start the temporary local chain:

```sh
npm run contracts:node
```

Then deploy and seed the collection:

```sh
npm run contracts:deploy
```

The deployment registers all ten products, adds sample issuer checkpoints, and stocks every size variant with twelve units. Public deployment settings are saved in the ignored `.dvogue/deployment.json`; `/api/network` supplies them to the storefront without needing a rebuild. Reload a previously open browser tab after deployment.

Connect an Ethereum-compatible browser wallet using **Connect wallet**. The app discovers EIP-6963 providers and supports the injected `window.ethereum` fallback. Checkout can request a network switch or add the local network:

| Setting | Value |
| --- | --- |
| Network | Dvogue Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency | `ETH` (local test currency only) |

Use a separate development wallet. To give its public address ten local test ETH, run:

```sh
npm run wallet:fund -- <your-development-wallet-address>
```

The funding helper only connects to the loopback development RPC and requires chain ID 31337. Alternatively, import a funded **test account** from the Anvil startup output. These publicly known test keys must never hold real assets. Dvogue never asks for a private key or recovery phrase. Connecting a wallet does not sign a payment. A localhost RPC is reachable only from the same computer; a phone requires a deliberately configured reachable development RPC.

Choose a piece and size, add it to the bag, and open checkout. The total is read from the contract. Approve the purchase in your wallet; confirmation appears only after an on-chain receipt verifies the buyer and marketplace event. Each purchased unit mints a passport. **My wardrobe** reads current passport ownership and original purchase history from the chain. Rejected requests keep the bag. Submitted transactions are remembered in the browser session so checkout can check their status after a reload instead of immediately sending another payment.

Anvil state is temporary. After restarting the chain, deploy again and reload the storefront. Existing local transaction hashes and passports belong to the old chain state.

## Contract behavior and trust

- `DvogueRegistry` stores issuer-controlled metadata hashes, URIs, and ordered provenance checkpoints. **Check on-chain record** compares the canonical `/api/products/[sku]` metadata with the registered digest. A match verifies what an issuer registered; it does not certify ethical sourcing or physical authenticity.
- `DvogueMarket` checks current stock, the exact unit prices reviewed, and the exact native-currency payment. Orders allow up to twenty units and ten units per variant. Purchases update stock atomically, record order lines, and mint OpenZeppelin ERC-721 enumerable passports. Reentrancy protection covers purchases, stock updates, and withdrawals.
- Only the contract owner manages listings, registry attestations, and withdrawals. Sale proceeds remain in the market until the owner withdraws. This is not escrow, and there is no automatic refund or dispute process.
- A token's metadata URI is captured at issuance. Metadata and images currently live on the app and are not immutable/IPFS-pinned content. Transferring a passport changes the current owner's wardrobe; the purchase receipt stays with the original buyer. Token transfers do not transfer a physical product.

Settlement, orders, and passport ownership run on-chain. Frontend hosting, catalog metadata, and issuer claims remain centrally managed. This is a hybrid application; it does not provide decentralised fulfilment or an SSI authentication system. Contracts have automated development tests, not an independent security audit.

## Checks

```sh
npm run lint
npm test
npm run build
npm run test:browser
npm audit
```

`npm test` checks catalog/bag validation and starts an isolated Anvil chain on a temporary port. It compiles and deploys both contracts, exercises access control, bad registrations, checkpoint ordering, metadata mismatches, exact payments, price changes, inventory, token ownership/transfers, URI snapshots, withdrawals, atomic mint rollback, reentrancy protection, and client wardrobe/checkout reads. The test chain stops afterwards. Solidity targets Cancun.

Build before running browser tests. They start their own disposable, seeded blockchain and production server on port 3173, leaving the preview chain untouched. Desktop and mobile Chrome tests cover collection navigation and filtering, search, size guides, provenance, wishlist and bag persistence, blocked storage, missing/rejected wallets, network switching, rejected and successful wallet purchases, receipt recovery, and on-chain wardrobe/history. A test wallet adapter forwards transactions to the disposable chain; it does not automate a real wallet extension. An installed Chrome/Chromium is detected on Linux; otherwise run `npx playwright install chromium` or set `CHROMIUM_EXECUTABLE_PATH`.

The former Hardhat/Waffle crowdfunding scaffold has been replaced by Solidity, Anvil, ethers, and OpenZeppelin. No crowdfunding artifacts, external RPC credentials, or real funds are needed for tests.

## Optional external configuration

`.env.example` documents the public `DVOGUE_*` network settings served by `/api/network`. These values are visible to browsers; use a public browser-accessible RPC endpoint without embedded secrets. Restart the server after environment changes. `DVOGUE_TESTNET` defaults to `true`.

For an intentional external deployment, set `DEPLOY_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `CATALOG_BASE_URL` in ignored `.env.local`, then run `npm run contracts:deploy`. External deployment settings are printed and must be explicitly configured; the script only automatically writes local-chain settings. Never expose a deployment private key through public configuration or a `NEXT_PUBLIC_` variable. This repository does not automatically deploy to a public network. Complete the necessary production security, fulfilment, and operational work before considering real purchases.

## Layout

- `app/` — storefront routes, styles, public network/product/passport metadata endpoints.
- `components/` — shopping UI, dialogs, wallet discovery/events, bag and wishlist persistence.
- `lib/` — catalog, validation, metadata verification, chain queries and checkout.
- `contracts/` — provenance registry and ERC-721 marketplace.
- `scripts/` — compiler, deployment/seeding, temporary development chain helper.
- `test.js`, `tests/` — contract/domain and desktop/mobile browser checks.
- `public/images/` — local illustrative photography; sources in `ATTRIBUTION.txt`.

The original NEXUS presentation is retained as project context. Underlying references: [Next.js](https://nextjs.org/docs), [Solidity compiler](https://docs.soliditylang.org/en/latest/using-the-compiler.html), [Anvil](https://www.getfoundry.sh/anvil), [OpenZeppelin ERC-721](https://docs.openzeppelin.com/contracts/5.x/api/token/erc721), [wallet discovery](https://eips.ethereum.org/EIPS/eip-6963).
