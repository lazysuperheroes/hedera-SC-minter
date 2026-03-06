# Deployment Guide

How to deploy each contract in the Hedera SC Minter Suite, including post-deployment configuration.

## General Prerequisites

1. Node.js v16+ with `npm install` completed
2. `.env` configured with `ACCOUNT_ID`, `PRIVATE_KEY`, and `ENVIRONMENT`
3. Contracts compiled: `npx hardhat compile`
4. Sufficient testnet/mainnet HBAR in your operator account

All deployment scripts are interactive and will ask for confirmation before executing transactions.

## MinterContract

**Script**: `scripts/deployment/deploy-MC.js`

**Run**:
```bash
npm run deploy-nft
```

**Constructor Parameters** (from `.env`):
- `LAZY_SCT_CONTRACT_ID` -- LAZY Smart Contract Treasury address
- `LAZY_TOKEN_ID` -- LAZY fungible token address
- `LAZY_BURN_PERC` -- LAZY burn percentage (default: 25)

**Process**:
1. Deploys MinterLibrary (or reuses `MINTER_LIBRARY_ID` from `.env` if set)
2. Links library address into MinterContract bytecode
3. Deploys MinterContract with linked bytecode
4. Gas limit: 1,600,000

**Post-Deployment**:
1. Set `CONTRACT_ID` in `.env`
2. Upload metadata: `node scripts/interactions/prepareMinter.js -upload metadata.json`
3. Initialize token: `node scripts/interactions/prepareMinter.js -init -name ... -symbol ... -memo ... -cid ...`
4. Set pricing: `node scripts/interactions/updateCost.js <hbar> <lazy>`
5. Unpause if needed: `node scripts/interactions/setPause.js`

## SoulboundMinter

**Script**: `scripts/deployment/deploy-SBT.js`

**Run**:
```bash
npm run deploy-sbt
```

**Constructor Parameters** (from `.env`):
- `LAZY_SCT_CONTRACT_ID` -- LAZY Smart Contract Treasury address
- `LAZY_TOKEN_ID` -- LAZY fungible token address
- `LAZY_BURN_PERC` -- LAZY burn percentage (default: 25)
- `REVOCABLE` -- Whether SBTs can be revoked (default: false, **immutable**)

**Process**:
1. Prompts to confirm or update revocable status
2. Deploys MinterLibrary (or reuses `MINTER_LIBRARY_ID`)
3. Links library and deploys SoulboundMinter
4. Gas limit: 1,600,000

**Post-Deployment**:
1. Set `CONTRACT_ID` in `.env` and `CONTRACT_NAME=SoulboundMinter`
2. Follow the same metadata upload and initialization flow as MinterContract
3. When prompted "Is this a SBT mint?" during init, answer Yes

## SoulboundBadgeMinter

**Script**: `scripts/deployment/deploy-SoulboundBadgeMinter.js`

**Run**:
```bash
npx hardhat run scripts/deployment/deploy-SoulboundBadgeMinter.js
```

**Constructor Parameters**:
- `REVOCABLE` -- Whether badges can be revoked (default: false, **immutable**)

**Process**:
1. Prompts to confirm or update revocable status
2. Deploys SoulboundBadgeMinter directly (no library linking needed)
3. Gas limit: 4,800,000

**Post-Deployment**:
1. Set `CONTRACT_ID` in `.env`
2. Initialize token: `node scripts/interactions/BadgeMinter/prepareBadgeMinter.js -init -name ... -symbol ... -memo ...`
3. Create badge types: `node scripts/interactions/BadgeMinter/createBadge.js <name> <metadata> <maxSupply>`
4. Set up whitelists: `node scripts/interactions/BadgeMinter/addToBadgeWhitelist.js ...`

## ForeverMinter

**Script**: `scripts/deployment/deploy-ForeverMinter.js`

**Run**:
```bash
npx hardhat run scripts/deployment/deploy-ForeverMinter.js
```

**Constructor Parameters** (from `.env` or command line):
- `NFT_TOKEN_ID` -- NFT collection to distribute
- `PRNG_CONTRACT_ID` -- PrngGenerator contract
- `LAZY_TOKEN_ID` -- LAZY fungible token
- `LAZY_GAS_STATION_CONTRACT_ID` -- LazyGasStation contract
- `LAZY_DELEGATE_REGISTRY_CONTRACT_ID` -- LazyDelegateRegistry contract

**Process**:
1. Loads and validates all five dependency contract IDs
2. Deploys ForeverMinter with constructor parameters
3. Gas limit: 6,500,000
4. Saves deployment info to a JSON file

