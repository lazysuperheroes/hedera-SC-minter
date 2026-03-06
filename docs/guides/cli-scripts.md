# CLI Scripts Guide

Complete reference for all interaction scripts in the Hedera SC Minter Suite. Scripts are organized by contract type with admin scripts separated from user-facing scripts.

## Script Organization

```
scripts/
  interactions/
    *.js                          # MinterContract / SoulboundMinter scripts
    ForeverMinter/
      *.js                        # User-facing ForeverMinter scripts
      admin/*.js                  # Admin-only ForeverMinter scripts
    EditionWithPrize/
      *.js                        # User-facing EditionWithPrize scripts
      admin/*.js                  # Admin-only EditionWithPrize scripts
    BadgeMinter/
      *.js                        # SoulboundBadgeMinter scripts (admin + user)
  deployment/
    *.js                          # Contract deployment scripts
  debug/
    *.js                          # Error decoding and contract inspection
  testing/
    *.js                          # Concurrent mint testing and validation
```

## Common Patterns

All interaction scripts follow consistent patterns:

- **Interactive prompts**: Scripts ask for confirmation before executing transactions using `readline-sync`
- **Environment from `.env`**: Scripts read configuration from `.env` via `dotenv`
- **Gas estimation**: Most scripts estimate gas before execution and display the estimate
- **Transaction logging**: Successful transactions print the transaction ID and key results
- **Error handling**: Failed transactions display the error status and helpful suggestions

## MinterContract / SoulboundMinter Scripts

Located in `scripts/interactions/`. These work with both MinterContract and SoulboundMinter (set `CONTRACT_NAME` in `.env` to select which ABI to use).

### Setup and Initialization

| Script | Description | Usage |
|--------|-------------|-------|
| `prepareMinter.js` | Upload metadata, initialize token, reset contract | See flags below |

**prepareMinter.js flags**:
- `-upload <file.json>` -- Upload metadata array from JSON file
- `-init -name NNN -symbol SSS -memo MMM -cid CCC` -- Initialize NFT token
  - `-royalty <file.json>` -- Add royalty fees from JSON
  - `-max MM` -- Set max supply (0 = match metadata count)
- `-reset` -- Remove metadata data only (keep token)
- `-hardreset` -- Remove all data including token ID
- `-gas X` -- Override default gas limit
- `-h` -- Show help

### Minting

| Script | Description | Usage |
|--------|-------------|-------|
| `mint.js` | Mint NFTs (handles association, allowances, payment) | `node mint.js` |
| `mintOnBehalfOf.js` | Mint NFTs to another account | `node mintOnBehalfOf.js` |

### Pricing and Economics

| Script | Description | Usage |
|--------|-------------|-------|
| `updateCost.js` | Update HBAR and LAZY mint price | `node updateCost.js <hbar> <lazy>` |
| `updateMaxMintPerWallet.js` | Update per-wallet mint limit | `node updateMaxMintPerWallet.js` |
| `updateContractPaysLazy.js` | Toggle contract-pays-LAZY mode | `node updateContractPaysLazy.js` |
| `setCID.js` | Update base CID for metadata | `node setCID.js` |

### Whitelist Management

| Script | Description | Usage |
|--------|-------------|-------|
| `addToWhiteList.js` | Add accounts to whitelist | `node addToWhiteList.js 0.0.111,0.0.222` |
| `getWL.js` | View current whitelist | `node getWL.js` |
| `setWLOnly.js` | Enable whitelist-only minting | `node setWLOnly.js` |
| `removeWLOnly.js` | Disable whitelist-only restriction | `node removeWLOnly.js` |

### Administration

