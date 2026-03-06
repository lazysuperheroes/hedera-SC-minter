const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');

runScript(async () => {
	const contractName = process.env.CONTRACT_NAME ?? 'MinterContract';
	const { client, operatorId, contractId, env, iface } = initScript({
		contractName,
		contractEnvVar: 'CONTRACT_ID',
	});

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());
	console.log('\n-Using contract name:', contractName);

	// get current pause status vis getMintTiming from mirror nodes
	const mintTiming = (await readContract(iface, env, contractId, operatorId, 'getMintTiming'))[0];

	console.log('Current mint timing:');
	console.log('last mint:', mintTiming[0], ' -> ', new Date(Number(mintTiming[0]) * 1000).toISOString());
	console.log('mint start:', mintTiming[1], ' -> ', new Date(Number(mintTiming[1]) * 1000).toISOString());
	console.log('PAUSE STATUS:', Boolean(mintTiming[2]));
	console.log('Cooldown period:', Number(mintTiming[3]), ' seconds');
	console.log('Refund Window (if applicable):', Number(mintTiming[4]));
	console.log('WL ONLY:', Boolean(mintTiming[5]));

	const proceed = readlineSync.keyInYNStrict('Do you wish to remove the contract from WL Only mode?');
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			350_000,
			'updateWlOnlyStatus',
			[false],
		);

		console.log('Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());
	}
	else {
		console.log('User aborted.');
	}
});
