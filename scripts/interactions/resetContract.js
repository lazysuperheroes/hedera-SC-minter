const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');

runScript(async () => {
	const contractName = process.env.CONTRACT_NAME ?? 'MinterContract';
	const { client, operatorId, contractId, env, iface } = initScript({
		contractName,
		contractEnvVar: 'CONTRACT_ID',
	});

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using Contract:', contractId.toString());
	console.log('Operator Account ID:', operatorId.toString());
	console.log('CONTRACT NAME:', contractName);

	// check if user wants to remove the token
	const removeToken = readlineSync.keyInYNStrict('Do you want to remove the token?');

	// request batch size (Default 100)
	const batchSize = readlineSync.questionInt('Enter the batch size (Suggestion=100): ');

	const proceed = readlineSync.keyInYNStrict('Do you want to reset the contract?');

	let status;
	let remaining;
	if (proceed) {
		do {
			const result = await contractExecuteFunction(
				contractId,
				iface,
				client,
				3_200_000,
				'resetContract',
				[removeToken, batchSize],
			);

			console.log('resetContract result:', result[0]?.status?.toString());
			console.log('resetContract transaction:', result[2]?.transactionId?.toString());
			status = result[0]?.status?.toString();
			remaining = Number(result[1][0]);
		} while (status == 'SUCCESS' && remaining > 0);
	}
	else {
		console.log('user aborted');
	}
});
