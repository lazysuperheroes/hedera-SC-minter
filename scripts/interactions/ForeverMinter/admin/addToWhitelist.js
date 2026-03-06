const { AccountId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	if (process.argv.length < 4) {
		console.log('Usage: node addToWhitelist.js <accountId> <slots>');
		console.log('\nExample: node addToWhitelist.js 0.0.123456 5');
		return;
	}

	const accountIdStr = process.argv[2];
	const slots = parseInt(process.argv[3]);

	let targetId;
	try {
		targetId = AccountId.fromString(accountIdStr);
	}
	catch {
		console.log('❌ Error: Invalid account ID');
		return;
	}

	if (isNaN(slots) || slots < 1) {
		console.log('❌ Error: Slots must be a positive number');
		return;
	}

	console.log('\n🎟️  ForeverMinter - Add to Whitelist');
	console.log('========================================\n');

	try {
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Whitelist Addition');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Account: ${targetId.toString()}`);
		console.log(`Slots to Add: ${slots}`);

		console.log('\n💡 This will ADD slots to any existing balance');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with adding to whitelist? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Adding to whitelist...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'addToWhitelist',
			[targetId.toSolidityAddress(), slots],
			200_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'addToWhitelist',
			[targetId.toSolidityAddress(), slots],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Added to whitelist');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Details:');
			console.log(`   Account: ${targetId.toString()}`);
			console.log(`   Slots Added: ${slots}`);

			console.log('\n💡 Verify with: node checkWLSlots.js ' + targetId.toString());
		}
		else {
			console.log('❌ Failed to add to whitelist:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Add to Whitelist', gasInfo);

	}
	catch (error) {
		console.log('❌ Error adding to whitelist:', error.message);
	}
});
