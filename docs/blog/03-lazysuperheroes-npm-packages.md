# @lazysuperheroes NPM Packages: The Full Toolkit

*Published by the Lazy Superheroes team*

---

Everything we build is open source and published under the `@lazysuperheroes` scope on npm. Below is the complete catalog of packages available today -- tools for minting, staking, trading, multisig operations, and more, all built for Hedera.

Install any package with:

```bash
npm install @lazysuperheroes/<package-name>
```

---

## NFT Minting Suite

Three packages that cover the full lifecycle of NFT minting on Hedera -- from contract ABIs to SDK utilities to a complete CLI.

| Package | Version | Description |
|---------|---------|-------------|
| [`@lazysuperheroes/hedera-minter-contracts`](https://www.npmjs.com/package/@lazysuperheroes/hedera-minter-contracts) | 1.0.0 | ABIs and Solidity sources for 10 minting contracts (MinterContract, SoulboundMinter, ForeverMinter, SoulboundBadgeMinter, EditionWithPrize, and supporting contracts). Zero runtime dependencies. |
| [`@lazysuperheroes/hedera-minter-sdk`](https://www.npmjs.com/package/@lazysuperheroes/hedera-minter-sdk) | 1.0.0 | Utility modules for deploying, querying, and interacting with minter contracts. Includes contract execution, mirror node queries, gas estimation, and transaction parsing. |
| [`@lazysuperheroes/hedera-minter-cli`](https://www.npmjs.com/package/@lazysuperheroes/hedera-minter-cli) | 1.0.0 | The `hedera-mint` CLI with 85+ commands for deploying and managing all minting contract types. Supports `--json` output and `--no-input` mode for automation. |

**Repository:** [github.com/lazysuperheroes/hedera-SC-minter](https://github.com/lazysuperheroes/hedera-SC-minter)

```bash
# Install the CLI globally
npm install -g @lazysuperheroes/hedera-minter-cli
hedera-mint --help

# Or use the SDK in your project
npm install @lazysuperheroes/hedera-minter-sdk @lazysuperheroes/hedera-minter-contracts
```

---

## NFT Farming & Staking

| Package | Version | Description |
|---------|---------|-------------|
| [`@lazysuperheroes/farming-sdk`](https://www.npmjs.com/package/@lazysuperheroes/farming-sdk) | 1.0.0 | TypeScript SDK for NFT farming and staking on Hedera. Query staking state, calculate rewards, and interact with farming contracts programmatically. |
| [`@lazysuperheroes/farming-cli`](https://www.npmjs.com/package/@lazysuperheroes/farming-cli) | 1.0.0 | Read-only CLI for querying farming and staking contracts. Check staked NFTs, pending rewards, and farm configuration. |

**Repository:** [github.com/lazysuperheroes/hedera-SC-LAZY-Farms](https://github.com/lazysuperheroes/hedera-SC-LAZY-Farms)

---

## Token Swap

| Package | Version | Description |
|---------|---------|-------------|
| [`@lazysuperheroes/lazy-tokenswap-contracts`](https://www.npmjs.com/package/@lazysuperheroes/lazy-tokenswap-contracts) | 2.0.0 | ABIs and TypeScript types for Lazy Token Swap smart contracts. Enables peer-to-peer NFT and token swaps on Hedera with on-chain escrow. |

**Repository:** [github.com/lazysuperheroes/hedera-SC-LAZY-tokenswap](https://github.com/lazysuperheroes/hedera-SC-LAZY-tokenswap)

---

## Lottery

| Package | Version | Description |
|---------|---------|-------------|
| [`@lazysuperheroes/lazy-lotto`](https://www.npmjs.com/package/@lazysuperheroes/lazy-lotto) | 1.0.0 | LazyLotto and LazyTradeLotto lottery systems on Hedera. ABIs and CLI tools for on-chain lottery management with verifiable random winner selection. |

**Repository:** [github.com/lazysuperheroes/hedera-SC-lazy-lotto](https://github.com/lazysuperheroes/hedera-SC-lazy-lotto)

---

## Multi-Signature Transactions

| Package | Version | Description |
|---------|---------|-------------|
| [`@lazysuperheroes/hedera-multisig`](https://www.npmjs.com/package/@lazysuperheroes/hedera-multisig) | 1.2.2 | Production-grade M-of-N multi-signature transaction management for Hedera. Supports WalletConnect browser dApp, encrypted key storage, air-gapped/offline signing, hardware wallets, and comprehensive audit logging. |

**Repository:** [github.com/lazysuperheroes/hedera-multisig](https://github.com/lazysuperheroes/hedera-multisig)

---

## NFT Utilities

| Package | Version | Description |
|---------|---------|-------------|
| [`@lazysuperheroes/hedera-nft-utils`](https://www.npmjs.com/package/@lazysuperheroes/hedera-nft-utils) | 2.0.0 | NFT migration and utility toolkit. Migrate NFTs from mainnet to testnet, sweep HBAR across accounts, and more. Essential for testing and development workflows. |
| [`@lazysuperheroes/nft-static-data`](https://www.npmjs.com/package/@lazysuperheroes/nft-static-data) | 1.0.1 | NFT static metadata uploader. Scrape, pin, and serve NFT metadata via IPFS/Filebase for the Lazy dApp and SecureTrade Marketplace. |
| [`@lazysuperheroes/token-graveyard`](https://www.npmjs.com/package/@lazysuperheroes/token-graveyard) | 2.1.2 | Permanent NFT storage contract for Hedera with royalty bypass capabilities. Send unwanted NFTs to the graveyard -- a verifiable, on-chain dead letter box. |

**Repositories:**
- [github.com/lazysuperheroes/hedera-nft-public-to-test](https://github.com/lazysuperheroes/hedera-nft-public-to-test)
- [github.com/lazysuperheroes/nft-static-data](https://github.com/lazysuperheroes/nft-static-data)
- [github.com/lazysuperheroes/hedera-token-graveyard](https://github.com/lazysuperheroes/hedera-token-graveyard)

---

## Common Themes

Every package in the `@lazysuperheroes` scope shares the same principles:

- **Open source** -- every line of code is readable, forkable, and auditable
- **Hedera native** -- built for HTS, not adapted from Ethereum patterns
- **Verifiable** -- smart contract logic is on-chain and can be confirmed on HashScan
- **CLI-first** -- admin operations are scriptable and automatable, not locked behind a UI

---

## Links

- **NPM scope:** [npmjs.com/org/lazysuperheroes](https://www.npmjs.com/org/lazysuperheroes)
- **GitHub:** [github.com/lazysuperheroes](https://github.com/lazysuperheroes)
- **Website:** [lazysuperheroes.com](https://www.lazysuperheroes.com/)
- **Whitepaper:** [docs.lazysuperheroes.com](https://docs.lazysuperheroes.com/)
- **X/Twitter:** [@superheroeslazy](https://x.com/superheroeslazy)
- **Email:** [lazysuperheroes@protonmail.com](mailto:lazysuperheroes@protonmail.com)

---

*All packages are maintained by the Lazy Superheroes team. Published under the `@lazysuperheroes` npm scope.*
