const { TokenId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Parse token address from arguments
	if (process.argv.length < 3) {
		console.log('Usage: node removeDiscountTier.js <tokenId>');
		console.log('\nExample: node removeDiscountTier.js 0.0.123456');
		console.log('\n💡 Use getContractInfo.js to see all tiers and their tokens');
		return;
	}

	const tokenIdStr = process.argv[2];

	let tokenId;
	try {
		tokenId = TokenId.fromString(tokenIdStr);
	}
	catch {
		console.log('❌ Error: Invalid token ID');
		return;
	}

	console.log('\n🎁 ForeverMinter - Remove Discount Tier');
	console.log('==========================================\n');

	try {
		console.log(`Removing discount tier for token: ${tokenId.toString()}`);

		console.log('\n⚠️  Warning: This will permanently remove the discount tier');
		console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with removal? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Removing discount tier...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'removeDiscountTier',
			[tokenId.toSolidityAddress()],
			250_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'removeDiscountTier',
			[tokenId.toSolidityAddress()],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Discount tier removed');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n💡 Verify with: node getContractInfo.js');
		}
		else {
			console.log('❌ Failed to remove tier:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Remove Discount Tier', gasInfo);

	}
	catch (error) {
		console.log('❌ Error removing discount tier:', error.message);
	}
});
