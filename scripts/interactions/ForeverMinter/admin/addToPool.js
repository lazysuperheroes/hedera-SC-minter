const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	if (process.argv.length < 3) {
		console.log('Usage: node addToPool.js <serial1> [serial2] [serial3] ...');
		console.log('\nExample: node addToPool.js 123 456 789');
		console.log('\n💡 This adds NFTs to the pool');
		console.log('   (Use registerNFTs.js for initial NFT registration)');
		return;
	}

	const serials = process.argv.slice(2).map(s => parseInt(s));

	if (serials.some(s => isNaN(s) || s < 1)) {
		console.log('❌ Error: All serials must be positive numbers');
		return;
	}

	console.log('\n📦 ForeverMinter - Add to Pool');
	console.log('=================================\n');

	try {
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Add NFTs to Pool');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Serials to Add: ${serials.length}`);
		console.log(`   ${serials.join(', ')}`);

		console.log('\n⚠️  Warning: These NFTs must be owned by the contract');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with adding to pool? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Adding NFTs to pool...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'addNFTsToPool',
			[serials],
			300_000 + (serials.length * 30_000),
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'addNFTsToPool',
			[serials],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! NFTs added to pool');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Details:');
			console.log(`   Serials Added: ${serials.length}`);
			console.log(`   Serials: ${serials.join(', ')}`);

			console.log('\n💡 Verify with: node getPoolStatus.js');
		}
		else {
			console.log('❌ Failed to add to pool:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Add to Pool', gasInfo);

	}
	catch (error) {
		console.log('❌ Error adding to pool:', error.message);
	}
});
