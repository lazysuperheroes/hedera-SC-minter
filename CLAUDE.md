# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hedera Smart Contract Minter Suite — a collection of NFT minting smart contracts for the Hedera network. Four main contracts handle different minting use cases, all with $LAZY token integration and whitelist systems.

**Contracts:**
- **MinterContract** (v2.0) — Standard transferable NFT minting with HBAR + $LAZY payment
- **SoulboundMinter** (v2.0) — Non-transferable (frozen) NFTs for badges/certificates
- **ForeverMinter** (v1.0) — Pool-based distribution of existing NFTs with discount/sacrifice system
- **SoulboundBadgeMinter** (v1.0) — Multiple soulbound badge types in one contract

## Build & Test Commands

```bash
# Compile all contracts (also runs contract sizer)
npx hardhat compile

# Run all tests (uses Hedera testnet via @hashgraph/sdk)
npm test

# Run specific contract tests
npm run test-ft          # FungibleTokenCreator
npm run test-nft         # MinterContract
npm run test-sbt         # SoulboundMinter
npm run test-badges      # SoulboundBadgeMinter
npm run test-forever     # ForeverMinter
npm run test-ewp         # EditionWithPrize

# Run a single test file directly
npx hardhat test test/ForeverMinter.test.js

# Lint Solidity
npm run solhint

# Deploy (examples)
npm run deploy-ft
npm run deploy-nft
npm run deploy-sbt
npx hardhat run scripts/deployment/deploy-ForeverMinter.js
npx hardhat run scripts/deployment/deploy-EditionWithPrize.js
```

## Architecture

### Contract Inheritance

**v2.0 contracts** (MinterContract, SoulboundMinter):
```
Contract → ExpiryHelperV2 → FeeHelperV2 → KeyHelperV2 → HederaTokenServiceV2
         + Ownable + ReentrancyGuard
```
These use custom errors (not string reverts) and the `Bits` library from KeyHelper.

**v1.0 contracts** (ForeverMinter, SoulboundBadgeMinter):
- ForeverMinter → TokenStakerV2 + Ownable + ReentrancyGuard (royalty-compliant transfers via staking pattern)
- SoulboundBadgeMinter → KeyHelper + HederaTokenService + Ownable + ReentrancyGuard

### Key Supporting Contracts
- **TokenStakerV2** — Enables royalty-compliant NFT transfers (stake/unstake pattern to respect HTS royalties)
- **PrngGenerator** — Hedera VRF wrapper for random serial/metadata selection
- **LazyGasStation** — Gas abstraction layer for $LAZY token operations
- **LazyDelegateRegistry** — Delegation for holder verification
- **FungibleTokenCreator** — Creates fungible tokens on HTS (used for $LAZY in tests)

### Hedera-Specific Patterns
- All NFT operations go through Hedera Token Service (HTS) precompile, not ERC-721
- Contracts use `IHederaTokenService` / `IHederaTokenServiceV2` interfaces for token create/mint/transfer/burn
- Soulbound tokens are implemented by freezing tokens at mint time (FREEZE key)
- Contract addresses are in Hedera format (`0.0.XXXXX`) and Solidity format interchangeably
- `HederaResponseCodes` provides error codes from the HTS precompile

### Test Infrastructure
Tests run against **Hedera testnet** (not a local Hardhat network). They require valid `.env` credentials:
- `ACCOUNT_ID` and `PRIVATE_KEY` — Hedera operator account (ED25519)
- `ENVIRONMENT=TEST` for testnet
- `LAZY_TOKEN_ID`, `LAZY_SCT_CONTRACT_ID` — $LAZY token references

Tests create real accounts, tokens, and contracts on testnet. They use helper utilities from `utils/`:
- `solidityHelpers.js` — Contract deploy/execute/read-only EVM call via mirror node
- `hederaHelpers.js` — Account creation, token operations, allowances, transfers
- `hederaMirrorHelpers.js` — Mirror node queries for balances, serials, events
- `transactionHelpers.js` — Transaction formatting and analysis
- `gasHelpers.js` — Gas estimation via mirror node

### Script Organization
- `scripts/deployment/` — Contract deployment scripts (interactive, use readline-sync)
- `scripts/interactions/` — CLI scripts for contract administration, organized by contract:
  - `ForeverMinter/admin/` — Admin operations (pause, whitelist, economics, pool management)
  - `ForeverMinter/` — User operations (mint, refund, check costs/discounts)
  - `BadgeMinter/` — Badge CRUD, minting, admin management
  - `EditionWithPrize/admin/` — Edition management
- `scripts/debug/` — Error decoding, contract info, log retrieval
- `scripts/testing/` — Concurrent mint testing, validation

### ABI Management
ABIs are extracted to `abi/` via `scripts/deployment/extractABI.js`. Interaction scripts load ABIs from this directory using `ethers.Interface`.

## Code Style

- **Solidity:** 0.8.18, optimizer enabled (200 runs), `viaIR: true`. Linted with solhint (extends `solhint:recommended`). Max 24,576 bytes contract size limit enforced by `hardhat-contract-sizer`.
- **JavaScript:** Tabs for indentation, single quotes, semicolons required, `stroustrup` brace style, trailing commas in multiline. Linted with ESLint (`eslint:recommended`).
- v2.0 contracts use custom errors (`error InsufficientPayment(...)`) instead of `require()` with strings.
- v1.0 contracts use `require()` with string messages.

## Environment Configuration

Copy `.env.example` to `.env`. Key variables:
- `ACCOUNT_ID` / `PRIVATE_KEY` — Hedera operator credentials
- `ENVIRONMENT` — `TEST` (testnet) or `MAIN` (mainnet)
- `CONTRACT_NAME` — Active contract name for scripts
- `LAZY_TOKEN_ID` / `LAZY_SCT_CONTRACT_ID` — $LAZY token addresses (differ per network)
