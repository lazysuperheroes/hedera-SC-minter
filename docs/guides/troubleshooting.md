# Troubleshooting Guide

Common issues and solutions when working with the Hedera SC Minter Suite.

## Environment and Configuration Issues

### Missing `.env` file or variables

**Symptom**: Error messages like "Environment required", "please specify PRIVATE_KEY", or `Cannot read properties of undefined`.

**Solution**:
1. Copy `.env.example` to `.env` if you haven't already:
   ```bash
   cp .env.example .env
   ```
2. Fill in the required values. At minimum, every script needs:
   ```env
   ACCOUNT_ID=0.0.XXXXX
   PRIVATE_KEY=302e...
   ENVIRONMENT=TEST
   ```
3. For contract-specific scripts, also set the relevant contract ID (e.g., `CONTRACT_ID`, `FOREVER_MINTER_CONTRACT_ID`, or `EDITION_WITH_PRIZE_CONTRACT_ID`).

### Wrong `CONTRACT_NAME` for the deployed contract

**Symptom**: ABI decoding errors, unexpected function signatures, or "function not found" errors.

**Solution**: Ensure `CONTRACT_NAME` in `.env` matches what you deployed:
- `MinterContract` for standard NFT minting
- `SoulboundMinter` for soulbound NFT minting

The scripts load the ABI from `artifacts/contracts/<CONTRACT_NAME>.sol/<CONTRACT_NAME>.json`.

### Testnet vs Mainnet mismatch

**Symptom**: "Contract not found", empty mirror node responses, or transactions succeed on one network but fail on another.

**Solution**:
1. Verify `ENVIRONMENT` is set to the correct network (`TEST` or `MAIN`).
2. Contract IDs are network-specific. A contract deployed on testnet does not exist on mainnet.
3. LAZY token IDs differ between networks:
   - Testnet: `LAZY_TOKEN_ID=0.0.2185`, `LAZY_SCT_CONTRACT_ID=0.0.2181`
   - Mainnet: `LAZY_TOKEN_ID=0.0.1311037`, `LAZY_SCT_CONTRACT_ID=0.0.1311003`

### Invalid private key format

**Symptom**: `BadKeyError` or `INVALID_SIGNATURE`.

**Solution**: The suite expects **ED25519** keys. Ensure your private key:
- Is in DER-encoded hex format (starts with `302e` or `3030`)
- Was generated as ED25519, not ECDSA
- Matches the `ACCOUNT_ID` you specified

---

## Token Association Failures

### "TOKEN_NOT_ASSOCIATED_TO_ACCOUNT"

**Symptom**: Mint transactions fail with `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`.

**Solution**: The recipient must associate with the NFT token before receiving it.

Most mint scripts detect this and offer to associate automatically. If you need to associate manually:
- Use HashPack, Kabila, or another Hedera wallet
- Or use the Hedera SDK to call `TokenAssociateTransaction`

For BadgeMinter `mintBadgeOnBehalf`, the **recipient** must associate the token themselves -- the operator cannot do it for them.

### Association during minting

**Symptom**: The mint script offers to associate but the subsequent mint still fails.

**Solution**: Token association transactions need to be confirmed on the network before the mint transaction is sent. The scripts handle this sequentially, but if you experience race conditions:
1. Run the association separately first
2. Wait a few seconds
3. Then run the mint script again

---

## Transaction Failures

### "CONTRACT_REVERT_EXECUTED"

**Symptom**: Transaction executes but the contract reverts.

**Causes and solutions**:

| Possible Cause | How to Check | Solution |
|----------------|-------------|----------|
| Minting is paused | Run `getContractInfo.js` or `getContractState.js` | Unpause with `setPause.js false` |
| Insufficient payment | Check pricing with `checkMintCost.js` | Ensure HBAR/LAZY/USDC amounts match |
| Insufficient allowance | Check allowance via mirror node | Set allowance before minting |
| Max supply reached | Check remaining supply | No more NFTs available |
| Max per wallet reached | Check wallet mint count | Limit reached for this wallet |
| WL-only and not whitelisted | Check WL status | Add address to whitelist |
| Mint not started | Check timing config | Wait for start time |
| Wrong phase (EditionWithPrize) | Run `getContractState.js` | Ensure correct phase for your operation |
| Not an admin | Check admin list | Use an admin account |

### Decoding revert errors

Use the error decoder to understand what went wrong:

```bash
# Decode a hex error string from a failed transaction
node scripts/debug/decodeSmartContractError.js 0x08c379a0...

# Fetch the last error from mirror node for a contract
node scripts/debug/decodeSmartContractError.js testnet 0.0.XXXXX

# Fetch last 5 errors
node scripts/debug/decodeSmartContractError.js testnet 0.0.XXXXX 5
```

The decoder looks up error signatures on 4byte.directory and recursively decodes nested errors.

For v2.0 contracts (MinterContract, SoulboundMinter) that use **custom errors** instead of string reverts, you can also use:

```bash
node scripts/debug/decodeWithABI.js
```

### "INSUFFICIENT_TX_FEE"

**Symptom**: Transaction rejected before execution due to insufficient fee.

**Solution**: This usually means the gas limit is too low. Options:
1. Most scripts calculate gas dynamically. If the estimate seems low, the script usually allows overrides.
2. For `prepareMinter.js`, use the `-gas X` flag.
3. For ForeverMinter and EditionWithPrize scripts, gas estimation happens via mirror node simulation. If the estimate fails, a conservative fallback is used.

