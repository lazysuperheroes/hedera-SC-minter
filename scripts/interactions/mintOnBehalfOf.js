const {
	AccountId,
	Hbar,
	HbarUnit,
	TokenId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { hex_to_ascii } = require('../../utils/nodeHelpers');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
const { getTokenDetails, checkMirrorBalance, homebrewPopulateAccountEvmAddress } = require('../../utils/hederaMirrorHelpers');

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

	// get the $LAZY token details
	const lazyToken = TokenId.fromSolidityAddress(
		(await readContract(iface, env, contractId, operatorId, 'getLazyToken'))[0],
	);

	const lazyTokenDetails = await getTokenDetails(env, lazyToken);

	// query getCost via mirror node
	const costs = await readContract(iface, env, contractId, operatorId, 'getCost');

	console.log('Cost to mint:\nHbar:', new Hbar(Number(costs[0]), HbarUnit.Tinybar).toString(), '\nLazy:', Number(costs[1]) / 10 ** lazyTokenDetails.decimals, lazyTokenDetails.symbol);

	// call getRemainingMint via mirror node
	const remainingMint = Number((await readContract(iface, env, contractId, operatorId, 'getRemainingMint'))[0]);

	console.log('Remaining to mint:', remainingMint);

	// get the token ID and ensure the user has it associated -> use getNFTTokenAddress from mirror nodes
	const nftToken = TokenId.fromSolidityAddress(
		(await readContract(iface, env, contractId, operatorId, 'getNFTTokenAddress'))[0],
	);

	// request the user to mint on behalf of and pattern check it for \d\.d\.\d+
	const pattern = /\d\.\d\.\d+/;
	let mintOnBehalfOf = readlineSync.question('Enter the account ID to mint on behalf of (e.g. 0.0.1234): ');

	if (!pattern.test(mintOnBehalfOf)) {
		console.log('Invalid account ID entered, aborting.');
		return;
	}

	mintOnBehalfOf = AccountId.fromString(mintOnBehalfOf);

	const mintOnBehalfOfAsEVM = await homebrewPopulateAccountEvmAddress(env, mintOnBehalfOf);

	console.log('Minting on behalf of:', mintOnBehalfOf.toString(), 'EVM:', mintOnBehalfOfAsEVM);

	const userTokenBalance = await checkMirrorBalance(env, mintOnBehalfOf, nftToken);

	if (userTokenBalance === null || userTokenBalance === undefined) {
		console.log('User neeeds to associate NFT token with account before minting NFTs. Exiting.');
		process.exit(1);
	}

	// ask the user how many they want to mint
	const qty = readlineSync.questionInt('How many NFTs do you want to mint? ');

	// check gas estimate
	// const gasEstimateCmd = iface.encodeFunctionData('mintNFTOnBehalf', [qty, operatorId.toSolidityAddress()]);

	// console.log('Getting gas estimate... for command:', gasEstimateCmd);

	// const gasEstimate = await readOnlyEVMFromMirrorNode(
	// 	env,
	// 	contractId,
	// 	gasEstimateCmd,
	// 	operatorId,
	// 	true,
	// 	2_000_000,
	// );

	// console.log('Gas estimate:', gasEstimate);

	const proceed = readlineSync.keyInYNStrict(`Do you wish to attempt to mint ${qty} NFTs?`);
	if (proceed) {
		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			500_000 + 325_000 * qty,
			'mintNFTOnBehalf',
			[qty, mintOnBehalfOfAsEVM],
			new Hbar(Number(costs[0]) * qty, HbarUnit.Tinybar),
		);
		if (result[0]?.status?.toString() != 'SUCCESS') {
			console.log('Transaction failed:', result[0]);
		}
		else {

			console.log('\nResult:', result[0]?.status?.toString(), '\nserial(s)', result[1][0], '\nmetadata:');
			for (let m = 0; m < result[1][1].length; m++) {
				console.log('Serial #', Number(result[1][0][m]), ' -> ', hex_to_ascii(result[1][1][m]));
			}

			console.log('\nTransaction ID:', result[2].transactionId.toString());
		}
	}
	else {
		console.log('User aborted.');
	}
});
