const readlineSync = require('readline-sync');
const { getArgFlag } = require('../../utils/nodeHelpers');
const { initScript, runScript } = require('../lib/scriptBase');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');

runScript(async () => {
	const args = process.argv.slice(2);
	if (getArgFlag('-h') || args.length != 1) {
		console.log('Usage: setCID.js https://newCID/');
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

	const proceed = readlineSync.keyInYNStrict('Do you want to update CID? -> ' + args[0]);
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			500_000,
			'updateCID',
			[args[0]],
		);

		console.log('Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());
	}
	else {
		console.log('User aborted');
	}
});
