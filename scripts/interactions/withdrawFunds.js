const {
	AccountId,
	TokenId,
	HbarUnit,
	Hbar,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { getArgFlag, sleep } = require('../../utils/nodeHelpers');
const { checkMirrorHbarBalance, checkMirrorBalance, getTokenDetails } = require('../../utils/hederaMirrorHelpers');

runScript(async () => {
	const args = process.argv.slice(2);
	if (getArgFlag('-h') || args.length != 1) {
		console.log('Usage: withdrawFunds.js');
		console.log('   pull hbar / $LAZY from contract to operator account');
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

	const proceed = readlineSync.keyInYNStrict('Do you want to pull HBAR/$LAZY?');
	if (proceed) {
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

		// withdraw the hbar
		let result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			500_000,
			'transferHbar',
			[operatorId.toSolidityAddress(), Number(contractBal)],
		);

		console.log('HBAR Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());

		result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			500_000,
			'retrieveLazy',
			[operatorId.toSolidityAddress(), Number(contractLazyBal)],
		);

		console.log('$LAZY Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());

		// sleep to let mirror node catch up
		await sleep(4000);
		contractBal = await checkMirrorHbarBalance(env, AccountId.fromString(contractId.toString()));
		contractLazyBal = await checkMirrorBalance(env, AccountId.fromString(contractId.toString()), lazyToken);

		console.log('Contract HBAR balance:', new Hbar(contractBal, HbarUnit.Tinybar).toString());
		console.log('Contract $LAZY balance:', contractLazyBal / 10 ** lazyTokenDetails.decimals, lazyTokenDetails.symbol);
	}
	else {
		console.log('User aborted');
		return;
	}
});
