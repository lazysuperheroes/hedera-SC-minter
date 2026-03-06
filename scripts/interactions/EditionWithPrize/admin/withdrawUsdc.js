const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const {
	contractExecuteFunction,
} = require('../../../../utils/solidityHelpers');
const { estimateGas } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: abi } = initScript({
		contractName: 'EditionWithPrize',
		contractEnvVar: 'EDITION_WITH_PRIZE_CONTRACT_ID',
	});

	console.log('\n╔══════════════════════════════════════════╗');
	console.log('║       Withdraw USDC (Owner)             ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		console.log('\n💵 Withdraw USDC Options:');
		console.log('   Contract supports both native and bridged USDC');
		console.log('   1. Native USDC (native HTS token)');
		console.log('   2. Bridged USDC (wormhole, hashport, etc.)');
		console.log('   3. Both');

		const choice = readlineSync.question('\nChoice [1-3]: ');

		const withdrawNative = (choice === '1' || choice === '3');
		const withdrawBridged = (choice === '2' || choice === '3');

		if (!withdrawNative && !withdrawBridged) {
			console.log('❌ Invalid choice');
			return;
		}

		console.log('\n⚠️  Owner must be associated with USDC token(s)');

		const proceed = readlineSync.keyInYNStrict('\nProceed with withdrawal?');
		if (!proceed) {
			console.log('❌ Operation cancelled');
			return;
		}

		// Withdraw native USDC
		if (withdrawNative) {
			console.log('\n💵 Withdrawing native USDC...');

			const gasEstimate = await estimateGas(
				env,
				contractId,
				abi,
				operatorId,
				'withdrawUsdcNative',
				[],
				150_000,
			);

			console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

			const result = await contractExecuteFunction(
				contractId,
				abi,
				client,
				gasEstimate.gasLimit,
				'withdrawUsdcNative',
				[],
			);

			if (result[0]?.status?.toString() !== 'SUCCESS') {
				console.log('❌ ERROR: Native USDC withdrawal failed');
				console.log('Status:', result[0]?.status?.toString());
			}
			else {
				console.log('✅ Native USDC withdrawn successfully!');
				console.log('Transaction ID:', result[2]?.transactionId?.toString());
			}
		}

		// Withdraw bridged USDC
		if (withdrawBridged) {
			console.log('\n💵 Withdrawing bridged USDC...');

			const gasEstimate = await estimateGas(
				env,
				contractId,
				abi,
				operatorId,
				'withdrawUsdcBridged',
				[],
				150_000,
			);

			console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

			const result = await contractExecuteFunction(
				contractId,
				abi,
				client,
				gasEstimate.gasLimit,
				'withdrawUsdcBridged',
				[],
			);

			if (result[0]?.status?.toString() !== 'SUCCESS') {
				console.log('❌ ERROR: Bridged USDC withdrawal failed');
				console.log('Status:', result[0]?.status?.toString());
			}
			else {
				console.log('✅ Bridged USDC withdrawn successfully!');
				console.log('Transaction ID:', result[2]?.transactionId?.toString());
			}
		}

		console.log('\n✓ USDC withdrawal(s) complete');
		console.log('✓ All USDC sent to owner account');

	}
	catch (error) {
		console.error('\n❌ Error withdrawing USDC:', error.message || error);
	}
});
