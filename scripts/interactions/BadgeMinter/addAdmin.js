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

	// check for 1 argument (account ID to add as admin)
	if (process.argv.length !== 3) {
		console.log('Usage: node addAdmin.js <accountID>');
		console.log('Example: node addAdmin.js 0.0.12345');
		console.log('Example: node addAdmin.js 0x000000000000000000000000000000000000beef');
		return;
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	const accountToAdd = process.argv[2];
	let adminAddress;

	let accountId;

	// Convert account ID to EVM address if needed
	if (accountToAdd.startsWith('0.0.')) {
		accountId = AccountId.fromString(accountToAdd);
		try {
			adminAddress = await homebrewPopulateAccountEvmAddress(env, accountId);
		}
		catch {
			adminAddress = accountId.toSolidityAddress();
		}
	}
	else if (accountToAdd.startsWith('0x')) {
		adminAddress = accountToAdd;
		accountId = await homebrewPopulateAccountNum(env, accountToAdd);
	}
	else {
		console.log('Invalid account format. Use either 0.0.xxxxx or 0x...');
		return;
	}

	console.log('\n===========================================');
	console.log('ADDING ADMIN');
	console.log('===========================================');
	console.log('Account to add:', accountId.toString());
	console.log('EVM Address:', adminAddress);

	const proceed = readlineSync.question('\nProceed to add this admin? (y/N): ');
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
			'addAdmin',
			[adminAddress],
			400_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			minterIface,
			client,
			gasInfo.gasLimit,
			'addAdmin',
			[adminAddress],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ Admin added successfully!');
		}

		// Centralized transaction result logging
		logTransactionResult(result, 'Add Admin', gasInfo);
	}
	catch (error) {
		console.log('❌ Error adding admin:', error.message);
	}
});
