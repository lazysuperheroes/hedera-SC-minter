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
	console.log('║   Initialize Edition Token (Owner)      ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Check current phase
		console.log('\n📊 Checking contract state...');
		const phaseCmd = abi.encodeFunctionData('currentPhase');
		const phaseResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			phaseCmd,
			operatorId,
			false,
		);
		const phase = abi.decodeFunctionResult('currentPhase', phaseResult);
		const currentPhase = Number(phase[0]);

		if (currentPhase !== 0) {
			const phaseNames = ['NOT_INITIALIZED', 'EDITION_MINTING', 'EDITION_SOLD_OUT', 'WINNER_SELECTED', 'PRIZE_CLAIMED'];
			console.log(`❌ ERROR: Edition token already initialized. Current phase: ${phaseNames[currentPhase]}`);
			return;
		}

		// Gather token details
		console.log('\n📝 Edition Token Configuration:\n');

		const name = readlineSync.question('Token Name (e.g., "My Edition Collection"): ');
		if (!name || name.trim().length === 0) {
			console.log('❌ Token name is required');
			return;
		}

		const symbol = readlineSync.question('Token Symbol (e.g., "MEC"): ');
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

		const maxSupply = parseInt(readlineSync.question('Max Supply (e.g., 10, 50, 100): '));
		if (isNaN(maxSupply) || maxSupply < 1) {
			console.log('❌ Invalid max supply');
			return;
		}

		// Royalties
		console.log('\n💎 Royalty Configuration (optional):');
		console.log('   Enter up to 10 royalty recipients');
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

			const numerator = parseInt(readlineSync.question('  Royalty numerator (e.g., 5 for 5%): '));
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
		console.log('\n📋 Edition Token Summary:');
		console.log('═══════════════════════════════════════════');
		console.log('  Name:', name);
		console.log('  Symbol:', symbol);
		console.log('  Memo:', memo || '(none)');
		console.log('  Metadata:', metadata);
		console.log('  Max Supply:', maxSupply);
		console.log('  Royalties:', royalties.length > 0 ? `${royalties.length} recipient(s)` : 'None');

		if (royalties.length > 0) {
			console.log('\n  Royalty Details:');
			royalties.forEach((r, i) => {
				const percentage = (r.numerator / r.denominator * 100).toFixed(2);
				console.log(`    ${i + 1}. ${r.feeAccountId}: ${percentage}% (${r.numerator}/${r.denominator})`);
			});
		}
		console.log();

		const proceed = readlineSync.keyInYNStrict('Proceed with edition token initialization?');
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
			'initializeEditionToken',
			[name, symbol, memo, metadata, maxSupply, royalties],
			400_000,
			Number(new Hbar(MINT_PAYMENT).toTinybars()),
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Execute initialization
		console.log('\n🚀 Initializing edition token...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'initializeEditionToken',
			[name, symbol, memo, metadata, maxSupply, royalties],
			MINT_PAYMENT,
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Edition token initialization failed');
			console.log('Status:', result[0]?.status?.toString());
			return;
		}

		console.log('\n✅ Edition token initialized successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());

		// Try to get token ID from return value
		try {
			const tokenAddress = result[1][0];
			console.log('\n📦 Edition Token Created:');
			console.log('  Address:', tokenAddress);
			console.log('  Name:', name);
			console.log('  Symbol:', symbol);
			console.log('  Max Supply:', maxSupply);

			console.log('\n📊 Next Steps:');
			console.log('  1. Initialize prize token:');
			console.log('     node scripts/interactions/EditionWithPrize/admin/initializePrizeToken.js');
			console.log('  2. After both tokens initialized, configure economics:');
			console.log('     node scripts/interactions/EditionWithPrize/admin/updateMintEconomics.js');
		}
		catch {
			console.log('\n📊 Check contract state for token details:');
			console.log('   node scripts/interactions/EditionWithPrize/getContractState.js');
		}

	}
	catch (error) {
		console.error('\n❌ Error initializing edition token:', error.message || error);
	}
});