| Script | Description | Usage |
|--------|-------------|-------|
| `setPause.js` | Pause or unpause minting | `node setPause.js` |
| `getRemainingMints.js` | Check remaining supply | `node getRemainingMints.js` |
| `resetContract.js` | Reset contract state | `node resetContract.js` |
| `withdrawFunds.js` | Withdraw HBAR and LAZY | `node withdrawFunds.js` |
| `withdrawToWallet.js` | Withdraw to specific wallet | `node withdrawToWallet.js` |
| `burnNFTs.js` | Burn unsold NFTs | `node burnNFTs.js` |
| `revokeSBT.js` | Revoke soulbound tokens (SBT only) | `node revokeSBT.js` |
| `retryFailedAbstractionMints.js` | Retry failed gas-abstracted mints | `node retryFailedAbstractionMints.js` |

---

## ForeverMinter Scripts

### User Scripts

Located in `scripts/interactions/ForeverMinter/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `mint.js` | Interactive minting with discounts, sacrifice, allowances | `node mint.js [quantity]` |
| `checkMintCost.js` | Preview mint cost for a quantity | `node checkMintCost.js <quantity>` |
| `refund.js` | Refund NFTs within the refund window | `node refund.js <serial1> [serial2] ...` |
| `buyWhitelistSlots.js` | Purchase WL slots with LAZY tokens | `node buyWhitelistSlots.js [quantity]` |
| `getContractInfo.js` | View full contract configuration | `node getContractInfo.js` |
| `getPoolStatus.js` | Check available NFTs in pool | `node getPoolStatus.js` |
| `checkDiscounts.js` | View your available holder discounts | `node checkDiscounts.js [address]` |
| `checkWLSlots.js` | View your WL slot balance | `node checkWLSlots.js [address]` |
| `checkRefundEligibility.js` | Check which NFTs are eligible for refund | `node checkRefundEligibility.js <serial1> ...` |
| `getMintHistory.js` | View mint history for an address | `node getMintHistory.js [address]` |
| `manageAllowances.js` | Set up HBAR and LAZY allowances manually | `node manageAllowances.js` |
| `scanEvents.js` | Scan and display contract events | `node scanEvents.js` |

### Admin Scripts

Located in `scripts/interactions/ForeverMinter/admin/`.

#### Economics and Timing

| Script | Description | Usage |
|--------|-------------|-------|
| `updateMintEconomics.js` | Configure all pricing, limits, and discount settings | `node updateMintEconomics.js` |
| `updateMintTiming.js` | Configure start time, cooldown, refund window | `node updateMintTiming.js` |
| `setPause.js` | Pause or unpause minting | `node setPause.js <true\|false>` |
| `setLazyBurnPercentage.js` | Update LAZY burn percentage | `node setLazyBurnPercentage.js` |

#### Pool Management

| Script | Description | Usage |
|--------|-------------|-------|
| `registerPoolNFTs.js` | Register contract-owned NFTs in the pool | `node registerPoolNFTs.js` |
| `addToPool.js` | Add specific serials to pool | `node addToPool.js <serial1> [serial2] ...` |
| `emergencyWithdrawNFT.js` | Emergency withdrawal of NFTs from pool | `node emergencyWithdrawNFT.js` |

#### Discount Management

| Script | Description | Usage |
|--------|-------------|-------|
| `addDiscountTier.js` | Add a holder-based discount tier | `node addDiscountTier.js` |
| `updateDiscountTier.js` | Update an existing discount tier | `node updateDiscountTier.js` |
| `removeDiscountTier.js` | Remove a discount tier | `node removeDiscountTier.js` |
| `manageDiscountUsage.js` | Reset or adjust discount serial usage | `node manageDiscountUsage.js` |
| `setSacrificeDestination.js` | Set where sacrificed NFTs are sent | `node setSacrificeDestination.js` |

#### Whitelist Management

| Script | Description | Usage |
|--------|-------------|-------|
| `addToWhitelist.js` | Grant WL slots to an address | `node addToWhitelist.js` |
| `batchAddToWhitelist.js` | Batch grant WL slots from a file | `node batchAddToWhitelist.js` |
| `removeFromWhitelist.js` | Remove WL slots from addresses | `node removeFromWhitelist.js` |

#### Admin Management

| Script | Description | Usage |
|--------|-------------|-------|
| `addAdmin.js` | Add a new admin | `node addAdmin.js` |
| `removeAdmin.js` | Remove an admin | `node removeAdmin.js` |
| `listAdmins.js` | List all admins | `node listAdmins.js` |

#### Financial

| Script | Description | Usage |
|--------|-------------|-------|
| `withdrawHbar.js` | Withdraw HBAR from contract | `node withdrawHbar.js` |

---

## EditionWithPrize Scripts

### User Scripts

Located in `scripts/interactions/EditionWithPrize/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `mint.js` | Mint edition NFTs (HBAR + LAZY + USDC) | `node mint.js` |
| `selectWinner.js` | Select winner(s) after sold out (permissionless) | `node selectWinner.js` |
| `claimPrize.js` | Claim prize with winning edition serial | `node claimPrize.js` |
| `getContractState.js` | View full contract state and phase | `node getContractState.js` |
| `getWinnerList.js` | Display all winners and claim status | `node getWinnerList.js` |
| `checkMintCost.js` | Calculate mint costs with WL discount | `node checkMintCost.js` |
| `checkWLStatus.js` | Check whitelist eligibility | `node checkWLStatus.js` |
| `purchaseWLWithLazy.js` | Buy WL slots using LAZY tokens | `node purchaseWLWithLazy.js` |
| `purchaseWLWithToken.js` | Buy WL slots using NFT serials | `node purchaseWLWithToken.js` |

