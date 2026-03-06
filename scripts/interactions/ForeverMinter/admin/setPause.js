const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Parse pause state from arguments
	if (process.argv.length < 3) {
		console.log('Usage: node setPause.js <true|false>');
		console.log('\nExamples:');
		console.log('   node setPause.js true    # Pause minting');
		console.log('   node setPause.js false   # Unpause minting');
		return;
	}

	const pauseInput = process.argv[2].toLowerCase();

	if (pauseInput !== 'true' && pauseInput !== 'false') {
		console.log('❌ Error: Argument must be "true" or "false"');
		return;
	}

	const shouldPause = pauseInput === 'true';

	console.log('\n⏸️  ForeverMinter - Set Pause State');
	console.log('======================================\n');

	try {
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Pause State Update');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`New State: ${shouldPause ? '🔴 PAUSED' : '🟢 UNPAUSED'}`);

		if (shouldPause) {
			console.log('\n⚠️  Warning: Pausing will prevent all minting');
			console.log('   Users will not be able to mint NFTs until unpaused');
		}
		else {
			console.log('\n✅ Unpausing will allow minting to resume');
			console.log('   Users will be able to mint NFTs normally');
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with pause state change? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Updating pause state...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'updatePauseStatus',
			[shouldPause],
			150_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'updatePauseStatus',
			[shouldPause],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Pause state updated');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log(`\n📊 New State: ${shouldPause ? '🔴 PAUSED' : '🟢 UNPAUSED'}`);

			if (shouldPause) {
				console.log('\n⚠️  Minting is now DISABLED');
				console.log('   To re-enable: node setPause.js false');
			}
			else {
				console.log('\n✅ Minting is now ENABLED');
				console.log('   To pause again: node setPause.js true');
			}

			console.log('\n💡 Verify with: node getContractInfo.js');
		}
		else {
			console.log('❌ Failed to update pause state:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Set Pause', gasInfo);

	}
	catch (error) {
		console.log('❌ Error updating pause state:', error.message);
	}
});
