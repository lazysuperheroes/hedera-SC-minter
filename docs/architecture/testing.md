# Testing Architecture

## Test Strategy

All tests in this project are **integration tests that run against the live Hedera testnet**. There
is no local Hardhat network simulation. This is a deliberate choice driven by the nature of the
contracts: every NFT operation goes through the Hedera Token Service (HTS) precompile, which has no
accurate local equivalent. Token creation, minting, freezing, transferring, and allowance management
all behave differently on HTS than on a standard EVM, so testing against the real network is the
only way to get meaningful coverage.

The tradeoff is that tests are slow (minutes, not seconds), cost real testnet HBAR, and depend on
external infrastructure (consensus nodes, mirror nodes). The project accepts this tradeoff to avoid
false confidence from a simulated environment that cannot replicate HTS behavior.

## Test Infrastructure

Six utility modules in `utils/` provide the shared test infrastructure:

### solidityHelpers.js

Core contract interaction layer. Provides three key functions used by every test file:

- **`contractDeployFunction`** -- Deploys compiled contract bytecode via `ContractCreateFlow`.
- **`contractExecuteFunction`** -- Executes a contract function using `ethers.Interface` to encode
  parameters, then submits via `ContractExecuteTransaction`. Returns the receipt and decoded result.
- **`readOnlyEVMFromMirrorNode`** -- Performs free read-only calls through the mirror node REST API
  instead of submitting a paid consensus transaction.

Also includes `parseError` and `parseErrorTransactionId` for decoding custom errors and revert
reasons from failed transactions.

### hederaHelpers.js

Hedera SDK operations that tests need for setup and assertions:

- **`accountCreator`** -- Creates funded test accounts with `AccountCreateTransaction`.
- **`associateTokenToAccount`** / **`associateTokensToAccount`** -- Token association (required
  before any HTS token can be received).
- **`mintNFT`** / **`mintFT`** -- Mint tokens using supply keys.
- **`setFTAllowance`** / **`setNFTAllowanceAll`** / **`setHbarAllowance`** -- Approve allowances.
- **`sendNFT`** / **`sendFT`** / **`sendHbar`** -- Direct transfers.
- **`sweepHbar`** -- Recover HBAR from test accounts back to the operator during cleanup.
- **`clearNFTAllowances`** / **`clearFTAllowances`** -- Revoke allowances during teardown.

### hederaMirrorHelpers.js

Free queries against the Hedera mirror node REST API for verification:

- **`checkMirrorBalance`** -- Verify fungible token balances.
- **`checkMirrorHbarBalance`** -- Verify HBAR balances.
- **`getSerialsOwned`** -- List NFT serials held by an account.
- **`checkMirrorAllowance`** -- Verify token allowance amounts.
- **`getTokenDetails`** -- Fetch token metadata from the mirror node.
- **`getBaseURL`** -- Resolves the mirror node URL for the active environment.

### gasHelpers.js

Provides `estimateGas`, which uses `readOnlyEVMFromMirrorNode` to simulate a contract call and
return a gas estimate before submitting a paid transaction.

### transactionHelpers.js

Provides `parseTransactionRecord` and `formatTransactionAnalysis` for structured debugging output
from `TransactionRecord` objects (transfers, gas used, error messages, logs).

### nodeHelpers.js

Simple utilities: `sleep` (used between transactions to allow mirror node propagation), `getArg` /
`getArgFlag` (CLI argument parsing), and `hex_to_ascii`.

## Test Environment Setup

