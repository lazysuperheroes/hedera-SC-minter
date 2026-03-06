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

	if (process.argv.length < 3) {
		console.log('Usage: node removeFromWhitelist.js <accountId>');
		console.log('\nExample: node removeFromWhitelist.js 0.0.123456');
		return;
	}

	const accountIdStr = process.argv[2];

	let targetId;
	try {
		targetId = AccountId.fromString(accountIdStr);
	}
	catch {
		console.log('❌ Error: Invalid account ID');
		return;
	}

	console.log('\n🎟️  ForeverMinter - Remove from Whitelist');
	console.log('=============================================\n');

	try {
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Whitelist Removal');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Account: ${targetId.toString()}`);

		console.log('\n⚠️  Warning: This will set WL slots to ZERO for this account');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with removal? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Removing from whitelist...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'removeFromWhitelist',
			[[targetId.toSolidityAddress()]],
			200_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'removeFromWhitelist',
			[[targetId.toSolidityAddress()]],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Removed from whitelist');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Details:');
			console.log(`   Account: ${targetId.toString()}`);
			console.log('   WL Slots: 0 (removed)');

			console.log('\n💡 Verify with: node checkWLSlots.js ' + targetId.toString());
		}
		else {
			console.log('❌ Failed to remove from whitelist:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Remove from Whitelist', gasInfo);

	}
	catch (error) {
		console.log('❌ Error removing from whitelist:', error.message);
	}
});
