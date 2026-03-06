const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	// Check for required arguments
	if (process.argv.length !== 4) {
		console.log('Usage: node activateBadge.js <badgeId> <active>');
		console.log('Example: node activateBadge.js 1 true    # Activate badge 1');
		console.log('Example: node activateBadge.js 2 false   # Deactivate badge 2');
		return;
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	const badgeId = parseInt(process.argv[2]);
	const activeString = process.argv[3].toLowerCase();

	if (!['true', 'false'].includes(activeString)) {
		console.log('Error: active parameter must be "true" or "false"');
		return;
	}

	const active = activeString === 'true';

	console.log('\n===========================================');
	console.log(active ? 'ACTIVATE BADGE' : 'DEACTIVATE BADGE');
	console.log('===========================================');
	console.log('Badge ID:', badgeId);
	console.log('Action:', active ? 'Activate' : 'Deactivate');

	if (!active) {
		console.log('\n⚠️  WARNING: Deactivating a badge will:');
		console.log('   - Prevent new mints of this badge type');
		console.log('   - Remove it from active badge listings');
		console.log('   - Keep existing NFTs intact');
	}

	const proceed = readlineSync.question(`\nProceed to ${active ? 'activate' : 'deactivate'} this badge? (y/N): `);
	if (proceed.toLowerCase() !== 'y') {
		console.log('Cancelled.');
		return;
	}

	try {
		// Estimate gas for the operation
		const gasInfo = await estimateGas(
			env,
			contractId,
			minterIface,
			operatorId,
			'setBadgeActive',
			[badgeId, active],
			400_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			minterIface,
			client,
			gasInfo.gasLimit,
			'setBadgeActive',
			[
				badgeId,
				active,
			],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log(`✅ Badge ${active ? 'activated' : 'deactivated'} successfully!`);
		}
		else {
			console.log(`❌ Failed to ${active ? 'activate' : 'deactivate'} badge:`, result[0]?.status?.toString());
			if (result[2]?.transactionId) {
				console.log('📝 Failed Transaction ID:', result[2].transactionId.toString());
			}
			if (result[0]?.status?.name === 'NotAdmin') {
				console.log('Error: You are not an admin of this contract.');
			}
			else if (result[0]?.status?.name === 'TypeNotFound') {
				console.log('Error: Badge ID not found.');
			}
		}

		// Centralized transaction result logging
		logTransactionResult(result, `Badge ${active ? 'Activation' : 'Deactivation'}`, gasInfo);
	}
	catch (error) {
		console.log(`❌ Error ${active ? 'activating' : 'deactivating'} badge:`, error.message);
	}
});
