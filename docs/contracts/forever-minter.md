# ForeverMinter

**Version:** 1.0.5 | **Status:** Production Ready | **Size:** 18.874 KiB

## Overview

**ForeverMinter** is a pool-based NFT distribution system that manages and distributes **existing** NFT serials rather than minting new tokens. It features a triple discount system, royalty-compliant transfers, a refund-to-pool mechanism, and multi-admin access control.

### Key Differentiator

ForeverMinter **respects Hedera royalty fees** on all transfers via the TokenStakerV2 stake/unstake pattern, making it suitable for secondary distribution while preserving creator royalties.

## Primary Use Cases

- Distributing existing NFT collections from a managed pool
- Staking rewards and recycling systems
- Sacrifice mechanics (burn old NFTs for discounts on new ones)
- Complex holder incentive programs with multiple discount tiers
- Large collections requiring efficient, ongoing distribution

## Technical Architecture

```
ForeverMinter
  +-- TokenStakerV2  (royalty-compliant NFT transfers via stake/unstake)
  +-- Ownable        (ownership and admin management)
  +-- ReentrancyGuard
```

### Immutable Parameters

```solidity
address public immutable nftToken;       // Token being distributed
address public immutable prngGenerator;  // PRNG for random serial selection
```

### Key Dependencies

- **TokenStakerV2** -- handles royalty-compliant NFT transfers
- **LazyGasStation** -- manages $LAZY token transfers and burns
- **IPrngGenerator** -- Hedera VRF for random serial selection
- **LazyDelegateRegistry** -- delegation support (optional)

## Pool-Based Distribution Model

The serial pool is an `EnumerableSet` of available NFT serials with O(1) add/remove/contains operations.

**Pool sources:** treasury deposits, user stakes, refunds
**Pool consumption:** mints (PRNG-selected)
**Max batch:** 50 NFTs per transaction

### User Minting Flow

1. Frontend calls `calculateMintCost()` to get pricing with applicable discounts
2. User sends HBAR and/or $LAZY payment
3. PRNG selects random serial(s) from pool
4. NFTs transferred with royalty compliance
5. Payment amounts recorded for refund eligibility

## Triple Discount System

### 1. Whitelist Discount

Fixed percentage off the base price. Purchasable with $LAZY tokens. Per-wallet slot tracking. Can stack with Holder discount.

### 2. Holder Discount

Based on NFT ownership of designated discount tokens. Global per-serial usage tracking prevents reuse across wallets. Multiple tiers supported (e.g., 10%, 20%, 30%). Can stack with Whitelist discount.

### 3. Sacrifice Discount

**Exclusive** -- cannot stack with other discounts. Users burn existing NFTs to earn the highest discount tier. Burned NFTs are permanently removed. Max 20 NFTs per sacrifice transaction.

### Discount Calculation Waterfall

```
Base Price -> WL Discount -> Holder Discount -> Final Price
                    OR
Base Price -> Sacrifice Discount -> Final Price (exclusive path)
```

## Refund-to-Pool Flow

- Time-window based (configurable, e.g., 60 minutes)
- Partial refund (e.g., 95% of amount actually paid)
- Refunded NFTs return to the available pool for redistribution
- NFTs obtained via sacrifice are **not** refundable (already burned)

## Key Structs

```solidity
struct MintCostResult {
    uint256 hbarCost;          // Total HBAR to pay
    uint256 lazyCost;          // Total $LAZY to pay
    uint256 totalDiscount;     // Total discount applied (%)
    uint256 holderSlotsUsed;   // Holder slots consumed
    uint256 wlSlotsUsed;       // WL slots consumed
}

struct MintPayment {
    uint256 hbarPaid;          // Actual HBAR paid
    uint256 lazyPaid;          // Actual $LAZY paid
    uint256 timestamp;         // For refund window calculation
}
```

## Admin Functions

```solidity
// Pool management
addSerialToPool(uint256 serial)
removeSerialFromPool(uint256 serial)
batchAddSerials(uint256[] serials)

// Pricing
setBasePrice(uint256 hbar, uint256 lazy)
setWLPrice(uint256 lazy)
setWLDiscount(uint256 percentage)

// Discounts
setHolderDiscounts(DiscountTier[] tiers)
setSacrificeDiscount(uint256 percentage)

// Timing
setRefundWindow(uint256 seconds)
setRefundPercentage(uint256 percentage)

// Admin management
addAdmin(address admin)
removeAdmin(address admin)
```

## Custom Errors

| Error | Meaning |
|-------|---------|
| `PoolEmpty()` | No serials available |
| `SerialNotAvailable(uint256)` | Serial not in pool |
| `InsufficientSerials()` | Not enough serials for batch |
| `InsufficientPayment(uint256, uint256)` | Underpayment |
| `InsufficientWLSlots(uint256, uint256)` | Not enough WL slots |
| `InsufficientHolderSlots(uint256, uint256)` | Holder discount depleted |
| `SacrificeDiscountNotAvailable()` | Sacrifice not allowed |
| `DiscountAlreadyUsed(uint256)` | Holder discount serial reused |
| `RefundWindowClosed(uint256, uint256)` | Past refund deadline |
| `NoRefundAvailable(uint256)` | Serial not eligible |
| `NotAdmin()` | Caller is not admin |

## Version History

| Version | Notes |
|---------|-------|
| 1.0.5 (Current) | DRY refactoring, `calculateMintCost()` returns 5 values (added `holderSlotsUsed`, `wlSlotsUsed`), fixed slot over-consumption edge cases. **Breaking:** `calculateMintCost()` return signature changed. |
| 1.0.4 | Initial working implementation, known slot consumption issues. |
| 1.0 | Original specification and design. |

## Detailed Design Documents

ForeverMinter has extensive supplementary documentation in `docs/`:

| Document | Audience | Content |
|----------|----------|---------|
| [ForeverMinter-SUMMARY.md](../ForeverMinter-SUMMARY.md) | All | Quick reference, roadmap, version history |
| [ForeverMinter-DESIGN.md](../ForeverMinter-DESIGN.md) | Developers, Auditors | Full technical spec, function-by-function detail |
| [ForeverMinter-BUSINESS-LOGIC.md](../ForeverMinter-BUSINESS-LOGIC.md) | Frontend Devs, Users | Plain-English guide, 40+ FAQs |
| [ForeverMinter-TESTING.md](../ForeverMinter-TESTING.md) | QA Engineers | 200+ test cases, coverage goals |
| [ForeverMinter-TODO.md](../ForeverMinter-TODO.md) | Implementation Team | 23-phase checklist, ~300 items |
| [ForeverMinter-IMPLEMENTATION-SUMMARY.md](../ForeverMinter-IMPLEMENTATION-SUMMARY.md) | Project Managers | Progress tracking, deployment details |

## Related Documentation

- [MinterContract](./minter-contract.md) -- standard transferable NFT minting
- [SoulboundMinter](./soulbound-minter.md) -- non-transferable badge minting
- [BadgeMinter](./badge-minter.md) -- multi-type soulbound badges
- [Shared Concepts](../shared-concepts.md) -- $LAZY integration, whitelist patterns, contract comparison table
- [Prerequisites](../getting-started/prerequisites.md) -- development environment setup
