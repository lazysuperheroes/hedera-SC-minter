# Building With the Hedera Minter Suite: A Developer's Guide

*Published by the Lazy Superheroes team*

---

You've decided to build an NFT minting experience on Hedera. You have options. The Hedera SDK lets you mint tokens from a backend. Third-party tools offer drag-and-drop interfaces. Both work -- but both require your users to trust that someone, somewhere, is running the process honestly. The price is what the server says. The supply cap is what the database enforces. The whitelist is whatever the admin decides it is today.

Smart contract minting is a different foundation. When the rules live on-chain, they're public, immutable, and verifiable. Your users don't need to trust your team -- they can read the contract on HashScan, compare it to the source code, and know exactly what will happen before they spend a single HBAR. **Code is law. Trust but verify. Or better yet -- don't trust at all, because you don't need to.**

If you believe in decentralization as a core principle -- that on-chain guarantees are better than off-chain promises -- then the Hedera Minter Suite gives you the right starting point. Five production-tested contracts, a utility SDK, and a CLI that handles 85 operations out of the box. All open source, all verifiable, all built so that users can have confidence in the process without having to have faith in the operator.

This post is for developers. We'll cover how to pick the right contract, the architecture decisions behind each one, the SDK and CLI tooling, and the configuration surface you'll need to understand. By the end, you should be able to go from "I want to mint NFTs on Hedera" to deployed contract with admin tooling in an afternoon.

---

## Choosing Your Contract

The first decision is which contract to deploy. Here's the decision tree:

**Do the tokens need to be transferable?**
- **No** (soulbound) -- Do you need multiple badge types per contract?
  - Yes --> **SoulboundBadgeMinter**
  - No --> **SoulboundMinter**
- **Yes** (transferable) -- Are you minting new tokens or distributing existing ones?
  - Distributing existing serials --> **ForeverMinter**
  - Minting new tokens -- Do you want a prize lottery mechanic?
    - Yes --> **EditionWithPrize**
    - No --> **MinterContract**

### Contract Architecture at a Glance

The v2.0 contracts (MinterContract, SoulboundMinter) share an inheritance chain:

```
Contract -> ExpiryHelperV2 -> FeeHelperV2 -> KeyHelperV2 -> HederaTokenServiceV2
         + Ownable + ReentrancyGuard
```

These use **custom errors** throughout (no `require()` strings), which saves gas and provides structured revert data.

The v1.0 contracts each have their own inheritance:

```
ForeverMinter       -> TokenStakerV2 + Ownable + ReentrancyGuard
SoulboundBadgeMinter -> KeyHelper + HederaTokenService + Ownable + ReentrancyGuard
EditionWithPrize    -> KeyHelper + ExpiryHelper + Ownable + ReentrancyGuard
```

These use `require()` with string messages.

All contracts are compiled with Solidity 0.8.18, optimizer at 200 runs with `viaIR: true`, and enforced under the 24,576 byte contract size limit.

---

## The Key Architectural Decisions

Every architectural choice in the suite serves a dual purpose: it solves a technical problem *and* it reinforces the trust model. When a user interacts with one of these contracts, every rule -- pricing, supply caps, discount logic, refund windows -- is enforced by code that anyone can read and verify on-chain. No backend, no API key, no "trust us." The architecture below explains how.

### HTS, Not ERC-721

Every token in this suite is a native Hedera Token Service token. We interact with the HTS precompile at `0x167`, not with ERC-721 contracts. This matters because:

- Tokens appear natively in wallets, HashScan, and marketplaces without wrapping
- Token operations (freeze, wipe, burn) are enforced at the network level, not by contract logic that could be bypassed
- Royalty fees are protocol-level, not contract-level conventions -- creators get paid because the *network* enforces it

The trade-off: you can't use standard Solidity ERC-721 patterns. Token creation, minting, and transfers all go through `IHederaTokenService` interfaces. But the payoff is consensus-level security guarantees that no smart contract hack can circumvent.

