const {
	AccountId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../utils/solidityHelpers');
const { homebrewPopulateAccountEvmAddress, homebrewPopulateAccountNum } = require('../../../utils/hederaMirrorHelpers');
const { estimateGas, logTransactionResult } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	// check for 1 argument (account ID to remove as admin)
	if (process.argv.length !== 3) {
		console.log('Usage: node removeAdmin.js <accountID>');
		console.log('Example: node removeAdmin.js 0.0.12345');
		console.log('Example: node removeAdmin.js 0x000000000000000000000000000000000000beef');
		return;
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	const accountToRemove = process.argv[2];
	let adminAddress;
	let accountId;

	// Convert account ID to EVM address if needed
	if (accountToRemove.startsWith('0.0.')) {
		accountId = AccountId.fromString(accountToRemove);
		try {
			adminAddress = await homebrewPopulateAccountEvmAddress(env, accountId);
		}
		catch {
			adminAddress = accountId.toSolidityAddress();
		}
	}
	else if (accountToRemove.startsWith('0x')) {
		adminAddress = accountToRemove;
		accountId = await homebrewPopulateAccountNum(env, accountToRemove);
	}
	else {
		console.log('Invalid account format. Use either 0.0.xxxxx or 0x...');
		return;
	}

	console.log('\n===========================================');
	console.log('REMOVING ADMIN');
	console.log('===========================================');
	console.log('Account to remove:', accountId.toString());
	console.log('EVM Address:', adminAddress);

	console.log('\n⚠️  WARNING: This will remove admin privileges from this account.');
	console.log('⚠️  Make sure this is not the last admin, or you will lose access to the contract!');

	const proceed = readlineSync.question('\nProceed to remove this admin? (y/N): ');
	if (proceed.toLowerCase() !== 'y') {
		console.log('Cancelled.');
		return;
	}

	try {
		// Estimate gas for the operation
		const gasInfo = await estimateGas(
			env,
			contractId,
			minterIface,
			operatorId,
			'removeAdmin',
			[adminAddress],
			400_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			minterIface,
			client,
			gasInfo.gasLimit,
			'removeAdmin',
			[adminAddress],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ Admin removed successfully!');
		}

		// Centralized transaction result logging
		logTransactionResult(result, 'Remove Admin', gasInfo);
	}
	catch (error) {
		console.log('❌ Error removing admin:', error.message);
	}
});
