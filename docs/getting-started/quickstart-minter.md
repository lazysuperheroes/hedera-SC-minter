# Quickstart: Deploy and Mint Your First NFT Collection

Deploy a MinterContract and mint your first NFTs on Hedera in about 10 minutes.

## Prerequisites

- Node.js (v16+) and npm installed
- A Hedera testnet account with ED25519 keys (create one at [portal.hedera.com](https://portal.hedera.com))
- Testnet HBAR for gas fees (available from the Hedera faucet)
- Git clone of this repository with `npm install` completed

## Step 1: Configure Your Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set the following:

```env
ACCOUNT_ID=0.0.XXXXX
PRIVATE_KEY=302e...your_ed25519_private_key
ENVIRONMENT=TEST
CONTRACT_NAME=MinterContract

# LAZY token config (testnet defaults)
LAZY_TOKEN_ID=0.0.2185
LAZY_SCT_CONTRACT_ID=0.0.2181
```

If you do not plan to use LAZY token pricing, you can keep the testnet defaults above and set LAZY costs to 0 later.

## Step 2: Compile the Contracts

```bash
npx hardhat compile
```

This compiles all Solidity contracts and produces artifacts in `artifacts/`. The contract sizer plugin will also report bytecode sizes.

## Step 3: Deploy the MinterContract

```bash
npm run deploy-nft
```

The deployment script is interactive. It will:

1. Display your operator account and LAZY token configuration
2. Ask for confirmation before deploying
3. Deploy the MinterLibrary (if not already deployed)
4. Link the library and deploy the MinterContract
5. Print the new Contract ID (e.g., `0.0.XXXXX`)

Save the Contract ID. Add it to your `.env` file:

```env
CONTRACT_ID=0.0.XXXXX
```

## Step 4: Prepare the Minter

The `prepareMinter.js` script handles metadata upload and token initialization in one interactive flow.

### Upload Metadata

First, prepare a JSON file containing an array of metadata strings (IPFS CIDs or paths). For example, create `metadata.json`:

```json
["ipfs://QmXXX1/metadata.json", "ipfs://QmXXX2/metadata.json", "ipfs://QmXXX3/metadata.json"]
```

Upload the metadata to the contract:

```bash
node scripts/interactions/prepareMinter.js -upload metadata.json
```

The script shuffles the metadata and uploads in batches. It will report how many were uploaded.

### Initialize the Token

Initialize the NFT collection on the contract:

```bash
node scripts/interactions/prepareMinter.js -init -name "My Collection" -symbol "MYCOL" -memo "My first NFT collection" -cid "ipfs://QmBaseFolder/"
```

Optional flags:
- `-max 100` -- Set a maximum supply (0 = supply equals uploaded metadata count)
- `-royalty royalties.json` -- Add royalty fees (see format below)

The script will ask whether to use PRNG for randomized metadata, whether this is a soulbound (SBT) mint, and then confirm token creation.

**Royalties JSON format** (optional):
```json
[
  { "percentage": 0.05, "account": "0.0.12345", "fbf": 1 }
]
```

This sets a 5% royalty to account `0.0.12345` with a 1 HBAR fallback fee.

## Step 5: Mint NFTs

```bash
node scripts/interactions/mint.js
```

The mint script will:

1. Query the contract for pricing (HBAR + LAZY costs)
2. Check remaining supply
3. Verify your NFT token association (and offer to associate if needed)
4. Ask how many NFTs to mint
5. Set LAZY token allowance if required
6. Execute the mint transaction
7. Display minted serial numbers and metadata

## Step 6: Verify on HashScan

View your contract and minted NFTs on HashScan:

```
https://hashscan.io/testnet/contract/0.0.XXXXX
```

## Next Steps

Once your basic mint is working, explore these common operations:

### Update Pricing

```bash
# Set price to 5 HBAR and 10 LAZY per mint
node scripts/interactions/updateCost.js 5 10
```

### Manage Whitelist

```bash
# Add accounts to whitelist
node scripts/interactions/addToWhiteList.js 0.0.11111,0.0.22222

# Enable whitelist-only minting
node scripts/interactions/setWLOnly.js

# Remove whitelist-only restriction
node scripts/interactions/removeWLOnly.js
```

### Pause/Unpause Minting

```bash
node scripts/interactions/setPause.js
```

### Update Max Mints Per Wallet

```bash
node scripts/interactions/updateMaxMintPerWallet.js
```

### Withdraw Funds

```bash
# Withdraw all HBAR and LAZY from the contract
node scripts/interactions/withdrawFunds.js

# Withdraw to a specific wallet
node scripts/interactions/withdrawToWallet.js
```

### Burn Unsold NFTs

```bash
node scripts/interactions/burnNFTs.js
```

## Troubleshooting

- **"Environment required"**: Make sure `ACCOUNT_ID` and `PRIVATE_KEY` are set in `.env`.
- **"Contract not found"**: Verify `CONTRACT_ID` is set and matches your deployed contract.
- **Token association errors**: The mint script will prompt you to associate. You can also associate manually via HashPack or the Hedera portal.
- **Insufficient gas**: The scripts calculate gas dynamically, but you can override with the `-gas` flag on `prepareMinter.js`.

For more details, see [Configuration Guide](../guides/configuration.md) and [Troubleshooting Guide](../guides/troubleshooting.md).
