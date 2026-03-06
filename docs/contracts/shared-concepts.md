# Shared Concepts

This document consolidates the cross-cutting features and patterns shared across the Hedera SC Minter contract suite. Individual contract READMEs should reference this document rather than duplicating these sections.

---

## Table of Contents

1. [$LAZY Token Integration](#lazy-token-integration)
2. [Whitelist System](#whitelist-system)
3. [Refund / Cooldown Mechanics](#refund--cooldown-mechanics)
4. [Custom Errors Reference](#custom-errors-reference)
5. [Hedera-Specific Patterns](#hedera-specific-patterns)
6. [Admin Access Control](#admin-access-control)
7. [Contract Comparison Table](#contract-comparison-table)

---

## $LAZY Token Integration

$LAZY is the fungible utility token of the Lazy Superheroes ecosystem on Hedera. All main minting contracts except SoulboundBadgeMinter integrate with $LAZY for payments, whitelist purchases, and token burning.

### How It Works

Each contract that supports $LAZY is deployed with three constructor parameters related to it:

| Parameter | Purpose |
|-----------|---------|
| `lazy` (address) | The $LAZY HTS token address |
| `lsct` (address) | Lazy Smart Contract Treasury -- the `IBurnableHTS` contract that executes burns |
| `lazyBurnPerc` (uint256) | Percentage of every $LAZY payment that is burned (0--100) |

These are stored in the `LazyDetails` struct:

```solidity
struct LazyDetails {
    address lazyToken;
    uint256 lazyBurnPerc;
    IBurnableHTS lazySCT;
}
```

### $LAZY Is Optional

Every contract can operate without $LAZY. If the deployer sets `mintPriceLazy = 0` and `buyWlWithLazy = 0`, no $LAZY is required from users. The HBAR-only path still functions normally.

### Lazy Burn Percentage

On every mint that involves $LAZY, a configurable percentage of the $LAZY payment is burned through the Lazy Smart Contract Treasury (`lazySCT`). The remaining portion stays in the contract. The burn percentage is updateable by the owner via `updateLazyBurnPercentage()`.

### Lazy From Contract (Sponsorship)

The `lazyFromContract` flag in `MintEconomics` controls who pays the $LAZY portion of the mint cost:

- **`false` (default)** -- The minting user pays $LAZY from their own balance via allowance.
- **`true`** -- The contract itself pays $LAZY from its own balance. This enables sponsorship models where the deployer pre-funds the contract with $LAZY so users only need to pay HBAR.

### LazyGasStation

ForeverMinter routes all $LAZY operations through the **LazyGasStation** contract rather than handling transfers directly. The LazyGasStation:

- Accepts $LAZY from users (via allowance) or from the calling contract
- Executes the burn percentage through the LSCT
- Manages gas refills for contracts that need HBAR to execute HTS operations
- Provides a role-based access control system so only authorized contracts can call it

Contracts that use LazyGasStation: **ForeverMinter**, **EditionWithPrize**

Contracts that handle $LAZY directly: **MinterContract**, **SoulboundMinter**

---

## Whitelist System

All five contracts support whitelisting, though the implementations vary by contract version and use case. Three distinct whitelist mechanisms are available.

### Mechanism 1: Address-Based Manual Whitelist

The contract owner (or admin, in multi-admin contracts) manually adds addresses with an allocation quantity.

```solidity
// MinterContract / SoulboundMinter
function addToWhitelist(address[] memory _newAddresses) external onlyOwner

// SoulboundBadgeMinter (per-badge-type)
function addToBadgeWhitelist(uint256 _typeId, address[] memory _addresses, uint256[] memory _quantities) external onlyAdmin

// EditionWithPrize (with quantities)
function addToWhitelist(address[] memory _addresses, uint256[] memory _quantities) external onlyOwner

// ForeverMinter
function addToWhitelist(address[] memory _addresses, uint256[] memory _quantities) external onlyAdmin
```

In SoulboundBadgeMinter and EditionWithPrize, a quantity of `0` means unlimited mints for that address. In MinterContract and SoulboundMinter, the default allocation is controlled by `maxWlAddressMint`.

### Mechanism 2: Token-Based Whitelist Purchase

Users gain whitelist access by proving ownership of a specific NFT. The serial number is recorded to prevent reuse.

- Supported by: **MinterContract**, **SoulboundMinter**, **EditionWithPrize**
- The WL token address is set via `updateWlToken()` or in the economics config
- Each serial can only be used once (`wlSerialsUsed` set)
- EditionWithPrize also supports delegate registry verification for staked tokens

### Mechanism 3: $LAZY Whitelist Purchase

Users spend $LAZY tokens to buy whitelist slots.

```solidity
// MinterContract / SoulboundMinter
function buyWlWithLazy() external returns (uint256 _wlSpotsPurchased)

// EditionWithPrize
function purchaseWhitelistWithLazy() external nonReentrant

// ForeverMinter
function buyWlWithLazy() external nonReentrant
```

The cost per slot is configured via `buyWlWithLazy` in `MintEconomics`. The $LAZY spent follows the same burn percentage rules as minting payments.

### Whitelist Discount

Whitelisted users receive a percentage discount on mint costs. The discount is configured via `wlDiscount` (0--100%) and applies to both HBAR and $LAZY prices.

```
Discounted Price = Base Price * (100 - wlDiscount) / 100
```

In **ForeverMinter**, the WL discount can stack with the Holder discount but not with the Sacrifice discount.

### Whitelist-Only Mode

All contracts except SoulboundBadgeMinter support a WL-only toggle (`wlOnly`). When enabled, only whitelisted addresses can mint. This is typically used for early-access phases before opening minting to the public.

---

## Refund / Cooldown Mechanics

### Cooldown System (MinterContract, SoulboundMinter)

These contracts track the last mint timestamp per wallet. After minting, a user must wait for the `cooldownPeriod` to elapse before minting again. Two separate cooldowns are tracked:

- **HBAR Cooldown** -- Enforced when paying with HBAR
- **$LAZY Cooldown** -- Enforced when paying with $LAZY

Custom errors `HbarCooldown()` and `LazyCooldown()` are emitted when the cooldown has not elapsed.

### Refund: Burn-Based (MinterContract, SoulboundMinter)

Users can burn their minted NFTs within a configurable `refundWindow` (seconds since mint) to receive a refund of their original payment. The refund is calculated proportionally based on the HBAR and $LAZY originally paid for each serial.

**Flow:**
1. User calls `burnForRefund(int64[] memory _serials)`
2. Contract validates the user owns each serial and the serial was minted within the refund window
3. NFTs are burned via HTS `burnToken()`
4. HBAR and $LAZY refunds are transferred to the user
5. Contract state is updated (totalMinted decremented, serial tracking removed)

### Refund: Pool Return (ForeverMinter)

ForeverMinter does not burn NFTs on refund. Instead, NFTs are returned to the available serial pool for redistribution.

**Flow:**
1. User calls `refundNFT(uint256 serial)` within the refund window
2. Contract validates the serial was minted by this user and is within the time window
3. A configurable refund percentage (e.g., 95%) of the original HBAR and $LAZY paid is returned
4. The NFT is transferred back to the contract's pool
5. The serial becomes available for future mints

**Key differences from burn-based refund:**
- NFTs are recycled, not destroyed
- Refund percentage is configurable (not necessarily 100%)
- Serials used for sacrifice discounts are blocked from refund (`RefundBlockedDueToDiscountUsage`)
- Withdrawal of staked serials is blocked during the refund window (`WithdrawalDuringRefundWindow`)

---

## Custom Errors Reference

All contracts use custom Solidity errors for gas efficiency. Errors are organized below by contract, with shared errors noted.

### MinterContract

| Error | Parameters | Description |
|-------|-----------|-------------|
| `NotReset` | `address token` | Token already initialized |
| `MemoTooLong` | -- | Memo exceeds 100 bytes |
| `TooManyFees` | -- | More than 10 royalty fees |
| `TooMuchMetadata` | -- | Metadata array exceeds max supply |
| `EmptyMetadata` | -- | No metadata provided |
| `FailedToMint` | -- | Token creation via HTS failed |
| `BadQuantity` | `uint256 quantity` | Invalid mint quantity (zero) |
| `NotOpen` | -- | Minting has not started yet |
| `Paused` | -- | Minting is paused |
| `NotWL` | -- | Not whitelisted during WL-only mode |
| `NotEnoughWLSlots` | -- | Whitelist allocation exhausted |
| `MintedOut` | -- | All NFTs have been minted |
| `MaxMintExceeded` | -- | Exceeds per-transaction limit |
| `MaxMintPerWalletExceeded` | -- | Exceeds per-wallet lifetime limit |
| `NotEnoughLazy` | -- | Insufficient $LAZY balance/allowance |
| `NotEnoughHbar` | -- | Insufficient HBAR sent with transaction |
| `FailedNFTMint` | -- | NFT mint operation failed |
| `NFTTransferFailed` | -- | Transfer of minted NFT to user failed |
| `AssociationFailed` | -- | Token association failed |
| `FailedToPayLazy` | -- | $LAZY transfer to contract failed |
| `BurnFailed` | -- | Burn operation failed |
| `LazyCooldown` | -- | Must wait before next $LAZY payment |
| `HbarCooldown` | -- | Must wait before next HBAR payment |
| `WLPurchaseFailed` | -- | Whitelist purchase with $LAZY failed |
| `NoWLToken` | -- | No WL token configured |
| `WLTokenUsed` | -- | WL serial already redeemed |
| `NotTokenOwner` | -- | Caller does not own the required token |
| `MaxSerials` | -- | Too many serials in batch operation |
| `BadArguments` | -- | Generic invalid function arguments |

### SoulboundMinter

Shares all MinterContract errors (without parameters on `NotReset` and `BadQuantity`) plus:

| Error | Parameters | Description |
|-------|-----------|-------------|
| `NotReset` | -- | Token already initialized |
| `BadQuantity` | -- | Invalid mint quantity |
| `FreezingFailed` | -- | Failed to freeze token (make soulbound) |
| `UnFreezingFailed` | -- | Failed to unfreeze token (for revocation) |
| `NotRevokable` | -- | Contract was not deployed as revocable |
| `NFTNotOwned` | -- | Target user does not own the serial |

### ForeverMinter

| Error | Parameters | Description |
|-------|-----------|-------------|
| `NotAdmin` | -- | Caller is not an admin |
| `NotOwnerOfSerial` | `uint256 serial` | Caller does not own the specified serial |
| `MintPaused` | -- | Minting is paused |
| `MintNotStarted` | -- | Minting has not started yet |
| `MintedOut` | -- | No serials available in pool |
| `InvalidQuantity` | -- | Invalid mint quantity |
| `ExceedsMaxMint` | -- | Exceeds per-transaction limit |
| `ExceedsMaxMintPerWallet` | -- | Exceeds per-wallet limit |
| `ExceedsMaxWlMint` | -- | Exceeds WL allocation |
| `NotEnoughHbar` | -- | Insufficient HBAR |
| `NotEnoughLazy` | -- | Insufficient $LAZY |
| `InvalidDiscount` | -- | Invalid discount configuration |
| `DiscountSerialNotOwned` | `uint256 serial` | Holder discount serial not owned by caller |
| `DiscountSerialMaxUsesReached` | `uint256 serial` | Holder discount serial exhausted |
| `ExceedsMaxSacrifice` | -- | Too many NFTs in sacrifice (max 20) |
| `SacrificeSerialNotOwned` | `uint256 serial` | Sacrifice serial not owned by caller |
| `RefundWindowExpired` | -- | Refund window has closed |
| `InvalidRefundSerial` | `uint256 serial` | Serial not eligible for refund |
| `RefundBlockedDueToDiscountUsage` | `uint256 serial` | Cannot refund serials used for discounts |
| `WhitelistOnly` | -- | Minting restricted to whitelisted users |
| `CannotRemoveLastAdmin` | -- | Would leave contract without admins |
| `WithdrawalDuringRefundWindow` | -- | Cannot withdraw staked serial during refund window |
| `InvalidParameter` | -- | Generic invalid parameter |
| `SerialNotInPool` | `uint256 serial` | Serial is not in the available pool |
| `SerialAlreadyInPool` | `uint256 serial` | Serial is already in the pool |
| `TransferFailed` | -- | HBAR or NFT transfer failed |
| `EmptyArray` | -- | Empty array passed to batch operation |
| `ArrayLengthMismatch` | -- | Mismatched array lengths |

### SoulboundBadgeMinter

| Error | Parameters | Description |
|-------|-----------|-------------|
| `NotAdmin` | -- | Caller is not an admin |
| `AdminAlreadyExists` | -- | Address is already an admin |
| `AdminNotFound` | -- | Address is not an admin |
| `CannotRemoveLastAdmin` | -- | Would leave contract without admins |
| `TypeNotFound` | -- | Badge type ID does not exist |
| `TypeInactive` | -- | Badge type is deactivated |
| `NotWhitelistedForType` | -- | User not on this badge type's whitelist |
| `TypeMintedOut` | -- | Badge type supply exhausted |
| `NotEnoughWLSlots` | -- | Whitelist allocation exhausted |
| `BadQuantity` | -- | Invalid mint quantity |
| `BadArguments` | -- | Invalid function arguments |
| `UnlimitedBadgeNotAllowed` | -- | Cannot create unlimited badge on capped token |
| `FailedToMint` | -- | Token creation via HTS failed |
| `FailedNFTMint` | -- | NFT mint operation failed |
| `NFTTransferFailed` | -- | Transfer of minted NFT failed |
| `FreezingFailed` | -- | Failed to freeze token (make soulbound) |
| `BurnFailed` | -- | Burn operation failed |
| `UnFreezingFailed` | -- | Failed to unfreeze token |
| `TokenAlreadyInitialized` | -- | Token was already created |
| `TokenNotInitialized` | -- | Token must be created first |
| `MaxSerialsExceeded` | -- | Too many serials in batch |
| `NotRevokable` | -- | Contract not deployed as revocable |
| `NFTNotOwned` | -- | Target user does not own the serial |

### EditionWithPrize

| Error | Parameters | Description |
|-------|-----------|-------------|
| `NotInitialized` | -- | Token not yet initialized |
| `AlreadyInitialized` | -- | Token already initialized |
| `InvalidPhase` | -- | Operation not allowed in current phase |
| `EditionNotSoldOut` | -- | Cannot select winner until sold out |
| `WinnerAlreadySelected` | -- | Winners already chosen |
| `PrizeAlreadyClaimed` | -- | Prize already claimed for this serial |
| `NotWinningSerial` | -- | Serial was not selected as winner |
| `NotSerialOwner` | -- | Caller does not own the serial |
| `MintedOut` | -- | All editions minted |
| `MaxSupplyReached` | -- | Maximum supply reached |
| `NotOpen` | -- | Minting has not started |
| `Paused` | -- | Minting is paused |
| `NotWL` | -- | Not whitelisted during WL-only mode |
| `NotEnoughWLSlots` | -- | Whitelist allocation exhausted |
| `MaxMintExceeded` | -- | Exceeds per-transaction limit |
| `MaxMintPerWalletExceeded` | -- | Exceeds per-wallet limit |
| `NotEnoughLazy` | -- | Insufficient $LAZY |
| `NotEnoughHbar` | -- | Insufficient HBAR |
| `NotEnoughUsdc` | -- | Insufficient USDC balance/allowance |
| `BadQuantity` | -- | Invalid mint quantity |
| `BadArguments` | -- | Invalid function arguments |
| `AssociationFailed` | -- | Token association failed |
| `FailedToMint` | -- | Token creation via HTS failed |
| `TransferFailed` | -- | Token transfer failed |
| `WipeFailed` | -- | Wipe operation failed |
| `PaymentFailed` | -- | Payment transfer failed |
| `BurnFailed` | -- | Burn operation failed |
| `WLPurchaseFailed` | -- | Whitelist purchase failed |
| `NoWLToken` | -- | No WL token configured |
| `WLTokenUsed` | -- | WL serial already redeemed |
| `NotTokenOwner` | -- | Does not own the required token |
| `TooManyFees` | -- | More than 10 royalty fees |
| `EmptyMetadata` | -- | No metadata provided |
| `UsdcWithdrawFailed` | -- | USDC withdrawal failed |
| `NotAdmin` | -- | Caller is not an admin |

---

## Hedera-Specific Patterns

### HTS Precompile

All token operations go through the **Hedera Token Service (HTS) precompile** at address `0x167`. This is a system contract on Hedera that provides native token create, mint, transfer, burn, freeze, wipe, and association operations. Contracts call HTS via Solidity function calls that are routed to the precompile by the Hedera EVM.

A deprecated v2 precompile exists at `0x16c` with `int64`-based parameters (see the v2 helper chain in [design.md](../architecture/design.md)), but no production contracts use it.

### Response Codes

Every HTS call returns an `int32` response code. Contracts check this against `HederaResponseCodes.SUCCESS` (value `22`) and revert with a custom error if the operation failed. Common response codes include:

| Code | Name | Meaning |
|------|------|---------|
| 22 | `SUCCESS` | Operation completed successfully |
| -1 | `INSUFFICIENT_TX_FEE` | Not enough gas/fee for the transaction |
| -4 | `INVALID_SIGNATURE` | Missing or invalid key authorization |

### Token Association

Before any account can hold an HTS token, it must **associate** with that token. Contracts handle this automatically where possible:

- Contracts associate with $LAZY in their constructor
- The `IHRC719` interface provides `associate()` for self-association
- Users must associate with the NFT token before receiving minted NFTs
- `AssociationFailed()` errors indicate the association step failed

### Soulbound Tokens via Freeze Key

Hedera does not have a native soulbound token primitive. The minter suite implements soulbound behavior by:

1. Creating the NFT token with a **FREEZE key** assigned to the contract
2. After transferring a minted NFT to the user, the contract **freezes** the user's account for that token
3. A frozen account cannot transfer the token, making it effectively soulbound

For revocation (if enabled):
1. **Unfreeze** the user's token
2. **Transfer** the NFT back to the contract (treasury)
3. **Burn** the NFT

Contracts using this pattern: **SoulboundMinter**, **SoulboundBadgeMinter**

### Contract Keys

When creating an NFT token via HTS, the contract assigns itself as the holder of specific keys that grant operational authority:

| Key | Purpose | Used By |
|-----|---------|---------|
| **SUPPLY** | Mint and burn tokens | All contracts that mint |
| **PAUSE** | Pause/unpause token transfers | MinterContract, SoulboundMinter, EditionWithPrize |
| **FREEZE** | Freeze/unfreeze accounts (soulbound) | SoulboundMinter, SoulboundBadgeMinter |
| **WIPE** | Wipe tokens from user accounts (revocation, prize claim) | SoulboundMinter, SoulboundBadgeMinter, EditionWithPrize |
| **ADMIN** | Update token properties | Varies by contract |

Keys are encoded as a bitmask using the `Bits` library from `KeyHelper`:

```
ADMIN=1, KYC=2, FREEZE=4, WIPE=8, SUPPLY=16, FEE=32, PAUSE=64
```

### Expiry and Auto-Renew

Every HTS token requires an expiry configuration. Contracts set the token's `autoRenewAccount` to the contract address itself and use the default auto-renew period of 90 days (`7,776,000` seconds). The `ExpiryHelper` contract provides utilities for constructing these parameters.

### Token Types

HTS supports two token types, both used in this suite:

- **NON_FUNGIBLE_UNIQUE** -- NFTs with individual serial numbers and per-serial metadata. Used by all minting contracts.
- **FUNGIBLE_COMMON** -- Divisible tokens with a total supply. Used for $LAZY and USDC.

---

## Admin Access Control

### Owner-Only Contracts

**MinterContract** and **SoulboundMinter** use OpenZeppelin's `Ownable` for access control. Only the contract owner can execute administrative functions. There is no multi-admin support.

### Multi-Admin Contracts

**ForeverMinter**, **SoulboundBadgeMinter**, and **EditionWithPrize** support multiple administrators via `EnumerableSet.AddressSet`:

```solidity
EnumerableSet.AddressSet private admins;
```

**Admin capabilities:**
- Add/remove other admins
- Manage whitelists
- Update contract parameters
- Pool management (ForeverMinter)
- Badge CRUD (SoulboundBadgeMinter)

**Safeguards:**
- The contract owner is always implicitly an admin
- The last admin cannot be removed (`CannotRemoveLastAdmin` error)
- Ownership transfer follows OpenZeppelin's `Ownable` pattern

| Contract | Admin Model | Add Admin | Remove Admin |
|----------|------------|-----------|-------------|
| MinterContract | Owner only | N/A | N/A |
| SoulboundMinter | Owner only | N/A | N/A |
| ForeverMinter | Multi-admin | `addAdmin()` | `removeAdmin()` |
| SoulboundBadgeMinter | Multi-admin | `addAdmin()` | `removeAdmin()` |
| EditionWithPrize | Owner only | N/A | N/A |

---

## Contract Comparison Table

| Feature | MinterContract | SoulboundMinter | ForeverMinter | SoulboundBadgeMinter | EditionWithPrize |
|---------|---------------|-----------------|---------------|---------------------|-----------------|
| **Version** | v2.0 | v2.0 | v1.0.5 | v1.0 | v1.0 |
| **Token Type** | Transferable NFT | Soulbound NFT | Transferable NFT | Soulbound NFT | Transferable NFT |
| **Primary Use Case** | Standard NFT sales | Badges / Certificates | Pool-based distribution | Multi-badge system | Gamified edition + prize |
| **Transferability** | Yes | No (frozen) | Yes | No (frozen) | Yes |
| **Creates New Tokens** | Yes | Yes | No (distributes existing) | Yes | Yes |
| **Payment: HBAR** | Yes | Yes | Yes | No | Yes |
| **Payment: $LAZY** | Yes | Yes | Yes (via LazyGasStation) | No | Yes |
| **Payment: USDC** | No | No | No | No | Yes |
| **Whitelist System** | Address + Token-gated + $LAZY | Address + Token-gated + $LAZY | Address + $LAZY | Per-badge whitelist | Address + Token-gated + $LAZY |
| **WL Discount** | Yes | Yes | Yes (stackable) | No | Yes |
| **Holder Discount** | No | No | Yes (stackable with WL) | No | No |
| **Sacrifice Discount** | No | No | Yes (exclusive) | No | No |
| **Refund System** | Burn-based, time window | Burn-based, time window | Pool return, time window | No | No |
| **Cooldown System** | Yes (HBAR + $LAZY) | Yes (HBAR + $LAZY) | No | No | No |
| **Batch Minting** | Yes | Yes | Yes (max 50) | Yes | Yes |
| **On-Behalf Minting** | No | Yes | No | Yes | No |
| **Revocation** | No | Optional (constructor) | No | Optional (constructor) | No |
| **Admin System** | Owner only | Owner only | Multi-admin | Multi-admin | Owner only |
| **Metadata** | Sequential / Random (PRNG) | Sequential / Random (PRNG) | Pool selection (PRNG) | Per-badge-type | Fixed edition |
| **Supply Model** | Fixed or unlimited | Fixed or unlimited | Pool-based | Fixed or unlimited per badge | Fixed |
| **Phase System** | No | No | No | No | Yes (5 phases) |
| **$LAZY Burn %** | Direct | Direct | Via LazyGasStation | N/A | Via LazyGasStation |
| **Contract Size** | 19.402 KiB | 20.436 KiB | 18.874 KiB | 14.824 KiB | ~20.3 KiB |

### When to Use Each Contract

**MinterContract** -- Standard NFT collection drops with transferable tokens, HBAR + $LAZY payment, optional refund window, and cooldown-based rate limiting.

**SoulboundMinter** -- Non-transferable credentials, achievement badges, certificates, or membership tokens. Supports on-behalf minting for gas abstraction and optional admin revocation.

**ForeverMinter** -- Distributing an existing pool of NFTs with advanced discount mechanics (WL + holder + sacrifice stacking), royalty-compliant transfers via staking, and pool-based refunds.

**SoulboundBadgeMinter** -- Organizations needing multiple badge categories under one token contract, each with independent whitelists, supply limits, and metadata. Multi-admin for team management.

**EditionWithPrize** -- Gamified edition mints where all editions share identical metadata, then random winners are selected to claim unique 1-of-1 prize tokens. Supports HBAR + $LAZY + USDC triple payment.
