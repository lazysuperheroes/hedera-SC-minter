# Quickstart: Deploy a SoulboundMinter

Deploy a SoulboundMinter contract to issue non-transferable (frozen) NFTs for badges, certificates, or credentials.

## How It Differs from MinterContract

SoulboundMinter shares the same v2.0 architecture as MinterContract and uses an almost identical workflow. The key differences are:

- Minted NFTs are **frozen at mint time** using Hedera's FREEZE key, making them non-transferable
- The contract can be deployed as **revocable** (allowing the owner to burn/wipe SBTs from holders) or **non-revocable** (permanent)
- Royalties are not needed since the tokens cannot be resold
- Supports fixed-edition minting (all NFTs share the same metadata)

## Quick Setup

Follow the same steps as the [MinterContract Quickstart](quickstart-minter.md) with these differences:

### 1. Configure `.env`

```env
ACCOUNT_ID=0.0.XXXXX
PRIVATE_KEY=302e...
ENVIRONMENT=TEST
CONTRACT_NAME=SoulboundMinter

LAZY_TOKEN_ID=0.0.2185
LAZY_SCT_CONTRACT_ID=0.0.2181
```

### 2. Compile

```bash
npx hardhat compile
```

### 3. Deploy

```bash
npm run deploy-sbt
```

The SBT deployment script has an additional prompt:

- **Revocable status**: You will be asked whether the contract should allow revocation of SBTs. This setting is **immutable** after deployment -- choose carefully.

Save the Contract ID:

```env
CONTRACT_ID=0.0.XXXXX
```

### 4. Prepare the Minter

Upload metadata and initialize the token exactly as with MinterContract:

```bash
# Upload metadata
node scripts/interactions/prepareMinter.js -upload metadata.json

# Initialize (the script will ask if this is an SBT mint -- answer Yes)
node scripts/interactions/prepareMinter.js -init -name "My SBT" -symbol "MYSBT" -memo "Soulbound credentials" -cid "ipfs://QmBaseFolder/"
```

When prompted "Is this a SBT mint?", answer **Yes**. The script will then ask:

- **Fixed edition?** -- If all NFTs should share the same metadata
- **Number of editions** -- Supply limit (0 = unlimited)

### 5. Mint

```bash
node scripts/interactions/mint.js
```

Minted tokens will be frozen on the recipient's account. They cannot be transferred or listed on marketplaces.

### 6. Revoke (If Revocable)

If the contract was deployed with `revocable=true`, admins can revoke SBTs:

```bash
node scripts/interactions/revokeSBT.js
```

## All Available Scripts

SoulboundMinter uses the same interaction scripts as MinterContract (they share the same ABI structure). Set `CONTRACT_NAME=SoulboundMinter` in your `.env` to ensure the correct ABI is loaded.

The full list of scripts is documented in the [MinterContract Quickstart](quickstart-minter.md#next-steps) and the [CLI Scripts Guide](../guides/cli-scripts.md).

## Troubleshooting

See the [Troubleshooting Guide](../guides/troubleshooting.md) for common issues. SBT-specific issues:

- **"Token frozen"**: This is expected behavior -- soulbound tokens cannot be transferred.
- **"Revocation failed"**: Verify the contract was deployed with `revocable=true`. This cannot be changed after deployment.
