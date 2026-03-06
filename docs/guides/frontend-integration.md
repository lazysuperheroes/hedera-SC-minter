# Frontend Integration Guide

This guide covers integrating a frontend application with the Hedera SC Minter contracts. It assumes familiarity with ethers.js and the Hedera JavaScript SDK (`@hashgraph/sdk`).

---

## Table of Contents

1. [ABI Usage](#abi-usage)
2. [Contract Interaction Patterns](#contract-interaction-patterns)
3. [Error Handling](#error-handling)
4. [Events](#events)
5. [Cost Calculation](#cost-calculation)
6. [Common Integration Patterns](#common-integration-patterns)

---

## ABI Usage

Compiled ABIs are extracted to the `abi/` directory by the `scripts/deployment/extractABI.js` script after compilation. The main contract ABIs you will need:

| File | Contract |
|------|----------|
| `MinterContract.json` | Standard NFT minting |
| `SoulboundMinter.json` | Soulbound NFT minting |
| `ForeverMinter.json` | Pool-based NFT distribution |
| `SoulboundBadgeMinter.json` | Multi-badge soulbound system |
| `EditionWithPrize.json` | Edition mint with prize draw |

### Loading an ABI with ethers.js

```js
import { ethers } from 'ethers';
import MinterContractABI from '../abi/MinterContract.json';

// From the extracted ABI file (contains { abi: [...] })
const iface = new ethers.Interface(MinterContractABI.abi);

// Or if loading from Hardhat artifacts (after compile)
import artifact from '../artifacts/contracts/MinterContract.sol/MinterContract.json';
const iface = new ethers.Interface(artifact.abi);
```

The `ethers.Interface` object is used throughout this guide for encoding function calls, decoding results, and parsing events and errors.

---

## Contract Interaction Patterns

There are two primary ways to call these contracts from a frontend.

### Pattern 1: ethers.js with a JSON-RPC Provider

Hedera exposes a JSON-RPC relay compatible with ethers.js. This works well for read-only queries and for wallets that support EVM-style signing (e.g., MetaMask with Hedera).

```js
const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
const signer = await provider.getSigner();

const contract = new ethers.Contract(contractEvmAddress, MinterContractABI.abi, signer);

// Read-only call
const [hbarCost, lazyCost] = await contract.getCost();

// State-changing call with HBAR payment
const tx = await contract.mintNFT(1, { value: hbarCost });
const receipt = await tx.wait();
```

### Pattern 2: @hashgraph/sdk ContractExecuteTransaction

This is the native Hedera SDK approach, used by all scripts in this repository. It gives full control over gas limits and works with ED25519 keys.

```js
import { ContractExecuteTransaction, ContractCallQuery, Hbar } from '@hashgraph/sdk';
import { ethers } from 'ethers';

const iface = new ethers.Interface(MinterContractABI.abi);

// Read-only query
const encoded = iface.encodeFunctionData('getCost', []);
const query = new ContractCallQuery()
    .setContractId(contractId)
    .setFunctionParameters(Buffer.from(encoded.slice(2), 'hex'))
    .setGas(100_000);
const result = await query.execute(client);
const [hbarCost, lazyCost] = iface.decodeFunctionResult('getCost', result.bytes);

// State-changing transaction with HBAR payment
const mintEncoded = iface.encodeFunctionData('mintNFT', [1]);
const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(800_000)
    .setFunctionParameters(Buffer.from(mintEncoded.slice(2), 'hex'))
    .setPayableAmount(Hbar.fromTinybars(hbarCost))
    .execute(client);
const receipt = await tx.getReceipt(client);
```

### Choosing Between Patterns

| Consideration | ethers.js + JSON-RPC | @hashgraph/sdk |
|---------------|---------------------|----------------|
| Wallet support | MetaMask, WalletConnect | HashPack, Blade, native |
| Key types | ECDSA only | ED25519 and ECDSA |
| Gas control | Limited | Full control |
| HBAR payment | `{ value: ... }` | `.setPayableAmount()` |
| Mirror node queries | Separate fetch calls | Built-in SDK queries |

---

## Error Handling

The contracts use two different error styles depending on version.

### v2.0 Custom Errors (MinterContract, SoulboundMinter)

These contracts use custom Solidity errors for gas efficiency. Parse them with `ethers.Interface.parseError()`:

```js
const iface = new ethers.Interface(MinterContractABI.abi);

try {
    await contract.mintNFT(1, { value: 0 });
} catch (err) {
    // Extract the revert data from the error
    const revertData = err.data ?? err?.contractFunctionResult?.errorMessage;
    if (revertData) {
        const parsed = iface.parseError(revertData);
        if (parsed) {
            console.log('Error name:', parsed.name);  // e.g., "NotEnoughHbar"
            console.log('Error args:', parsed.args);   // e.g., [] or [quantity]
        }
    }
}
```

Common custom errors to handle in the UI:

| Error | User-facing message |
|-------|-------------------|
| `NotOpen` | Minting has not started yet |
| `Paused` | Minting is currently paused |
| `MintedOut` | All NFTs have been minted |
| `NotWL` | You are not on the whitelist |
| `NotEnoughHbar` | Insufficient HBAR sent |
| `NotEnoughLazy` | Insufficient $LAZY balance or allowance |
| `HbarCooldown` | Please wait before minting again |
| `MaxMintPerWalletExceeded` | Wallet mint limit reached |

### v1.0 Require Strings (ForeverMinter, SoulboundBadgeMinter, EditionWithPrize)

These contracts also use custom errors (not `require()` strings), so the same `parseError()` approach applies. The error names differ -- for example, ForeverMinter uses `MintPaused()` instead of `Paused()`, and `ExceedsMaxMint()` instead of `MaxMintExceeded()`. Refer to the [Custom Errors Reference](../contracts/shared-concepts.md#custom-errors-reference) for the full list per contract.

### Unified Error Handler

```js
function handleContractError(iface, error) {
    const revertData = error.data ?? error?.contractFunctionResult?.errorMessage;
    if (!revertData) return { name: 'UnknownError', message: error.message };

    const parsed = iface.parseError(revertData);
    if (!parsed) return { name: 'UnparsedError', message: revertData };

    // Map error names to user-friendly messages
    const messages = {
        NotEnoughHbar: 'Not enough HBAR sent. Please check the mint cost.',
        NotEnoughLazy: 'Insufficient $LAZY balance or allowance.',
        MintedOut: 'This collection is sold out.',
        NotOpen: 'Minting has not started yet.',
        Paused: 'Minting is currently paused.',
        MintPaused: 'Minting is currently paused.',
        NotWL: 'Your address is not on the whitelist.',
        WhitelistOnly: 'Minting is restricted to whitelisted addresses.',
        HbarCooldown: 'Cooldown active. Please wait before minting again.',
        LazyCooldown: 'Cooldown active. Please wait before minting again.',
        MaxMintExceeded: 'Exceeds the maximum mint per transaction.',
        MaxMintPerWalletExceeded: 'You have reached the per-wallet mint limit.',
    };

    return {
        name: parsed.name,
        args: parsed.args,
        message: messages[parsed.name] ?? `Transaction failed: ${parsed.name}`,
    };
}
```

---

## Events

### Key Events by Contract

**MinterContract / SoulboundMinter:**

| Event | Emitted When |
|-------|-------------|
| `MintEvent(address, bool, uint256, string)` | Each NFT minted (address, isLazy, serial, metadata) |
| `BurnEvent(address, int64[], uint64)` | NFTs burned for refund |
| `MinterContractMessage(uint8, address, uint256)` | Admin/config changes, WL purchases |

**ForeverMinter:**

| Event | Emitted When |
|-------|-------------|
| `NFTMinted(address, uint256, uint256[], uint256, uint256, uint256)` | Mint completes (minter, qty, serials, hbar, lazy, discount) |
| `NFTRefunded(address, uint256[], uint256, uint256)` | Refund processed |
| `NFTsAddedToPool(address, uint256[], uint256)` | Serials added to pool |
| `WhitelistUpdated(address, bool)` | WL address added/removed |

**EditionWithPrize:**

| Event | Emitted When |
|-------|-------------|
| `EditionMintEvent(address, bool, uint256, uint256)` | Edition minted |
| `WinnerSelectedEvent(uint256[], uint256)` | Prize winners drawn |
| `PrizeClaimedEvent(address, uint256, uint256)` | Prize claimed by winner |

**SoulboundBadgeMinter:**

| Event | Emitted When |
|-------|-------------|
| `BadgeMintEvent(uint256, address, uint256[], uint256)` | Badge(s) minted |
| `BadgeCreated(uint256, string, string)` | New badge type created |
| `BurnEvent(uint256, address, int64[], uint64)` | Badge(s) burned/revoked |

### Querying Events via Mirror Node

Hedera's mirror node REST API is the reliable way to fetch historical events. The contracts do not support Ethereum-style `eth_getLogs` subscriptions natively.

```js
import axios from 'axios';

const MIRROR_BASE = 'https://testnet.mirrornode.hedera.com';
// For mainnet: 'https://mainnet.mirrornode.hedera.com'

async function getContractEvents(contractId, iface, limit = 100) {
    const url = `${MIRROR_BASE}/api/v1/contracts/${contractId}/results/logs?order=desc&limit=${limit}`;
    const { data } = await axios.get(url);

    return data.logs
        .filter(log => log.data !== '0x' && log.topics?.length > 0)
        .map(log => {
            try {
                const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                return {
                    name: parsed.name,
                    args: parsed.args,
                    timestamp: new Date(parseFloat(log.timestamp) * 1000),
                    transactionHash: log.transaction_hash,
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

// Usage
const iface = new ethers.Interface(ForeverMinterABI.abi);
const events = await getContractEvents('0.0.12345', iface);
const mints = events.filter(e => e.name === 'NFTMinted');
```

For paginated results, follow the `links.next` field in the response to fetch additional pages.

---

## Cost Calculation

Always query the on-chain cost before minting. Costs vary based on whitelist status, discounts, and payment method.

### MinterContract / SoulboundMinter

```js
// getCost() returns the caller's cost factoring in their WL status
const [hbarCost, lazyCost] = await contract.getCost();

// getMintEconomics() returns the full economics struct
const economics = await contract.getMintEconomics();
// economics.mintPriceHbar, economics.mintPriceLazy, economics.wlDiscount, etc.

// getMintTiming() returns timing configuration
const timing = await contract.getMintTiming();
// timing.mintStartTime, timing.cooldownPeriod, timing.refundWindow, etc.
```

### ForeverMinter

ForeverMinter has a more complex discount system. There is no single `getCost()` function -- you compute the cost from `getMintEconomics()` and discount tiers:

```js
const economics = await contract.getMintEconomics();
const baseHbar = economics.mintPriceHbar;
const baseLazy = economics.mintPriceLazy;

// Check whitelist discount
const wlSlots = await contract.whitelistSlots(userAddress);
const wlDiscount = wlSlots > 0 ? economics.wlDiscount : 0;

// Check holder discount tiers
const tierCount = await contract.getDiscountTierCount();
let holderDiscount = 0;
for (let i = 0; i < tierCount; i++) {
    const tier = await contract.getDiscountTier(i);
    // Check if user holds a serial of tier.token with uses remaining
    // holderDiscount = Math.max(holderDiscount, tier.discountPercentage);
}

// WL and holder discounts stack additively (capped at 100)
const combinedDiscount = Math.min(wlDiscount + holderDiscount, 100);

const finalHbar = baseHbar * BigInt(100 - combinedDiscount) / 100n;
const finalLazy = baseLazy * BigInt(100 - combinedDiscount) / 100n;
```

### EditionWithPrize

```js
// getMintCost() returns the caller's costs
const [hbarCost, lazyCost, usdcCost] = await contract.getMintCost();
```

### SoulboundBadgeMinter

Badge minting is free (no HBAR or $LAZY payment). Cost checking is not needed -- only whitelist eligibility matters.

---

## Common Integration Patterns

### Full Mint Flow (MinterContract)

```js
async function mintNFT(contract, iface, quantity) {
    // 1. Check if minting is open
    const timing = await contract.getMintTiming();
    const now = Math.floor(Date.now() / 1000);
    if (timing.mintStartTime > now) throw new Error('Minting not started');
    if (timing.mintPaused) throw new Error('Minting is paused');

    // 2. Get cost for this user (factors in WL status)
    const [hbarCost, lazyCost] = await contract.getCost();
    const totalHbar = hbarCost * BigInt(quantity);
    const totalLazy = lazyCost * BigInt(quantity);

    // 3. If paying with $LAZY, ensure allowance is set
    if (totalLazy > 0n) {
        const lazyToken = new ethers.Contract(lazyTokenAddress, ERC20_ABI, signer);
        const allowance = await lazyToken.allowance(userAddress, contractAddress);
        if (allowance < totalLazy) {
            const approveTx = await lazyToken.approve(contractAddress, totalLazy);
            await approveTx.wait();
        }
    }

    // 4. Execute mint
    const tx = await contract.mintNFT(quantity, { value: totalHbar });
    const receipt = await tx.wait();

    // 5. Parse events from receipt to get serial numbers
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed.name === 'MintEvent') {
                console.log('Minted serial:', parsed.args._serial.toString());
            }
        } catch { /* skip non-matching logs */ }
    }
}
```

### Whitelist Check

```js
// MinterContract / SoulboundMinter: getCost() implicitly checks WL
const [hbarCost, lazyCost] = await contract.getCost();
// If hbarCost < base price, user is whitelisted

// ForeverMinter: direct slot check
const slots = await contract.whitelistSlots(userAddress);
const isWhitelisted = slots > 0;

// SoulboundBadgeMinter: per-badge eligibility
const eligibility = await contract.getUserBadgeEligibility(typeId, userAddress);
// Returns: isWhitelisted, remainingSlots, totalMinted, canMint
```

### Refund Flow (ForeverMinter)

```js
async function refundNFTs(contract, serials) {
    // 1. Check refund window
    const timing = await contract.getMintTiming();
    const now = Math.floor(Date.now() / 1000);
    // refundWindow is duration in seconds from last mint

    // 2. Execute refund (returns NFTs to pool, refunds partial HBAR/LAZY)
    const tx = await contract.refundNFT(serials);
    const receipt = await tx.wait();

    // 3. Parse NFTRefunded event
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed.name === 'NFTRefunded') {
                console.log('Refunded HBAR:', parsed.args.hbarRefunded.toString());
                console.log('Refunded LAZY:', parsed.args.lazyRefunded.toString());
            }
        } catch { /* skip */ }
    }
}
```

### Token Association Reminder

Before a user can receive an HTS NFT, their account must be associated with the token. This is a Hedera-specific requirement that does not exist in ERC-721.

```js
import { TokenAssociateTransaction } from '@hashgraph/sdk';

// Associate user with the NFT token before minting
const tx = await new TokenAssociateTransaction()
    .setAccountId(userAccountId)
    .setTokenIds([nftTokenId])
    .execute(client);
await tx.getReceipt(client);
```

If association is missing, the mint transaction will revert with `AssociationFailed()` or `NFTTransferFailed()`. Your UI should check association status via the mirror node before attempting a mint:

```js
const url = `${MIRROR_BASE}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
const { data } = await axios.get(url);
const isAssociated = data.tokens?.length > 0;
```
