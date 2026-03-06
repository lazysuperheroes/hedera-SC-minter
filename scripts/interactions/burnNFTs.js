const { TokenId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { getSerialsOwned, getNFTApprovedForAllAllowances } = require('../../utils/hederaMirrorHelpers');
const { setNFTAllowanceAll } = require('../../utils/hederaHelpers');

runScript(async () => {
	const contractName = process.env.CONTRACT_NAME ?? 'MinterContract';
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName,
		contractEnvVar: 'CONTRACT_ID',
	});

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());
	console.log('\n-Using contract name:', contractName);

	// get the token ID and ensure the user has it associated -> use getNFTTokenAddress from mirror nodes
	const nftToken = TokenId.fromSolidityAddress(
		(await readContract(iface, env, contractId, operatorId, 'getNFTTokenAddress'))[0],
	);

	// get the serials of the NFTs
	const usersSerials = await getSerialsOwned(env, operatorId, nftToken);

	if (usersSerials === null || usersSerials === undefined || usersSerials.length === 0) {
		console.log('No NFTs found in user account, unable to burn.');
		process.exit(1);
	}

	// ask the user which NFT(s) they want to burn
	console.log('Serials owned:', usersSerials);
	const serials = readlineSync.question('Enter the serial number(s) of the NFT(s) you want to burn (comma separated): ');

	const serialArr = serials.split(',').map(Number);

	if (serialArr.length === 0) {
		console.log('No serials entered, aborting.');
		process.exit(1);
	}

	// check if the user owns the NFTs
	const ownedSerials = usersSerials.filter(serial => serialArr.includes(serial));

	if (ownedSerials.length !== serialArr.length) {
		console.log('User does not own all the NFTs specified.');
		process.exit(1);
	}

	let proceed = readlineSync.keyInYNStrict(`Do you wish to attempt to burn serial #${serialArr} NFTs?`);

	if (!proceed) {
		console.log('User aborted.');
		return;
	}

	// need to check there is an allowance to the contract to enable the burn
	const nftAllowances = await getNFTApprovedForAllAllowances(env, operatorId);

	if (!nftAllowances.has(contractId.toString()) || !nftAllowances.get(contractId.toString()).includes(nftToken.toString())) {
		// check user is happy to set the allowance
		proceed = readlineSync.keyInYNStrict('Do you wish to allow the contract to burn NFTs on your behalf? Required for burn');
		if (proceed) {
			const nftAllowanceRes = await setNFTAllowanceAll(client, [nftToken], operatorId, contractId);
			console.log('Setting NFT All serial Allowance:', nftAllowanceRes);
		}
	}


	proceed = readlineSync.keyInYNStrict('LAST CHANCE: Do you wish to procced with the burn?');
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			500_000 + 225_000 * serialArr.length,
			'burnNFTs',
			[serialArr],
		);
		if (result[0]?.status?.toString() != 'SUCCESS') {
			console.log('Transaction failed:', result[0]);
		}
		else {

			console.log('\nResult:', result[0]?.status?.toString());
			console.log('\nTransaction ID:', result[2].transactionId.toString());
		}
	}
	else {
		console.log('User aborted.');
	}
});
