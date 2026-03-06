# EditionWithPrize

**Status:** Production Ready | **Size:** ~20.3 KiB

## Overview

The **EditionWithPrize** contract creates edition NFTs with identical metadata, then awards unique 1-of-1 prize tokens to randomly selected edition holders. This produces a gamified minting experience with fair, verifiable on-chain randomness via Hedera PRNG.

## Core Concept

1. **Edition Minting Phase** -- users mint edition NFTs (identical metadata).
2. **Winner Selection Phase** -- after sellout, random winners are selected using PRNG.
3. **Prize Claiming Phase** -- winners exchange their edition NFT for a unique prize token (atomic swap: edition is wiped, prize is minted and transferred).

## Contract Inheritance

```solidity
contract EditionWithPrize is KeyHelper, ExpiryHelper, Ownable, ReentrancyGuard
```

## 5-Phase Lifecycle

| Phase | Name | Description |
|-------|------|-------------|
| 0 | `NOT_INITIALIZED` | Contract deployed, tokens not yet created. Only initialization allowed. |
| 1 | `EDITION_MINTING` | Users mint edition NFTs. Payment and whitelist enforcement active. |
| 2 | `EDITION_SOLD_OUT` | All editions minted. `selectWinner()` can be called by anyone. |
| 3 | `WINNER_SELECTED` | Winners chosen via PRNG. Prize claiming available. |
| 4 | `PRIZE_CLAIMED` | All prizes claimed. Final state. |

Functions are phase-gated -- they revert if called in the wrong phase.

## Payment System

The contract supports **three payment methods**, usable individually or in combination:

### HBAR (Native)

Paid via `msg.value`. Excess automatically refunded using OpenZeppelin `Address.sendValue`.

### $LAZY Token

Paid via allowance. Supports configurable burn percentage (0-100%). Sponsorship mode available (`lazyFromContract = true`).

### USDC (Dual Token)

Supports both native and bridged USDC on Hedera:

| Token | Mainnet Address |
|-------|-----------------|
| USDC Native | `0x000000000000000000000000000000000006f89a` |
| USDC Bridged | `0x0000000000000000000000000000000000101Ae3` |

Smart prioritization: uses native first, then bridged. Supports mixed allowances.

On testnet, create custom test tokens with **6 decimals** to match production behavior.

### Whitelist Discounts

Configurable percentage (0-100%) applied to all three payment methods automatically for whitelisted addresses.

## Whitelist System

**Manual:** `addToWhitelist(address[], uint256[])` -- quantity of `0` means unlimited.

**$LAZY purchase:** `purchaseWhitelistWithLazy()` -- configurable cost and slots per purchase.

**Token-gated:** `purchaseWhitelistWithToken(uint256 _serial)` -- use a specific NFT serial. Supports staked tokens via delegate registry. Serials marked as used to prevent reuse.

## Prize Mechanism

### Winner Selection

- Uses PRNG for verifiable on-chain randomness.
- Supports multiple winners (configurable count).
- Can be triggered by anyone once the edition is sold out.

### Prize Claiming

```solidity
function claimPrize(uint256 _editionSerial) external nonReentrant
```

Process (atomic):
1. Verify serial is a winner (O(1) `EnumerableSet` lookup).
2. Verify caller owns the winning edition NFT.
3. **Wipe** the edition NFT from the winner's account.
4. **Mint** a new prize token with unique metadata.
5. **Transfer** the prize token to the winner.

Bearer asset model: whoever holds the winning edition serial can claim, regardless of who originally minted it.

## Configuration Structs

```solidity
struct MintEconomics {
    bool lazyFromContract;      // Contract pays LAZY (sponsorship)
    uint256 mintPriceHbar;      // Price in tinybars
    uint256 mintPriceLazy;      // Price in LAZY tokens
    uint256 mintPriceUsdc;      // Price in USDC (6 decimals)
    uint256 wlDiscount;         // Whitelist discount (0-100%)
    uint256 maxMint;            // Max per transaction (0 = unlimited)
    uint256 buyWlWithLazy;      // LAZY cost for WL purchase
    uint256 wlSlotsPerPurchase; // WL slots per purchase
    uint256 maxWlAddressMint;   // Max mints for WL addresses
    uint256 maxMintPerWallet;   // Max total per wallet
    address wlToken;            // Token for WL purchase
}

struct MintTiming {
    uint256 lastMintTime;
    uint256 mintStartTime;
    bool mintPaused;
    bool wlOnly;
}
```

## View Functions

| Function | Returns |
|----------|---------|
| `getContractState()` | Phase, counts, supply info, winning serials |
| `getWhitelistStatus(address)` | WL status, allocation, minted count |
| `calculateMintCost(uint256, address)` | HBAR cost, LAZY cost, USDC cost |
| `canAddressMint(address, uint256)` | Eligibility bool + reason string |
| `getWinningSerials()` | Array of winning serial numbers |
| `isWinningSerial(uint256)` | Whether a specific serial won |

## Events

```solidity
event EditionMintEvent(address indexed minter, bool isLazyPayment, uint256 quantity, uint256 totalPaid);
event WinnerSelectedEvent(uint256[] winningSerials, uint256 timestamp);
event PrizeClaimedEvent(address indexed claimer, uint256 indexed editionSerial, uint256 timestamp);
event EditionWithPrizeEvent(ContractEventType indexed eventType, address indexed msgAddress, uint256 msgNumeric);
```

## Deployment Checklist

### Constructor Parameters

1. **LAZY Token** address
2. **LSCT** (Lazy Smart Contract Treasury) address
3. **Burn Percentage** (0-100%)
4. **PRNG Generator** address
5. **Delegate Registry** address
6. **USDC Native** address (network-specific)
7. **USDC Bridged** address (network-specific)

### Initialization Steps

1. Deploy contract with constructor parameters.
2. Initialize edition token (`initializeEditionToken`).
3. Initialize prize token (`initializePrizeToken`).
4. Configure economics (`updateMintCost`, etc.).
5. Set timing (`setMintStartTime`).
6. Unpause when ready (`setPaused(false)`).

## Related Documentation

- [MinterContract](./minter-contract.md) -- standard transferable NFT minting
- [SoulboundMinter](./soulbound-minter.md) -- soulbound NFTs
- [ForeverMinter](./forever-minter.md) -- pool-based distribution
- [BadgeMinter](./badge-minter.md) -- multi-type soulbound badges
- [Shared Concepts](../shared-concepts.md) -- $LAZY integration, whitelist patterns, common errors
- [Prerequisites](../getting-started/prerequisites.md) -- development environment setup
- [EditionWithPrize Business Logic](../EditionWithPrize-BUSINESS-LOGIC.md) -- detailed user guide
- [EditionWithPrize Testing](../EditionWithPrize-TESTING.md) -- test plan
