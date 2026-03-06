# SoulboundMinter

**Version:** 2.0 | **Status:** Production Ready | **Size:** 20.436 KiB

## Overview

The `SoulboundMinter` creates **non-transferable (soulbound) NFTs** on Hedera Token Service. Tokens are automatically frozen upon minting, permanently binding them to the recipient. Ideal for certificates, achievement badges, membership tokens, and identity credentials.

## Key Differences from MinterContract

| Aspect | SoulboundMinter | MinterContract |
|--------|-----------------|----------------|
| Transferability | Frozen at mint (soulbound) | Freely transferable |
| On-behalf minting | Yes (gas abstraction) | No |
| Revocation | Optional (set at deploy) | No |
| Freeze/Wipe keys | Required | Not used |
| Constructor param | Extra `_revocable` bool | -- |

Everything else -- whitelist system, dual-currency payments, refund window, cooldowns, batch minting -- works identically to MinterContract. See [shared-concepts.md](../shared-concepts.md) for those shared patterns.

## Soulbound Mechanics

### How Freezing Works

The token is created with both FREEZE and WIPE keys pointing to the contract address. After each mint, the contract calls `freezeToken()` on the recipient, which prevents any transfer of that token.

```solidity
int32 responseCode = freezeToken(token, _onBehalfOf);
if (responseCode != HederaResponseCodes.SUCCESS) {
    revert FreezingFailed();
}
```

### On-Behalf Minting

```solidity
function mintNFTOnBehalf(uint256 _numberToMint, address _onBehalfOf)
    external payable returns (int64[] memory, bytes[] memory)
```

Allows a caller (e.g., a gas-abstraction service) to mint and deliver soulbound tokens directly to another account. The caller pays; the recipient receives the frozen NFT.

### Revocation Flow (Optional)

Only available when the contract was deployed with `_revocable = true`. The owner can revoke any soulbound token:

1. Unfreeze the token on the user's account
2. Transfer the NFT back to the contract (treasury)
3. Burn the NFT
4. Remove the user from the whitelist

```solidity
function revokeSBT(address _user, uint256 serialToBurn)
    external onlyOwner returns (int256)
```

## Deployment

### Constructor

```solidity
constructor(
    address lsct,           // Lazy Smart Contract Treasury
    address lazy,           // $LAZY token address
    uint256 lazyBurnPerc,   // % of $LAZY to burn per mint
    bool _revocable         // Whether SBTs can be revoked (immutable)
)
```

### Token Creation

```solidity
function initialiseNFTMint(
    string memory _name,
    string memory _symbol,
    string memory _memo,
    string memory _cid,
    int64 _maxSupply,
    bool _fixedEdition,
    bool _unlimitedSupply
) external payable onlyOwner returns (address, uint256)
```

Compared to MinterContract, this adds `_fixedEdition` (repeat same metadata for all NFTs) and `_unlimitedSupply` flags.

## Administrative and Query Functions

The admin and query function sets are nearly identical to MinterContract. Notable additions:

- `revokeSBT(address, uint256)` -- revoke a soulbound token (owner only, revocable contracts only)
- `mintNFTOnBehalf(uint256, address)` -- mint for another user

All other admin functions (`updatePricing`, `updateMaxMint`, `pause`, `toggleWlOnly`, whitelist management, etc.) and query functions (`getCost`, `getMintTiming`, `getRemainingMint`, etc.) match MinterContract. See [minter-contract.md](./minter-contract.md) for the full listing.

## SoulboundMinter-Specific Errors

| Error | Meaning |
|-------|---------|
| `FreezingFailed()` | Failed to freeze token after mint |
| `UnfreezingFailed()` | Failed to unfreeze during revocation |
| `WipeFailed()` | Wipe operation failed during revocation |
| `NotRevocable()` | Revocation attempted on non-revocable contract |
| `FixedRequiresMaxSupply()` | Fixed edition mode requires a max supply |
| `UnlimitedNotAllowedWithMax()` | Cannot set both unlimited and a max supply |

For shared errors (payment, access, limits, whitelist, technical), see [shared-concepts.md](../shared-concepts.md).

## Events

```solidity
event MintEvent(address indexed msgAddress, ContractEventType indexed mintType, int64 serialMinted, bytes metadataMinted);
event BurnEvent(address indexed burnerAddress, int64[] serialsArrayBurned, uint64 newTotalSupply);
event MinterContractMessage(ContractEventType indexed eventType, address indexed msgAddress, uint256 msgNumeric);
```

Event types include: `INITIALISE`, `MINT`, `BURN`, `REFUND`, `PAUSE`, `UNPAUSE`, `REVOKE`, `WL_BUY`.

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 2.0 | October 2025 | MinterLibrary removed, custom errors, KeyHelper integration, SBTKeyType unified to KeyType, 78-byte size reduction. No public API changes. |
| 1.x | Pre-refactor | Original with MinterLibrary, string reverts, separate SBTKeyType enum. |

## Related Documentation

- [MinterContract](./minter-contract.md) -- transferable NFT variant
- [BadgeMinter](./badge-minter.md) -- multi-type soulbound badges (different architecture)
- [Shared Concepts](../shared-concepts.md) -- $LAZY integration, whitelist patterns, common errors, contract comparison table
- [Prerequisites](../getting-started/prerequisites.md) -- development environment setup
