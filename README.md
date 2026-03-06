# Hedera Smart Contract Minter Suite

A collection of NFT minting smart contracts for the Hedera network, with $LAZY token integration and whitelist systems.

**Solidity 0.8.18 | Hardhat | Hedera Token Service (HTS)**

---

## Quick Contract Selector

**Transferable NFTs**
- Standard sales -- [MinterContract](docs/contracts/minter-contract.md)
- Pool-based distribution with royalties -- [ForeverMinter](docs/contracts/forever-minter.md)
- Edition minting with random prize awards -- [EditionWithPrize](docs/contracts/edition-with-prize.md)

**Soulbound (non-transferable) NFTs**
- Single badge/certificate type -- [SoulboundMinter](docs/contracts/soulbound-minter.md)
- Multiple badge types in one contract -- [SoulboundBadgeMinter](docs/contracts/badge-minter.md)

---

## Contract Comparison

| Feature | MinterContract | SoulboundMinter | ForeverMinter | SoulboundBadgeMinter | EditionWithPrize |
|---------|----------------|-----------------|---------------|----------------------|------------------|
| **Version** | v2.0 | v2.0 | v1.0 | v1.0 | v1.0 |
| **Token Type** | Transferable | Soulbound | Transferable | Soulbound | Transferable |
| **Distribution** | Mint on demand | Mint on demand | Pool-based | Mint on demand | Edition + prize |
| **Payment** | HBAR + $LAZY | HBAR + $LAZY | HBAR + $LAZY | HBAR only | HBAR + $LAZY |
| **Whitelist** | Address + Token-gated | Address + Token-gated | Address + Holder | Per-badge | Address + Token-gated |
| **Discount Stacking** | No | No | WL + Holder | No | No |
| **Sacrifice System** | No | No | Burn NFTs for discount | No | No |
| **Refunds** | Time-based | Time-based | Pool return | No | No |
| **Batch Minting** | Unlimited | Unlimited | 50 max | Unlimited | Unlimited |
| **On-Behalf Minting** | No | Yes | No | Yes | No |
| **Revocation** | No | Optional | No | Optional | No |
| **Admin System** | Owner only | Owner only | Multi-admin | Multi-admin | Multi-admin |
| **Royalty Compliance** | No | N/A | Yes (via staking) | N/A | No |

---

## Getting Started

```bash
git clone https://github.com/Burstall/hedera-SC-minter.git && cd hedera-SC-minter
npm install
cp .env.example .env          # then fill in ACCOUNT_ID, PRIVATE_KEY, ENVIRONMENT
npx hardhat compile
```

See [Prerequisites](docs/getting-started/prerequisites.md) and [Configuration](docs/guides/configuration.md) for full setup details.

### Running Tests

Tests run against Hedera testnet and require valid `.env` credentials.

```bash
npm test                      # all tests
npm run test-nft              # MinterContract
npm run test-sbt              # SoulboundMinter
npm run test-forever          # ForeverMinter
npm run test-badges           # SoulboundBadgeMinter
npm run test-ewp              # EditionWithPrize
npm run test-ft               # FungibleTokenCreator
```

### Deployment

See the [Deployment Guide](docs/guides/deployment.md) for per-contract instructions. All deployment scripts are interactive.

```bash
npm run deploy-nft            # MinterContract
npm run deploy-sbt            # SoulboundMinter
npx hardhat run scripts/deployment/deploy-ForeverMinter.js
npx hardhat run scripts/deployment/deploy-EditionWithPrize.js
```

---

## Documentation

### Per-Contract Docs

