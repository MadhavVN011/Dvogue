# Development guide

[Back to the project](../README.md) · [Architecture](ARCHITECTURE.md) · [Public deployment](DEPLOYMENT.md)

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

The contract toolchain uses Solidity, Anvil, ethers and OpenZeppelin. External RPC credentials and real funds are not needed for tests.

## Recreate screenshots and walkthrough

Build the storefront, then run:

```sh
npm run build
npx playwright install ffmpeg
npm run demo:capture
```

The capture command requires Chrome/Chromium (or Playwright Chromium), the Playwright media binary installed above, and a system `ffmpeg` encoder. It creates its own seeded blockchain and a production preview on a free local port. It does not use your preview deployment or a real wallet. The browser follows product selection, provenance verification, checkout, receipt confirmation and wardrobe/history, then saves:

- `docs/images/` — seven desktop/mobile screenshots consumed by the README.
- `docs/demo/dvogue-walkthrough.mp4` — compressed walkthrough video.
- `.dvogue/recordings/` — ignored intermediate browser recordings.

Timed pauses only control the recording's reading pace; browser tests use assertions. The recording's wallet is a test EIP-1193 adapter; contract purchases are real transactions on the disposable development chain. Recordings are not evidence of a public deployment or a manual wallet-extension test.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests targeting `main` and can also be started manually. It uses Node.js from `.nvmrc`, pinned action revisions, `npm ci`, lint, contract/domain checks, a production build, bundled Chromium browser checks, and an audit for high/critical dependency findings. The workflow has read-only repository permissions and does not need secrets.

Browser tests use two workers in CI and produce an HTML report. Reports and failure traces are retained as run artifacts for seven days. Local tests can use installed Chrome; CI uses Playwright's installed Chromium unless an explicit executable override is supplied.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Browsing works but wallet checkout is unavailable | Start Anvil, deploy both contracts, and reload the tab so it fetches the new `/api/network` settings |
| Contracts disappeared after restarting Anvil | Redeploy; the chain is temporary and old local transaction references no longer apply |
| Wallet shows a different network | Approve switching to chain ID 31337; local test currency is separate from public networks |
| Wallet cannot afford a test purchase | Run the local funding helper with the development wallet's public address |
| A phone cannot reach the local RPC | A phone's loopback address is not your computer; use the app on the development computer or intentionally configure a reachable test RPC |
| Browser checks cannot launch Chromium | Install it using `npx playwright install chromium` or set `CHROMIUM_EXECUTABLE_PATH` |
| Checkout reports a stock or price change | Refresh the quote and review the current on-chain listing; the original quote does not reserve inventory |
| A submitted purchase has no confirmation yet | Check transaction status and wallet history before attempting another purchase |

The app hosts public product and NFT metadata under `/api/products/[sku]` and `/api/passports/[sku]`. It does not collect delivery information or store deployment keys. Image sources are listed in `public/images/ATTRIBUTION.txt`.
