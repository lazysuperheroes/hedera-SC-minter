const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const contractName = process.env.CONTRACT_NAME ?? 'MinterContract';
	const { operatorId, contractId, env, iface } = initScript({
		contractName,
		contractEnvVar: 'CONTRACT_ID',
	});

	if (!jsonMode) {
		console.log('\n-Using ENVIRONMENT:', env);
		console.log('\n-Using Operator:', operatorId.toString());
		console.log('\n-Using contract:', contractId.toString());
		console.log('\n-Using contract name:', contractName);
	}

	// get totalMinted from the mirror nodes
	const totalMinted = Number((await readContract(iface, env, contractId, operatorId, 'totalMinted'))[0]);

	// now get maxSupply
	const maxSupply = Number((await readContract(iface, env, contractId, operatorId, 'maxSupply'))[0]);

	const remainingMints = maxSupply - totalMinted;

	if (jsonMode) {
		console.log(JSON.stringify({
			contractId: contractId.toString(),
			contractName,
			totalMinted,
			maxSupply,
			remainingMints,
		}, null, 2));
		return;
	}

	console.log(`\nTotal minted: ${totalMinted}`);
	console.log(`Max supply: ${maxSupply}`);
	console.log(`Remaining mints: ${remainingMints}`);
});
