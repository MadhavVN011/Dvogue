# Public demo deployment

[Back to the project](../README.md) · [Development guide](DEVELOPMENT.md)

The public storefront is hosted at **https://dvogue.vercel.app** and connected to Etherscan-verified contracts on **Sepolia** (chain ID 11155111). The addresses are listed in the [README](../README.md#sepolia-deployment), and the hosted `/api/network` reports checkout enabled.

The steps below record how that deployment was made, so it can be repeated on another testnet or after a contract change.

> **Public RPC note:** free load-balanced RPC endpoints can briefly answer from a node one block behind. On public networks the deploy script checks on-chain state before every step, tracks transaction nonces itself, and retries a step that fails for that reason, so a lagging node slows the run down rather than stopping it.

## Prerequisites

- A hosting account that supports Next.js server routes, such as Vercel.
- A separate development wallet with native test currency on a public EVM testnet that supports the Cancun EVM target.
- A public HTTPS RPC endpoint reachable by browsers, without embedded secrets and with appropriate cross-origin support.
- The testnet's numeric chain ID, currency symbol and explorer URL.

Choose a current application-development testnet from the [Ethereum network documentation](https://ethereum.org/en/developers/docs/networks/). Do not use a validator-only test network. No mainnet deployment or real currency is needed for a portfolio demo.

## 1. Host the storefront

Import this GitHub repository into a Next.js-compatible hosting account. Use Node.js 24, install with `npm ci`, and build with `npm run build`. Keep the Next.js framework preset and its server routes; this app is not a static export.

Initially, leave blockchain address settings unset. Visitors can browse the collection while checkout stays unavailable. Obtain the final public HTTPS origin before deploying contracts so their metadata URIs point to the correct site.

For Vercel, follow the [official Next.js deployment guide](https://nextjs.org/docs/app/getting-started/deploying). The repo does not include a hosting token or automatically provision an account.

### Release gates

The hosted project uses two Vercel deployment checks. Together they hold back each new production deployment from `dvogue.vercel.app` until it passes:

| Check | Source | What it verifies |
| --- | --- | --- |
| `Lint, contracts, build and browsers` | [CI workflow](../.github/workflows/ci.yml), on every push | Lint, domain and contract tests, production build, desktop/mobile browser flows, dependency audit |
| `Vercel - dvogue: smoke (production)` | [Smoke workflow](../.github/workflows/smoke.yml), on Vercel's `vercel.deployment.ready` event | The deployment itself: pages render, `/api/network` is enabled for chain 11155111, and both contracts exist and are linked ([scripts/smoke.js](../scripts/smoke.js)) |

The smoke workflow needs the `VERCEL_AUTOMATION_BYPASS_SECRET` Actions secret, because unique deployment URLs sit behind Vercel Deployment Protection. Create it in Vercel under **Settings → Deployment Protection → Protection Bypass for Automation**. If you rename either job or status, update the matching check (`vercel project checks`); otherwise production deployments wait for a check that never arrives. To run the smoke test against any deployment, use `SMOKE_URL=https://dvogue.vercel.app npm run smoke`.

## 2. Prepare a local testnet deployment

Copy `.env.example` to ignored `.env.local`. Set these values locally:

| Variable | Value |
| --- | --- |
| `DEPLOY_RPC_URL` | RPC endpoint for the chosen public testnet |
| `DEPLOYER_PRIVATE_KEY` | Dedicated funded testnet wallet key, configured locally only |
| `CATALOG_BASE_URL` | Final public HTTPS storefront origin |

Keep the key out of Git, command arguments, screenshots, chat and hosted frontend configuration. The hosting service does not need the deployment key. Use a wallet dedicated to test networks.

Run:

```sh
npm ci
npm run check
npm run contracts:deploy
```

The deploy script compiles both contracts, deploys the registry and marketplace, registers ten illustrative products, and stocks all size variants. It sends about 80 transactions and needs enough native test currency for deployment and seeding. On public networks it prints each contract address as soon as that contract is deployed, followed by one line per completed step.

If a run stops partway, for example because the deployer ran out of test currency, resume it instead of starting over. Add the printed addresses to `.env.local` and run the same command again:

```dotenv
DEPLOY_REGISTRY_ADDRESS=<printed registry address>
DEPLOY_MARKET_ADDRESS=<printed marketplace address>
```

Every step that is already on-chain is skipped, so only the missing registrations, checkpoints and listings are sent. Existing listings keep their current stock. Remove both lines afterwards so the next fresh deployment does not reuse them.

For external networks, the script prints public contract addresses and chain ID. It does not write these into the local auto-deployment file or update hosted configuration automatically. The deployer becomes the registry and marketplace owner.

## 3. Configure the hosted app

Set these public runtime values in the hosting account, then redeploy/restart as required by the provider:

```dotenv
DVOGUE_CHAIN_ID=<numeric-testnet-chain-id>
DVOGUE_CHAIN_NAME=<testnet-name>
DVOGUE_CURRENCY=<native-currency-symbol>
DVOGUE_RPC_URL=<public-https-rpc>
DVOGUE_REGISTRY_ADDRESS=<deployed-registry-address>
DVOGUE_MARKET_ADDRESS=<deployed-market-address>
DVOGUE_EXPLORER_URL=<https-explorer-origin>
DVOGUE_TESTNET=true
```

These values are returned by `/api/network` and are public. Do not use a private RPC credential here. The app-hosted metadata endpoints must remain public and reachable. The ignored `.dvogue/deployment.json` belongs to local development and should not be uploaded.

## 4. Verify contract source on the explorer

Compile from the same commit and locked dependencies used for deployment:

```sh
npm run contracts:compile
```

Use the compiler's complete version from the generated artifact, optimizer enabled with **200 runs**, EVM target **Cancun**, and the generated **`artifacts/solc-input.json`** as the Standard JSON input. This file includes the project's contracts and their imported OpenZeppelin sources, so the explorer does not need to fetch package imports.

| Contract | Fully qualified name | Constructor arguments |
| --- | --- | --- |
| Registry | `DvogueRegistry.sol:DvogueRegistry` | None |
| Marketplace | `DvogueMarket.sol:DvogueMarket` | The deployed registry address |

Follow the chosen explorer's Standard JSON verification flow and provide the marketplace's ABI-encoded registry address if requested. Compiler input is generated and ignored by Git; contract source and pinned dependencies remain tracked. A successful local compilation is not proof that an explorer has verified a public deployment.

## 5. Validate using a real wallet

Check the deployed flow in an actual wallet extension or wallet browser:

1. Open `/api/network` and verify the public chain and both addresses.
2. Confirm explorer source verification and the market's linked registry.
3. Connect the development wallet and approve the requested testnet switch.
4. Check a product's metadata digest against the registry.
5. Decline a payment once; the bag should remain intact.
6. Approve a small test purchase; confirm the receipt and `OrderPlaced` event on the explorer.
7. Open My wardrobe and inspect the minted ERC-721 passport and original order history.
8. Transfer a passport with a compatible wallet/tool and check the recipient's ownership display.

Automated browser checks use a test adapter; complete this manual check before describing the project as tested with a real wallet extension on a public network.

## 6. Update the portfolio evidence

After the deployed flow works, add the live URL, network, contract addresses and verified explorer links to the README. Record a new walkthrough and distinguish it from the local-adapter recording. A short dated deployment record can include the commit SHA, compiler version and owner public address, without private credentials.

The demo remains a single-merchant prototype even after public hosting. Physical fulfilment, escrow, refunds, seller onboarding and independent contract auditing remain outside the implemented scope.
