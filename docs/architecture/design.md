# Architecture & Design

This document describes the contract inheritance hierarchy, design decisions, and supporting infrastructure for the Hedera SC Minter suite.

---

## Table of Contents

1. [Contract Inheritance Chains](#contract-inheritance-chains)
2. [Design Decision: Flat Contracts](#design-decision-flat-contracts)
3. [Contract Types Overview](#contract-types-overview)
4. [Key Supporting Contracts](#key-supporting-contracts)
5. [Hedera Token Service Integration](#hedera-token-service-integration)

---

## Contract Inheritance Chains

### v1.0 Helper Chain (Active)

The v1.0 helper chain is used by all production contracts. It targets HTS precompile `0x167`.

```
HederaResponseCodes          (response code constants)
        |
HederaTokenService           (abstract; precompile calls at 0x167)
        |
    KeyHelper                (key type enums, Bits library, getSingleKey utilities)
        |
    FeeHelper                (royalty/fixed fee construction helpers)
        |
   ExpiryHelper              (auto-renew and expiry configuration)
```

Contracts built on this chain:

| Contract | Inherits | Additional Bases |
|----------|----------|-----------------|
| MinterContract | ExpiryHelper | Ownable, ReentrancyGuard |
| SoulboundMinter | ExpiryHelper | Ownable, ReentrancyGuard |
| SoulboundBadgeMinter | ExpiryHelper | Ownable, ReentrancyGuard |
| EditionWithPrize | ExpiryHelper | Ownable, ReentrancyGuard |

ForeverMinter uses a separate base (`TokenStakerV2`) which itself inherits from `HederaTokenServiceStakerLite` -- a stripped-down version of `HederaTokenService` containing only the three HTS functions needed for staking (`cryptoTransfer`, `associateToken`, `associateTokens`). This reduces bytecode by 5--12 KB.

```
HederaResponseCodes
        |
HederaTokenServiceStakerLite   (minimal HTS: 3 functions only)
        |
    KeyHelper                   (key utilities, Bits library)
        |
    FeeHelper
        |
   ExpiryHelper
```

```
HederaTokenServiceStakerLite
        |
   TokenStakerV2               (stake/unstake/royalty-compliant transfers)
        |
   ForeverMinter               + Ownable, ReentrancyGuard
```

### v2.0 Helper Chain (DEPRECATED)

A v2 helper chain exists targeting the newer HTS precompile at `0x16c` with `int64`-based parameters. **No production contract currently uses this chain.** It is retained in the codebase for potential future use.

```
HederaResponseCodesV2
        |
HederaTokenServiceV2          (precompile 0x16c, int64 params)
        |
   KeyHelperV2                 (uses Bits library from libraries/Bits.sol)
        |
   FeeHelperV2
        |
  ExpiryHelperV2
```

Each v2 file contains the header comment:
```
/// @notice DEPRECATED: V2 helpers for future use with HTS precompile 0x16c.
///         No current contract uses this chain.
```

---

## Design Decision: Flat Contracts

**MinterContract and SoulboundMinter are approximately 85% duplicated code. This is a deliberate design choice, not an oversight.**

### Rationale: Auditability

These contracts are deployed independently and verified on-chain. Each contract must be auditable in isolation. A user or auditor examining a deployed MinterContract should be able to read and understand the entire contract without needing to locate, download, and trust a shared base library.

With a shared abstract base:
- Auditors must verify two contracts instead of one
- The base contract becomes a single point of failure affecting multiple deployments
- On-chain verification is more complex (users must map inheritance to deployed bytecode)

With flat contracts:
- Each contract is self-contained and independently verifiable
- A bug in one contract does not imply a bug in the other
- Contract-specific optimizations can be made without affecting the other

### Historical Context

Earlier versions used a shared `MinterLibrary` for common logic. The v2.0 refactoring eliminated this dependency by inlining all library functions directly into each contract. This produced measurable improvements:

- 86-byte size reduction in MinterContract
- 78-byte size reduction in SoulboundMinter
- ~40% cheaper deployment (custom errors replacing string reverts)
- Eliminated cross-contract JUMP operations

### Where They Differ

Despite sharing most logic, the contracts diverge in these areas:

| Aspect | MinterContract | SoulboundMinter |
|--------|---------------|-----------------|
| Token keys | SUPPLY + PAUSE | SUPPLY + PAUSE + FREEZE + WIPE |
| Post-mint action | Transfer to user | Transfer + freeze (soulbound) |
| Revocation | Not supported | Optional (unfreeze + transfer + burn) |
| On-behalf minting | Not supported | `mintNFTOnBehalf()` |
| Constructor | 3 params | 4 params (adds `_revocable`) |
| Initialization | Standard | Adds fixed-edition and unlimited-supply options |
| `error NotReset` | `NotReset(address token)` | `NotReset()` (no parameter) |
| `error BadQuantity` | `BadQuantity(uint256 quantity)` | `BadQuantity()` (no parameter) |

---

## Contract Types Overview

### MinterContract (v2.0)

Standard transferable NFT minting with sequential or PRNG-based metadata selection. Supports HBAR + $LAZY dual payment, whitelist with discount, cooldown rate limiting, and time-windowed burn-for-refund.

**Best for:** NFT collection drops, PFP projects, generative art collections.

### SoulboundMinter (v2.0)

Non-transferable NFT minting using the freeze-key pattern. Shares the MinterContract feature set and adds on-behalf minting (gas abstraction) and optional owner-initiated revocation.

**Best for:** Achievement badges, certificates, credentials, membership tokens, attendance proofs.

### ForeverMinter (v1.0.5)

Pool-based distribution of existing NFTs with royalty-compliant transfers via the TokenStakerV2 staking pattern. Features a triple discount system (WL + holder + sacrifice), PRNG-based random serial selection, and pool-return refunds.

**Best for:** Secondary distribution of existing collections, staking rewards, recycling/reuse systems, complex discount incentive programs.

### SoulboundBadgeMinter (v1.0)

Type-based badge system where a single token contract supports multiple badge categories, each with independent metadata, whitelists, supply limits, and tracking. Multi-admin support for team management.

**Best for:** Organization badge programs, multi-tier achievement systems, role-based access tokens, company credential ecosystems.

### EditionWithPrize (v1.0)

Phase-driven edition minting where all editions share identical metadata, followed by PRNG-based winner selection and atomic prize claiming (edition wiped, unique prize minted and transferred). Supports HBAR + $LAZY + USDC triple payment.

**Best for:** Gamified mints, lottery-style drops, promotional campaigns with prizes.

---

## Key Supporting Contracts

### TokenStakerV2

**File:** `contracts/TokenStakerV2.sol`
**Used by:** ForeverMinter

Enables royalty-compliant NFT transfers on Hedera. Direct `transferNFT()` calls bypass royalty fees, but the stake/unstake pattern routes transfers through HTS `cryptoTransfer()`, which enforces royalties.

**Pattern:**
1. User "stakes" an NFT into the contract (transfer with royalty payment)
2. Contract holds the NFT in its pool
3. When a mint occurs, the contract "unstakes" an NFT to the buyer (transfer with royalty payment)

This ensures creator royalties are paid on every distribution, making ForeverMinter suitable for secondary market scenarios.

TokenStakerV2 also integrates with:
- **LazyGasStation** for $LAZY token operations and gas management
- **LazyDelegateRegistry** for verifying delegated token ownership

### PrngGenerator

**File:** `contracts/PrngGenerator.sol`
**Used by:** MinterContract, SoulboundMinter, ForeverMinter, EditionWithPrize

Wraps the Hedera PRNG system contract at address `0x169` to provide pseudorandom number generation. Supports two modes:

- **ANY** -- Returns a random `uint256`
- **RANGE** -- Returns a random number within a specified `[lo, hi)` range

Used for random metadata selection during minting and random serial selection from pools. Emits `PrngEvent` with full parameters for on-chain auditability.

### LazyGasStation

**File:** `contracts/LazyGasStation.sol`
**Used by:** ForeverMinter, EditionWithPrize (via `ILazyGasStation`)

Centralized $LAZY token operations contract that:

1. Accepts $LAZY from users (via ERC-20 allowance) or from calling contracts
2. Executes the configured burn percentage through the Lazy Smart Contract Treasury (LSCT)
3. Manages HBAR gas refills for contracts that need HBAR to pay for HTS precompile calls
4. Enforces role-based access control -- only authorized contracts can call gas station functions

The LazyGasStation uses the `IRoles` interface for access control with distinct roles for different operational permissions.

### LazyDelegateRegistry

**File:** `contracts/LazyDelegateRegistry.sol`
**Used by:** ForeverMinter, EditionWithPrize (via `ILazyDelegateRegistry`)

A delegation registry that allows NFT holders to delegate their holding verification to another address. This enables:

- Verification of token ownership for discount eligibility when tokens are staked in external contracts
- Whitelist token verification for staked/delegated tokens
- Holder discount verification without requiring the NFT to be in the user's direct wallet

### FungibleTokenCreator

**File:** `contracts/FungibleTokenCreator.sol`

Creates fungible tokens on HTS. Primarily used in the test suite to create $LAZY and USDC test tokens. Not a dependency of any production minting contract.

---

## Hedera Token Service Integration

### The Precompile Model

Hedera's EVM is augmented with system contracts (precompiles) that expose native Hedera services to Solidity code. The HTS precompile at `0x167` provides the full token lifecycle:

```solidity
address constant precompileAddress = address(0x167);
```

Contracts interact with HTS by encoding function calls and sending them to this address. The `HederaTokenService` abstract contract wraps these low-level calls into Solidity functions:

| HTS Function | Solidity Wrapper | Purpose |
|-------------|-----------------|---------|
| `createNonFungibleToken` | `createNonFungibleToken()` | Create a new NFT token type |
| `mintToken` | `mintToken()` | Mint new serials with metadata |
| `burnToken` | `burnToken()` | Burn specific serials |
| `transferNFT` | `transferNFT()` | Transfer a single NFT |
| `cryptoTransfer` | `cryptoTransfer()` | Multi-party transfers (respects royalties) |
| `associateToken` | `associateToken()` | Associate an account with a token |
| `freezeToken` | `freezeToken()` | Freeze an account for a token |
| `unfreezeToken` | `unfreezeToken()` | Unfreeze an account for a token |
| `wipeTokenAccount` | `wipeTokenAccount()` | Wipe tokens from an account (requires WIPE key) |

### Response Code Pattern

Every HTS call returns an `int32` response code. The standard pattern throughout the codebase:

```solidity
int32 responseCode = HederaTokenService.mintToken(token, 0, metadata);
if (responseCode != HederaResponseCodes.SUCCESS) {
    revert FailedNFTMint();
}
```

This pattern is repeated for every HTS operation. Custom errors provide specific context about which operation failed.

### Token Creation Parameters

When creating an NFT via HTS, contracts construct a `HederaToken` struct with:

- **name, symbol, memo** -- Token identity
- **treasury** -- The contract itself (receives minted tokens)
- **expiry** -- Auto-renew configuration (contract address, 90-day period)
- **tokenKeys** -- Array of key assignments (SUPPLY, PAUSE, FREEZE, WIPE as needed)
- **tokenSupplyType** -- `FINITE` or `INFINITE`
- **maxSupply** -- Maximum supply (for FINITE tokens)

Keys are constructed using `KeyHelper` utilities:

```solidity
// Single key assignment
IHederaTokenService.TokenKey memory supplyKey = getSingleKey(
    KeyType.SUPPLY,
    KeyValueType.CONTRACT_ID,
    ""
);

// Duplex key (two key types, one key holder)
uint256 keyType = getDuplexKeyType(KeyType.SUPPLY, KeyType.PAUSE);
```

### HTS vs ERC-721

Hedera NFTs created via HTS are **not** standard ERC-721 tokens, though Hedera provides an ERC-721 compatibility layer. Key differences relevant to this codebase:

| Aspect | ERC-721 | HTS NFT |
|--------|---------|---------|
| Token creation | `constructor()` | HTS `createNonFungibleToken()` |
| Minting | Internal state update | HTS `mintToken()` precompile |
| Transfers | `transferFrom()` | HTS `transferNFT()` / `cryptoTransfer()` |
| Burn | Contract logic | HTS `burnToken()` precompile |
| Freeze | Not native | HTS `freezeToken()` precompile |
| Association | Not needed | Required before holding |
| Royalties | Not enforced | Enforced via `cryptoTransfer()` |
| Serial numbers | Token IDs (arbitrary) | Sequential from 1 |
| Metadata | `tokenURI()` | Per-serial bytes at mint time |

The contracts in this suite use `IERC721` from OpenZeppelin only for `ownerOf()` balance checks, not for transfer operations. All state-mutating token operations go through HTS.
