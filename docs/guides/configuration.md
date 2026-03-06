# Configuration Reference

All environment variables used across the Hedera SC Minter Suite. Copy `.env.example` to `.env` and fill in the values relevant to your contract.

## Core Variables

These are required for every contract type.

| Variable | Description | Example | Required By |
|----------|-------------|---------|-------------|
| `ACCOUNT_ID` | Hedera operator account ID (ED25519) | `0.0.12345` | All contracts |
| `PRIVATE_KEY` | ED25519 private key for the operator | `302e...` | All contracts |
| `ENVIRONMENT` | Network selection | `TEST` or `MAIN` | All contracts |

### ENVIRONMENT Values

| Value | Network | Mirror Node |
|-------|---------|-------------|
| `TEST` | Hedera Testnet | `testnet.mirrornode.hedera.com` |
| `MAIN` | Hedera Mainnet | `mainnet-public.mirrornode.hedera.com` |
| `PREVIEW` | Hedera Previewnet | `previewnet.mirrornode.hedera.com` |
| `LOCAL` | Local node (127.0.0.1) | `127.0.0.1:5600` |

## MinterContract / SoulboundMinter

v2.0 contracts that share the same configuration.

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `CONTRACT_NAME` | Contract name for ABI loading | `MinterContract` or `SoulboundMinter` | `MinterContract` |
| `CONTRACT_ID` | Deployed contract ID | `0.0.54321` | -- |
| `LAZY_TOKEN_ID` | LAZY fungible token ID | `0.0.2185` (testnet) | -- |
| `LAZY_SCT_CONTRACT_ID` | LAZY Smart Contract Treasury ID | `0.0.2181` (testnet) | -- |
| `LAZY_BURN_PERC` | Percentage of LAZY to burn on transactions | `25` | `25` |
| `MINTER_LIBRARY_ID` | Pre-deployed MinterLibrary ID (skip redeployment) | `0.0.99999` | -- |
| `MINT_PAYMENT` | HBAR sent with token-creation transactions | `50` | `50` |
| `METADATA_BATCH` | Number of metadata strings per upload batch | `60` | `60` |
| `PRNG_CONTRACT_ID` | PrngGenerator contract for random metadata | `0.0.88888` | -- |
| `EVENT_NAME` | Event name for log parsing | `MinterContractMessage` | `MinterContractMessage` |

### SoulboundMinter-Specific

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `REVOCABLE` | Whether SBTs can be revoked after minting (immutable) | `true` or `false` | `false` |
| `SBT_CONTRACT_NAME` | SBT contract name for ABI | `SoulboundMinter` | `SoulboundMinter` |

## ForeverMinter

v1.0 contract for pool-based NFT distribution.

| Variable | Description | Example |
|----------|-------------|---------|
| `FOREVER_MINTER_CONTRACT_ID` | Deployed ForeverMinter contract ID | `0.0.77777` |
| `NFT_TOKEN_ID` | NFT collection to distribute from | `0.0.66666` |
| `PRNG_CONTRACT_ID` | PrngGenerator contract for random selection | `0.0.88888` |
| `LAZY_TOKEN_ID` | LAZY fungible token ID | `0.0.2185` (testnet) |
| `LAZY_GAS_STATION_CONTRACT_ID` | LazyGasStation contract for LAZY processing | `0.0.55555` |
| `LAZY_DELEGATE_REGISTRY_CONTRACT_ID` | LazyDelegateRegistry for holder verification | `0.0.44444` |
| `DISCOUNT_TOKENS` | Comma-separated token IDs for holder discounts | `0.0.11111,0.0.22222` |

## EditionWithPrize

v1.0 contract for edition minting with prize raffle.

| Variable | Description | Example |
|----------|-------------|---------|
| `EDITION_WITH_PRIZE_CONTRACT_ID` | Deployed EditionWithPrize contract ID | `0.0.33333` |
| `LAZY_TOKEN_ID` | LAZY fungible token ID | `0.0.2185` (testnet) |
| `LAZY_SCT_CONTRACT_ID` | LAZY Smart Contract Treasury ID | `0.0.2181` (testnet) |
| `LAZY_BURN_PERCENTAGE` | LAZY burn percentage | `25` |
| `PRNG_CONTRACT_ID` | PrngGenerator contract for winner selection | `0.0.88888` |
| `LAZY_DELEGATE_REGISTRY_CONTRACT_ID` | LazyDelegateRegistry for holder verification | `0.0.44444` |
| `USDC_NATIVE_TOKEN_ID` | Native USDC token ID on Hedera | `0.0.456858` (mainnet) |
| `USDC_BRIDGED_TOKEN_ID` | Bridged USDC token ID on Hedera | `0.0.XXXXX` |

## SoulboundBadgeMinter

v1.0 contract for multi-type badge management.

| Variable | Description | Example |
|----------|-------------|---------|
| `CONTRACT_ID` | Deployed SoulboundBadgeMinter contract ID | `0.0.11111` |
| `REVOCABLE` | Whether badges can be revoked (immutable) | `true` or `false` |
| `MINT_PAYMENT` | HBAR sent with token-creation transactions | `50` |

## Optional / Shared

| Variable | Description | Example |
|----------|-------------|---------|
| `SPARE_ROYALTY_ACCOUNT` | Additional royalty collection account | `0.0.99999` |

## Testnet vs Mainnet Reference

### LAZY Token

| Network | `LAZY_TOKEN_ID` | `LAZY_SCT_CONTRACT_ID` |
|---------|-----------------|------------------------|
| Testnet | `0.0.2185` | `0.0.2181` |
| Mainnet | `0.0.1311037` | `0.0.1311003` |

### Network Endpoints

The SDK determines endpoints from the `ENVIRONMENT` variable:

| Environment | Consensus Node | Mirror Node |
|-------------|---------------|-------------|
| `TEST` | Hedera testnet nodes | `testnet.mirrornode.hedera.com` |
| `MAIN` | Hedera mainnet nodes | `mainnet-public.mirrornode.hedera.com` |
| `PREVIEW` | Hedera previewnet nodes | `previewnet.mirrornode.hedera.com` |
| `LOCAL` | `127.0.0.1:50211` | `127.0.0.1:5600` |

## Security Notes

- **Never commit `.env` to version control.** The `.gitignore` should already exclude it.
- Use ED25519 keys (not ECDSA) for the operator account.
- For mainnet deployments, use a dedicated operator account with only the HBAR needed for deployment and operations.
- Keep `LAZY_BURN_PERC` consistent between deployment and runtime configuration.
