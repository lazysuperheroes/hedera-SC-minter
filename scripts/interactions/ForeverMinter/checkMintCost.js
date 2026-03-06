const { TokenId, Hbar } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');
const { readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');
const { homebrewPopulateAccountEvmAddress, getTokenDetails } = require('../../../utils/hederaMirrorHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Parse arguments
	const quantity = parseInt(process.argv[2]);
	if (isNaN(quantity) || quantity <= 0) {
		console.log('Usage: node checkMintCost.js <quantity> [--discount-tokens=0x...,0x...] [--discount-serials=1,2,3|4,5,6] [--sacrifice=N]');
		console.log('\nExample: node checkMintCost.js 10 --discount-tokens=0xabc,0xdef --discount-serials=1,2,3|4,5 --sacrifice=2');
		return;
	}

	if (!jsonMode) console.log('\n💰 ForeverMinter - Mint Cost Calculator');
	if (!jsonMode) console.log('==========================================\n');

	try {
		// Parse optional parameters
		let discountTokens = [];
		let serialsByToken = [];
		let sacrificeCount = 0;

		for (let i = 3; i < process.argv.length; i++) {
			const arg = process.argv[i];

			if (arg.startsWith('--discount-tokens=')) {
				const tokens = arg.split('=')[1].split(',');
				discountTokens = tokens;
			}
			else if (arg.startsWith('--discount-serials=')) {
				const serialGroups = arg.split('=')[1].split('|');
				serialsByToken = serialGroups.map(group =>
					group.split(',').map(s => parseInt(s.trim())),
				);
			}
			else if (arg.startsWith('--sacrifice=')) {
				sacrificeCount = parseInt(arg.split('=')[1]);
			}
		}

		// Validate arrays match
		if (discountTokens.length !== serialsByToken.length && discountTokens.length > 0) {
			console.log('❌ Error: Number of discount tokens must match number of serial groups');
			console.log(`   Tokens: ${discountTokens.length}, Serial groups: ${serialsByToken.length}`);
			return;
		}

		if (!jsonMode) console.log('📊 Calculation Parameters:');
		if (!jsonMode) console.log(`   Quantity: ${quantity}`);
		if (!jsonMode) console.log(`   Discount Tokens: ${discountTokens.length || 'None'}`);
		if (!jsonMode) console.log(`   Sacrifice Count: ${sacrificeCount || 'None'}`);

		// Get economics for reference
		const economics = (await readContract(iface, env, contractId, operatorId, 'getMintEconomics'))[0];

		// Get LAZY token details
		const lazyDetails = (await readContract(iface, env, contractId, operatorId, 'getLazyDetails'))[0];
		const lazyTokenId = TokenId.fromSolidityAddress(lazyDetails.lazyToken);
		const lazyTokenInfo = await getTokenDetails(env, lazyTokenId);
		if (!lazyTokenInfo) {
			console.log('❌ Error: Could not fetch LAZY token details');
			return;
		}
		const lazyDecimals = parseInt(lazyTokenInfo.decimals);

		// Get WL slots
		const userAddress = (await homebrewPopulateAccountEvmAddress(env, operatorId)).startsWith('0x')
			? await homebrewPopulateAccountEvmAddress(env, operatorId)
			: operatorId.toSolidityAddress();
		const slotsArray = (await readContract(iface, env, contractId, operatorId, 'getBatchWhitelistSlots', [[userAddress]]))[0];
		const wlSlots = Number(slotsArray[0]);

		if (!jsonMode) console.log(`   Your WL Slots: ${Number(wlSlots)}`);
		if (!jsonMode) console.log('');

		// Calculate cost
		if (!jsonMode) console.log('🧮 Calculating costs...\n');

		const costCommand = iface.encodeFunctionData('calculateMintCost', [
			quantity,
			discountTokens,
			serialsByToken,
			sacrificeCount,
		]);

		const costResult = await readOnlyEVMFromMirrorNode(env, contractId, costCommand, operatorId, false);
		const [totalHbarCost, totalLazyCost, totalDiscount, holderSlotsUsed, wlSlotsUsed] =
			iface.decodeFunctionResult('calculateMintCost', costResult);

		// Calculate base cost (no discounts)
		const baseHbarCost = Number(economics.mintPriceHbar) * quantity;
		const baseLazyCost = Number(economics.mintPriceLazy) * quantity;

		if (jsonMode) {
			console.log(JSON.stringify({
				quantity,
				discountTokens: discountTokens.length,
				sacrificeCount,
				baseCost: { hbarTinybar: baseHbarCost, lazy: baseLazyCost / Math.pow(10, lazyDecimals) },
				finalCost: { hbarTinybar: Number(totalHbarCost), lazy: Number(totalLazyCost) / Math.pow(10, lazyDecimals) },
				savings: { hbar: baseHbarCost - Number(totalHbarCost), lazy: (baseLazyCost - Number(totalLazyCost)) / Math.pow(10, lazyDecimals) },
				averageDiscountPercent: Number(totalDiscount),
				holderSlotsUsed: Number(holderSlotsUsed),
				wlSlotsUsed: Number(wlSlotsUsed),
				wlSlotsAvailable: Number(wlSlots),
			}, null, 2));
			return;
		}

		// Format for display
		const baseHbarFormatted = Hbar.fromTinybars(baseHbarCost);
		const baseLazyFormatted = baseLazyCost / Math.pow(10, lazyDecimals);
		const finalHbarFormatted = Hbar.fromTinybars(Number(totalHbarCost));
		const finalLazyFormatted = Number(totalLazyCost) / Math.pow(10, lazyDecimals);
		const savedHbar = Hbar.fromTinybars(baseHbarCost - Number(totalHbarCost));
		const savedLazy = (baseLazyCost - Number(totalLazyCost)) / Math.pow(10, lazyDecimals);

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('💰 COST BREAKDOWN');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log('Base Cost (no discounts):');
		console.log(`   ${baseHbarFormatted.toString()} + ${baseLazyFormatted.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);

		console.log('\nWith Discounts Applied:');
		console.log(`   ${finalHbarFormatted.toString()} + ${finalLazyFormatted.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);

		console.log('\n📊 Discount Summary:');
		console.log(`   Average Discount: ${Number(totalDiscount)}%`);
		console.log(`   You Save: ${savedHbar.toString()} + ${savedLazy.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);

		console.log('\n🎫 Slot Usage:');
		console.log(`   Holder Slots Consumed: ${Number(holderSlotsUsed)}`);
		console.log(`   WL Slots Consumed: ${Number(wlSlotsUsed)} (of ${Number(wlSlots)} available)`);

		if (Number(wlSlotsUsed) > Number(wlSlots)) {
			console.log('   ⚠️  Warning: Insufficient WL slots! Some NFTs will have reduced discount.');
		}

		// Show waterfall breakdown
		console.log('\n🌊 Waterfall Discount Order:');
		console.log('   1. Sacrifice Discount (if any)');
		console.log('   2. Holder Discounts (sorted by tier, can stack with WL)');
		console.log('   3. WL-only Discount');
		console.log('   4. Full Price (no discounts)');

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

		console.log('\n💡 To mint with these parameters, run:');
		console.log(`   node mint.js ${quantity}`);
		console.log('   (and follow the interactive prompts)');

	}
	catch (error) {
		console.log('❌ Error calculating cost:', error.message);
	}
});