### "INSUFFICIENT_PAYER_BALANCE"

**Symptom**: Your account does not have enough HBAR to pay for the transaction.

**Solution**: Fund your operator account with more testnet HBAR from the [Hedera faucet](https://portal.hedera.com).

---

## Gas Issues

### Gas estimation returns 0 or fails

**Symptom**: Gas estimation via mirror node returns an error or 0.

**Causes**:
- The contract function would revert (check parameters)
- Mirror node is temporarily unavailable
- Contract ID in `.env` is incorrect

**Solution**: Most scripts fall back to a hardcoded gas estimate when mirror estimation fails. If you need to override, look for the gas limit parameter in the script.

### EditionWithPrize `selectWinner()` gas

**Symptom**: `selectWinner()` fails with gas exhaustion when `prizeMaxSupply > 1`.

**Solution**: The robust PRNG algorithm needs extra gas to handle potential duplicate random numbers. The `selectWinner.js` script automatically applies a 2.5x gas multiplier for multiple winners. If it still fails:
1. Try running again -- the algorithm is idempotent
2. The probability of needing more than 2.5x is very low but possible for extreme configurations

### ForeverMinter batch operations

**Symptom**: `registerPoolNFTs.js` or `batchAddToWhitelist.js` times out or fails on large batches.

**Solution**: These scripts process in batches of 30 (registration) or 75 (whitelist). If a batch fails:
1. The script reports which batches succeeded
2. Re-run the script -- it detects already-registered serials and only processes new ones
3. For very large pools, consider running in smaller manual batches

---

## Mirror Node Issues

### "Empty data" or stale results

**Symptom**: Read-only queries return empty data or outdated values.

**Solution**: Mirror nodes have a propagation delay (typically 3-7 seconds after a consensus transaction). If you run a write followed immediately by a read:
1. Wait a few seconds
2. Re-run the read-only query
3. Most scripts that write and then read already account for this

### Mirror node rate limiting

**Symptom**: HTTP 429 errors or connection timeouts on mirror node queries.

**Solution**: If running many queries in sequence, add brief pauses between them. The utility functions in `utils/hederaMirrorHelpers.js` handle basic retry logic.

---

## Contract-Specific Issues

### MinterContract / SoulboundMinter

**"No option selected"** when running `prepareMinter.js`:
- You must specify a flag: `-upload`, `-init`, `-reset`, or `-hardreset`
- Run with `-h` for help

**Metadata upload seems stuck**:
- Large metadata sets are uploaded in batches (default 60 per batch)
- Each batch is a separate transaction. Wait for each to confirm.
- Adjust `METADATA_BATCH` in `.env` if needed

### ForeverMinter

**"Contract does not own any NFTs"** during registration:
- Transfer NFTs to the contract address before running `registerPoolNFTs.js`
- Use HashPack, Kabila, or the SDK to transfer

**Discount tokens not detected**:
- The mint script scans contract events to find discount tokens
- Ensure discount tiers were added with `addDiscountTier.js`
- If the contract has many events, scanning may take a moment

**Refund fails with "not eligible"**:
- Check the refund window with `checkRefundEligibility.js`
- Refunds are only available within the configured time window after minting

### EditionWithPrize

**"Edition token must be initialized first"**:
- Run `initializeEditionToken.js` before `initializePrizeToken.js`
- Tokens must be initialized in order

**"Minting not available"**:
- Check the phase with `getContractState.js`
- Minting is only possible in phase 1 (EDITION_MINTING)
- If phase is 0, tokens need initialization
- If phase is 2+, minting is over

### SoulboundBadgeMinter

**"TokenNotInitialized"**:
- Run `prepareBadgeMinter.js -init` before creating badges or minting

**"CannotRemoveLastAdmin"**:
- The contract requires at least one admin at all times

---

## Development Issues

### Compilation errors

```bash
npx hardhat compile
```

- Ensure Solidity 0.8.18 compiler is available (Hardhat downloads it automatically)
- Check that `@openzeppelin/contracts` is installed (`npm install`)
- The contract sizer enforces a 24,576 byte limit -- if a contract exceeds this, refactor or adjust optimizer settings

### Test failures

Tests run against Hedera testnet (not a local network). They require:
- Valid `.env` with testnet credentials
- Sufficient testnet HBAR
- `LAZY_TOKEN_ID` and `LAZY_SCT_CONTRACT_ID` set for testnet

Run specific test suites to isolate issues:
```bash
npm run test-nft       # MinterContract
npm run test-sbt       # SoulboundMinter
npm run test-forever   # ForeverMinter
npm run test-badges    # SoulboundBadgeMinter
npm run test-ewp       # EditionWithPrize
```

### Lint issues

```bash
# Solidity linting
npm run solhint

# JavaScript linting
npx eslint .
```

JavaScript style: tabs for indentation, single quotes, semicolons required, `stroustrup` brace style.

---

## Getting Help

1. **Check contract state**: Use the relevant `getContractInfo.js` or `getContractState.js` script
2. **Decode errors**: Use `scripts/debug/decodeSmartContractError.js`
3. **Review transaction**: Look up the transaction ID on [HashScan](https://hashscan.io)
4. **Check mirror node**: Query `https://<network>.mirrornode.hedera.com/api/v1/contracts/<id>/results?order=desc&limit=5`
5. **Review the source**: Contract source files are in `contracts/` with clear function documentation
