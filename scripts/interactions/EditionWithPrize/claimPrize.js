const {
	TokenId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const {
	contractExecuteFunction,
	readOnlyEVMFromMirrorNode,
} = require('../../../utils/solidityHelpers');
const {
	associateTokenToAccount,
} = require('../../../utils/hederaHelpers');
const {
	getSerialsOwned,
} = require('../../../utils/hederaMirrorHelpers');
const { estimateGas } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface: abi } = initScript({
		contractName: 'EditionWithPrize',
		contractEnvVar: 'EDITION_WITH_PRIZE_CONTRACT_ID',
	});

	console.log('\n╔══════════════════════════════════════════╗');
	console.log('║    EditionWithPrize - Claim Prize       ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Step 1: Get contract state
		console.log('\n📊 Fetching contract state...');
		const state = await getContractState();

		// Validate phase
		if (state.phase !== 3) {
			const phaseNames = ['NOT_INITIALIZED', 'EDITION_MINTING', 'EDITION_SOLD_OUT', 'WINNER_SELECTED', 'PRIZE_CLAIMED'];
			console.log(`❌ ERROR: Prize claiming not available. Current phase: ${phaseNames[state.phase]}`);

			if (state.phase === 2) {
				console.log('   Winners have not been selected yet');
				console.log('   Run: node scripts/interactions/EditionWithPrize/selectWinner.js');
			}
			else if (state.phase === 4) {
				console.log('   All prizes have already been claimed');
			}
			return;
		}

		// Display info
		console.log('\n🎉 Winners have been selected!');
		console.log('  Prize Token:', state.prizeToken);
		console.log('  Total Prizes:', state.prizeMaxSupply);
		console.log('  Prizes Claimed:', state.prizeMinted);
		console.log('  Prizes Available:', state.prizeMaxSupply - state.prizeMinted);

		console.log('\n🎲 Winning Edition Serials:');
		state.winningSerials.forEach((serial, index) => {
			console.log(`  ${index + 1}. Serial #${serial}`);
		});

		// Step 2: Check which serials user owns
		console.log('\n🔍 Checking your edition NFTs...');
		const editionTokenId = TokenId.fromSolidityAddress(state.editionToken);
		const ownedSerials = await getSerialsOwned(env, operatorId, editionTokenId);

		if (!ownedSerials || ownedSerials.length === 0) {
			console.log('❌ You do not own any edition NFTs');
			return;
		}

		console.log(`✓ You own ${ownedSerials.length} edition NFT(s)`);

		// Check if any owned serials are winners
		const winningOwnedSerials = ownedSerials.filter(serial =>
			state.winningSerials.includes(serial),
		);

		if (winningOwnedSerials.length === 0) {
			console.log('\n❌ None of your edition NFTs are winning serials');
			console.log('\nYour Serials:', ownedSerials.join(', '));
			console.log('Winning Serials:', state.winningSerials.join(', '));
			console.log('\n💡 TIP: Winning serials are bearer assets and can be traded!');
			return;
		}

		console.log('\n🎉 You own winning serial(s)!');
		winningOwnedSerials.forEach((serial, index) => {
			console.log(`  ${index + 1}. Serial #${serial} ✨`);
		});

		// Step 3: Select which serial to claim (if multiple)
		let serialToClaim;
		if (winningOwnedSerials.length === 1) {
			serialToClaim = winningOwnedSerials[0];
			console.log(`\n✓ Claiming prize for serial #${serialToClaim}`);
		}
		else {
			console.log('\nYou own multiple winning serials. Which one to claim?');
			winningOwnedSerials.forEach((serial, index) => {
				console.log(`  ${index + 1}. Serial #${serial}`);
			});

			const choice = parseInt(readlineSync.question(`\nEnter choice (1-${winningOwnedSerials.length}): `));

			if (choice < 1 || choice > winningOwnedSerials.length) {
				console.log('❌ Invalid choice');
				return;
			}

			serialToClaim = winningOwnedSerials[choice - 1];
		}

		// Step 4: Check prize token association
		console.log('\n🔗 Checking prize token association...');
		const prizeTokenId = TokenId.fromSolidityAddress(state.prizeToken);

		try {
			await getSerialsOwned(env, operatorId, prizeTokenId);
			console.log('✓ Prize token associated');
		}
		catch {
			console.log('⚠️  Prize token not associated');
			const associate = readlineSync.keyInYNStrict('Associate prize token now?');

			if (associate) {
				console.log('Associating prize token...');
				await associateTokenToAccount(client, operatorId, operatorKey, prizeTokenId);
				console.log('✓ Prize token associated');
			}
			else {
				console.log('❌ Cannot claim prize without association');
				return;
			}
		}

		// Step 5: Display claim details
		console.log('\n📝 Prize Claim Summary:');
		console.log('  Edition Serial:', serialToClaim);
		console.log('  Action: Wipe edition NFT from your account');
		console.log('  Receive: Prize NFT minted and transferred to you');
		console.log('\n⚠️  IMPORTANT:');
		console.log('  - This will permanently remove edition serial', serialToClaim, 'from your account');
		console.log('  - You will receive 1 prize NFT in exchange');
		console.log('  - This action cannot be reversed');

		const proceed = readlineSync.keyInYNStrict('\nProceed with prize claim?');
		if (!proceed) {
			console.log('❌ Claim cancelled');
			return;
		}

		// Step 6: Estimate gas
		console.log('\n⛽ Estimating gas...');
		const gasEstimate = await estimateGas(
			env,
			contractId,
			abi,
			operatorId,
			'claimPrize',
			[serialToClaim],
			600_000,
			0,
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Step 7: Execute claim
		console.log('\n🎁 Claiming prize...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'claimPrize',
			[serialToClaim],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Prize claim failed');
			console.log('Status:', result[0]?.status?.toString());
			return;
		}

		console.log('\n✅ Prize claimed successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());

		// Try to get prize serial from return value
		try {
			const prizeSerials = result[1];
			if (prizeSerials && prizeSerials.length > 0) {
				console.log('\n🎁 Prize NFT Details:');
				console.log('  Serial Number:', Number(prizeSerials[0]));
				console.log('  Token:', state.prizeToken);
			}
		}
		catch {
			console.log('\n🎁 Prize NFT minted! Check your wallet for the new serial.');
		}

		console.log('\n🎉 Congratulations!');
		console.log('  Edition serial', serialToClaim, 'has been wiped from your account');
		console.log('  Prize NFT has been minted and transferred to you');
		console.log('\n📊 View your prize NFT on HashScan:');
		console.log(`  https://hashscan.io/${env === 'MAIN' ? 'mainnet' : 'testnet'}/token/${prizeTokenId.toString()}`);

	}
	catch (error) {
		console.error('\n❌ Error during prize claim:', error.message || error);
	}

	/**
	 * Get contract state
	 */
	async function getContractState() {
		const encodedCommand = abi.encodeFunctionData('getContractState');
		const result = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			encodedCommand,
			operatorId,
			false,
		);

		const decoded = abi.decodeFunctionResult('getContractState', result);

		const state = {
			phase: Number(decoded[0]),
			editionToken: decoded[1],
			prizeToken: decoded[2],
			prizeMaxSupply: Number(decoded[7]),
			prizeMinted: Number(decoded[9]),
			winningSerials: decoded[10].map(s => Number(s)),
		};

		return state;
	}
});
