const { AccountId, Hbar, TokenId } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');
const { getTokenDetails } = require('../../../utils/hederaMirrorHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Optional: Check specific address
	let targetAddress = operatorId.toSolidityAddress();

	if (process.argv.length >= 3) {
		try {
			const targetId = AccountId.fromString(process.argv[2]);
			targetAddress = targetId.toSolidityAddress();
		}
		catch {
			console.log('❌ Error: Invalid account ID');
			console.log('   Usage: node getMintHistory.js [accountId]');
			return;
		}
	}

	console.log('\n📊 ForeverMinter - Mint History');
	console.log('==================================\n');

	try {
		const targetAccountId = AccountId.fromSolidityAddress(targetAddress);

		console.log(`Account: ${targetAccountId.toString()}`);
		console.log('');

		// Get mint count using correct function
		const mintCount = Number((await readContract(iface, env, contractId, operatorId, 'getWalletMintCount', [targetAddress]))[0]);

		if (mintCount === 0) {
			console.log('❌ No mint history found for this account');
			return;
		}

		// Get max per wallet and LAZY token info for context
		const economics = (await readContract(iface, env, contractId, operatorId, 'getMintEconomics'))[0];
		const maxPerWallet = Number(economics[5]); // maxMintPerWallet

		// Get LAZY token details
		const lazyDetails = (await readContract(iface, env, contractId, operatorId, 'getLazyDetails'))[0];
		const lazyTokenId = TokenId.fromSolidityAddress(lazyDetails[0]);
		const lazyTokenInfo = await getTokenDetails(env, lazyTokenId);
		const lazyDecimals = parseInt(lazyTokenInfo.decimals);

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📈 Mint Statistics');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Total Mints: ${mintCount} NFTs`);

		if (maxPerWallet > 0) {
			const remaining = Math.max(0, maxPerWallet - mintCount);
			console.log(`Wallet Limit: ${maxPerWallet} NFTs`);
			console.log(`Remaining: ${remaining} NFTs`);

			const usedPercent = ((mintCount / maxPerWallet) * 100).toFixed(2);
			console.log(`Usage: ${usedPercent}%`);
		}
		else {
			console.log('Wallet Limit: Unlimited');
		}

		// Get base prices for reference
		const baseHbar = new Hbar(Number(economics[0]) / 100000000); // mintPriceHbar
		const baseLazy = Number(economics[1]) / Math.pow(10, lazyDecimals); // mintPriceLazy

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('💰 Base Mint Prices');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Base HBAR Price: ${baseHbar.toString()} per NFT`);
		console.log(`Base ${lazyTokenInfo.symbol} Price: ${baseLazy.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol} per NFT`);

		console.log('\n💡 Note: Actual costs may be lower with discounts (sacrifice, holder, whitelist)');


		console.log('\n💡 Use checkDiscounts.js to see your available discounts');
		console.log('💡 Use checkMintCost.js to preview costs with your holdings');

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	}
	catch (error) {
		console.log('❌ Error loading mint history:', error.message);
	}
});
