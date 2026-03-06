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
	console.log('║       Withdraw HBAR (Owner)             ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		console.log('\n💰 Withdrawing HBAR from contract...');
		console.log('   All HBAR will be sent to contract owner');

		// Estimate gas
		console.log('\n⛽ Estimating gas...');
		const gasEstimate = await estimateGas(
			env,
			contractId,
			abi,
			operatorId,
			'withdrawHbar',
			[],
			100_000,
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Execute withdrawal
		console.log('\n🚀 Executing withdrawal...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'withdrawHbar',
			[],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Withdrawal failed');
			console.log('Status:', result[0]?.status?.toString());
			return;
		}

		console.log('\n✅ HBAR withdrawn successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());
		console.log('\n✓ All HBAR sent to owner account');

	}
	catch (error) {
		console.error('\n❌ Error withdrawing HBAR:', error.message || error);
	}
});
