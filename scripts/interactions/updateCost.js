const {
	Hbar,
	HbarUnit,
	TokenId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { getArgFlag } = require('../../utils/nodeHelpers');
const { getTokenDetails } = require('../../utils/hederaMirrorHelpers');

runScript(async () => {
	const args = process.argv.slice(2);
	if (getArgFlag('-h') || args.length != 2) {
		console.log('Usage: updateCost.js XX YY');
		console.log('   where XX is price in Hbar and YY is price in Lazy allowinf for decimal so 10 == 1 $LAZY');
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

	// getMintEconomics from mirror nodes
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

	const hbarCost = new Hbar(Number(args[0]), HbarUnit.Hbar);
	const lazyCost = Number(args[1]) * 10 ** lazyTokenDetails.decimals;

	console.log('New cost to mint:\nHbar:', hbarCost.toString(), '\n$LAZY:', Number(args[1]), lazyTokenDetails.symbol);

	const proceed = readlineSync.keyInYNStrict('Do you want to update mint price?');
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			500_000,
			'updateCost',
			[BigInt(hbarCost.toTinybars()), lazyCost],
		);

		console.log('Result:', result[0]?.status.toString(), 'transaction ID:', result[2].transactionId.toString());
	}
	else {
		console.log('User aborted');
	}
});
