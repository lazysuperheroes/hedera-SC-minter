const { TokenId, ContractId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');
const { contractExecuteFunction } = require('../../../utils/solidityHelpers');
const { associateTokenToAccount, setFTAllowance } = require('../../../utils/hederaHelpers');
const { checkMirrorBalance, getTokenDetails } = require('../../../utils/hederaMirrorHelpers');
const { estimateGas, logTransactionResult } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Parse quantity from arguments
	if (process.argv.length < 3) {
		console.log('Usage: node buyWhitelistSlots.js <quantity>');
		console.log('\nExample: node buyWhitelistSlots.js 5');
		return;
	}

	const quantity = parseInt(process.argv[2]);

	if (isNaN(quantity) || quantity < 1) {
		console.log('❌ Error: Quantity must be a positive number');
		return;
	}

	console.log('\n🎟️  ForeverMinter - Buy Whitelist Slots');
	console.log('===========================================\n');

	try {
		// Get LAZY token details
		const lazyDetails = (await readContract(iface, env, contractId, operatorId, 'getLazyDetails'))[0];
		const lazyTokenId = TokenId.fromSolidityAddress(lazyDetails[0]);

		// Check LAZY token association
		const balance = await checkMirrorBalance(env, operatorId, lazyTokenId);

		if (balance === null) {
			console.log(`\n❌ LAZY token ${lazyTokenId.toString()} is not associated with your account`);
			console.log('   Associating token...\n');
			await associateTokenToAccount(client, operatorId, operatorKey, lazyTokenId);
			console.log('✅ Token associated\n');
		}

		// Get economics for WL slot cost
		const economics = (await readContract(iface, env, contractId, operatorId, 'getMintEconomics'))[0];
		const wlSlotCost = Number(economics[6]);
		const slotsPerPurchase = Number(economics[7]);

		// Get LAZY token info for decimal precision
		const lazyTokenInfo = await getTokenDetails(env, lazyTokenId);
		if (!lazyTokenInfo) {
			console.log('❌ Error: Could not fetch LAZY token details');
			return;
		}
		const lazyDecimals = parseInt(lazyTokenInfo.decimals);

		const totalCost = wlSlotCost * quantity;

		// Get current WL slots
		const slotsArray = (await readContract(iface, env, contractId, operatorId, 'getBatchWhitelistSlots', [[operatorId.toSolidityAddress()]]))[0];
		const currentSlots = Number(slotsArray[0]);

		// Get LazyGasStation for allowance
		const gasStationAddress = (await readContract(iface, env, contractId, operatorId, 'lazyGasStation'))[0];
		const gasStationId = ContractId.fromSolidityAddress(gasStationAddress);

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Whitelist Slot Purchase');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Current WL Slots: ${currentSlots}`);
		console.log(`Quantity to Buy: ${quantity}`);
		console.log(`Slots Per Purchase: ${slotsPerPurchase}`);
		console.log(`New Total: ${currentSlots + (quantity * slotsPerPurchase)} slots`);

		const wlSlotCostFormatted = wlSlotCost / Math.pow(10, lazyDecimals);
		const totalCostFormatted = totalCost / Math.pow(10, lazyDecimals);

		console.log('\n💰 Cost:');
		console.log(`   Per Purchase: ${wlSlotCostFormatted.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);
		console.log(`   Total: ${totalCostFormatted.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);
		console.log(`   You Get: ${quantity * slotsPerPurchase} slots`);

		console.log('\n💡 What are Whitelist Slots?');
		console.log('   WL slots allow you to mint at full price BEFORE');
		console.log('   the waterfall discount system applies holder discounts.');

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with purchase? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		// Set LAZY allowance to LazyGasStation
		console.log('\n⚙️  Setting LAZY allowance...\n');

		await setFTAllowance(
			client,
			lazyTokenId,
			operatorId,
			gasStationId,
			totalCost,
		);

		console.log('✅ Allowance set');

		// Execute purchase
		console.log('\n🔄 Processing purchase...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'buyWhitelistWithLazy',
			[quantity],
			200_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'buyWhitelistWithLazy',
			[quantity],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Whitelist slots purchased');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Your Updated WL Slots:');
			console.log(`   Previous: ${currentSlots}`);
			console.log(`   Purchased: ${quantity * slotsPerPurchase}`);
			console.log(`   New Total: ${currentSlots + (quantity * slotsPerPurchase)}`);

			console.log('\n💰 ${lazyTokenInfo.symbol} Spent:');
			console.log(`   ${totalCostFormatted.toFixed(lazyDecimals)} ${lazyTokenInfo.symbol}`);

			console.log('\n💡 Next Steps:');
			console.log('   • Your WL slots will be consumed during minting');
			console.log('   • They allow full-price mints before holder discounts');
			console.log('   • Check your slots anytime with: node checkWLSlots.js');
		}
		else {
			console.log('❌ Failed to purchase:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Buy Whitelist Slots', gasInfo);

	}
	catch (error) {
		console.log('❌ Error during purchase:', error.message);
	}
});
