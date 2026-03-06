const {
	Hbar,
	HbarUnit,
	TokenId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { getTokenDetails } = require('../../utils/hederaMirrorHelpers');
const { getArgFlag } = require('../../utils/nodeHelpers');

runScript(async () => {
	const args = process.argv.slice(2);
	if (getArgFlag('-h') || args.length != 1) {
		console.log('Usage: updateContractPaysLazy.js 1|0');
		console.log('1 - contract pays $LAZY fees');
		console.log('0 - contract does not pay $LAZY fees');
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

	// get current pause status vis getMintEconomics from mirror nodes
	const mintEcon = (await readContract(iface, env, contractId, operatorId, 'getMintEconomics'))[0];

	// get the $LAZY token details
	const lazyToken = TokenId.fromSolidityAddress(
		(await readContract(iface, env, contractId, operatorId, 'getLazyToken'))[0],
	);

	const lazyTokenDetails = await getTokenDetails(env, lazyToken);

	console.log('Current mint economics:');
	console.log('Contract Pays $LAZY:', Boolean(mintEcon[0]));
	console.log('HBAR Px:', new Hbar(Number(mintEcon[1]), HbarUnit.Tinybar).toString());
	console.log('$LAZY Px:', Number(mintEcon[2]) / 10 ** lazyTokenDetails.decimals, lazyTokenDetails.symbol);
	console.log('WL discount (during WL period):', Number(mintEcon[3]), '%');
	console.log('Max Mints (per tx):', Number(mintEcon[4]));
	console.log('WL cost in $LAZY (0 = N/A):', Number(mintEcon[5]) ? `${Number(mintEcon[5]) / 10 ** lazyTokenDetails.decimals} ${lazyTokenDetails.symbol}` : 'N/A');
	console.log('WL slots per purchase (0 = uncapped):', Number(mintEcon[6]));
	console.log('Max Mints per Wallet:', Number(mintEcon[7]));
	console.log('Token to buy WL with:', TokenId.fromSolidityAddress(mintEcon[8]).toString());

	const settting = Boolean(args[0]);
	const msg = settting ? 'Set Contract to pay $LAZY fees' : 'Set User to pay $LAZY fees';
	const proceed = readlineSync.keyInYNStrict(msg);
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			350_000,
			'updateContractPaysLazy',
			[settting],
		);

		console.log('Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());
	}
	else {
		console.log('User aborted.');
	}
});
