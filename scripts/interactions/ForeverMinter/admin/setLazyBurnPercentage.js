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
		console.log('Usage: node setLazyBurnPercentage.js <percentage>');
		console.log('\nExample: node setLazyBurnPercentage.js 25');
		console.log('\n💡 Percentage of LAZY tokens to burn (0-100)');
		console.log('   Remaining percentage goes to contract owner');
		return;
	}

	const percentage = parseInt(process.argv[2]);

	if (isNaN(percentage) || percentage < 0 || percentage > 100) {
		console.log('❌ Error: Percentage must be between 0 and 100');
		return;
	}

	console.log('\n💎 ForeverMinter - Set LAZY Burn Percentage');
	console.log('==============================================\n');

	try {
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 LAZY Burn Percentage Update');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`New Burn Percentage: ${percentage}%`);
		console.log(`Owner Receives: ${100 - percentage}%`);

		console.log('\n💡 How it works:');
		console.log(`   • ${percentage}% of LAZY payments will be burned`);
		console.log(`   • ${100 - percentage}% will go to contract owner`);
		console.log('   • This applies to future mints and WL slot purchases');

		console.log('\n⚠️  Warning: This affects LAZY token economics');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with update? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Updating LAZY burn percentage...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'updateLazyBurnPercentage',
			[percentage],
			150_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'updateLazyBurnPercentage',
			[percentage],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! LAZY burn percentage updated');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 New Split:');
			console.log(`   Burn: ${percentage}%`);
			console.log(`   Owner: ${100 - percentage}%`);

			console.log('\n💡 Verify with: node getContractInfo.js');
		}
		else {
			console.log('❌ Failed to update:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Set LAZY Burn Percentage', gasInfo);

	}
	catch (error) {
		console.log('❌ Error updating LAZY burn percentage:', error.message);
	}
});