### Soulbound via Freeze, Not Transfer Restriction

SoulboundMinter and SoulboundBadgeMinter don't override `transfer()` to block movement. Instead, they create tokens with FREEZE and WIPE keys pointing to the contract, then call `freezeToken()` on the recipient after each mint. This makes soulbinding a network-level guarantee -- no contract bypass, no proxy workaround. Users can verify this themselves: the token's freeze key points to the contract address, and the contract has no function to unfreeze. The guarantee is visible on HashScan before a user ever interacts with the contract.

### Royalty Compliance via Stake/Unstake

ForeverMinter faces a unique problem: Hedera enforces royalty fees on token transfers, but a distribution contract shouldn't silently absorb royalties on behalf of recipients. The solution is `TokenStakerV2`:

1. NFTs are "staked" into the contract (transferred to contract treasury, bypassing royalties since the contract is the token treasury)
2. When a user mints, the NFT is "unstaked" (transferred from contract to user), which triggers royalty payment
3. The user pays royalties as if they bought on a marketplace

This is why ForeverMinter is the right choice for secondary distribution scenarios where creator royalties matter.

### LazyGasStation Pattern

ForeverMinter and EditionWithPrize route $LAZY operations through a separate `LazyGasStation` contract rather than handling transfers inline. The gas station:

- Accepts $LAZY via allowance
- Executes the configured burn percentage through the Lazy Smart Contract Treasury
- Manages gas refills (HBAR) for contracts that need it for HTS operations

This decouples token economics from minting logic and allows the gas station to serve multiple contracts.

---

## The SDK: @lazysuperheroes/hedera-minter-sdk

The SDK packages the utility functions used by every script in the repo. Install it and you get:

```bash
npm install @lazysuperheroes/hedera-minter-sdk
```

### Module Map

| Module | Source | What It Does |
|--------|--------|-------------|
| `contract` | solidityHelpers | Deploy contracts, execute functions, read-only EVM calls via mirror node |
| `hedera` | hederaHelpers | Account creation, token association, allowances, transfers |
| `mirror` | hederaMirrorHelpers | Balance checks, serial queries, event parsing, token details |
| `gas` | gasHelpers | Gas estimation via mirror node simulation |
| `transaction` | transactionHelpers | Transaction record parsing and failure analysis |
| `node` | nodeHelpers | Sleep, hex conversion, argument parsing |

### Quick Start

```javascript
const {
  createClient,
  initScript,
  contractExecuteFunction,
  readOnlyEVMFromMirrorNode,
  checkMirrorBalance,
  associateTokenToAccount,
} = require('@lazysuperheroes/hedera-minter-sdk');

// Set up a client
const client = createClient('TEST', operatorId, operatorKey);

// Read contract state via mirror node (no gas cost)
const encodedCall = iface.encodeFunctionData('getMintEconomics');
const result = await readOnlyEVMFromMirrorNode('TEST', contractId, encodedCall, operatorId, false);
const economics = iface.decodeFunctionResult('getMintEconomics', result);

// Execute a contract function (costs gas)
const [receipt, record, tx] = await contractExecuteFunction(
  contractId, iface, client, gasLimit,
  'mintNFT', [quantity, discountTokens, serialsByToken, sacrificeSerials],
  hbarPayment,
);
```

### ABI Loading

The SDK's `loadABI()` tries `@lazysuperheroes/hedera-minter-contracts` first, then falls back to hardhat artifacts in development:

```javascript
const { loadABI } = require('@lazysuperheroes/hedera-minter-sdk');
const iface = loadABI('ForeverMinter'); // Returns ethers.Interface
```

---

## The CLI: @lazysuperheroes/hedera-minter-cli

Every admin and user operation has a CLI command. Install globally:

```bash
npm install -g @lazysuperheroes/hedera-minter-cli
```

### Command Structure

```
hedera-mint <contract-type> [admin] <command> [args]
```

