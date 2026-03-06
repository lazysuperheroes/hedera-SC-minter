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
const { getTokenDetails, checkMirrorBalance, checkMirrorAllowance } = require('../../utils/hederaMirrorHelpers');
const { associateTokenToAccount, setFTAllowance } = require('../../utils/hederaHelpers');

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

	const userTokenBalance = await checkMirrorBalance(env, operatorId, nftToken);

	if (userTokenBalance === null || userTokenBalance === undefined) {
		console.log('User neeeds to associate NFT token with account before minting NFTs.');

		const proceed = readlineSync.keyInYNStrict('Do you wish to associate the NFT token with this account?');
		if (proceed) {
			const result = await associateTokenToAccount(client, operatorId, operatorKey, nftToken);

			console.log('Result:', result);
		}
		else {
			console.log('User aborted.');
			return;
		}
	}

	// ask the user how many they want to mint
	const qty = readlineSync.questionInt('How many NFTs do you want to mint? ');

	// need to set the $LAZY allowance to the contract
	const lazyAllowance = Number(costs[1]) * qty;
	const lazyAllowanceStr = `${lazyAllowance / 10 ** lazyTokenDetails.decimals} ${lazyTokenDetails.symbol}`;

	// get the user's $LAZY allowance
	const userLazyAllowance = await checkMirrorAllowance(env, operatorId, lazyToken, contractId);

	if (userLazyAllowance === null || userLazyAllowance === undefined || userLazyAllowance < lazyAllowance) {

		const lazyAllowanceProceed = readlineSync.keyInYNStrict(`Do you wish to allow the contract to spend ${lazyAllowanceStr}?`);
		if (lazyAllowanceProceed) {
			const result = await setFTAllowance(client, lazyToken, operatorId, AccountId.fromString(contractId.toString()), lazyAllowance);

			console.log('Result:', result);
		}
		else {
			console.log('User aborted.');
			return;
		}
	}

	// check gas estimate
	// const gasEstimateCmd = iface.encodeFunctionData('mint', [qty]);

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
			'mintNFT',
			[qty],
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