### Admin Scripts

Located in `scripts/interactions/EditionWithPrize/admin/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `initializeEditionToken.js` | Create the edition NFT collection | `node initializeEditionToken.js` |
| `initializePrizeToken.js` | Create the prize NFT collection | `node initializePrizeToken.js` |
| `updateMintEconomics.js` | Configure HBAR/LAZY/USDC pricing, discounts | `node updateMintEconomics.js` |
| `updateMintTiming.js` | Configure start time, pause state | `node updateMintTiming.js` |
| `addToWhitelist.js` | Add addresses to whitelist | `node addToWhitelist.js` |
| `removeFromWhitelist.js` | Remove addresses from whitelist | `node removeFromWhitelist.js` |
| `setWlPurchaseOptions.js` | Configure WL purchase settings | `node setWlPurchaseOptions.js` |
| `setPause.js` | Pause or unpause minting | `node setPause.js` |
| `setWlOnly.js` | Toggle whitelist-only mode | `node setWlOnly.js` |
| `withdrawHbar.js` | Withdraw HBAR proceeds | `node withdrawHbar.js` |
| `withdrawLazy.js` | Withdraw LAZY proceeds | `node withdrawLazy.js` |
| `withdrawUsdc.js` | Withdraw USDC proceeds (native + bridged) | `node withdrawUsdc.js` |

---

## SoulboundBadgeMinter Scripts

Located in `scripts/interactions/BadgeMinter/`. All scripts require `CONTRACT_ID` in `.env`.

### Setup

| Script | Description | Usage |
|--------|-------------|-------|
| `prepareBadgeMinter.js` | Initialize the badge token | `node prepareBadgeMinter.js -init -name ... -symbol ... -memo ...` |

### Badge Management

| Script | Description | Usage |
|--------|-------------|-------|
| `createBadge.js` | Create a new badge type | `node createBadge.js <name> <metadata> <maxSupply>` |
| `updateBadge.js` | Update badge name, metadata, supply | `node updateBadge.js <badgeId> <name> <metadata> <maxSupply>` |
| `activateBadge.js` | Activate or deactivate a badge type | `node activateBadge.js <badgeId> <true\|false>` |
| `getBadge.js` | View badge details | `node getBadge.js [badgeId]` |

### Minting

| Script | Description | Usage |
|--------|-------------|-------|
| `mintBadge.js` | Mint badges (self or on behalf) | `node mintBadge.js <badgeId> <quantity> [recipient]` |
| `burnBadge.js` | Burn a badge | `node burnBadge.js` |

### Whitelist

| Script | Description | Usage |
|--------|-------------|-------|
| `addToBadgeWhitelist.js` | Add users to badge-specific whitelist | `node addToBadgeWhitelist.js <badgeId> <accounts> <quantities>` |
| `checkUserEligibility.js` | Check user eligibility for badges | `node checkUserEligibility.js [badgeId] [account]` |

### Administration

| Script | Description | Usage |
|--------|-------------|-------|
| `addAdmin.js` | Add a new admin | `node addAdmin.js <account>` |
| `removeAdmin.js` | Remove an admin | `node removeAdmin.js <account>` |
| `listAdmins.js` | List all admins | `node listAdmins.js` |
| `getContractInfo.js` | View contract configuration | `node getContractInfo.js` |
| `revokeSBT.js` | Revoke a soulbound badge (if revocable) | `node revokeSBT.js <account> <serial>` |
| `transferHbar.js` | Withdraw HBAR from contract | `node transferHbar.js <amount> [recipient]` |

---

## Debug Scripts

Located in `scripts/debug/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `decodeSmartContractError.js` | Decode contract revert errors | See below |
| `decodeWithABI.js` | Decode errors using contract ABI | `node decodeWithABI.js` |
| `getContractLogs.js` | Retrieve contract event logs | `node getContractLogs.js` |
| `getContractInfo.js` | Query generic contract info from mirror node | `node getContractInfo.js` |

