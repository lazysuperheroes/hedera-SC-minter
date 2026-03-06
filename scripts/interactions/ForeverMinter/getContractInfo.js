const { TokenId, ContractId, Hbar } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');
const { getTokenDetails } = require('../../../utils/hederaMirrorHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	if (!jsonMode) {
		console.log('\n📊 ForeverMinter - Contract Information');
		console.log('==========================================\n');
	}

	try {
		// Get all contract configuration
		if (!jsonMode) console.log('🔍 Loading contract configuration...\n');

		// Get token addresses
		const nftTokenAddress = (await readContract(iface, env, contractId, operatorId, 'NFT_TOKEN'))[0];
		const nftTokenId = TokenId.fromSolidityAddress(nftTokenAddress);

		// Get mint economics
		const economics = (await readContract(iface, env, contractId, operatorId, 'getMintEconomics'))[0];

		// Get timing
		const timing = (await readContract(iface, env, contractId, operatorId, 'getMintTiming'))[0];

		// Get supply
		const supply = (await readContract(iface, env, contractId, operatorId, 'getRemainingSupply'))[0];

		// Get LAZY details
		const lazyDetails = (await readContract(iface, env, contractId, operatorId, 'getLazyDetails'))[0];
		const lazyTokenId = TokenId.fromSolidityAddress(lazyDetails[0]);

		// Get LAZY token info for decimal precision
		const lazyTokenInfo = await getTokenDetails(env, lazyTokenId);
		if (!lazyTokenInfo) {
			console.log('❌ Error: Could not fetch LAZY token details');
			return;
		}
		const lazyDecimals = parseInt(lazyTokenInfo.decimals);

		// Get LazyGasStation
		const gasStationAddress = (await readContract(iface, env, contractId, operatorId, 'lazyGasStation'))[0];
		const gasStationId = ContractId.fromSolidityAddress(gasStationAddress);

		// Get discount tier count
		const tierCount = Number((await readContract(iface, env, contractId, operatorId, 'getDiscountTierCount'))[0]);

		// Get all discount tiers
		const discountTiers = [];
		for (let i = 0; i < tierCount; i++) {
			const tier = (await readContract(iface, env, contractId, operatorId, 'getDiscountTier', [i]))[0];

			discountTiers.push({
				index: i,
				// First element is discountPercentage
				discountPercentage: Number(tier[0]),
				// Second element is maxUsesPerSerial
				maxUsesPerSerial: Number(tier[1]),
			});
		}

		const hbarPrice = new Hbar(Number(economics[0]) / 100000000);
		const lazyPrice = Number(economics[1]) / Math.pow(10, lazyDecimals);
		const wlSlotCost = Number(economics[6]) / Math.pow(10, lazyDecimals);
		const isPaused = timing[2];
		const startTime = Number(timing[1]);

		// JSON output mode
		if (jsonMode) {
			console.log(JSON.stringify({
				contractId: contractId.toString(),
				nft: {
					tokenId: nftTokenId.toString(),
					tokenAddress: nftTokenAddress,
					remainingSupply: Number(supply),
				},
				pricing: {
					mintPriceHbar: hbarPrice.toString(),
					mintPriceHbarTinybar: Number(economics[0]),
					mintPriceLazy: lazyPrice,
					wlDiscountPercent: Number(economics[2]),
					sacrificeDiscountPercent: Number(economics[3]),
					maxPerMint: Number(economics[4]),
					maxPerWallet: Number(economics[5]),
					wlSlotCostLazy: wlSlotCost,
				},
				timing: {
					paused: Boolean(isPaused),
					startTime,
					startTimeISO: startTime > 0 ? new Date(startTime * 1000).toISOString() : null,
					refundWindowSeconds: Number(timing[3]),
					refundPercent: Number(timing[4]),
					wlOnly: Boolean(timing[5]),
				},
				lazy: {
					tokenId: lazyTokenId.toString(),
					tokenAddress: lazyDetails[0],
					gasStationId: gasStationId.toString(),
					gasStationAddress,
					burnPercent: Number(lazyDetails[1]),
					symbol: lazyTokenInfo.symbol,
					decimals: lazyDecimals,
				},
				discountTiers,
			}, null, 2));
			return;
		}

		// Display all configuration
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📦 NFT Configuration');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`NFT Token ID: ${nftTokenId.toString()}`);
		console.log(`NFT Token Address: ${nftTokenAddress}`);
		console.log(`Remaining in Pool: ${Number(supply)} NFTs`);
		console.log('(Note: getRemainingSupply returns available serials count only)');

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('💰 Pricing Configuration');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Base Price (HBAR): ${hbarPrice.toString()}`);
		console.log(`Base Price (${lazyTokenInfo.symbol}): ${lazyPrice.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);
		console.log(`WL Discount: ${Number(economics[2])}%`);
		console.log(`Sacrifice Discount: ${Number(economics[3])}%`);
		console.log(`Max Per Mint: ${Number(economics[4])} NFTs`);
		console.log(`Max Per Wallet: ${Number(economics[5])} NFTs (0 = unlimited)`);

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('⏰ Timing Configuration');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const now = Math.floor(Date.now() / 1000);

		console.log(`Paused: ${isPaused ? '🔴 YES' : '🟢 NO'}`);

		if (startTime > 0) {
			if (startTime > now) {
				const timeUntilStart = startTime - now;
				const hours = Math.floor(timeUntilStart / 3600);
				const minutes = Math.floor((timeUntilStart % 3600) / 60);
				console.log(`Start Time: ${new Date(startTime * 1000).toLocaleString()} (in ${hours}h ${minutes}m)`);
			}
			else {
				console.log(`Start Time: ${new Date(startTime * 1000).toLocaleString()} (started)`);
			}
		}
		else {
			console.log('Start Time: Not set (immediate)');
		}

		console.log(`Refund Window: ${Number(timing[3]) / 3600} hours`);
		console.log(`Refund Percentage: ${Number(timing[4])}%`);
		console.log(`WL Only Mode: ${timing[5] ? '🔴 YES' : '🟢 NO'}`);

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🎟️  Whitelist Configuration');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`WL Slot Cost (${lazyTokenInfo.symbol}): ${wlSlotCost.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('💎 LAZY Token Configuration');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`LAZY Token ID: ${lazyTokenId.toString()}`);
		console.log(`LAZY Token Address: ${lazyDetails[0]}`);
		console.log(`LazyGasStation ID: ${gasStationId.toString()}`);
		console.log(`LazyGasStation Address: ${gasStationAddress}`);
		console.log(`LAZY Burn Percentage: ${Number(lazyDetails[1])}%`);

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🎁 Discount Tiers');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		if (discountTiers.length === 0) {
			console.log('No discount tiers configured');
		}
		else {
			console.log('Note: Each discount token is assigned to a tier.');
			console.log('Use getTokenTierIndex(tokenAddress) to see which tier a token uses.\n');

			discountTiers.forEach(tier => {
				console.log(`Tier ${tier.index}:`);
				console.log(`   Discount Percentage: ${tier.discountPercentage}%`);
				console.log(`   Max Uses Per Serial: ${tier.maxUsesPerSerial}`);
				console.log('');
			});
		}

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log('✅ Configuration loaded successfully');

	}
	catch (error) {
		console.log('❌ Error loading configuration:', error.message, error);
	}
});
