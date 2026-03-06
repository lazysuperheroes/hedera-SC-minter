const { TokenId } = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const {
	contractExecuteFunction,
	readOnlyEVMFromMirrorNode,
} = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Parse arguments
	if (process.argv.length < 5) {
		console.log('Usage: node addDiscountTier.js <tokenId> <discountPercentage> <maxUsesPerSerial>');
		console.log('\nExample: node addDiscountTier.js 0.0.123456 25 8');
		console.log('   • tokenId: Token ID for this tier');
		console.log('   • discountPercentage: Discount % (e.g., 25 for 25%)');
		console.log('   • maxUsesPerSerial: Max times each serial can provide discount (e.g., 8)');
		return;
	}

	const tokenIdStr = process.argv[2];
	const discountPercentage = parseInt(process.argv[3]);
	const maxUsesPerSerial = parseInt(process.argv[4]);

	// Validate
	let tierTokenId;
	try {
		tierTokenId = TokenId.fromString(tokenIdStr);
	}
	catch {
		console.log('❌ Error: Invalid token ID');
		return;
	}

	if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
		console.log('❌ Error: Discount percentage must be 0-100');
		return;
	}

	if (isNaN(maxUsesPerSerial) || maxUsesPerSerial < 1) {
		console.log('❌ Error: Max uses per serial must be at least 1');
		return;
	}

	console.log('\n🎁 ForeverMinter - Add Discount Tier');
	console.log('=======================================\n');

	try {
		// Check if tier already exists for this token
		console.log('🔍 Checking for existing tier...\n');

		let existingTier = null;
		let isUpdate = false;

		try {
			// Try to get the tier index for this token
			const tierIndexCommand = iface.encodeFunctionData('getTokenTierIndex', [tierTokenId.toSolidityAddress()]);
			const tierIndexResult = await readOnlyEVMFromMirrorNode(env, contractId, tierIndexCommand, operatorId, false);
			const tierIndex = iface.decodeFunctionResult('getTokenTierIndex', tierIndexResult)[0];

			// If we got here, the token has a tier - fetch its details
			const tierCommand = iface.encodeFunctionData('getDiscountTier', [tierIndex]);
			const tierResult = await readOnlyEVMFromMirrorNode(env, contractId, tierCommand, operatorId, false);
			existingTier = iface.decodeFunctionResult('getDiscountTier', tierResult)[0];

			// Check if it's active (not marked as removed)
			if (Number(existingTier.discountPercentage) > 0) {
				isUpdate = true;
			}
		}
		catch (error) {
			// Token doesn't have a tier yet - this is fine, we're adding a new one
			if (!error.message.includes('InvalidParameter') && !error.message.includes('execution reverted')) {
				console.log('⚠️  Warning: Could not check existing tier:', error.message);
			}
		}

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		if (isUpdate) {
			console.log('⚠️  UPDATING EXISTING DISCOUNT TIER');
		} else {
			console.log('📋 New Discount Tier');
		}
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Token: ${tierTokenId.toString()}`);
		console.log(`Token Address: ${tierTokenId.toSolidityAddress()}`);

		if (isUpdate && existingTier) {
			console.log('\n🔄 CURRENT VALUES:');
			console.log(`   Discount Percentage: ${Number(existingTier.discountPercentage)}%`);
			console.log(`   Max Uses Per Serial: ${Number(existingTier.maxUsesPerSerial)}`);

			console.log('\n⭐ NEW VALUES:');
			console.log(`   Discount Percentage: ${discountPercentage}% ${Number(existingTier.discountPercentage) !== discountPercentage ? '← CHANGED' : ''}`);
			console.log(`   Max Uses Per Serial: ${maxUsesPerSerial} ${Number(existingTier.maxUsesPerSerial) !== maxUsesPerSerial ? '← CHANGED' : ''}`);
		} else {
			console.log(`Discount Percentage: ${discountPercentage}%`);
			console.log(`Max Uses Per Serial: ${maxUsesPerSerial}`);
		}

		console.log('\n💡 How it works:');
		console.log(`   Each serial of this token can be used ${maxUsesPerSerial} times`);
		console.log(`   Each use provides ${discountPercentage}% discount on one NFT`);
		console.log(`   Example: User owns serial #123 → can get ${discountPercentage}% off ${maxUsesPerSerial} mints`);

		if (isUpdate) {
			console.log('\n⚠️  WARNING: This will OVERWRITE the existing discount tier!');
			console.log('   • Any already-consumed uses will remain consumed');
			console.log('   • New max uses will apply to future mints');
			console.log('   • Discount percentage will change immediately');
		} else {
			console.log('\n⚠️  This will add a new discount tier to the contract');
		}
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const confirmMsg = isUpdate
			? 'Proceed with UPDATING this tier? (y/N): '
			: 'Proceed with adding tier? (y/N): ';

		const confirm = readlineSync.question(confirmMsg);
		if (confirm.toLowerCase() !== 'y') {
			console.log('❌ Cancelled');
			return;
		}

		console.log(isUpdate ? '\n🔄 Updating discount tier...\n' : '\n🔄 Adding discount tier...\n');

		const gasInfo = await estimateGas(
			env,
			contractId,
			iface,
			operatorId,
			'addDiscountTier',
			[tierTokenId.toSolidityAddress(), discountPercentage, maxUsesPerSerial],
			300_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			iface,
			client,
			gasInfo.gasLimit,
			'addDiscountTier',
			[tierTokenId.toSolidityAddress(), discountPercentage, maxUsesPerSerial],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log(isUpdate ? '✅ SUCCESS! Discount tier updated' : '✅ SUCCESS! Discount tier added');
			console.log(`   Transaction ID: ${result[2]?.transactionId?.toString()}`);

			console.log('\n📊 Tier Details:');
			console.log(`   Token: ${tierTokenId.toString()}`);
			console.log(`   Discount Percentage: ${discountPercentage}%`);
			console.log(`   Max Uses Per Serial: ${maxUsesPerSerial}`);

			if (isUpdate && existingTier) {
				console.log('\n📝 Changes Applied:');
				if (Number(existingTier.discountPercentage) !== discountPercentage) {
					console.log(`   Discount: ${Number(existingTier.discountPercentage)}% → ${discountPercentage}%`);
				}
				if (Number(existingTier.maxUsesPerSerial) !== maxUsesPerSerial) {
					console.log(`   Max Uses: ${Number(existingTier.maxUsesPerSerial)} → ${maxUsesPerSerial}`);
				}
			}

			console.log('\n💡 Verify with: node getContractInfo.js');
		}
		else {
			console.log(isUpdate ? '❌ Failed to update tier:' : '❌ Failed to add tier:', result[0]?.status?.toString());
		}

		logTransactionResult(result, 'Add Discount Tier', gasInfo);

	}
	catch (error) {
		console.log('❌ Error adding discount tier:', error.message);
	}
});
