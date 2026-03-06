const { AccountId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	if (process.argv.length < 4) {
		console.log('Usage: node emergencyWithdrawNFT.js <recipient> <serial1> [serial2] [serial3] ...');
		console.log('\nExample: node emergencyWithdrawNFT.js 0.0.123456 123 456 789');
		console.log('\n⚠️  WARNING: Emergency use only - withdraws NFTs from contract');
		return;
	}

	const recipientStr = process.argv[2];
	const serials = process.argv.slice(3).map(s => parseInt(s));

	let recipientId;
	try {
		recipientId = AccountId.fromString(recipientStr);
	}
	catch {
		console.log('❌ Error: Invalid recipient account ID');
		return;
	}

	if (serials.some(s => isNaN(s) || s < 1)) {
		console.log('❌ Error: All serials must be positive numbers');
		return;
	}

	console.log('\n🚨 ForeverMinter - Emergency NFT Withdrawal');
	console.log('==============================================\n');

	try {
		console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🚨 EMERGENCY NFT WITHDRAWAL');
		console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Recipient: ${recipientId.toString()}`);
		console.log(`Serials to Withdraw: ${serials.length}`);
		console.log(`   ${serials.join(', ')}`);

		console.log('\n⚠️  WARNING: This is an emergency function');
		console.log('   • NFTs will be transferred to specified recipient');
		console.log('   • They will be removed from the minting pool');
		console.log('   • Use only in exceptional circumstances');
		console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Are you sure you want to proceed? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		const doubleConfirm = readlineSync.question('Type "EMERGENCY" to confirm: ');
		if (doubleConfirm !== 'EMERGENCY') {
			console.log('❌ Cancelled - confirmation failed');
			return;
		}

		console.log('\n🔄 Processing emergency withdrawal...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'emergencyWithdrawNFTs',
			[recipientId.toSolidityAddress(), serials],
			300_000 + (serials.length * 50_000),
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'emergencyWithdrawNFTs',
			[recipientId.toSolidityAddress(), serials],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Emergency withdrawal completed');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Details:');
			console.log(`   Serials Withdrawn: ${serials.length}`);
			console.log(`   Serials: ${serials.join(', ')}`);
			console.log(`   Destination: ${recipientId.toString()}`);

			console.log('\n💡 Verify with: node getPoolStatus.js');
		}
		else {
			console.log('❌ Failed to withdraw:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Emergency Withdraw NFT', gasInfo);

	}
	catch (error) {
		console.log('❌ Error during emergency withdrawal:', error.message);
	}
});
