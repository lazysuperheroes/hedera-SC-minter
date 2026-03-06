const { initScript, runScript } = require('../../lib/scriptBase');
const { readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const { operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	if (!jsonMode) {
		console.log('\n-Using ENVIRONMENT:', env);
		console.log('\n-Using Operator:', operatorId.toString());
		console.log('\n-Using contract:', contractId.toString());
	}

	try {
		// Get token information
		const tokenCommand = minterIface.encodeFunctionData('getToken');
		const tokenResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			tokenCommand,
			operatorId,
			false,
		);
		const tokenAddress = minterIface.decodeFunctionResult('getToken', tokenResult);

		const tokenInitialized = tokenAddress[0] !== '0x0000000000000000000000000000000000000000';
		let maxSupplyVal = null;
		let totalMintedVal = null;
		let remainingVal = null;

		if (tokenInitialized) {
			// Get max supply
			const maxSupplyCommand = minterIface.encodeFunctionData('getMaxSupply');
			const maxSupplyResult = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				maxSupplyCommand,
				operatorId,
				false,
			);
			const maxSupply = minterIface.decodeFunctionResult('getMaxSupply', maxSupplyResult);
			maxSupplyVal = Number(maxSupply[0]);

			// Get total minted
			const totalMintedCommand = minterIface.encodeFunctionData('totalMinted');
			const totalMintedResult = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				totalMintedCommand,
				operatorId,
				false,
			);
			const totalMinted = minterIface.decodeFunctionResult('totalMinted', totalMintedResult);
			totalMintedVal = Number(totalMinted[0]);

			// Get remaining supply
			const remainingCommand = minterIface.encodeFunctionData('getRemainingSupply');
			const remainingResult = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				remainingCommand,
				operatorId,
				false,
			);
			const remainingSupply = minterIface.decodeFunctionResult('getRemainingSupply', remainingResult);
			remainingVal = Number(remainingSupply[0]);
		}

		// Get admin information
		const adminsCommand = minterIface.encodeFunctionData('getAdmins');
		const adminsResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			adminsCommand,
			operatorId,
			false,
		);
		const adminList = minterIface.decodeFunctionResult('getAdmins', adminsResult);

		// Check if operator is admin
		const isAdminCommand = minterIface.encodeFunctionData('isAdmin', [operatorId.toSolidityAddress()]);
		const isAdminResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			isAdminCommand,
			operatorId,
			false,
		);
		const isAdmin = minterIface.decodeFunctionResult('isAdmin', isAdminResult);

		// Get active badge information
		const activeBadgesCommand = minterIface.encodeFunctionData('getActiveBadgeIds');
		const activeBadgesResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			activeBadgesCommand,
			operatorId,
			false,
		);
		const activeBadgeIds = minterIface.decodeFunctionResult('getActiveBadgeIds', activeBadgesResult);

		const badgeSummaries = [];
		if (activeBadgeIds[0].length > 0) {
			for (let i = 0; i < Math.min(5, activeBadgeIds[0].length); i++) {
				const badgeId = Number(activeBadgeIds[0][i]);

				const badgeCommand = minterIface.encodeFunctionData('getBadge', [badgeId]);
				const badgeResult = await readOnlyEVMFromMirrorNode(
					env,
					contractId,
					badgeCommand,
					operatorId,
					false,
				);
				const [name, , totalMinted, maxSupply] = minterIface.decodeFunctionResult('getBadge', badgeResult);

				badgeSummaries.push({
					badgeId,
					name,
					totalMinted: Number(totalMinted),
					maxSupply: Number(maxSupply),
				});
			}
		}

		// Get capacity analysis
		let capacityData = null;
		try {
			const capacityCommand = minterIface.encodeFunctionData('getCapacityAnalysis');
			const capacityResult = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				capacityCommand,
				operatorId,
				false,
			);
			const [tokenMaxSupply, tokenMinted, tokenRemaining, totalBadgeCapacity, reservedCapacity, hasUnlimitedBadges] = minterIface.decodeFunctionResult('getCapacityAnalysis', capacityResult);

			capacityData = {
				tokenMaxSupply: Number(tokenMaxSupply),
				tokenMinted: Number(tokenMinted),
				tokenRemaining: Number(tokenRemaining),
				totalBadgeCapacity: Number(totalBadgeCapacity),
				reservedCapacity: Number(reservedCapacity),
				hasUnlimitedBadges,
			};
		}
		catch (error) {
			capacityData = null;
		}

		// Get revocable status from contract
		let revocableVal = null;
		try {
			const revocableCommand = minterIface.encodeFunctionData('REVOCABLE');
			const revocableResult = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				revocableCommand,
				operatorId,
				false,
			);
			const revocable = minterIface.decodeFunctionResult('REVOCABLE', revocableResult);
			revocableVal = revocable[0];
		}
		catch (error) {
			revocableVal = null;
		}

		// JSON output
		if (jsonMode) {
			console.log(JSON.stringify({
				contractId: contractId.toString(),
				contractType: 'SoulboundBadgeMinter',
				token: {
					initialized: tokenInitialized,
					address: tokenAddress[0],
					maxSupply: maxSupplyVal,
					totalMinted: totalMintedVal,
					remaining: remainingVal,
				},
				admins: {
					count: adminList[0].length,
					addresses: adminList[0].map(a => a),
					operatorIsAdmin: isAdmin[0],
				},
				activeBadges: {
					count: activeBadgeIds[0].length,
					ids: activeBadgeIds[0].map(id => Number(id)),
					badges: badgeSummaries,
				},
				capacity: capacityData,
				revocable: revocableVal,
			}, null, 2));
			return;
		}

		// Display output
		console.log('\n===========================================');
		console.log('CONTRACT INFORMATION');
		console.log('===========================================');

		console.log('\n📋 Token Information:');
		if (!tokenInitialized) {
			console.log('Token: ❌ Not initialized');
		}
		else {
			console.log('Token Address:', tokenAddress[0]);
			console.log('Max Supply:', maxSupplyVal > 1000000000 ? 'Unlimited' : maxSupplyVal);
			console.log('Total Minted:', totalMintedVal);
			console.log('Remaining Supply:', remainingVal > 1000000000 ? 'Unlimited' : remainingVal);
		}

		// Get admin information
		console.log('\n👥 Admin Information:');
		console.log(`Total Admins: ${adminList[0].length}`);
		console.log('You are admin:', isAdmin[0] ? '✅ Yes' : '❌ No');

		// Get active badge information
		console.log('\n🏅 Badge Information:');
		console.log(`Active Badges: ${activeBadgeIds[0].length}`);

		if (badgeSummaries.length > 0) {
			for (const badge of badgeSummaries) {
				console.log(`  ${badge.badgeId}: ${badge.name} (${badge.totalMinted}/${badge.maxSupply === 0 ? '∞' : badge.maxSupply})`);
			}

			if (activeBadgeIds[0].length > 5) {
				console.log(`  ... and ${activeBadgeIds[0].length - 5} more`);
			}
		}

		// Get capacity analysis
		console.log('\n📊 Capacity Analysis:');
		if (capacityData) {
			console.log('Token Max Supply:', capacityData.tokenMaxSupply > 1000000000 ? 'Unlimited' : capacityData.tokenMaxSupply);
			console.log('Token Minted:', capacityData.tokenMinted);
			console.log('Token Remaining:', capacityData.tokenRemaining > 1000000000 ? 'Unlimited' : capacityData.tokenRemaining);
			console.log('Total Badge Capacity:', capacityData.totalBadgeCapacity > 1000000000 ? 'Unlimited' : capacityData.totalBadgeCapacity);
			console.log('Reserved Capacity:', capacityData.reservedCapacity > 1000000000 ? 'Unlimited' : capacityData.reservedCapacity);
			console.log('Has Unlimited Badges:', capacityData.hasUnlimitedBadges ? 'Yes' : 'No');

			// Calculate utilization if not unlimited
			if (capacityData.tokenMaxSupply <= 1000000000 && capacityData.totalBadgeCapacity <= 1000000000) {
				const utilization = capacityData.totalBadgeCapacity > 0 ?
					((capacityData.tokenMinted / capacityData.totalBadgeCapacity) * 100).toFixed(2) : 0;
				console.log('Capacity Utilization:', `${utilization}%`);
			}
		}
		else {
			console.log('Capacity analysis not available');
		}

		// Contract version and features
		console.log('\n🔧 Contract Features:');
		console.log('Contract Type: SoulboundBadgeMinter');
		console.log('Multi-Badge Support: ✅ Yes');
		console.log('Whitelist Management: ✅ Yes');
		console.log('Admin Management: ✅ Yes');

		if (revocableVal !== null) {
			console.log('Revocable SBTs:', revocableVal ? '✅ Yes' : '❌ No');
		}
		else {
			console.log('Revocable SBTs: ❓ Could not determine');
		}

	}
	catch (error) {
		console.log('❌ Error fetching contract information:', error.message);
	}
});
