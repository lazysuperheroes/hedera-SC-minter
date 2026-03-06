const {
	Hbar,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const {
	contractExecuteFunction,
	readOnlyEVMFromMirrorNode,
} = require('../../../../utils/solidityHelpers');
const { estimateGas } = require('../../../../utils/gasHelpers');

const MINT_PAYMENT = process.env.MINT_PAYMENT || 50;

runScript(async () => {
	const { client, operatorId, contractId, env, iface: abi } = initScript({
		contractName: 'EditionWithPrize',
		contractEnvVar: 'EDITION_WITH_PRIZE_CONTRACT_ID',
	});

	console.log('\n╔══════════════════════════════════════════╗');
	console.log('║    Initialize Prize Token (Owner)       ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Check current phase and edition token
		console.log('\n📊 Checking contract state...');
		const editionCmd = abi.encodeFunctionData('editionToken');
		const editionResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			editionCmd,
			operatorId,
			false,
		);
		const editionToken = abi.decodeFunctionResult('editionToken', editionResult);

		if (editionToken[0] === '0x0000000000000000000000000000000000000000') {
			console.log('❌ ERROR: Edition token must be initialized first');
			console.log('   Run: node scripts/interactions/EditionWithPrize/admin/initializeEditionToken.js');
			return;
		}

		const prizeCmd = abi.encodeFunctionData('prizeToken');
		const prizeResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			prizeCmd,
			operatorId,
			false,
		);
		const prizeToken = abi.decodeFunctionResult('prizeToken', prizeResult);

		if (prizeToken[0] !== '0x0000000000000000000000000000000000000000') {
			console.log('❌ ERROR: Prize token already initialized');
			console.log('   Prize Token:', prizeToken[0]);
			return;
		}

		console.log('✓ Edition token initialized, ready for prize token');

		// Gather token details
		console.log('\n📝 Prize Token Configuration:\n');

		const name = readlineSync.question('Token Name (e.g., "My Prize Collection"): ');
		if (!name || name.trim().length === 0) {
			console.log('❌ Token name is required');
			return;
		}

		const symbol = readlineSync.question('Token Symbol (e.g., "MPC"): ');
		if (!symbol || symbol.trim().length === 0) {
			console.log('❌ Token symbol is required');
			return;
		}

		const memo = readlineSync.question('Token Memo (max 100 chars, optional): ');
		if (memo.length > 100) {
			console.log('❌ Memo too long (max 100 characters)');
			return;
		}

		const metadata = readlineSync.question('Metadata CID (IPFS, e.g., "ipfs://Qm..."): ');
		if (!metadata || metadata.trim().length === 0) {
			console.log('❌ Metadata CID is required');
			return;
		}

		console.log('\n🎲 Number of Winners:');
		console.log('   1 = Single winner (traditional)');
		console.log('   2+ = Multiple winners (bearer assets)');
		console.log('   ⚠️  Multiple winners require 2-3x gas for selectWinner()');

		const maxSupply = parseInt(readlineSync.question('\nMax Supply / Number of Winners (e.g., 1, 3, 5): '));
		if (isNaN(maxSupply) || maxSupply < 1) {
			console.log('❌ Invalid max supply');
			return;
		}

		if (maxSupply > 1) {
			console.log(`\n⚠️  IMPORTANT: With ${maxSupply} winners, the selectWinner() function`);
			console.log('   may require 2-3x estimated gas due to duplicate handling.');
			console.log('   The robust algorithm ensures exactly', maxSupply, 'unique winners.');
		}

		// Royalties
		console.log('\n💎 Royalty Configuration (optional):');
		console.log('   Prize royalties can differ from edition royalties');
		console.log('   Leave blank to skip royalties\n');

		const royalties = [];
		let addingRoyalties = true;
		let royaltyIndex = 1;

		while (addingRoyalties && royalties.length < 10) {
			const addRoyalty = readlineSync.keyInYNStrict(`Add royalty #${royaltyIndex}?`);

			if (!addRoyalty) {
				addingRoyalties = false;
				break;
			}

			const feeAccountId = readlineSync.question('  Royalty recipient account ID (0.0.xxxxx): ');
			if (!feeAccountId || !feeAccountId.match(/^\d+\.\d+\.\d+$/)) {
				console.log('  ❌ Invalid account ID format');
				continue;
			}

			const numerator = parseInt(readlineSync.question('  Royalty numerator (e.g., 10 for 10%): '));
			const denominator = parseInt(readlineSync.question('  Royalty denominator (e.g., 100 for %): '));

			if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
				console.log('  ❌ Invalid royalty values');
				continue;
			}

			const fallbackFee = parseInt(readlineSync.question('  Fallback fee in tinybar (optional, 0 for none): ') || '0');

			royalties.push({
				feeAccountId,
				numerator,
				denominator,
				fallbackFee,
			});

			royaltyIndex++;
		}

		// Display summary
		console.log('\n📋 Prize Token Summary:');
		console.log('═══════════════════════════════════════════');
		console.log('  Name:', name);
		console.log('  Symbol:', symbol);
		console.log('  Memo:', memo || '(none)');
		console.log('  Metadata:', metadata);
		console.log('  Max Supply:', maxSupply, maxSupply === 1 ? '(single winner)' : `(${maxSupply} winners)`);
		console.log('  Royalties:', royalties.length > 0 ? `${royalties.length} recipient(s)` : 'None');

		if (royalties.length > 0) {
			console.log('\n  Royalty Details:');
			royalties.forEach((r, i) => {
				const percentage = (r.numerator / r.denominator * 100).toFixed(2);
				console.log(`    ${i + 1}. ${r.feeAccountId}: ${percentage}% (${r.numerator}/${r.denominator})`);
			});
		}

		if (maxSupply > 1) {
			console.log('\n  ⚠️  Gas Warning: selectWinner() will need 2-3x gas estimate');
		}
		console.log();

		const proceed = readlineSync.keyInYNStrict('Proceed with prize token initialization?');
		if (!proceed) {
			console.log('❌ Initialization cancelled');
			return;
		}

		// Estimate gas
		console.log('\n⛽ Estimating gas...');
		const gasEstimate = await estimateGas(
			env,
			contractId,
			abi,
			operatorId,
			'initializePrizeToken',
			[name, symbol, memo, metadata, maxSupply, royalties],
			400_000,
			Number(new Hbar(MINT_PAYMENT).toTinybars()),
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Execute initialization
		console.log('\n🚀 Initializing prize token...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'initializePrizeToken',
			[name, symbol, memo, metadata, maxSupply, royalties],
			MINT_PAYMENT,
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Prize token initialization failed');
			console.log('Status:', result[0]?.status?.toString());
			return;
		}

		console.log('\n✅ Prize token initialized successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());

		// Try to get token ID from return value
		try {
			const tokenAddress = result[1][0];
			console.log('\n🎁 Prize Token Created:');
			console.log('  Address:', tokenAddress);
			console.log('  Name:', name);
			console.log('  Symbol:', symbol);
			console.log('  Max Supply:', maxSupply);

			console.log('\n✅ Contract phase transitioned to EDITION_MINTING');
			console.log('\n📊 Next Steps:');
			console.log('  1. Configure mint economics:');
			console.log('     node scripts/interactions/EditionWithPrize/admin/updateMintEconomics.js');
			console.log('  2. Configure mint timing:');
			console.log('     node scripts/interactions/EditionWithPrize/admin/updateMintTiming.js');
			console.log('  3. Setup whitelist (optional):');
			console.log('     node scripts/interactions/EditionWithPrize/admin/addToWhitelist.js');
			console.log('  4. Unpause minting:');
			console.log('     node scripts/interactions/EditionWithPrize/admin/setPause.js');
		}
		catch {
			console.log('\n📊 Check contract state for token details:');
			console.log('   node scripts/interactions/EditionWithPrize/getContractState.js');
		}

	}
	catch (error) {
		console.error('\n❌ Error initializing prize token:', error.message || error);
	}
});