**Contract types:** `forever`, `badge`, `edition`, `minter`

**Plus:** `deploy` and `debug` command groups

### Examples

```bash
# Check ForeverMinter contract state
hedera-mint forever info

# Calculate mint cost with discounts
hedera-mint forever cost 5

# Pause minting (admin)
hedera-mint forever admin pause true

# Deploy a new ForeverMinter
hedera-mint deploy forever

# Decode a contract error
hedera-mint debug decode 0x08c379a0...
```

### Automation Flags

Two flags make the CLI automation-friendly:

**`--json`** -- Structured JSON output from read-only commands. Pipe it to `jq`, parse it in a script, feed it to a dashboard:

```bash
hedera-mint --json forever info | jq '.pricing.mintPriceHbar'
hedera-mint --json forever cost 10 | jq '.finalCost'
hedera-mint --json badge info | jq '.activeBadges'
```

**`--no-input`** -- Non-interactive mode. Confirmation prompts auto-accept, so you can run commands in CI/CD pipelines or cron jobs. Required data inputs must come from command-line arguments:

```bash
hedera-mint --no-input forever admin pause true
```

### Configuration

The CLI reads from `.env` in your working directory:

```env
ACCOUNT_ID=0.0.12345
PRIVATE_KEY=302e...
ENVIRONMENT=TEST

# Contract-specific (varies by command)
FOREVER_MINTER_CONTRACT_ID=0.0.67890
CONTRACT_ID=0.0.67890
CONTRACT_NAME=MinterContract
```

---

## Contract Configuration Deep Dive

Every contract has a `MintEconomics` struct (or equivalent) and a `MintTiming` struct that control behavior. These are the levers you'll spend most of your time adjusting.

### MintEconomics (MinterContract / SoulboundMinter)

| Field | Type | What It Controls |
|-------|------|-----------------|
| `mintPriceHbar` | uint256 | HBAR cost per NFT (in tinybar) |
| `mintPriceLazy` | uint256 | $LAZY cost per NFT (in smallest unit) |
| `wlDiscount` | uint256 | Whitelist discount percentage (0-100) |
| `maxMint` | uint256 | Max NFTs per transaction (0 = unlimited) |
| `maxWlMint` | uint256 | Max mints per whitelisted address |
| `lazyFromContract` | bool | Contract pays $LAZY instead of user |

### ForeverMinter Economics (Extended)

ForeverMinter adds holder discounts, sacrifice mechanics, and WL slot purchasing:

| Field | What It Controls |
|-------|-----------------|
| `mintPriceHbar` / `mintPriceLazy` | Base prices |
| `wlDiscount` | WL discount percentage, stacks with holder discount |
| `sacrificeDiscount` | Sacrifice discount percentage, exclusive (no stacking) |
| `maxPerMint` / `maxPerWallet` | Minting caps |
| `wlSlotCostLazy` | Cost to buy a WL slot with $LAZY |
| `maxSacrifice` | Max NFTs burnable per transaction |
| Discount tiers | Separate configuration per tier (percentage + max uses per serial) |

### MintTiming

| Field | What It Controls |
|-------|-----------------|
| `mintStartTime` | Unix timestamp; minting blocked before this time |
| `mintPaused` | Emergency stop |
| `refundWindow` | Seconds after mint during which refunds are allowed |
| `refundPercentage` | % of payment refunded on return |
| `wlOnly` | Restrict minting to whitelisted addresses only |

### EditionWithPrize Additions

EditionWithPrize adds USDC payment support and a 5-phase lifecycle:

- Phase 0: Not initialized (deploy, then call `initializeEditionToken` and `initializePrizeToken`)
- Phase 1: Edition minting open
- Phase 2: Sold out, winner selection available
- Phase 3: Winners selected, prize claiming available
- Phase 4: All prizes claimed, terminal

Each phase gates which functions can be called. The contract won't let you select winners before sellout or claim prizes before winners are selected.

