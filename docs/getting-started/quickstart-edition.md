# Quickstart: Deploy an EditionWithPrize Collection

Deploy an EditionWithPrize contract to sell edition NFTs where random winners receive a prize NFT. This is ideal for raffle-style drops and gamified collections.

## How It Works

EditionWithPrize uses a dual-token system:

1. **Edition Token**: The NFT that users purchase during the minting phase
2. **Prize Token**: The NFT awarded to randomly selected winner(s)

The lifecycle follows strict phases:
1. **NOT_INITIALIZED** -- Contract deployed, tokens not yet created
2. **EDITION_MINTING** -- Users can mint edition NFTs (HBAR + LAZY + USDC payments)
3. **EDITION_SOLD_OUT** -- All editions sold, anyone can trigger winner selection
4. **WINNER_SELECTED** -- Winning serials chosen via Hedera PRNG, winners can claim prizes
5. **PRIZE_CLAIMED** -- All prizes claimed (final state)

Winning edition serials are **bearer assets** -- whoever owns the winning serial at claim time receives the prize, creating a tradeable "winning ticket" market.

## Step 1: Configure Your Environment

```env
ACCOUNT_ID=0.0.XXXXX
PRIVATE_KEY=302e...
ENVIRONMENT=TEST

# LAZY token (testnet)
LAZY_TOKEN_ID=0.0.2185
LAZY_SCT_CONTRACT_ID=0.0.2181

# Dependencies
PRNG_CONTRACT_ID=0.0.XXXXX
LAZY_DELEGATE_REGISTRY_CONTRACT_ID=0.0.XXXXX
USDC_NATIVE_TOKEN_ID=0.0.XXXXX
USDC_BRIDGED_TOKEN_ID=0.0.XXXXX
```

For testnet USDC tokens: create test fungible tokens with 6 decimals to simulate USDC.

## Step 2: Compile

```bash
npx hardhat compile
```

## Step 3: Deploy

```bash
npx hardhat run scripts/deployment/deploy-EditionWithPrize.js
```

The deployment script requires seven constructor parameters (loaded from `.env` or command line):
- LAZY token address
- LAZY SCT contract address
- LAZY burn percentage
- PRNG generator address
- LazyDelegateRegistry address
- USDC native token address
- USDC bridged token address

Save the Contract ID:

```env
EDITION_WITH_PRIZE_CONTRACT_ID=0.0.XXXXX
```

## Step 4: Initialize Edition Token

Create the edition NFT that users will mint:

```bash
node scripts/interactions/EditionWithPrize/admin/initializeEditionToken.js
```

The interactive script will prompt you for:
- **Token Name**: e.g., "My Edition Collection"
- **Token Symbol**: e.g., "MEC"
- **Token Memo**: Optional description (max 100 chars)
- **Metadata CID**: IPFS CID for the edition metadata
- **Max Supply**: How many editions to sell (e.g., 100)
- **Royalties**: Optional royalty recipients with percentage and fallback fees

## Step 5: Initialize Prize Token

Create the prize NFT that winners will receive:

```bash
node scripts/interactions/EditionWithPrize/admin/initializePrizeToken.js
```

The script checks that the edition token was initialized first. You will set:
- **Token Name**: e.g., "My Prize"
- **Token Symbol**: e.g., "MPR"
- **Metadata CID**: IPFS CID for the prize metadata
- **Max Supply / Number of Winners**: 1 for a single winner, or higher for multiple winners
- **Royalties**: Independent from edition royalties

After both tokens are initialized, the contract transitions to the **EDITION_MINTING** phase.

**Important**: If `prizeMaxSupply > 1`, the `selectWinner()` function may require 2-3x the gas estimate due to the duplicate-handling PRNG algorithm.

## Step 6: Configure Mint Economics

```bash
node scripts/interactions/EditionWithPrize/admin/updateMintEconomics.js
```

Configure:
- HBAR price per edition
- LAZY price per edition
- USDC price per edition
- Whitelist discount percentage
- Max mint per transaction
- Max mint per wallet

## Step 7: Configure Mint Timing

```bash
node scripts/interactions/EditionWithPrize/admin/updateMintTiming.js
```

Set:
- Mint start time
- WL-only mode toggle

## Step 8: Set Up Whitelist (Optional)

```bash
# Add addresses to whitelist
node scripts/interactions/EditionWithPrize/admin/addToWhitelist.js

# Configure WL purchase options (buy WL with LAZY or NFTs)
node scripts/interactions/EditionWithPrize/admin/setWlPurchaseOptions.js

# Toggle WL-only mode
node scripts/interactions/EditionWithPrize/admin/setWlOnly.js
```

## Step 9: Unpause Minting

```bash
node scripts/interactions/EditionWithPrize/admin/setPause.js
```

## Step 10: Mint Editions

Users (or you for testing) can now mint:

```bash
node scripts/interactions/EditionWithPrize/mint.js
```

The script handles:
1. Phase validation (must be EDITION_MINTING)
2. Token association
3. WL status check
4. Cost calculation with discounts
5. Balance verification (HBAR, LAZY, USDC)
6. Allowance setup
7. Mint execution

## Step 11: Select Winner(s)

After all editions are sold (phase transitions to EDITION_SOLD_OUT), anyone can trigger winner selection:

```bash
node scripts/interactions/EditionWithPrize/selectWinner.js
```

This uses Hedera's PRNG precompile for verifiable randomness. For multiple winners, the script automatically applies a 2.5x gas multiplier.

## Step 12: Claim Prize

Winners who own the winning edition serial(s) can claim their prize:

```bash
node scripts/interactions/EditionWithPrize/claimPrize.js
```

The claim process:
1. Checks which of your edition serials are winners
2. Associates the prize token if needed
3. Exchanges your winning edition serial for a prize NFT (edition is wiped)

## Verify and Monitor

```bash
# Full contract state
node scripts/interactions/EditionWithPrize/getContractState.js

# Check mint cost with WL discount
node scripts/interactions/EditionWithPrize/checkMintCost.js

# Check WL status
node scripts/interactions/EditionWithPrize/checkWLStatus.js

# View winner list
node scripts/interactions/EditionWithPrize/getWinnerList.js
```

## Withdraw Proceeds (Owner)

```bash
node scripts/interactions/EditionWithPrize/admin/withdrawHbar.js
node scripts/interactions/EditionWithPrize/admin/withdrawLazy.js
node scripts/interactions/EditionWithPrize/admin/withdrawUsdc.js
```

## Troubleshooting

- **"Edition token must be initialized first"**: Run `initializeEditionToken.js` before `initializePrizeToken.js`.
- **"Minting not available"**: Check the current phase with `getContractState.js`. Minting is only available in phase 1 (EDITION_MINTING).
- **"Winner selection not available"**: All editions must be sold out (phase 2) before selecting winners.
- **Gas exceeded on selectWinner()**: With multiple winners, try running again. The PRNG algorithm is idempotent and may need extra gas for duplicate handling.
- **"Not winning serial"**: Verify you own the winning serial. Winning serials are bearer assets -- check if they were traded.

For more details, see the [EditionWithPrize README](../../scripts/interactions/EditionWithPrize/README.md) and the [Troubleshooting Guide](../guides/troubleshooting.md).
