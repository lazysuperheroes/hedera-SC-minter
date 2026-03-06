const { AccountId, TokenId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { homebrewPopulateAccountEvmAddress, getSerialsOwned } = require('../../utils/hederaMirrorHelpers');

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

	// check the REVOCABLE status of the contract is true else abort
	const revocable = (await readContract(iface, env, contractId, operatorId, 'REVOCABLE'))[0];
	if (!revocable) {
		console.log('Contract is not revocable, aborting.');
		process.exit(1);
	}
	else {
		console.log('Contract is revocable. Proceeding.');
	}


	// get the token ID and ensure the user has it associated -> use getNFTTokenAddress from mirror nodes
	const nftToken = TokenId.fromSolidityAddress(
		(await readContract(iface, env, contractId, operatorId, 'getNFTTokenAddress'))[0],
	);

	// request the user to mint on behalf of and pattern check it for \d\.d\.\d+
	const pattern = /\d\.\d\.\d+/;
	let revokeFor = readlineSync.question(`Enter the account ID to revoke the SBT token [${nftToken.toString()}] from (e.g. 0.0.1234): `);

	if (!pattern.test(revokeFor)) {
		console.log('Invalid account ID entered, aborting.');
		return;
	}

	revokeFor = AccountId.fromString(revokeFor);

	const revokeForAsEVM = await homebrewPopulateAccountEvmAddress(env, revokeFor);

	console.log('Revoking SBT from:', revokeFor.toString(), 'EVM:', revokeForAsEVM);

	// check which serials the user has
	const serials = await getSerialsOwned(env, revokeFor, nftToken);

	if (serials === null || serials === undefined || serials.length === 0) {
		console.log('No NFTs found in user account, unable to revoke.');
		process.exit(1);
	}

	console.log('Serials owned:', serials);

	// ask which serial they want to revoke
	const selectedSerial = Number(readlineSync.question('Enter the serial number of the NFT you want to revoke: '));

	if (!serials.includes(selectedSerial)) {
		console.log('User does not own the NFT specified.');
		process.exit(1);
	}

	const proceed = readlineSync.keyInYNStrict(`Do you wish to revoke #${selectedSerial} of the SBT [${nftToken.toString()}] for ${revokeFor.toString()}?`);
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			500_000,
			'revokeSBT',
			[revokeForAsEVM, selectedSerial],
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
