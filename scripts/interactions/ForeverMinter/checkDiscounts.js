const { TokenId } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');
const { readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');
const { getSerialsOwned, parseContractEvents } = require('../../../utils/hederaMirrorHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	console.log('\n🎁 ForeverMinter - Discount Eligibility');
	console.log('==========================================\n');

	try {
		console.log('🔍 Checking your discount eligibility...\n');

		// Get discount tier count
		const tierCount = Number((await readContract(iface, env, contractId, operatorId, 'getDiscountTierCount'))[0]);

		if (tierCount === 0) {
			console.log('❌ No discount tiers configured in contract');
			return;
		}

		// Get whitelist slots
		const slotsArray = (await readContract(iface, env, contractId, operatorId, 'getBatchWhitelistSlots', [[operatorId.toSolidityAddress()]]))[0];
		const wlSlots = Number(slotsArray[0]);

		// Get NFT token for sacrifice eligibility
		const nftTokenAddress = (await readContract(iface, env, contractId, operatorId, 'NFT_TOKEN'))[0];
		const nftTokenId = TokenId.fromSolidityAddress(nftTokenAddress);

		const ownedNFTs = await getSerialsOwned(env, operatorId, nftTokenId);

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🎟️  Whitelist Status');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		if (wlSlots > 0) {
			console.log(`✅ You have ${wlSlots} whitelist slot(s)`);
			console.log('   Each slot allows 1 mint at full price before holder discounts');
		}
		else {
			console.log('❌ You have 0 whitelist slots');
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		// Get economics for sacrifice discount
		const economics = (await readContract(iface, env, contractId, operatorId, 'getMintEconomics'))[0];
		const sacrificeDiscount = Number(economics[3]);

		console.log('🔥 Sacrifice Eligibility');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		if (ownedNFTs.length > 0) {
			console.log(`✅ You own ${ownedNFTs.length} NFT(s) that can be sacrificed`);
			console.log(`   NFT Token: ${nftTokenId.toString()}`);
			console.log(`   Your Serials: ${ownedNFTs.join(', ')}`);
			console.log(`   Sacrifice Discount: ${sacrificeDiscount}% (mutually exclusive!)`);
		}
		else {
			console.log('❌ You do not own any NFTs to sacrifice');
			console.log(`   NFT Token: ${nftTokenId.toString()}`);
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🎁 Holder Discount Tiers');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		if (tierCount === 0) {
			console.log('❌ No discount tiers configured');
		}
		else {
			console.log('Tier Configuration:');
			for (let i = 0; i < tierCount; i++) {
				const tier = (await readContract(iface, env, contractId, operatorId, 'getDiscountTier', [i]))[0];

				console.log(`   Tier ${i}: ${Number(tier[0])}% discount, ${Number(tier[1])} max uses per serial`);
			}

			// Scan contract events to find which tokens use which tiers
			console.log('\n📋 Scanning contract events for discount tokens...');
			const allEvents = await parseContractEvents(env, contractId, iface, 100, true, 'desc');
			const discountEvents = allEvents.filter(e => e.name === 'DiscountTierUpdated');

			const processedTokens = new Set();
			const discountTokenMap = new Map();

			for (const event of discountEvents) {
				const tokenAddress = event.args.token;

				// We iterate in descending order (newest first), so only care about first time we see a token
				if (processedTokens.has(tokenAddress)) continue;
				processedTokens.add(tokenAddress);

				const discountPercentage = Number(event.args.discountPercentage);

				// Only add if it's an active discount (percentage > 0)
				if (discountPercentage > 0) {
					try {
						const tokenId = TokenId.fromSolidityAddress(tokenAddress);
						const tokenIdStr = tokenId.toString();

						discountTokenMap.set(tokenIdStr, {
							tokenId,
							tokenAddress,
							tierIndex: Number(event.args.tierIndex),
							discountPercentage,
							maxUsesPerSerial: Number(event.args.maxUsesPerSerial),
						});
					}
					catch {
						console.log(`   ⚠️  Could not parse token address from event: ${tokenAddress}`);
					}
				}
			}

			if (discountTokenMap.size > 0) {
				console.log(`\n✅ Found ${discountTokenMap.size} discount token(s)\n`);

				let hasUsableDiscounts = false;

				for (const [tokenIdStr, info] of discountTokenMap) {
					// Check if user owns any
					const ownedSerials = await getSerialsOwned(env, operatorId, info.tokenId);

					console.log(`Token: ${tokenIdStr} (Tier ${info.tierIndex})`);
					console.log(`   Discount: ${info.discountPercentage}%`);
					console.log(`   Max Uses Per Serial: ${info.maxUsesPerSerial}`);

					if (ownedSerials.length > 0) {
						// Check ACTUAL remaining uses for each serial
						const serialsWithUses = [];

						// Batch check serial discount info
						const tokenAddresses = ownedSerials.map(() => info.tokenAddress);
						const batchCommand = iface.encodeFunctionData('getBatchSerialDiscountInfo', [
							tokenAddresses,
							ownedSerials,
						]);
						const batchResult = await readOnlyEVMFromMirrorNode(env, contractId, batchCommand, operatorId, false);
						const [, usesRemaining, isEligible] =
							iface.decodeFunctionResult('getBatchSerialDiscountInfo', batchResult);

						for (let i = 0; i < ownedSerials.length; i++) {
							if (isEligible[i] && Number(usesRemaining[i]) > 0) {
								serialsWithUses.push({
									serial: ownedSerials[i],
									remainingUses: Number(usesRemaining[i]),
								});
							}
						}

						if (serialsWithUses.length > 0) {
							hasUsableDiscounts = true;
							const totalAvailableUses = serialsWithUses.reduce((sum, s) => sum + s.remainingUses, 0);
							console.log(`   ✅ You own ${serialsWithUses.length} usable NFT${serialsWithUses.length > 1 ? 's' : ''} with ${totalAvailableUses} total use${totalAvailableUses > 1 ? 's' : ''} remaining`);
							console.log(`   Serials: [${serialsWithUses.map(s => `#${s.serial}(${s.remainingUses})`).slice(0, 10).join(', ')}${serialsWithUses.length > 10 ? '...' : ''}]`);
						}
						else {
							console.log(`   ⚠️  You own ${ownedSerials.length} NFT${ownedSerials.length > 1 ? 's' : ''} but all uses are exhausted`);
						}
					}
					else {
						console.log('   ❌ You do not own any NFTs from this token');
					}
					console.log('');
				}

				console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
				console.log('💡 Summary');
				console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

				console.log('Your Discount Eligibility:');
				console.log(`   Sacrifice: ${ownedNFTs.length > 0 ? '✅ YES' : '❌ NO'}`);
				console.log(`   Holder Discounts: ${hasUsableDiscounts ? '✅ YES' : '❌ NO'}`);
				console.log(`   Whitelist: ${wlSlots > 0 ? `✅ YES (${wlSlots} slot(s))` : '❌ NO'}`);
			}
			else {
				console.log('\n⚠️  No active discount tokens found in contract events');
				console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
				console.log('💡 Summary');
				console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

				console.log('Your Discount Eligibility:');
				console.log(`   Sacrifice: ${ownedNFTs.length > 0 ? '✅ YES' : '❌ NO'}`);
				console.log('   Holder Discounts: ❌ NO');
				console.log(`   Whitelist: ${wlSlots > 0 ? `✅ YES (${wlSlots} slot(s))` : '❌ NO'}`);
			}
		}

		console.log('\n📋 Discount Logic:');
		console.log(`   • Sacrifice: ${sacrificeDiscount}% discount (if provided - STOPS HERE)`);
		console.log('');
		console.log('OR if no sacrifice, waterfall applies:');
		console.log('   1. Holder Discounts (Tier 0 → Tier N, best first)');
		console.log('   2. Whitelist (if slots remain)');
		console.log('   3. Full Price (remaining quantity)');

		console.log('\n💡 Tips:');
		console.log('   • Sacrifice is mutually exclusive with holder/WL discounts');
		console.log('   • Use mint.js to see live cost calculation with your holdings');
		console.log('   • Use checkMintCost.js to preview costs without minting');
		console.log('   • Holder discount serials are consumed in order provided');
		console.log('   • Sacrifice discount applies to ALL mints in transaction');

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	}
	catch (error) {
		console.log('❌ Error checking discounts:', error.message);
	}
});
