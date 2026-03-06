const {
	AccountId,
	Hbar,
	HbarUnit,
} = require('@hashgraph/sdk');
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
		console.log('Usage: node withdrawHbar.js <recipient> <amount>');
		console.log('\nExample: node withdrawHbar.js 0.0.123456 100');
		console.log('\n💡 Amount is in HBAR');
		return;
	}

	const recipientStr = process.argv[2];
	const amountHbar = parseFloat(process.argv[3]);

	let recipientId;
	try {
		recipientId = AccountId.fromString(recipientStr);
	}
	catch {
		console.log('❌ Error: Invalid recipient account ID');
		return;
	}

	if (isNaN(amountHbar) || amountHbar <= 0) {
		console.log('❌ Error: Amount must be positive');
		return;
	}

	console.log('\n💰 ForeverMinter - Withdraw HBAR');
	console.log('===================================\n');

	try {
		console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('💰 HBAR Withdrawal');
		console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Recipient: ${recipientId.toString()}`);
		console.log(`Amount: ${amountHbar} HBAR`);

		console.log('\n⚠️  Warning: This will withdraw HBAR from the contract');
		console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with HBAR withdrawal? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Withdrawing HBAR...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'withdrawHbar',
			[recipientId.toSolidityAddress(), Hbar.from(amountHbar, HbarUnit.Hbar).toTinybars().toString()],
			200_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'withdrawHbar',
			[recipientId.toSolidityAddress(), Hbar.from(amountHbar, HbarUnit.Hbar).toTinybars().toString()],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! HBAR withdrawn');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n💰 Details:');
			console.log(`   Amount: ${amountHbar} HBAR`);
			console.log(`   Recipient: ${recipientId.toString()}`);
		}
		else {
			console.log('❌ Failed to withdraw:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Withdraw HBAR', gasInfo);

	}
	catch (error) {
		console.log('❌ Error withdrawing HBAR:', error.message);
	}
});