1. Copy `.env.example` to `.env`.
2. Set `ENVIRONMENT=TEST`.
3. Populate `ACCOUNT_ID` and `PRIVATE_KEY` with a funded Hedera testnet operator account (ED25519).
   Testnet accounts can be created at the [Hedera Portal](https://portal.hedera.com/).
4. The `LAZY_TOKEN_ID` and `LAZY_SCT_CONTRACT_ID` values in `.env.example` are pre-populated with
   testnet defaults. Tests that exercise LAZY payment paths deploy their own `FungibleTokenCreator`
   contract and mint a fresh LAZY-like token, so the `.env` values are only needed for scripts.
5. Compile contracts before running tests: `npx hardhat compile`.

The operator account needs sufficient testnet HBAR to cover contract deployment, account creation,
token creation, and minting fees across all tests. A few hundred testnet HBAR is typically enough
for a full run.

## Running Tests

Run all test suites:

```bash
npm test                  # runs: npx hardhat test
```

Run a specific contract's tests:

```bash
npm run test-ft           # FungibleTokenCreator
npm run test-nft          # MinterContract
npm run test-sbt          # SoulboundMinter
npm run test-badges       # SoulboundBadgeMinter
npm run test-forever      # ForeverMinter
npm run test-ewp          # EditionWithPrize
```

Run a single test file directly:

```bash
npx hardhat test test/ForeverMinter.test.js
```

The Hardhat config sets `mocha.timeout` to 10,000,000 ms (~2.7 hours) to accommodate the slow
testnet round-trips. Individual test cases involving multiple transactions can take 30-60 seconds.

## Test Structure

Each test file follows a consistent pattern:

### 1. Imports and Environment

Tests import from `@hashgraph/sdk`, `ethers`, the three core utility modules, and `chai`/`mocha`.
The operator account is loaded from `.env`. The `ENVIRONMENT` variable selects the network (TEST,
MAIN, PREVIEW, or LOCAL).

### 2. Deployment and Setup (first `describe` block)

The first test case in every file deploys the contract under test and its dependencies. This
includes:

- Initializing the Hedera `Client` for the target network.
- Creating test accounts (Alice, Bob, Carol) with `accountCreator`, each funded with testnet HBAR.
- Deploying dependency contracts (e.g., `FungibleTokenCreator` for LAZY tokens,
  `PrngGenerator` for randomness, `LazyGasStation`, `LazyDelegateRegistry`).
- Creating test tokens (NFTs for pools, fungible tokens for payments/discounts).
- Loading contract ABIs into `ethers.Interface` for encoding/decoding.

State is held in module-level variables (`contractId`, `aliceId`, `lazyTokenId`, etc.) shared
across all test cases within the file.

### 3. Functional Test Cases

Subsequent `describe` blocks test contract functionality in order: configuration, minting,
payment flows, whitelist behavior, edge cases, and error conditions. Tests use
`contractExecuteFunction` for state-changing calls and `readOnlyEVMFromMirrorNode` for view
functions. Assertions use `chai`'s `expect` and verify state via mirror node queries.

### 4. Cleanup (after hooks or final tests)

Some test files use `after` hooks or final test cases to sweep HBAR back from test accounts to the
operator, clear allowances, and log summary information.

### Test Files

| File | Contract | Key Areas |
|------|----------|-----------|
| `FungibleTokenCreator.test.js` | FungibleTokenCreator | FT creation, minting, transfers via HTS |
| `MinterContract.test.js` | MinterContract | NFT minting, HBAR/LAZY payments, whitelists, metadata |
| `SoulboundMinter.test.js` | SoulboundMinter | Soulbound (frozen) NFT minting, same payment paths |
| `SoulboundBadgeMinter.test.js` | SoulboundBadgeMinter | Multi-badge-type creation, admin management |
| `ForeverMinter.test.js` | ForeverMinter | Pool-based NFT distribution, discounts, sacrifices, refunds |
| `EditionWithPrize.test.js` | EditionWithPrize | Edition minting, prize distribution, USDC payments |

## Writing New Tests

### Adding Tests for a New Contract

1. Create `test/<ContractName>.test.js`.
2. Follow the existing import pattern -- pull from `solidityHelpers`, `hederaHelpers`, and
   `hederaMirrorHelpers`.
3. Initialize the Hedera client from `ENVIRONMENT` in the first test case.
4. Create test accounts with `accountCreator` and fund them appropriately.
5. Deploy the contract using `contractDeployFunction` with the compiled bytecode from
   `artifacts/contracts/`.
6. Load the ABI into an `ethers.Interface` for use with `contractExecuteFunction` and
   `readOnlyEVMFromMirrorNode`.
7. Add an npm script in `package.json` following the `test-*` naming convention.

### Adding Tests for Existing Contracts

Append new `describe`/`it` blocks to the relevant test file. Because tests share module-level
state and run sequentially (Mocha's default), new tests can rely on state established by earlier
test cases (deployed contracts, created accounts, minted tokens).

### Key Patterns

- Use `contractExecuteFunction(contractId, iface, client, gasLimit, fnName, params)` for
  state-changing calls. It returns `[receipt, decodedResult]`.
- Use `readOnlyEVMFromMirrorNode(env, contractId, encodedData, operatorId)` for view calls.
  Encode with `iface.encodeFunctionData(fnName, params)` and decode the result with
  `iface.decodeFunctionResult(fnName, result)`.
- Insert `await sleep(N)` (typically 3000-5000 ms) after transactions when the next step queries
  the mirror node, to allow propagation.
- Validate token balances with `checkMirrorBalance` rather than calling contract view functions,
  since HTS balances live outside the contract's storage.

## Known Limitations

- **Testnet dependency.** Tests require a live Hedera testnet connection. They cannot run offline,
  in CI without network access, or against a local Hardhat node (HTS precompiles are not available).
- **Execution speed.** A full test run across all contracts takes 15-45 minutes depending on
  testnet congestion. Each consensus transaction adds 3-7 seconds of latency.
- **Mirror node propagation delay.** Mirror node data lags behind consensus by a few seconds.
  Tests insert `sleep()` calls to compensate, but under high testnet load these may be
  insufficient, causing sporadic assertion failures.
- **Cost.** Tests consume testnet HBAR for account creation, contract deployment, token operations,
  and gas. The operator account must be periodically refilled via the Hedera testnet faucet.
- **Sequential execution.** Tests within a file depend on shared mutable state and must run in
  order. Parallel test execution is not supported.
- **No test isolation.** Failed test runs may leave behind deployed contracts, created accounts, and
  minted tokens on testnet. Cleanup logic (HBAR sweeps, allowance clears) runs at the end, so an
  early failure can leave resources stranded.
- **Rate limits.** The mirror node REST API has rate limits. Tests that make many rapid mirror node
  queries may hit these limits and fail with HTTP 429 errors.