---

## Frontend Integration Patterns

### Read-Only Queries (Free)

Use the mirror node for all read operations. No gas cost, no transaction required:

```javascript
const { readOnlyEVMFromMirrorNode } = require('@lazysuperheroes/hedera-minter-sdk/contract');

// Encode the call
const callData = iface.encodeFunctionData('getMintEconomics');

// Execute against mirror node
const result = await readOnlyEVMFromMirrorNode(
  'MAIN',        // environment
  contractId,    // contract
  callData,      // encoded function call
  operatorId,    // caller (for context)
  false,         // don't estimate gas
);

// Decode the result
const economics = iface.decodeFunctionResult('getMintEconomics', result);
```

### Cost Calculation Before Mint

ForeverMinter exposes `calculateMintCost()` which returns the exact HBAR and $LAZY amounts after applying all applicable discounts. Always call this before minting to show users their actual price:

```javascript
const [totalHbar, totalLazy, avgDiscount, holderSlots, wlSlots] =
  await readContract(iface, env, contractId, operatorId, 'calculateMintCost', [
    quantity,
    discountTokenAddresses,
    serialsByToken,
    sacrificeCount,
  ]);
```

### Allowance Setup

Both HBAR and $LAZY allowances must be set before minting. The user grants the contract (or LazyGasStation) permission to spend tokens:

```javascript
const { setHbarAllowance, setFTAllowance } = require('@lazysuperheroes/hedera-minter-sdk/hedera');

// HBAR allowance to the minting contract
await setHbarAllowance(client, operatorId, contractId, hbarAmount);

// $LAZY allowance to the LazyGasStation (not the minting contract)
await setFTAllowance(client, lazyTokenId, operatorId, gasStationId, lazyAmount);
```

### Token Association

Users must associate with the NFT token before they can receive it. Check first, then associate if needed:

```javascript
const { checkMirrorBalance } = require('@lazysuperheroes/hedera-minter-sdk/mirror');
const { associateTokenToAccount } = require('@lazysuperheroes/hedera-minter-sdk/hedera');

const balance = await checkMirrorBalance(env, accountId, nftTokenId);
if (balance === null) {
  // Not associated yet
  await associateTokenToAccount(client, accountId, privateKey, nftTokenId);
}
```

---

## Testing Strategy

All tests run against Hedera testnet (not a local Hardhat network). This means every test creates real accounts, tokens, and contracts on a live consensus network.

**Why testnet, not local?**

The HTS precompile behaves differently from any local EVM mock. Token creation, freezing, royalty enforcement, mirror node queries -- none of these work realistically in a local environment. Testing against testnet gives confidence that the same code will work on mainnet.

**What to expect:**

- Tests take 5-30 minutes per contract (network latency, consensus finality)
- Tests require a funded testnet account (HBAR for gas + token creation)
- Mirror node has a 3-5 second propagation delay; tests include appropriate sleeps
- Timeout is set to 10,000,000ms (about 2.7 hours) in hardhat config

```bash
# Run all tests
npm test

# Run a specific contract's tests
npm run test-forever    # ForeverMinter
npm run test-badges     # SoulboundBadgeMinter
npm run test-ewp        # EditionWithPrize
```

---

## Deployment Workflow

Every contract has an interactive deployment script:

```bash
npx hardhat run scripts/deployment/deploy-ForeverMinter.js
```

Or via the CLI:

```bash
hedera-mint deploy forever
```

The deployment flow varies by contract, but generally:

1. **Deploy** -- constructor args for $LAZY token, burn percentage, etc.
2. **Initialize** -- create the HTS token (name, symbol, metadata, supply)
3. **Configure** -- set economics, timing, whitelists
4. **Fund** -- send HBAR to the contract for HTS operations
5. **Verify** -- run `hedera-mint <type> info` to confirm everything looks right

