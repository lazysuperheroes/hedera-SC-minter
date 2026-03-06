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
	if (process.argv.length < 6) {
		console.log('Usage: node updateBadge.js <badgeId> <name> <metadata> <maxSupply>');
		console.log('Example: node updateBadge.js 1 "Bronze Badge Updated" "ipfs://bronze-metadata-v2.json" 150');
		console.log('Example: node updateBadge.js 2 "Silver Badge" "ipfs://silver-metadata.json" 0');
		console.log('Note: maxSupply of 0 means unlimited supply');
		return;
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	const badgeId = parseInt(process.argv[2]);
	const badgeName = process.argv[3];
	const badgeMetadata = process.argv[4];
	const maxSupply = parseInt(process.argv[5]);

	console.log('\n===========================================');
	console.log('UPDATE BADGE');
	console.log('===========================================');
	console.log('Badge ID:', badgeId);
	console.log('New Name:', badgeName);
	console.log('New Metadata:', badgeMetadata);
	console.log('New Max Supply:', maxSupply === 0 ? 'Unlimited' : maxSupply);

	const proceed = readlineSync.question('\nProceed to update this badge? (y/N): ');
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
			'updateBadge',
			[badgeId, badgeName, badgeMetadata, maxSupply],
			600_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			minterIface,
			client,
			gasInfo.gasLimit,
			'updateBadge',
			[
				badgeId,
				badgeName,
				badgeMetadata,
				maxSupply,
			],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ Badge updated successfully!');
		}
		else {
			console.log('❌ Failed to update badge:', result[0]?.status?.toString());
			if (result[2]?.transactionId) {
				console.log('📝 Failed Transaction ID:', result[2].transactionId.toString());
			}
			if (result[0]?.status?.name === 'NotAdmin') {
				console.log('Error: You are not an admin of this contract.');
			}
			else if (result[0]?.status?.name === 'TypeNotFound') {
				console.log('Error: Badge ID not found.');
			}
			else if (result[0]?.status?.name === 'InsufficientTokenSupply') {
				console.log('Error: New max supply would exceed available token capacity.');
			}
		}

		// Centralized transaction result logging
		logTransactionResult(result, 'Badge Update', gasInfo);
	}
	catch (error) {
		console.log('❌ Error updating badge:', error.message);
	}
});
