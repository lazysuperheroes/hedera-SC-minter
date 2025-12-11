const {
	Client,
	AccountId,
	PrivateKey,
	ContractId,
	TokenId,
} = require('@hashgraph/sdk');
require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');
const readlineSync = require('readline-sync');
const {
	contractExecuteFunction,
	readOnlyEVMFromMirrorNode,
} = require('../../../../utils/solidityHelpers');
const { estimateGas, logTransactionResult } = require('../../../../utils/gasHelpers');

const operatorKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY);
const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
const contractName = 'ForeverMinter';
const contractId = ContractId.fromString(process.env.FOREVER_MINTER_CONTRACT_ID || '');
const env = process.env.ENVIRONMENT ?? null;
let client;

const main = async () => {
	if (!operatorId || !operatorKey || !contractId || contractId.toString() === '0.0.0') {
		console.log('❌ Error: Missing configuration in .env file');
		return;
	}

	// Parse arguments
	if (process.argv.length < 4) {
		console.log('Usage: node manageDiscountUsage.js <action> <tokenId> [serials...]');
		console.log('\nActions:');
		console.log('  query  - Check current discount usage for serials');
		console.log('  reset  - Reset discount usage for serials (admin only)');
		console.log('\nExamples:');
		console.log('  node manageDiscountUsage.js query 0.0.123456 1 2 3 5 8');
		console.log('  node manageDiscountUsage.js reset 0.0.123456 1 2 3');
		console.log('\nNote: For query, you can check multiple serials at once');
		console.log('      For reset, you can reset multiple serials at once (requires admin role)');
		return;
	}

	const action = process.argv[2].toLowerCase();
	const tokenIdStr = process.argv[3];
	const serials = process.argv.slice(4).map(s => parseInt(s));

	// Validate action
	if (!['query', 'reset'].includes(action)) {
		console.log('❌ Error: Invalid action. Must be "query" or "reset"');
		return;
	}

	// Validate token ID
	let discountTokenId;
	try {
		discountTokenId = TokenId.fromString(tokenIdStr);
	}
	catch {
		console.log('❌ Error: Invalid token ID');
		return;
	}

	// Validate serials
	if (serials.length === 0) {
		console.log('❌ Error: Must provide at least one serial number');
		return;
	}

	if (serials.some(s => isNaN(s) || s < 1)) {
		console.log('❌ Error: Invalid serial number(s). All serials must be positive integers');
		return;
	}

	console.log('\n🎯 ForeverMinter - Manage Discount Usage');
	console.log('============================================\n');

	// Setup client
	if (env.toUpperCase() == 'TEST') {
		client = Client.forTestnet();
	}
	else if (env.toUpperCase() == 'MAIN') {
		client = Client.forMainnet();
	}
	else if (env.toUpperCase() == 'PREVIEW') {
		client = Client.forPreviewnet();
	}
	else if (env.toUpperCase() == 'LOCAL') {
		const node = { '127.0.0.1:50211': new AccountId(3) };
		client = Client.forNetwork(node).setMirrorNetwork('127.0.0.1:5600');
	}
	else {
		console.log('❌ Error: Invalid ENVIRONMENT in .env file');
		return;
	}

	client.setOperator(operatorId, operatorKey);

	// Load ABI
	const json = JSON.parse(fs.readFileSync(`./artifacts/contracts/${contractName}.sol/${contractName}.json`));
	const minterIface = new ethers.Interface(json.abi);

	try {
		// Check if token is a discount token
		console.log('🔍 Verifying discount token configuration...\n');

		const tierIndexCommand = minterIface.encodeFunctionData('getTokenTierIndex', [discountTokenId.toSolidityAddress()]);
		let tierIndex;
		try {
			const tierIndexResult = await readOnlyEVMFromMirrorNode(env, contractId, tierIndexCommand, operatorId, false);
			tierIndex = minterIface.decodeFunctionResult('getTokenTierIndex', tierIndexResult)[0];
		}
		catch {
			console.log(`❌ Error: Token ${discountTokenId.toString()} is not configured as a discount token`);
			console.log('\n💡 Tip: Use addDiscountTier.js to add this token as a discount token first');
			return;
		}

		// Get tier details
		const tierCommand = minterIface.encodeFunctionData('getDiscountTier', [tierIndex]);
		const tierResult = await readOnlyEVMFromMirrorNode(env, contractId, tierCommand, operatorId, false);
		const tier = minterIface.decodeFunctionResult('getDiscountTier', tierResult)[0];
		const discountPercentage = Number(tier.discountPercentage);
		const maxUsesPerSerial = Number(tier.maxUsesPerSerial);

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Discount Token Configuration');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
		console.log(`Token: ${discountTokenId.toString()}`);
		console.log(`Discount: ${discountPercentage}%`);
		console.log(`Max Uses Per Serial: ${maxUsesPerSerial}`);
		console.log('');

		// Query current usage
		console.log('🔍 Querying discount usage...\n');

		const usageCommand = minterIface.encodeFunctionData('getBatchSerialDiscountUsage', [
			discountTokenId.toSolidityAddress(),
			serials,
		]);
		const usageResult = await readOnlyEVMFromMirrorNode(env, contractId, usageCommand, operatorId, false);
		const usageCounts = minterIface.decodeFunctionResult('getBatchSerialDiscountUsage', usageResult)[0];

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📊 Current Discount Usage');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		const serialsWithUsage = [];
		const serialsExhausted = [];
		const serialsUnused = [];

		for (let i = 0; i < serials.length; i++) {
			const serial = serials[i];
			const used = Number(usageCounts[i]);
			const remaining = maxUsesPerSerial - used;
			const percentUsed = ((used / maxUsesPerSerial) * 100).toFixed(1);

			let status;
			if (used === 0) {
				status = '✅ UNUSED';
				serialsUnused.push(serial);
			}
			else if (remaining === 0) {
				status = '❌ EXHAUSTED';
				serialsExhausted.push(serial);
			}
			else {
				status = '🟡 ACTIVE';
				serialsWithUsage.push(serial);
			}

			console.log(`Serial #${serial}:`);
			console.log(`   Status: ${status}`);
			console.log(`   Used: ${used}/${maxUsesPerSerial} (${percentUsed}%)`);
			console.log(`   Remaining: ${remaining}`);
			console.log('');
		}

		// Summary
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📈 Summary');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
		console.log(`Total Serials Checked: ${serials.length}`);
		console.log(`✅ Unused: ${serialsUnused.length}`);
		console.log(`🟡 Partially Used: ${serialsWithUsage.length}`);
		console.log(`❌ Exhausted: ${serialsExhausted.length}`);
		console.log('');

		// If query action, we're done
		if (action === 'query') {
			console.log('✅ Query complete!\n');
			return;
		}

		// Reset action - requires confirmation and admin rights
		if (action === 'reset') {
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
			console.log('⚠️  RESET DISCOUNT USAGE');
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

			// Filter to only serials that have usage
			const serialsToReset = serials.filter((serial, i) => Number(usageCounts[i]) > 0);

			if (serialsToReset.length === 0) {
				console.log('ℹ️  All selected serials already have zero usage. Nothing to reset.\n');
				return;
			}

			console.log('⚠️  WARNING: This will reset discount usage for the following serials:\n');
			for (const serial of serialsToReset) {
				const index = serials.indexOf(serial);
				const used = Number(usageCounts[index]);
				console.log(`   Serial #${serial}: ${used} → 0 uses`);
			}

			console.log('\n💡 After reset, these serials will have their full discount uses available again.');
			console.log('   This is useful when serials return to the team or for promotional resets.\n');

			const confirmReset = readlineSync.keyInYNStrict('Do you want to proceed with the reset?');
			if (!confirmReset) {
				console.log('\n❌ Reset cancelled by user\n');
				return;
			}

			// Check admin status
			console.log('\n🔐 Verifying admin rights...');
			const isAdminCommand = minterIface.encodeFunctionData('isAdmin', [operatorId.toSolidityAddress()]);
			const isAdminResult = await readOnlyEVMFromMirrorNode(env, contractId, isAdminCommand, operatorId, false);
			const isAdmin = minterIface.decodeFunctionResult('isAdmin', isAdminResult)[0];

			if (!isAdmin) {
				console.log(`❌ Error: Account ${operatorId.toString()} is not an admin`);
				console.log('   Only admins can reset discount usage\n');
				return;
			}

			console.log('✅ Admin rights confirmed\n');

			// Estimate gas
			console.log('⛽ Estimating gas...\n');

			const funcName = 'resetSerialDiscountUsage';
			const params = [discountTokenId.toSolidityAddress(), serialsToReset];
			const encodedCommand = minterIface.encodeFunctionData(funcName, params);

			const { gasLimit, gasPrice } = await estimateGas(
				env,
				contractId,
				encodedCommand,
				operatorId,
				150_000 + (serialsToReset.length * 25_000),
				// Base + per serial
			);

			console.log(`   Gas Limit: ${gasLimit.toLocaleString()}`);
			console.log(`   Gas Price: ${gasPrice} tinybar/gas`);
			console.log(`   Estimated Cost: ${(gasLimit * gasPrice * 1e-8).toFixed(5)} HBAR`);
			console.log('');

			// Execute reset
			console.log('📝 Resetting discount usage...\n');

			const gasLimitFinal = Math.floor(gasLimit * 1.1);
			// Add 10% buffer

			const result = await contractExecuteFunction(
				contractId,
				minterIface,
				client,
				gasLimitFinal,
				funcName,
				params,
			);

			logTransactionResult(result, 'Reset Discount Usage');

			console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
			console.log('✅ Reset Complete!');
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

			console.log('🎉 Discount usage has been reset for:');
			for (const serial of serialsToReset) {
				console.log(`   • Serial #${serial} → ${maxUsesPerSerial} uses available`);
			}
			console.log('');
		}

	}
	catch (error) {
		console.log('\n❌ Error:', error.message);
		console.log('\nFull error:', error);
	}
	finally {
		if (client) {
			client.close();
		}
	}
};

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
