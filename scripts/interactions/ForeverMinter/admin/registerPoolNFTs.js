const { TokenId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { readContract } = require('../../../lib/contractHelpers');
const {
	contractExecuteFunction,
	readOnlyEVMFromMirrorNode,
} = require('../../../../utils/solidityHelpers');
const { estimateGas } = require('../../../../utils/gasHelpers');
const { getSerialsOwned } = require('../../../../utils/hederaMirrorHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	/**
	 * Fetch all registered serials from contract (paginated)
	 */
	async function getRegisteredSerials() {
		const allSerials = [];
		const pageSize = 100;
		let offset = 0;
		let hasMore = true;

		console.log('⏳ Fetching registered serials from contract...');

		while (hasMore) {
			const command = iface.encodeFunctionData('getAvailableSerialsPaginated', [offset, pageSize]);
			const result = await readOnlyEVMFromMirrorNode(env, contractId, command, operatorId, false);
			const serials = iface.decodeFunctionResult('getAvailableSerialsPaginated', result)[0];

			if (serials.length === 0) {
				hasMore = false;
			}
			else {
				allSerials.push(...serials.map(s => Number(s)));
				offset += pageSize;

				if (serials.length < pageSize) {
					hasMore = false;
				}
			}
		}

		return allSerials;
	}

	console.log('\n📦 ForeverMinter - Register Pool NFTs');
	console.log('========================================\n');

	try {
		// Step 1: Get NFT token address from contract
		console.log('📋 Fetching NFT token information...');
		const nftTokenAddress = (await readContract(iface, env, contractId, operatorId, 'NFT_TOKEN'))[0];
		const nftTokenId = TokenId.fromSolidityAddress(nftTokenAddress);
		console.log(`✅ NFT Token: ${nftTokenId.toString()}\n`);

		// Step 2: Get serials owned by contract
		console.log('🔍 Checking serials owned by contract...');
		const ownedSerials = await getSerialsOwned(env, contractId, nftTokenId);

		if (!ownedSerials || ownedSerials.length === 0) {
			console.log('❌ Contract does not own any NFTs');
			console.log('\n💡 Tip: Send NFTs to the contract before registering them');
			return;
		}

		console.log(`✅ Found ${ownedSerials.length} NFTs owned by contract\n`);

		// Step 3: Get already registered serials
		const registeredSerials = await getRegisteredSerials();
		console.log(`✅ Found ${registeredSerials.length} serials already registered\n`);

		// Step 4: Calculate unregistered serials
		const registeredSet = new Set(registeredSerials);
		const unregisteredSerials = ownedSerials.filter(serial => !registeredSet.has(serial));

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📊 REGISTRATION STATUS');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Total Owned by Contract: ${ownedSerials.length}`);
		console.log(`Already Registered: ${registeredSerials.length}`);
		console.log(`Unregistered (need registration): ${unregisteredSerials.length}`);

		if (unregisteredSerials.length === 0) {
			console.log('\n✅ All owned NFTs are already registered!');
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
			return;
		}

		console.log('\n🆕 Unregistered Serials:');
		// Display in rows of 10 for readability
		for (let i = 0; i < unregisteredSerials.length; i += 10) {
			const chunk = unregisteredSerials.slice(i, Math.min(i + 10, unregisteredSerials.length));
			console.log(`   ${chunk.join(', ')}`);
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🎯 REGISTRATION OPTIONS');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log('How would you like to proceed?\n');
		console.log('   1. 🤖 Automatic - Register ALL unregistered serials');
		console.log('   2. ✏️  Manual - Specify which serials to register');
		console.log('   3. ❌ Cancel\n');

		const choice = readlineSync.question('Enter your choice (1-3): ').trim();

		let serialsToRegister = [];

		if (choice === '1') {
			// Automatic: register all unregistered serials
			serialsToRegister = [...unregisteredSerials];
			console.log(`\n✅ Selected: Register all ${serialsToRegister.length} unregistered serials`);
		}
		else if (choice === '2') {
			// Manual: user specifies serials
			console.log('\n✏️  Manual Registration');
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
			console.log('Enter serial numbers to register (comma separated)');
			console.log('Example: 123, 456, 789\n');

			const input = readlineSync.question('Serials: ').trim();

			if (!input) {
				console.log('❌ No serials provided');
				return;
			}

			serialsToRegister = input.split(',').map(s => parseInt(s.trim()));

			// Validate serials
			if (serialsToRegister.some(s => isNaN(s) || s < 1)) {
				console.log('❌ Error: All serials must be positive numbers');
				return;
			}

			// Check if serials are owned by contract
			const notOwned = serialsToRegister.filter(s => !ownedSerials.includes(s));
			if (notOwned.length > 0) {
				console.log('\n⚠️  Warning: The following serials are NOT owned by the contract:');
				console.log(`   ${notOwned.join(', ')}`);
				const proceed = readlineSync.question('\nProceed anyway? (y/N): ');
				if (proceed.toLowerCase() !== 'y') {
					console.log('❌ Cancelled');
					return;
				}
			}

			// Check if any are already registered
			const alreadyRegistered = serialsToRegister.filter(s => registeredSet.has(s));
			if (alreadyRegistered.length > 0) {
				console.log('\n⚠️  Warning: The following serials are ALREADY registered:');
				console.log(`   ${alreadyRegistered.join(', ')}`);
				const proceed = readlineSync.question('\nProceed anyway? (y/N): ');
				if (proceed.toLowerCase() !== 'y') {
					console.log('❌ Cancelled');
					return;
				}
			}

			console.log(`\n✅ Selected: Register ${serialsToRegister.length} serials`);
		}
		else {
			console.log('\n❌ Cancelled');
			return;
		}

		// Final confirmation
		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 REGISTRATION SUMMARY');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Serials to Register: ${serialsToRegister.length}`);
		if (serialsToRegister.length <= 20) {
			console.log(`   ${serialsToRegister.join(', ')}`);
		}
		else {
			console.log(`   ${serialsToRegister.slice(0, 10).join(', ')}...`);
			console.log(`   (and ${serialsToRegister.length - 10} more)`);
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with registration? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Registering pool NFTs...\n');

		// Process in batches of 30 (Hedera EVM has 50 sub-transaction limit, being conservative)
		const batchSize = 30;
		const batches = [];
		for (let i = 0; i < serialsToRegister.length; i += batchSize) {
			batches.push(serialsToRegister.slice(i, i + batchSize));
		}

		console.log(`Processing ${batches.length} batch${batches.length > 1 ? 'es' : ''} in parallel...\n`);

		// Execute all batches in parallel
		const batchPromises = batches.map(async (batch, batchNum) => {
			console.log(`📦 Batch ${batchNum + 1}/${batches.length}: Submitting ${batch.length} serials...`);

			try {
				const gasInfo = await estimateGas(
					env,
					contractId,
					iface,
					operatorId,
					'registerNFTs',
					[batch],
					300_000 + (batch.length * 30_000),
				);

				const result = await contractExecuteFunction(
					contractId,
					iface,
					client,
					gasInfo.gasLimit,
					'registerNFTs',
					[batch],
				);

				if (result[0]?.status?.toString() === 'SUCCESS') {
					console.log(`   ✅ Batch ${batchNum + 1} SUCCESS: ${batch.length} serials registered`);
					console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);
					return { success: true, count: batch.length, batchNum: batchNum + 1 };
				}
				else {
					console.log(`   ❌ Batch ${batchNum + 1} FAILED: ${result[0]?.status?.toString()}`);
					return { success: false, count: 0, batchNum: batchNum + 1, error: result[0]?.status?.toString() };
				}
			}
			catch (error) {
				console.log(`   ❌ Batch ${batchNum + 1} ERROR: ${error.message}`);
				return { success: false, count: 0, batchNum: batchNum + 1, error: error.message };
			}
		});

		// Wait for all batches to complete
		const results = await Promise.all(batchPromises);

		// Calculate totals
		const totalRegistered = results.reduce((sum, r) => sum + r.count, 0);
		const successfulBatches = results.filter(r => r.success).length;
		const failedBatches = results.filter(r => !r.success).length;

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📊 REGISTRATION COMPLETE');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Total Serials Registered: ${totalRegistered}/${serialsToRegister.length}`);
		console.log(`Successful Batches: ${successfulBatches}/${batches.length}`);
		if (failedBatches > 0) {
			console.log(`Failed Batches: ${failedBatches}`);
			console.log('\n⚠️  Some batches failed. You may need to re-run for remaining serials.');
		}
		console.log(`New Total in Pool: ${registeredSerials.length + totalRegistered}`);

		console.log('\n💡 Verify with: node getPoolStatus.js');

	}
	catch (error) {
		console.log('❌ Error registering pool NFTs:', error.message);
	}
});
