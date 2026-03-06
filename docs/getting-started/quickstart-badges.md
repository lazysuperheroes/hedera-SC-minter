# Quickstart: Deploy a SoulboundBadgeMinter

Deploy a SoulboundBadgeMinter to manage multiple soulbound badge types in a single contract -- ideal for achievement systems, event badges, and certification programs.

## How It Differs from SoulboundMinter

SoulboundBadgeMinter (v1.0) supports **multiple badge types** within one contract. Each badge type has its own name, metadata, supply cap, and per-address whitelist. This is more efficient than deploying separate SoulboundMinter contracts for each badge.

Key features:
- Multiple badge types per contract
- Per-badge whitelists with quantity controls
- Per-badge supply caps (or unlimited)
- Multi-admin support
- Optional revocation (set at deploy time)

## Step 1: Configure Your Environment

```env
ACCOUNT_ID=0.0.XXXXX
PRIVATE_KEY=302e...
ENVIRONMENT=TEST
```

## Step 2: Compile

```bash
npx hardhat compile
```

## Step 3: Deploy

```bash
npx hardhat run scripts/deployment/deploy-SoulboundBadgeMinter.js
```

The script will:

1. Display your operator and environment
2. Ask about **revocable** status (immutable after deployment)
3. Deploy the contract
4. Print the Contract ID and next steps

Add the Contract ID to `.env`:

```env
CONTRACT_ID=0.0.XXXXX
```

## Step 4: Initialize the Token

Create the underlying HTS NFT token that will hold all badge types:

```bash
node scripts/interactions/BadgeMinter/prepareBadgeMinter.js -init -name "My Badges" -symbol "BADGE" -memo "Achievement badges"
```

Arguments:
- `-name` -- Token name
- `-symbol` -- Token symbol
- `-memo` -- Token memo (max 100 bytes)
- `-max` -- Max supply across all badge types (0 = unlimited)

## Step 5: Create Badge Types

Create one or more badge types. Each badge type has its own name, metadata, and supply cap:

```bash
# Limited supply badge
node scripts/interactions/BadgeMinter/createBadge.js "Bronze Badge" "ipfs://QmBronze/metadata.json" 100

# Unlimited supply badge
node scripts/interactions/BadgeMinter/createBadge.js "Silver Badge" "ipfs://QmSilver/metadata.json" 0
```

Arguments: `<name> <metadata> <maxSupply>`

The script returns the badge ID (a sequential integer starting from 1). Note these IDs -- you will use them for whitelisting and minting.

## Step 6: Whitelist Users for Badges

Add users to badge-specific whitelists with quantity limits:

```bash
# Allow accounts to mint badge ID 1 (2 mints for first account, 1 for second)
node scripts/interactions/BadgeMinter/addToBadgeWhitelist.js 1 "0.0.11111,0.0.22222" "2,1"

# Unlimited mints (quantity 0 = no limit)
node scripts/interactions/BadgeMinter/addToBadgeWhitelist.js 2 "0.0.11111" "0"
```

Arguments: `<badgeId> <comma-separated-accounts> <comma-separated-quantities>`

## Step 7: Mint Badges

Mint badges for yourself or on behalf of others:

```bash
# Mint 2 of badge type 1 for yourself
node scripts/interactions/BadgeMinter/mintBadge.js 1 2

# Mint 1 of badge type 1 for another account
node scripts/interactions/BadgeMinter/mintBadge.js 1 1 0.0.33333
```

Arguments: `<badgeId> <quantity> [recipientAccountId]`

The script will:
1. Check recipient eligibility and remaining mint allocation
2. Verify token association
3. Execute the mint
4. Display minted serial numbers

When minting on behalf of another account, the recipient must have already associated the badge token.

## Verify and Manage

### Check Contract State

```bash
node scripts/interactions/BadgeMinter/getContractInfo.js
```

### View Badge Details

```bash
# View a specific badge
node scripts/interactions/BadgeMinter/getBadge.js 1

# View all badges
node scripts/interactions/BadgeMinter/getBadge.js
```

### Check User Eligibility

```bash
# Check your eligibility for all badges
node scripts/interactions/BadgeMinter/checkUserEligibility.js

# Check eligibility for a specific badge
node scripts/interactions/BadgeMinter/checkUserEligibility.js 1

# Check another user
node scripts/interactions/BadgeMinter/checkUserEligibility.js 1 0.0.11111
```

### Update Badge Metadata

```bash
node scripts/interactions/BadgeMinter/updateBadge.js 1 "Bronze Badge V2" "ipfs://QmBronzeV2/metadata.json" 150
```

### Activate/Deactivate Badges

```bash
# Deactivate badge type 1
node scripts/interactions/BadgeMinter/activateBadge.js 1 false

# Reactivate
node scripts/interactions/BadgeMinter/activateBadge.js 1 true
```

### Manage Admins

```bash
node scripts/interactions/BadgeMinter/addAdmin.js 0.0.44444
node scripts/interactions/BadgeMinter/removeAdmin.js 0.0.44444
node scripts/interactions/BadgeMinter/listAdmins.js
```

### Revoke Badges (If Revocable)

```bash
node scripts/interactions/BadgeMinter/revokeSBT.js 0.0.11111 42
```

### Withdraw HBAR

```bash
node scripts/interactions/BadgeMinter/transferHbar.js 1000000
```

## Troubleshooting

- **"TokenNotInitialized"**: Run `prepareBadgeMinter.js -init` before creating badges.
- **"TypeNotFound"**: The badge ID does not exist. Create it with `createBadge.js` first.
- **"NotWhitelistedForType"**: The user is not on the whitelist for this badge. Add them with `addToBadgeWhitelist.js`.
- **"InsufficientBadgeSupply"**: The badge has reached its maximum supply.
- **"NotAdmin"**: Your account is not an admin of this contract.
- **Token association**: Recipients must associate the token before receiving minted-on-behalf badges.

For more details, see the [BadgeMinter README](../../scripts/interactions/BadgeMinter/README.md) and the [Troubleshooting Guide](../guides/troubleshooting.md).
