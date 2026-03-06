const {
	TokenId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const { contractExecuteFunction, readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');
const { setNFTAllowanceAll } = require('../../../utils/hederaHelpers');
const { estimateGas, logTransactionResult } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	// Check for required arguments
	if (process.argv.length < 3) {
		console.log('Usage: node burnBadge.js <serial1> [serial2] [serial3] ...');
		console.log('Examples:');
		console.log('  node burnBadge.js 123                   # Burn NFT with serial 123');
		console.log('  node burnBadge.js 123 124 125           # Burn NFTs with serials 123, 124, 125');
		console.log('  node burnBadge.js 100,101,102           # Burn NFTs with serials 100, 101, 102');
		return;
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	// Parse serial numbers from arguments
	let serialNumbers = [];

	// Check if using comma-separated format
	if (process.argv.length === 3 && process.argv[2].includes(',')) {
		serialNumbers = process.argv[2].split(',').map(s => parseInt(s.trim()));
	}
	else {
		// Space-separated format
		for (let i = 2; i < process.argv.length; i++) {
			const serial = parseInt(process.argv[i]);
			if (isNaN(serial)) {
				console.log(`❌ Error: Invalid serial number "${process.argv[i]}"`);
				return;
			}
			serialNumbers.push(serial);
		}
	}

	// Validate serial numbers
	if (serialNumbers.length === 0) {
		console.log('❌ Error: No valid serial numbers provided');
		return;
	}

	if (serialNumbers.length > 10) {
		console.log('❌ Error: Cannot burn more than 10 NFTs at once');
		return;
	}

	// Check for duplicates
	const uniqueSerials = [...new Set(serialNumbers)];
	if (uniqueSerials.length !== serialNumbers.length) {
		console.log('❌ Error: Duplicate serial numbers detected');
		return;
	}

	try {
		// Get token address
		const tokenCommand = minterIface.encodeFunctionData('getToken');
		const tokenResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			tokenCommand,
			operatorId,
			false,
		);
		const tokenAddress = minterIface.decodeFunctionResult('getToken', tokenResult);

		if (tokenAddress[0] === '0x0000000000000000000000000000000000000000') {
			console.log('❌ Error: Token not initialized.');
			return;
		}

		const tokenId = TokenId.fromSolidityAddress(tokenAddress[0]);

		// Get badge information for each serial
		console.log('\n📋 Checking badge information...');
		const badgeInfo = [];

		for (const serial of serialNumbers) {
			try {
				const serialCommand = minterIface.encodeFunctionData('getSerialBadgeId', [serial]);
				const serialResult = await readOnlyEVMFromMirrorNode(
					env,
					contractId,
					serialCommand,
					operatorId,
					false,
				);
				const badgeId = minterIface.decodeFunctionResult('getSerialBadgeId', serialResult);

				// Get badge details
				const badgeCommand = minterIface.encodeFunctionData('getBadge', [Number(badgeId[0])]);
				const badgeResult = await readOnlyEVMFromMirrorNode(
					env,
					contractId,
					badgeCommand,
					operatorId,
					false,
				);
				const [name, metadata] = minterIface.decodeFunctionResult('getBadge', badgeResult);

				badgeInfo.push({
					serial: serial,
					badgeId: Number(badgeId[0]),
					name: name,
					metadata: metadata,
				});
			}
			catch {
				console.log(`❌ Error: Serial ${serial} not found or invalid`);
				return;
			}
		}

		console.log('\n===========================================');
		console.log('BURN BADGES');
		console.log('===========================================');
		console.log('Token:', tokenId.toString());
		console.log('Account:', operatorId.toString());
		console.log('Serial Count:', serialNumbers.length);

		console.log('\nBadges to burn:');
		badgeInfo.forEach(info => {
			console.log(`  Serial ${info.serial}: ${info.name} (Badge ID: ${info.badgeId})`);
		});

		// Warning about burning
		console.log('\n⚠️  WARNING: Burning is permanent and cannot be undone!');
		console.log('⚠️  This will reduce your mint count for each badge type.');

		const proceed = readlineSync.question('\nProceed with burning? (y/N): ');
		if (proceed.toLowerCase() !== 'y') {
			console.log('Cancelled.');
			return;
		}

		// Set NFT allowance so contract can transfer the NFTs back for burning
		console.log('\n📋 Setting NFT allowance for burning...');
		try {
			const allowanceResult = await setNFTAllowanceAll(
				client,
				[tokenId],
				operatorId,
				contractId,
			);

			if (allowanceResult !== 'SUCCESS') {
				console.log('❌ Failed to set NFT allowance:', allowanceResult);
				return;
			}
			console.log('✅ NFT allowance set successfully');
		}
		catch (error) {
			console.log('❌ Error setting NFT allowance:', error.message);
			return;
		}

		console.log('\n🔥 Burning badges...');

		// Estimate gas for the operation
		const gasInfo = await estimateGas(
			env,
			contractId,
			minterIface,
			operatorId,
			'burnNFTs',
			[serialNumbers],
			800_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			minterIface,
			client,
			gasInfo.gasLimit,
			'burnNFTs',
			[serialNumbers],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			const newTotalSupply = Number(result[1][0]);
			console.log('✅ Badges burned successfully!');
			console.log('Burned Serials:', serialNumbers);
			console.log('New Total Supply:', newTotalSupply);

			// Show updated mint counts
			console.log('\n📊 Updated badge counts:');
			const badgeIds = [...new Set(badgeInfo.map(info => info.badgeId))];

			try {
				const countsCommand = minterIface.encodeFunctionData('getUserBadgeMintCounts', [operatorId.toSolidityAddress(), badgeIds]);
				const countsResult = await readOnlyEVMFromMirrorNode(
					env,
					contractId,
					countsCommand,
					operatorId,
					false,
				);
				const mintCounts = minterIface.decodeFunctionResult('getUserBadgeMintCounts', countsResult);

				badgeIds.forEach((badgeId, index) => {
					const badgeName = badgeInfo.find(info => info.badgeId === badgeId)?.name || `Badge ${badgeId}`;
					console.log(`  ${badgeName}: ${Number(mintCounts[0][index])} owned`);
				});
			}
			catch {
				console.log('Note: Could not retrieve updated mint counts');
			}
		}
		else {
			console.log('❌ Failed to burn badges:', result[0]?.status?.toString());
			if (result[0]?.status?.name === 'BurnFailed') {
				console.log('Error: Burn operation failed.');
			}
			else if (result[0]?.status?.name === 'NFTTransferFailed') {
				console.log('Error: Failed to transfer NFTs back to contract for burning.');
			}
			else if (result[0]?.status?.name === 'UnFreezingFailed') {
				console.log('Error: Failed to unfreeze tokens for burning.');
			}
			else if (result[0]?.status?.name === 'MaxSerialsExceeded') {
				console.log('Error: Too many serials specified (max 10).');
			}
		}

		// Centralized transaction result logging
		logTransactionResult(result, 'Badge Burning', gasInfo);

	}
	catch (error) {
		console.log('❌ Error during burning:', error.message);
	}
});
