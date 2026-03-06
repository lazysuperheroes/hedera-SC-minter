# Quickstart: Deploy a ForeverMinter Pool

Deploy a ForeverMinter contract and distribute existing NFTs from a pool in about 15 minutes.

ForeverMinter differs from MinterContract in that it distributes **pre-existing NFTs** from a pool rather than minting new ones. It supports holder discounts, sacrifice mechanics, whitelist slots, and time-based refunds.

## Prerequisites

- Node.js (v16+) and npm installed
- A Hedera testnet account with ED25519 keys
- Testnet HBAR for gas fees
- Git clone of this repository with `npm install` completed
- An existing NFT collection (token ID) with serials you want to distribute
- Supporting contract IDs already deployed:
  - **PrngGenerator** contract ID
  - **LazyGasStation** contract ID
  - **LazyDelegateRegistry** contract ID

## Step 1: Configure Your Environment

Copy `.env.example` to `.env` and fill in all required values:

```env
ACCOUNT_ID=0.0.XXXXX
PRIVATE_KEY=302e...your_ed25519_private_key
ENVIRONMENT=TEST

# LAZY token (testnet)
LAZY_TOKEN_ID=0.0.2185

# ForeverMinter dependencies
NFT_TOKEN_ID=0.0.XXXXX
PRNG_CONTRACT_ID=0.0.XXXXX
LAZY_GAS_STATION_CONTRACT_ID=0.0.XXXXX
LAZY_DELEGATE_REGISTRY_CONTRACT_ID=0.0.XXXXX
```

## Step 2: Compile the Contracts

```bash
npx hardhat compile
```

## Step 3: Deploy the ForeverMinter

```bash
npx hardhat run scripts/deployment/deploy-ForeverMinter.js
```

The deployment script will:

1. Load all dependency contract IDs from `.env` or command-line arguments
2. Display a dependency summary for review
3. Ask for confirmation
4. Deploy the contract with constructor parameters (NFT token, PRNG, LAZY, LazyGasStation, LazyDelegateRegistry)
5. Print the Contract ID and next steps
6. Save deployment info to a JSON file

Add the new Contract ID to `.env`:

```env
FOREVER_MINTER_CONTRACT_ID=0.0.XXXXX
```

## Step 4: Register with LazyGasStation

ForeverMinter needs to be registered with LazyGasStation to process LAZY token payments:

```bash
node scripts/deployment/register-FM-with-LGS.js
```

This authorizes ForeverMinter to call `drawLazyFrom()` and `payoutLazy()` on the LazyGasStation contract.

## Step 5: Configure Mint Economics

Set pricing, discounts, and limits:

```bash
node scripts/interactions/ForeverMinter/admin/updateMintEconomics.js
```

This interactive script lets you configure:

- **HBAR Price**: Cost in HBAR per NFT
- **LAZY Price**: Cost in LAZY per NFT
- **Whitelist Discount**: Percentage discount for whitelisted users
- **Sacrifice Discount**: Percentage discount for users who sacrifice NFTs
- **Max Per Mint**: Maximum NFTs per transaction
- **Max Per Wallet**: Maximum NFTs per wallet (0 = unlimited)
- **WL Slot Cost**: LAZY cost to purchase whitelist slots
- **WL Slot Count**: Number of slots per purchase
- **Max Sacrifice**: Maximum NFTs that can be sacrificed per mint
- **Contract Sponsors LAZY**: Whether the contract pays LAZY fees

Press Enter to keep any current value unchanged.

## Step 6: Configure Mint Timing (Optional)

Set start time, cooldown, refund window, and WL-only period:

```bash
node scripts/interactions/ForeverMinter/admin/updateMintTiming.js
```

## Step 7: Transfer NFTs to the Contract

Transfer the NFTs you want to distribute to the ForeverMinter contract address. You can do this via HashPack, Kabila, or using the Hedera SDK directly.

The contract must own the NFTs before they can be registered in the pool.

## Step 8: Register Pool NFTs

Register the NFTs the contract now holds:

```bash
node scripts/interactions/ForeverMinter/admin/registerPoolNFTs.js
```

This interactive script will:

1. Query the NFT token address from the contract
2. Scan for all serials owned by the contract
3. Compare against already-registered serials
4. Offer automatic registration of all unregistered serials, or manual selection
5. Process registrations in batches of 30 (parallel)

## Step 9: Configure Whitelist (Optional)

Add individual addresses:

```bash
node scripts/interactions/ForeverMinter/admin/addToWhitelist.js
```

Or batch add from a file:

```bash
node scripts/interactions/ForeverMinter/admin/batchAddToWhitelist.js
```

## Step 10: Add Discount Tiers (Optional)

Create holder-based discount tiers:

```bash
node scripts/interactions/ForeverMinter/admin/addDiscountTier.js
```

Supply the discount token address, discount percentage, and maximum uses per serial.

## Step 11: Unpause Minting

The contract starts paused by default. Unpause to allow minting:

```bash
node scripts/interactions/ForeverMinter/admin/setPause.js false
```

## Step 12: Test Minting

```bash
node scripts/interactions/ForeverMinter/mint.js
```

The interactive mint flow will guide you through:

1. Token association check
2. Contract configuration display (pricing, supply, discounts)
3. Discount token detection and selection
4. Sacrifice option (trade NFTs for discounted new ones)
5. Cost calculation with waterfall discount breakdown
6. Allowance setup (HBAR and LAZY)
7. Final confirmation and execution

## Verify and Monitor

Check your pool status at any time:

```bash
# Full contract info
node scripts/interactions/ForeverMinter/getContractInfo.js

# Pool status (available serials)
node scripts/interactions/ForeverMinter/getPoolStatus.js

# Check your available discounts
node scripts/interactions/ForeverMinter/checkDiscounts.js

# Check mint cost for a quantity
node scripts/interactions/ForeverMinter/checkMintCost.js 5

# View mint history
node scripts/interactions/ForeverMinter/getMintHistory.js
```

## Next Steps

- **Manage discounts**: `addDiscountTier.js`, `updateDiscountTier.js`, `removeDiscountTier.js`
- **Admin management**: `addAdmin.js`, `removeAdmin.js`, `listAdmins.js`
- **Withdraw earnings**: `withdrawHbar.js`
- **Emergency NFT withdrawal**: `emergencyWithdrawNFT.js`
- **Scan events**: `scanEvents.js` to review contract activity

For more details, see the [CLI Scripts Guide](../guides/cli-scripts.md) and the [ForeverMinter README](../../scripts/interactions/ForeverMinter/README.md).
