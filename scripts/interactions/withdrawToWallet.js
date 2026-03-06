const {
	AccountId,
	Hbar,
	HbarUnit,
	TokenId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { getArgFlag, sleep, getArg } = require('../../utils/nodeHelpers');
const { checkMirrorHbarBalance, checkMirrorBalance, getTokenDetails } = require('../../utils/hederaMirrorHelpers');

runScript(async () => {

	if (getArgFlag('h')) {
		console.log('Usage: withdrawToWallet.js -[hbar|lazy] -wallet WWWW -amount AA');
		return;
	}

	const contractName = process.env.CONTRACT_NAME ?? 'MinterContract';
	const { client, operatorId, contractId, env, iface } = initScript({
		contractName,
		contractEnvVar: 'CONTRACT_ID',
	});

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());
	console.log('\n-Using contract name:', contractName);

	// get the $LAZY token of the contract via mirror node -> getLazyToken
	const lazyToken = TokenId.fromSolidityAddress(
		(await readContract(iface, env, contractId, operatorId, 'getLazyToken'))[0],
	);

	const lazyTokenDetails = await getTokenDetails(env, lazyToken);

	// find out the hbar balance of the contract
	let contractBal = await checkMirrorHbarBalance(env, AccountId.fromString(contractId.toString()));
	let contractLazyBal = await checkMirrorBalance(env, AccountId.fromString(contractId.toString()), lazyToken);

	console.log('Contract HBAR balance:', new Hbar(contractBal, HbarUnit.Tinybar).toString());
	console.log('Contract $LAZY balance:', contractLazyBal / 10 ** lazyTokenDetails.decimals, lazyTokenDetails.symbol);

	const wallet = AccountId.fromString(getArg('wallet'));
	const amount = Number(getArg('amount'));

	if (getArgFlag('hbar')) {

		const outputStr = 'Do you wish to withdraw ' + (new Hbar(amount)).toString() + ' to ' + wallet + ' ?';
		const proceed = readlineSync.keyInYNStrict(outputStr);
		if (proceed) {

			const result = await contractExecuteFunction(
				contractId,
				iface,
				client,
				500_000,
				'transferHbar',
				[wallet.toSolidityAddress(), Number(amount)],
			);
			console.log('HBAR Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());
		}
		else {
			console.log('User aborted');
			return;
		}
	}
	else if (getArgFlag('lazy')) {

		const outputStr = 'Do you wish to withdraw ' + amount + ' $LAZY to ' + wallet + ' ?';
		const proceed = readlineSync.keyInYNStrict(outputStr);

		if (proceed) {

			const result = await contractExecuteFunction(
				contractId,
				iface,
				client,
				500_000,
				'retrieveLazy',
				[wallet.toSolidityAddress(), Number(amount * 10 ** lazyTokenDetails.decimals)],
			);

			console.log('$LAZY Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());
		}
		else {
			console.log('User aborted');
			return;
		}
	}
	else {
		console.log('No valid swicth given, run with -h for usage pattern');
		return;
	}

	// sleep to let mirror node catch up
	await sleep(4000);
	contractBal = await checkMirrorHbarBalance(env, AccountId.fromString(contractId.toString()));
	contractLazyBal = await checkMirrorBalance(env, AccountId.fromString(contractId.toString()), lazyToken);

	console.log('Contract HBAR balance:', new Hbar(contractBal, HbarUnit.Tinybar).toString());
	console.log('Contract $LAZY balance:', contractLazyBal / 10 ** lazyTokenDetails.decimals, lazyTokenDetails.symbol);
});
