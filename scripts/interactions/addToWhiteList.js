const { AccountId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { homebrewPopulateAccountEvmAddress } = require('../../utils/hederaMirrorHelpers');

runScript(async () => {
	// check for 1 argument (a comma separated list of account IDs)
	if (process.argv.length !== 3) {
		console.log('Usage: node addToWhiteList.js <accountID>,<accountID>,<accountID>,...<accountID>');
		console.log('Example: node addToWhiteList.js 0.0.12345,0.0.12346,0.0.12347,0x00000027t1hjgjh');
		return;
	}

	const contractName = process.env.CONTRACT_NAME ?? 'MinterContract';
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName,
		contractEnvVar: 'CONTRACT_ID',
	});

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());
	console.log('\n-Using contract name:', contractName);

	// parse the list of account IDs
	const accountList = process.argv[2].split(',');

	// if the user has supplied more than 80 accounts, warn them on maxing out the transaction size
	if (accountList.length > 75) {
		console.log('WARNING: Adding more than 75 accounts in a single transaction may exceed the transaction size limit.');
		console.log('Consider breaking up the list into multiple transactions.');
		const keepGoing = readlineSync.keyInYNStrict('Do you wish to continue?');
		if (!keepGoing) {
			console.log('User aborted.');
			return;
		}
	}

	const evmAddressList = [];
	console.log('Adding the following accounts to the whitelist:', accountList);
	for (let i = 0; i < accountList.length; i++) {
		const account = accountList[i];
		let accountId;
		try {
			accountId = AccountId.fromString(account);
		}
		catch {
			console.error('ERROR: Invalid account ID:', account);
			return;
		}
		try {
			const evmAddress = await homebrewPopulateAccountEvmAddress(env, accountId);
			evmAddressList.push(evmAddress);
		}
		catch {
			evmAddressList.push(accountId.toSolidityAddress());
		}
		console.log(`Account ${i + 1}:`, account, '->', evmAddressList[i]);
	}

	const proceed = readlineSync.keyInYNStrict('Do you wish to add these addresses to the WL?');
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			250_000 + (125_000 * evmAddressList.length),
			'addToWhitelist',
			[evmAddressList.map(a => a.toString())],
		);

		console.log('Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());
	}
	else {
		console.log('User aborted.');
	}
});