**Post-Deployment** (listed in order):
1. Set `FOREVER_MINTER_CONTRACT_ID` in `.env`
2. Register with LazyGasStation: `node scripts/deployment/register-FM-with-LGS.js`
3. Configure economics: `node scripts/interactions/ForeverMinter/admin/updateMintEconomics.js`
4. Configure timing: `node scripts/interactions/ForeverMinter/admin/updateMintTiming.js`
5. Add discount tiers (optional): `node scripts/interactions/ForeverMinter/admin/addDiscountTier.js`
6. Transfer NFTs to contract address
7. Register NFTs in pool: `node scripts/interactions/ForeverMinter/admin/registerPoolNFTs.js`
8. Configure whitelist (optional): `node scripts/interactions/ForeverMinter/admin/addToWhitelist.js`
9. Unpause minting: `node scripts/interactions/ForeverMinter/admin/setPause.js false`

## EditionWithPrize

**Script**: `scripts/deployment/deploy-EditionWithPrize.js`

**Run**:
```bash
npx hardhat run scripts/deployment/deploy-EditionWithPrize.js
```

**Constructor Parameters** (from `.env` or command line):
- `LAZY_TOKEN_ID` -- LAZY fungible token
- `LAZY_SCT_CONTRACT_ID` -- LAZY Smart Contract Treasury
- `LAZY_BURN_PERCENTAGE` -- LAZY burn percentage (default: 25)
- `PRNG_CONTRACT_ID` -- PrngGenerator contract
- `LAZY_DELEGATE_REGISTRY_CONTRACT_ID` -- LazyDelegateRegistry
- `USDC_NATIVE_TOKEN_ID` -- Native USDC token
- `USDC_BRIDGED_TOKEN_ID` -- Bridged USDC token

**Process**:
1. Loads and validates all seven dependency values
2. Deploys EditionWithPrize with constructor parameters
3. Gas limit: 7,750,000
4. Saves deployment info to a JSON file

**Post-Deployment** (listed in order):
1. Set `EDITION_WITH_PRIZE_CONTRACT_ID` in `.env`
2. Initialize edition token: `node scripts/interactions/EditionWithPrize/admin/initializeEditionToken.js`
3. Initialize prize token: `node scripts/interactions/EditionWithPrize/admin/initializePrizeToken.js`
4. Configure economics: `node scripts/interactions/EditionWithPrize/admin/updateMintEconomics.js`
5. Configure timing: `node scripts/interactions/EditionWithPrize/admin/updateMintTiming.js`
6. Set up whitelist (optional): `node scripts/interactions/EditionWithPrize/admin/addToWhitelist.js`
7. Unpause minting: `node scripts/interactions/EditionWithPrize/admin/setPause.js`

## FungibleTokenCreator

**Script**: `scripts/deployment/deploy-FTC.js`

**Run**:
```bash
npm run deploy-ft
```

This is a utility contract for creating fungible tokens on HTS. It is primarily used in tests to create LAZY-like tokens. It has no constructor parameters beyond the `CONTRACT_NAME` environment variable.

## Deploying Supporting Contracts

### PrngGenerator

Used by MinterContract (optional), ForeverMinter, and EditionWithPrize for random selection.

The `prepareMinter.js -init` script can deploy a PrngGenerator if `PRNG_CONTRACT_ID` is not set. Alternatively, deploy it manually using the SDK. Gas limit: 800,000.

### Bytecode on Hedera File Service

For large contracts that exceed the `ContractCreateFlow` size limit, you can first upload bytecode to the Hedera File Service and then reference it by file ID:

```bash
node scripts/deployment/loadBytecodeHederaFS.js
```

Then pass the file ID as an argument to the deployment script:

```bash
npx hardhat run scripts/deployment/deploy-MC.js -- <fileId>
```

## Extracting ABIs

After compilation, extract ABIs for use by interaction scripts:

```bash
node scripts/deployment/extractABI.js
```

This writes ABI JSON files to the `abi/` directory.

## Verification on HashScan

After deployment, verify your contracts on HashScan:

1. Navigate to `https://hashscan.io/testnet/contract/<CONTRACT_ID>` (or `mainnet` for mainnet)
2. The contract details page shows:
   - Contract ID and EVM address
   - Creator account
   - Bytecode
   - Recent transactions
3. Use the "Contract" tab to view state and call read-only functions

For a deeper look at transaction results, use the "Transactions" tab or query the mirror node API directly:

```
https://testnet.mirrornode.hedera.com/api/v1/contracts/<CONTRACT_ID>/results?order=desc&limit=5
```
