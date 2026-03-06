# Five Ways to Mint NFTs on Hedera: A Complete Guide

*Published by the Lazy Superheroes team*

---

There are plenty of ways to create NFTs on Hedera. You can use the SDK directly, call the Hedera API from a backend, or use one of many third-party tools. All of these work, and for simple use cases they might be all you need.

But here's the thing: in every one of those approaches, **you're trusting someone** -- a server operator, a backend admin, a tool provider -- to mint what they said they'd mint, charge what they said they'd charge, and not change the rules halfway through. You trust because you have to.

Smart contracts remove that "have to." When minting logic lives on-chain, the rules are public, immutable, and verifiable. The price is what the contract says. The supply cap is what the contract enforces. The whitelist is what the contract checks. Nobody needs to trust the team behind the project -- they can read the code, verify it on HashScan, and know exactly what will happen when they hit "mint." **Code is law. Trust but verify. Or better yet -- don't trust at all, because you don't need to.**

That's not a statement against any team's integrity. It's a statement *for* decentralization as a principle. If you believe that on-chain guarantees are better than off-chain promises, then smart contract minting is the right foundation. It's why we built the **Hedera Minter Suite** -- five contracts, each designed for a different minting scenario, each giving users the confidence that comes from verifiable, immutable logic.

And because all of this is open source, you're not even trusting *us*. Read the Solidity. Deploy it yourself. Verify it on-chain. That's the point.

---

## 1. MinterContract -- The Standard Drop

**Best for:** NFT collections, PFP drops, generative art releases

This is the workhorse. MinterContract creates new HTS tokens on the fly -- you set up your metadata, configure pricing, and open the mint. Users pay in HBAR, $LAZY tokens, or both, and receive freely tradeable NFTs.

**What users get:**

- **Batch minting** -- grab multiple NFTs in a single transaction, no repeated clicks
- **Whitelist access** -- get guaranteed slots before public mint, either by address or by holding a specific token
- **Refund window** -- changed your mind? Within the configured window, you can burn your NFT and get a proportional refund on your HBAR and $LAZY
- **Random or sequential metadata** -- each mint either picks from a shuffled pool (surprise reveal) or assigns the next in sequence (predictable)

**The experience:** You connect your wallet, check if you're whitelisted, see the price, pick how many you want, and mint. Clean and straightforward -- the kind of flow everyone recognizes from NFT drops.

---

## 2. SoulboundMinter -- Permanent, Non-Transferable Tokens

**Best for:** Certificates, membership tokens, proof of attendance, credentials

Some tokens shouldn't be traded. A university degree, an event attendance badge, a DAO membership credential -- these mean something because *you* earned them. SoulboundMinter creates NFTs that are permanently frozen to the recipient's wallet. They can't be transferred, sold, or given away.

**What makes it different:**

- **Frozen at mint** -- the token is locked to your account the moment it arrives. This isn't a smart contract restriction that can be bypassed; it's enforced at the Hedera Token Service level
- **On-behalf minting** -- an organization can mint tokens directly to someone else's wallet. The recipient doesn't need to initiate the transaction, which is perfect for airdrops, rewards, and gas-abstracted flows
- **Optional revocation** -- if the deployer enables it, soulbound tokens can be revoked. Think of expired certifications or rescinded memberships. The token is unfrozen, returned, and burned
- **Same payment flexibility** -- HBAR, $LAZY, or both. Whitelists and refunds work the same as MinterContract

**The experience:** You might not even initiate the mint yourself. An organization mints a token to your wallet, and it appears in your collection -- permanently. It's proof that something happened, tied to your identity on-chain.

---

## 3. ForeverMinter -- The Recycling Pool

**Best for:** Ongoing NFT distribution, reward systems, complex loyalty programs, secondary distribution with royalty compliance

This is the most feature-rich contract in the suite, and it works fundamentally differently from the others. Instead of creating new tokens, ForeverMinter manages a **pool of existing NFTs** and distributes them. When users return NFTs (via refund), those serials go back into the pool for someone else to claim.

**What makes it special:**

- **Triple discount system** -- three ways to get a deal, and some of them stack:
  - *Whitelist discount:* buy slots with $LAZY for a percentage off, stackable with holder discounts
  - *Holder discount:* own specific NFTs to unlock discounts, with per-serial usage tracking so each discount NFT has limited uses
  - *Sacrifice discount:* burn your existing NFTs from the collection for the biggest discount, but it doesn't stack with the others

- **Royalty compliance** -- every transfer goes through a stake/unstake pattern that respects Hedera royalty fees. This matters for creators who rely on secondary sale royalties; ForeverMinter doesn't bypass them

- **Refund to pool** -- within a configurable time window, you can return your NFT for a percentage refund. The NFT goes back into the pool for the next buyer. This creates a living, breathing collection where serials circulate

- **Random selection** -- when you mint, the contract uses Hedera's PRNG (verifiable random function) to pick which serial you get from the pool. No cherrypicking

- **Multi-admin** -- not just owner-controlled. Multiple admins can manage the pool, whitelists, and configuration

**The experience:** Check the pool, see what's available, check your discounts (do you hold any discount tokens? do you have WL slots?), see the calculated price with all applicable discounts, then mint. You might get a refund option if you change your mind within the window. The same serials might cycle through multiple owners over time.

---

## 4. SoulboundBadgeMinter -- Multiple Badge Types, One Contract

**Best for:** Achievement systems, role-based badges, tiered memberships, community recognition programs