ForeverMinter has additional post-deploy steps:
- Register with LazyGasStation
- Add NFTs to the pool (transfer serials, then register them)
- Configure discount tiers

---

## NPM Packages

The suite publishes three packages under `@lazysuperheroes`:

| Package | What It Contains |
|---------|-----------------|
| `@lazysuperheroes/hedera-minter-contracts` | ABIs (10 contracts) + Solidity sources. Zero runtime deps. Import ABIs by name or use `loadABI()`. |
| `@lazysuperheroes/hedera-minter-sdk` | Utility modules for contract interaction, mirror node queries, gas estimation, transaction parsing. |
| `@lazysuperheroes/hedera-minter-cli` | The `hedera-mint` CLI with 85 commands. Depends on SDK + contracts packages. |

```javascript
// Load an ABI
const { foreverMinterABI, loadABI } = require('@lazysuperheroes/hedera-minter-contracts');

// Use SDK utilities
const { contractExecuteFunction, checkMirrorBalance } = require('@lazysuperheroes/hedera-minter-sdk');

// Or use namespaced imports
const sdk = require('@lazysuperheroes/hedera-minter-sdk');
const result = await sdk.mirror.checkMirrorBalance(env, accountId, tokenId);
```

---

## Security & Verifiability

The security model has two layers, and both reinforce the trust-free design:

**Contract-level protections:**
- All contracts use OpenZeppelin's `ReentrancyGuard` on state-changing functions
- HBAR transfers use `Address.sendValue()` (not `.transfer()`) to avoid gas limit issues
- $LAZY burn percentage is validated to 0-100 range
- Whitelist discount is validated to 0-100 range
- ForeverMinter validates refund amounts against actual payment records per serial
- v2.0 contracts use custom errors, which can't be spoofed by string matching
- All tokens are created with keys held by the contract, not by external accounts

**Network-level guarantees (the part users can verify without reading Solidity):**
- Token operations are enforced at the consensus level, not just by contract logic. A frozen token cannot be transferred regardless of what any contract says
- Royalty fees are collected by the protocol, not by contract convention -- they can't be silently skipped
- Token supply is visible on HashScan. The contract's max supply is the network's max supply

**Full verifiability:** Every contract is open source. The Solidity is readable, the ABIs are published, and the deployed bytecode can be verified against the source. Users don't need to trust the team behind the project -- they can audit the code, check the contract on HashScan, and confirm that the rules are exactly what they appear to be. That's the whole point.

---

## Get Involved

The entire codebase is open source. We welcome issues, PRs, and questions.

- **Repository:** [github.com/lazysuperheroes/hedera-SC-minter](https://github.com/lazysuperheroes/hedera-SC-minter)
- **Issues & discussions:** [GitHub Issues](https://github.com/lazysuperheroes/hedera-SC-minter/issues)
- **NPM packages:** Search `@lazysuperheroes` on npmjs.com
- **Website:** [lazysuperheroes.com](https://www.lazysuperheroes.com/)
- **Whitepaper:** [docs.lazysuperheroes.com](https://docs.lazysuperheroes.com/)
- **X/Twitter:** [@superheroeslazy](https://x.com/superheroeslazy)
- **Email:** [lazysuperheroes@protonmail.com](mailto:lazysuperheroes@protonmail.com)

Whether you're building a simple drop or a complex gamified distribution system, we'd rather you start from tested, verified, open-source code than reinvent the wheel. Fork it, deploy it, extend it, audit it line by line. You're not even trusting *us* -- the code speaks for itself.

---

*All contracts are Solidity 0.8.18, compiled with `viaIR: true` and optimizer at 200 runs. Contract sizes range from 14.8 KiB (SoulboundBadgeMinter) to 20.6 KiB (EditionWithPrize), all within the 24,576 byte limit. Tests are integration tests running against Hedera testnet using @hashgraph/sdk. The Hedera Minter Suite is maintained by the [Lazy Superheroes](https://www.lazysuperheroes.com/) team.*