| Contract | Reference | Quickstart |
|----------|-----------|------------|
| MinterContract | [docs/contracts/minter-contract.md](docs/contracts/minter-contract.md) | [quickstart](docs/getting-started/quickstart-minter.md) |
| SoulboundMinter | [docs/contracts/soulbound-minter.md](docs/contracts/soulbound-minter.md) | [quickstart](docs/getting-started/quickstart-soulbound.md) |
| ForeverMinter | [docs/contracts/forever-minter.md](docs/contracts/forever-minter.md) | [quickstart](docs/getting-started/quickstart-forever.md) |
| SoulboundBadgeMinter | [docs/contracts/badge-minter.md](docs/contracts/badge-minter.md) | [quickstart](docs/getting-started/quickstart-badges.md) |
| EditionWithPrize | [docs/contracts/edition-with-prize.md](docs/contracts/edition-with-prize.md) | [quickstart](docs/getting-started/quickstart-edition.md) |

### Guides

- [Configuration Reference](docs/guides/configuration.md) -- all environment variables
- [Deployment Guide](docs/guides/deployment.md) -- per-contract deploy and post-deploy steps
- [CLI Scripts Guide](docs/guides/cli-scripts.md) -- admin and user interaction scripts
- [Troubleshooting](docs/guides/troubleshooting.md) -- common issues and fixes

### Architecture

- [Design and Architecture](docs/architecture/design.md) -- inheritance trees, v2.0 refactoring, Hedera-specific patterns
- [Shared Concepts](docs/contracts/shared-concepts.md) -- $LAZY integration, whitelists, refunds, custom errors, admin access control

---

## Repository Structure

```
hedera-SC-minter/
├── contracts/
│   ├── MinterContract.sol            # v2.0 -- standard NFT minting
│   ├── SoulboundMinter.sol           # v2.0 -- soulbound NFTs
│   ├── ForeverMinter.sol             # v1.0 -- pool-based distribution
│   ├── SoulboundBadgeMinter.sol      # v1.0 -- multi-badge soulbound
│   ├── EditionWithPrize.sol          # v1.0 -- edition + prize minting
│   ├── TokenStakerV2.sol             # royalty-compliant staking
│   ├── FungibleTokenCreator.sol      # HTS fungible token creation
│   ├── *HelperV2.sol / KeyHelperV2   # shared HTS helpers (v2.0)
│   └── interfaces/
├── test/                             # one test file per contract
├── docs/
│   ├── architecture/
│   │   └── design.md
│   ├── contracts/
│   │   ├── minter-contract.md
│   │   ├── soulbound-minter.md
│   │   ├── forever-minter.md
│   │   ├── badge-minter.md
│   │   ├── edition-with-prize.md
│   │   └── shared-concepts.md
│   ├── getting-started/
│   │   ├── prerequisites.md
│   │   └── quickstart-*.md
│   ├── guides/
│   │   ├── configuration.md
│   │   ├── deployment.md
│   │   ├── cli-scripts.md
│   │   └── troubleshooting.md
│   └── ForeverMinter-*.md / EditionWithPrize-*.md   # extended specs
├── abi/                              # extracted ABIs
├── scripts/
│   ├── deployment/                   # deploy scripts (interactive)
│   └── interactions/                 # admin + user CLI by contract
│       ├── ForeverMinter/
│       ├── BadgeMinter/
│       └── EditionWithPrize/
└── utils/                            # Hedera/mirror-node helpers
```

---

## Technology Stack

- **Blockchain:** Hedera Hashgraph (HTS precompile, not ERC-721)
- **Solidity:** 0.8.18, optimizer enabled (200 runs, `viaIR: true`)
- **Framework:** Hardhat with hardhat-contract-sizer (24 KiB limit)
- **Testing:** Mocha + Chai against Hedera testnet via @hashgraph/sdk
- **Libraries:** OpenZeppelin (ReentrancyGuard, Ownable, SafeCast, EnumerableMap/Set), Hedera Token Service

---

## Support

- **Repository:** [Burstall/hedera-SC-minter](https://github.com/Burstall/hedera-SC-minter)
- **Issues:** [GitHub Issues](https://github.com/Burstall/hedera-SC-minter/issues)

## License

See [LICENSE](LICENSE) for details.

---

**Last Updated:** March 2026
**Versions:** v2.0 (MinterContract, SoulboundMinter) | v1.0 (ForeverMinter, SoulboundBadgeMinter, EditionWithPrize)