### decodeSmartContractError.js Usage

```bash
# Decode a raw error hex string
node scripts/debug/decodeSmartContractError.js 0x08c379a0...

# Fetch and decode last error from mirror node
node scripts/debug/decodeSmartContractError.js testnet 0.0.12345

# Fetch last N errors
node scripts/debug/decodeSmartContractError.js testnet 0.0.12345 5
```

The script looks up error signatures on [4byte.directory](https://www.4byte.directory/) and recursively decodes nested errors (e.g., `BootstrapCallFailedError` wrapping an inner error).

---

## Deployment Scripts

Located in `scripts/deployment/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `deploy-MC.js` | Deploy MinterContract | `npm run deploy-nft` |
| `deploy-SBT.js` | Deploy SoulboundMinter | `npm run deploy-sbt` |
| `deploy-SoulboundBadgeMinter.js` | Deploy SoulboundBadgeMinter | `npx hardhat run scripts/deployment/deploy-SoulboundBadgeMinter.js` |
| `deploy-ForeverMinter.js` | Deploy ForeverMinter | `npx hardhat run scripts/deployment/deploy-ForeverMinter.js` |
| `deploy-EditionWithPrize.js` | Deploy EditionWithPrize | `npx hardhat run scripts/deployment/deploy-EditionWithPrize.js` |
| `deploy-FTC.js` | Deploy FungibleTokenCreator | `npm run deploy-ft` |
| `register-FM-with-LGS.js` | Register ForeverMinter with LazyGasStation | `node scripts/deployment/register-FM-with-LGS.js` |
| `extractABI.js` | Extract ABIs to abi/ directory | `node scripts/deployment/extractABI.js` |
| `loadBytecodeHederaFS.js` | Upload bytecode to Hedera File Service | `node scripts/deployment/loadBytecodeHederaFS.js` |

---

## Tips

- **Run from project root**: All scripts expect to be run from the repository root directory.
- **Check before transacting**: Use read-only scripts (`getContractInfo.js`, `checkMintCost.js`, etc.) before executing state-changing transactions.
- **Gas overrides**: Many scripts accept a `-gas` flag or calculate gas dynamically. If a transaction fails due to gas, check the error decode script.
- **Batch operations**: Whitelist and registration scripts support batching. Keep batches under 30-75 entries to avoid transaction size limits.
- **Mirror node lag**: After a transaction, mirror node data may take a few seconds to update. If a subsequent read-only query returns stale data, wait briefly and retry.