What if you need ten different badge types but don't want to deploy ten separate contracts? SoulboundBadgeMinter lets you create and manage **multiple badge types within a single contract**. Each badge type has its own name, metadata, whitelist, supply limit, and active/inactive state.

**What makes it different from SoulboundMinter:**

- **Type-based system** -- create "Bronze Contributor", "Silver Contributor", "Gold Contributor" all under one contract. Each has its own metadata and supply cap
- **Per-badge whitelists** -- control who can receive each badge type independently. Address Alice might be eligible for the Bronze badge but not Gold
- **Unlimited supply option** -- set a badge's max supply to 0 and it can be minted indefinitely. Perfect for recurring participation badges
- **On-behalf minting** -- admins mint badges directly to recipients
- **Activate / deactivate** -- temporarily disable a badge type without deleting it
- **HBAR only** -- streamlined payment model (no $LAZY integration), keeping the contract smaller and simpler

**The experience:** An admin creates badge types, sets up per-type whitelists, and activates them. Users (or admins on their behalf) mint badges of specific types. The badges are soulbound -- frozen to the recipient's wallet. An organization might use this for a whole tiered achievement system without ever deploying a second contract.

---

## 5. EditionWithPrize -- Limited Editions With a Lottery Twist

**Best for:** Artists releasing limited editions, charitable fundraising with prize incentives, gamified collection launches

This is the most creative contract in the suite. EditionWithPrize creates a batch of **identical edition NFTs**, sells them, and then selects random winners who can exchange their edition for a **unique 1-of-1 prize token**. Think of it as a raffle baked into the smart contract.

**How the lifecycle works:**

1. **Edition Minting** -- users buy edition NFTs. Everyone gets the same metadata. An artist might sell 50 identical prints.

2. **Sold Out** -- once all editions are minted, the contract moves to the next phase. Anyone can trigger winner selection.

3. **Winner Selection** -- the contract uses Hedera's PRNG to randomly select winning serial numbers. The number of winners and prizes is configured at setup.

4. **Prize Claiming** -- winners exchange their edition NFT for a unique prize token. The edition is wiped (burned), and the prize is minted fresh with its own metadata. It's an atomic swap enforced by the contract -- no intermediary, no "we'll announce winners on Discord," no trust required.

**Payment options are the broadest here:**

- HBAR (native)
- $LAZY tokens
- USDC (both native and bridged Hedera USDC, with smart prioritization)
- Any combination of the above

Whitelist discounts apply across all payment methods automatically.

**The experience:** You buy an edition, knowing you might win a unique prize. After sellout, winners are selected on-chain with verifiable randomness. If you won, you claim your prize -- your edition NFT is swapped for the 1-of-1 prize token. Everyone else keeps their edition as a collectible.

---

## What They All Share

Despite their differences, every contract in the suite is built on common foundations:

- **Verifiable on-chain logic** -- every rule is in the smart contract. Pricing, supply caps, whitelist checks, discount calculations, refund windows -- none of it lives on a server. You can read the contract on HashScan, compare it to the source code, and know exactly what will happen before you spend a single HBAR. No backend, no API key, no "trust us"
- **Native HTS tokens** -- all tokens are native Hedera Token Service tokens, not ERC-721 emulations. They show up natively in HashScan, wallets, and marketplaces without wrapping or bridging
- **Network-level security** -- the Hedera network itself enforces token operations. When a token is frozen (soulbound), no contract hack can unfreeze it. When royalties are set, the protocol collects them. Smart contract logic sits on top of consensus-level guarantees
- **Whitelist systems** -- every contract supports gated access, whether by address, token holding, or both
- **Configurable economics** -- pricing, discounts, supply limits, timing windows -- everything is adjustable by the contract owner/admin
- **Open source, top to bottom** -- every line of Solidity is readable, verifiable, and deployable. The build scripts, CLI tools, and utility SDK are all open too. There is nothing hidden. If you want to fork it, extend it, or audit it line by line -- go ahead. That's the whole idea

## Which One Is Right for You?

| I want to... | Use this |
|-------------|----------|
| Drop a standard NFT collection | MinterContract |
| Issue non-transferable certificates | SoulboundMinter |
| Distribute existing NFTs with complex incentives | ForeverMinter |
| Run a multi-badge achievement program | SoulboundBadgeMinter |
| Sell limited editions with a prize lottery | EditionWithPrize |

---

## Getting Started

The full suite is open source and available on GitHub. Every contract comes with comprehensive documentation, interactive deployment scripts, and admin CLI tools.

- **Repository:** [github.com/lazysuperheroes/hedera-SC-minter](https://github.com/lazysuperheroes/hedera-SC-minter)
- **Documentation:** see the `docs/` folder for per-contract guides, quickstarts, and architecture details
- **Website:** [lazysuperheroes.com](https://www.lazysuperheroes.com/)
- **Whitepaper:** [docs.lazysuperheroes.com](https://docs.lazysuperheroes.com/)

All contracts are deployed and tested on Hedera testnet. You can try them before committing to mainnet.

**Questions?** Open an issue on [GitHub](https://github.com/lazysuperheroes/hedera-SC-minter/issues), find us on [X/Twitter](https://x.com/superheroeslazy), or email [lazysuperheroes@protonmail.com](mailto:lazysuperheroes@protonmail.com). We're building the tools we wish we had -- and we want them to work for you too.

---

*The Hedera Minter Suite is maintained by the [Lazy Superheroes](https://www.lazysuperheroes.com/) team and published under the `@lazysuperheroes` npm scope. All contracts are Solidity 0.8.18, audited by usage across testnet and mainnet deployments.*
