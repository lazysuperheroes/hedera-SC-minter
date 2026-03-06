# SoulboundBadgeMinter

**Version:** 1.0 | **Status:** Production Ready | **Size:** 14.824 KiB

## Overview

The `SoulboundBadgeMinter` manages **multiple badge types within a single soulbound token contract**. Each badge type has its own metadata, whitelist, supply limit, and active/inactive state. It supports multi-admin management, on-behalf minting, optional revocation, and comprehensive capacity analysis.

Unlike `SoulboundMinter` (single-purpose soulbound tokens with $LAZY integration), this contract is designed for organizations that need many categories of badges -- achievements, roles, tiers, attendance proofs -- all on one HTS token.

## Key Differences from SoulboundMinter

| Aspect | SoulboundBadgeMinter | SoulboundMinter |
|--------|---------------------|-----------------|
| Badge types | Multiple per contract | Single purpose |
| Whitelists | Per-badge-type | Single global whitelist |
| Admin model | Multi-admin (EnumerableSet) | Owner only |
| Payment | HBAR only (no $LAZY) | HBAR + $LAZY |
| Refund system | No | Yes (time-based) |
| Architecture | v1.0 (require strings) | v2.0 (custom errors) |

## Type-Based Badge System

### Creating Badges

```solidity
function createBadge(
    string memory _name,
    string memory _metadata,
    uint256 _maxSupply        // 0 = unlimited
) external onlyAdmin returns (uint256 _typeId)
```

Each badge type gets a unique ID and can be independently activated or deactivated.

### Updating Badges

```solidity
function updateBadge(uint256 _typeId, string memory _name, string memory _metadata, uint256 _maxSupply) external onlyAdmin
function setBadgeActive(uint256 _typeId, bool _active) external onlyAdmin
```

### Per-Type Whitelist

```solidity
function addToBadgeWhitelist(uint256 _typeId, address[] memory _addresses, uint256[] memory _quantities) external onlyAdmin
function removeFromBadgeWhitelist(uint256 _typeId, address[] memory _addresses) external onlyAdmin
```

Quantities: `0` = unlimited mints for that address and type; `>0` = specific allocation.

## Multi-Admin System

```solidity
function addAdmin(address _admin) external onlyAdmin
function removeAdmin(address _admin) external onlyAdmin
function isAdmin(address _address) external view returns (bool)
function getAdmins() external view returns (address[] memory)
```

- The contract owner is always considered an admin.
- Last-admin protection prevents removing the final admin (avoids orphaning the contract).
- Admins can create badge types, manage whitelists, and toggle badge activation.

## Minting

```solidity
function mintBadge(uint256 _typeId, uint256 _numberToMint) external returns (int64[] memory _serials)
function mintBadgeOnBehalf(uint256 _typeId, uint256 _numberToMint, address _onBehalfOf) external returns (int64[] memory _serials)
```

Follows the unfreeze/transfer/freeze pattern for users who already hold badges on this token:
1. Check if user has existing tokens; if yes, unfreeze.
2. Execute mint.
3. Transfer to user.
4. Freeze to maintain soulbound property.

Enforces: badge active, user whitelisted for type, per-type supply limits, per-user allocation.

## Burning and Revocation

### Burning

```solidity
function burnNFTs(int64[] memory _serialNumbers) external returns (uint64 _newTotalSupply)
```

Properly decrements per-type and per-user mint counts using the serial-to-type mapping.

### Revocation (Revocable Contracts Only)

```solidity
function revokeSBT(address _user, uint256 _serialToWipe) external onlyOwner returns (int32 responseCode)
```

Wipes the NFT from the user's account, removes them from that badge type's whitelist, and updates all tracking counters. Only available when deployed with `REVOCABLE = true`.

## Token Initialization

```solidity
function initialiseNFTMint(
    string memory _name,
    string memory _symbol,
    string memory _memo,
    int64 _maxSupply,
    bool _unlimitedSupply
) external payable onlyOwner returns (address _createdTokenAddress, uint256 _tokenSupply)
```

The token-level max supply caps the total across all badge types. Individual badge types have their own `_maxSupply` within that cap.

## Query Functions

### Badge Information

| Function | Returns |
|----------|---------|
| `getBadge(uint256 _typeId)` | Name, metadata, totalMinted, maxSupply, active status |
| `getActiveBadgeIds()` | Array of active badge type IDs |
| `getBadgeRemainingSupply(uint256)` | Remaining mintable count for a type |
| `getSerialBadgeId(uint256)` | Which badge type a serial belongs to |

### User Information

| Function | Returns |
|----------|---------|
| `getUserBadgeEligibility(uint256, address)` | Eligible bool, remaining mints, already minted |
| `getUserBadgeMintCounts(address, uint256[])` | Mint counts per type for a user |
| `getBadgeWhitelist(uint256)` | Addresses and quantities for a type's whitelist |

### Capacity Analysis

| Function | Returns |
|----------|---------|
| `getToken()` | Token address |
| `getMaxSupply()` | Token-level max supply |
| `getRemainingSupply()` | Token-level remaining |
| `getReservedCapacity()` | Total reserved across all badge types |
| `getUnreservedCapacity()` | Available for new badge types |
| `getTotalBadgeCapacity()` | Sum of all badge type max supplies |
| `getCapacityAnalysis()` | Combined view: token max, minted, remaining, badge capacity, reserved, has-unlimited flag |

## Error Handling

Uses `require()` with string messages (v1.0 architecture):

| Error | Meaning |
|-------|---------|
| `NotAdmin` / `AdminAlreadyExists` / `AdminNotFound` / `CannotRemoveLastAdmin` | Admin management |
| `TypeNotFound` / `TypeInactive` | Badge type issues |
| `NotWhitelistedForType` / `TypeMintedOut` | Minting eligibility |
| `NotRevokable` / `NFTNotOwned` | Revocation issues |
| `UnlimitedBadgeNotAllowed` / `NotEnoughWLSlots` / `BadQuantity` / `BadArguments` | Validation |

## CEI Pattern Compliance

The contract follows Checks-Effects-Interactions:
- **Checks**: `_validateMintParameters`, `_checkMintEligibility`
- **Effects**: `_updateMintTracking` (state updates before external calls)
- **Interactions**: `_executeMint` (HTS calls last)

## Related Documentation

- [SoulboundMinter](./soulbound-minter.md) -- single-purpose soulbound with $LAZY
- [MinterContract](./minter-contract.md) -- transferable NFTs
- [ForeverMinter](./forever-minter.md) -- pool-based distribution
- [EditionWithPrize](./edition-with-prize.md) -- edition + prize gamification
- [Shared Concepts](../shared-concepts.md) -- whitelist patterns, contract comparison table
- [Prerequisites](../getting-started/prerequisites.md) -- development environment setup
