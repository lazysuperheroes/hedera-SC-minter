# MinterContract

**Version:** 2.0 | **Status:** Production Ready | **Size:** 19.402 KiB

## Overview

The `MinterContract` creates **transferable NFTs** on Hedera Token Service (HTS) with advanced minting mechanics, dual-currency payments (HBAR + $LAZY), whitelist gating, batch minting, and a time-based refund system. It is the standard choice for NFT collections where tokens should be freely tradeable after mint.

## Key Features

- **Transferable Tokens** -- standard HTS NFTs that holders can trade freely.
- **Batch Minting** -- mint multiple NFTs in a single transaction.
- **Sequential or Random Metadata** -- PRNG-based or sequential metadata selection from a pre-loaded array.
- **Configurable Max Supply** -- fixed cap or unlimited supply.
- **Refund Window** -- users may burn recently minted NFTs for a proportional HBAR + $LAZY refund within a configurable time window.

## Contract Inheritance

```
MinterContract -> ExpiryHelper -> FeeHelper -> KeyHelper -> HederaTokenService
               + Ownable (OpenZeppelin)
               + ReentrancyGuard (OpenZeppelin)
```

Uses `Bits` library from `KeyHelper` for key bit operations. All error handling uses custom errors (gas-efficient).

## Deployment and Initialization

### Constructor

```solidity
constructor(
    address lsct,           // Lazy Smart Contract Treasury address
    address lazy,           // $LAZY token contract address
    uint256 lazyBurnPerc    // Percentage of $LAZY to burn per mint (0-100)
)
```

### Token Creation

```solidity
function initialiseNFTMint(
    string memory _name,
    string memory _symbol,
    string memory _memo,
    string memory _cid,
    string[] memory _metadata,
    int64 _maxSupply              // -1 for unlimited
) external payable onlyOwner returns (address, uint256)
```

## Core Functionality

### Minting

```solidity
function mintNFT(uint256 _numberToMint)
    external payable nonReentrant
    returns (int64[] memory _serials, bytes[] memory _metadataForMint)
```

Flow: validation -> access/whitelist check -> payment processing (HBAR + $LAZY) -> metadata selection -> HTS mint in batches -> transfer to user -> state updates.

### Whitelist Purchase with $LAZY

```solidity
function buyWlWithLazy() external returns (uint256 _wlSpotsPurchased)
```

Users may also gain whitelist access by holding specific NFTs (token-gated), with serial tracking to prevent reuse.

### Burn and Refund

```solidity
function burnForRefund(int64[] memory _serials)
    external returns (uint256 _refundHbar, uint256 _refundLazy)
```

Validates ownership, checks the refund window, calculates proportional refunds, burns the NFTs, and transfers payment back.

## Administrative Functions

| Function | Purpose |
|----------|---------|
| `updatePricing(uint256, uint256)` | Set HBAR and $LAZY mint prices |
| `updateWlDiscount(uint256)` | Whitelist discount percentage |
| `updateLazyBurnPercentage(uint256)` | $LAZY burn percentage |
| `updateMaxMint(uint256)` | Max NFTs per transaction |
| `updateMaxMintPerWallet(uint256)` | Max NFTs per wallet |
| `updateMintStartTime(uint256)` | Scheduled launch time |
| `updateCooldown(uint256)` | Cooldown between mints per address |
| `updateRefundWindow(uint256)` | Refund eligibility window |
| `pause()` / `unpause()` | Emergency pause control |
| `toggleWlOnly()` | Toggle whitelist-only minting |
| `addToWhitelist(address[])` | Batch add to whitelist |
| `updateCID(string)` | Update IPFS CID |
| `updatePrng(address)` | Update PRNG contract |
| `updateLSCT(address)` | Update Lazy SCT address |
| `updateLazyToken(address)` | Update $LAZY token address |
| `updateWlToken(address)` | Update token-gated WL token |

## Query Functions

**Contract state:** `getNFTTokenAddress`, `getLazyToken`, `getLSCT`, `getPaused`, `getWlOnly`

**Supply:** `getTotalMinted`, `getMaxSupply`, `getRemainingMint`, `getBatchSize`, `getMetadataLength`

**Economics:** `getCost`, `getLazyBurnPercentage`, `getMintTiming`, `getMintEconomics`

**Whitelist/user:** `getWhiteListLength`, `getQtyWhiteListed`, `checkEligibility`, `getNumberOfWLUsed`, `getNumMintedByAddress`, `getWLTokensUsed`, `getWlSerialsUsed`

**Timing:** `getWalletMintTime`, `getSerialMintTime`, `checkMintTiming`, `checkCooldown`

## Custom Errors

Errors specific to or particularly relevant for MinterContract:

| Error | Meaning |
|-------|---------|
| `NotReset(address)` | Token already initialized |
| `BadQuantity(uint256)` | Invalid mint quantity |
| `TooMuchMetadata()` | Metadata array exceeds max supply |
| `EmptyMetadata()` | No metadata provided |
| `MintedOut()` | All NFTs minted |
| `MaxMintExceeded()` | Exceeds per-transaction limit |
| `MaxMintPerWalletExceeded()` | Exceeds per-wallet limit |

For the full shared error reference (payment errors, access errors, technical errors, whitelist errors), see [shared-concepts.md](../shared-concepts.md).

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 2.0 | October 2025 | MinterLibrary removed, custom errors, KeyHelper Bits integration, 86-byte size reduction. No public API changes. |
| 1.x | Pre-refactor | Original implementation with MinterLibrary and string reverts. |

### Migration Note (v1.x to v2.0)

There are no breaking changes to the public interface. The only frontend change is error handling -- switch from string matching to custom error parsing:

```javascript
// v2.0 error handling
const errorData = contract.interface.parseError(error.data);
if (errorData.name === 'NotEnoughHbar') { /* ... */ }
```

## Related Documentation

- [SoulboundMinter](./soulbound-minter.md) -- non-transferable variant
- [ForeverMinter](./forever-minter.md) -- pool-based distribution
- [EditionWithPrize](./edition-with-prize.md) -- edition + prize gamification
- [BadgeMinter](./badge-minter.md) -- multi-type soulbound badges
- [Shared Concepts](../shared-concepts.md) -- $LAZY integration, whitelist patterns, common errors, contract comparison table
- [Prerequisites](../getting-started/prerequisites.md) -- development environment setup
