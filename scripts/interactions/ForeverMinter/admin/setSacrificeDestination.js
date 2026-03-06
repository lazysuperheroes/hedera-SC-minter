const { AccountId } = require('@hashgraph/sdk');
const { ethers } = require('ethers');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');
const { homebrewPopulateAccountEvmAddress, homebrewPopulateAccountNum } = require('../../../../utils/hederaMirrorHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	if (process.argv.length < 3) {
		console.log('Usage: node setSacrificeDestination.js <accountId>');
		console.log('\nExample: node setSacrificeDestination.js 0.0.123456');
		console.log('\n💡 Sacrificed NFTs will be sent to this address');
		console.log('   (Set to 0.0.0 to burn them instead)');
		return;
	}

	const accountIdStr = process.argv[2];

	let targetId;
	let targetEvmAddress;

	// Check if empty string or just spaces - use zero address
	if (!accountIdStr || accountIdStr.trim() === '') {
		targetId = AccountId.fromString('0.0.0');
		targetEvmAddress = ethers.ZeroAddress;
	}
	// Check if input is an EVM address (starts with 0x)
	else if (accountIdStr.startsWith('0x')) {
		try {
			// Validate and normalize the EVM address
			targetEvmAddress = ethers.getAddress(accountIdStr);
			// Use Mirror Node to get the corresponding Hedera account ID
			const hederaAccountId = await homebrewPopulateAccountNum(env, targetEvmAddress);
			targetId = AccountId.fromString(hederaAccountId);
		}
		catch {
			console.log('❌ Error: Invalid EVM address');
			return;
		}
	}
	// Input is a Hedera account ID (e.g., 0.0.123456)
	else {
		try {
			targetId = AccountId.fromString(accountIdStr);
			// Use Mirror Node to get the correct EVM address
			targetEvmAddress = await homebrewPopulateAccountEvmAddress(env, targetId);
		}
		catch {
			console.log('❌ Error: Invalid account ID');
			return;
		}
	}

	console.log('\n🔥 ForeverMinter - Set Sacrifice Destination');
	console.log('================================================\n');

	try {
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Sacrifice Destination Update');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`New Destination: ${targetId.toString()}`);
		console.log(`Address: ${targetEvmAddress}`);

		if (targetId.toString() === '0.0.0') {
			console.log('\n🔥 Sacrificed NFTs will be BURNED (sent to 0.0.0)');
		}
		else {
			console.log('\n📮 Sacrificed NFTs will be sent to this account');
		}

		console.log('\n⚠️  Warning: This affects all future sacrifices');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirm = readlineSync.question('Proceed with update? (y/N): ');
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log('\n🔄 Updating sacrifice destination...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'setSacrificeDestination',
			[targetEvmAddress],
			150_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'setSacrificeDestination',
			[targetEvmAddress],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ SUCCESS! Sacrifice destination updated');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Details:');
			console.log(`   Destination: ${targetId.toString()}`);

			if (targetId.toString() === '0.0.0') {
				console.log('   Mode: BURN');
			}
			else {
				console.log('   Mode: TRANSFER');
			}

			console.log('\n💡 This will apply to all future sacrifice operations');
		}
		else {
			console.log('❌ Failed to update:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Set Sacrifice Destination', gasInfo);

	}
	catch (error) {
		console.log('❌ Error updating sacrifice destination:', error.message);
	}
});
