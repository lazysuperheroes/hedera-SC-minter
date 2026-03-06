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
		console.log('Usage: node removeAdmin.js <accountId>');
		console.log('\nExample: node removeAdmin.js 0.0.123456');
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

	console.log('\n👥 ForeverMinter - Remove Admin');
	console.log('==================================\n');

	try {
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Remove Admin');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Account: ${targetId.toString()}`);

		console.log('\n⚠️  Warning: This will revoke admin privileges');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with removing admin? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Removing admin...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'removeAdmin',
			[targetId.toSolidityAddress()],
			150_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'removeAdmin',
			[targetId.toSolidityAddress()],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Admin removed');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Details:');
			console.log(`   Account: ${targetId.toString()}`);
			console.log('   Status: No longer admin');

			console.log('\n💡 View remaining admins with: node listAdmins.js');
		}
		else {
			console.log('❌ Failed to remove admin:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Remove Admin', gasInfo);

	}
	catch (error) {
		console.log('❌ Error removing admin:', error.message);
	}
});
