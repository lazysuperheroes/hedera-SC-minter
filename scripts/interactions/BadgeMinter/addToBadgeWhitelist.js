const {
	AccountId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const { contractExecuteFunction, readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');
const { homebrewPopulateAccountEvmAddress, homebrewPopulateAccountNum } = require('../../../utils/hederaMirrorHelpers');
const { estimateGas, logTransactionResult } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	// Check for required arguments
	if (process.argv.length < 5) {
		console.log('Usage: node addToBadgeWhitelist.js <badgeId> <accountsList> <quantitiesList>');
		console.log('Example: node addToBadgeWhitelist.js 1 "0.0.12345,0.0.12346" "2,1"');
		console.log('Example: node addToBadgeWhitelist.js 2 "0.0.12345,0x123abc" "0,0"');
		console.log('Note: quantity of 0 means unlimited mints for that address');
		return;
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	const badgeId = parseInt(process.argv[2]);
	const accountsInput = process.argv[3];
	const quantitiesInput = process.argv[4];

	// Parse comma-separated lists
	const accountStrings = accountsInput.split(',').map(s => s.trim());
	const quantities = quantitiesInput.split(',').map(s => parseInt(s.trim()));

	if (accountStrings.length !== quantities.length) {
		console.log('Error: Number of accounts must match number of quantities');
		return;
	}

	// Convert accounts to EVM addresses
	const evmAddresses = [];
	for (let i = 0; i < accountStrings.length; i++) {
		const accountString = accountStrings[i];
		try {
			let evmAddress;
			if (accountString.startsWith('0.0.')) {
				// Hedera account ID format - use homebrewPopulateAccountEvmAddress for proper EVM routing
				const accountId = AccountId.fromString(accountString);
				try {
					evmAddress = await homebrewPopulateAccountEvmAddress(env, accountId);
				}
				catch {
					evmAddress = accountId.toSolidityAddress();
				}
			}
			else if (accountString.startsWith('0x')) {
				// Already EVM address
				evmAddress = accountString;
				accountStrings[i] = (await homebrewPopulateAccountNum(env, accountString)).toString();
			}
			else {
				// Try to lookup account by alias using mirror node
				console.log(`Looking up account: ${accountString}`);
				const lookupResult = await homebrewPopulateAccountEvmAddress(env, accountString);
				if (lookupResult) {
					evmAddress = lookupResult;
				}
				else {
					throw new Error(`Could not resolve account: ${accountString}`);
				}
			}
			evmAddresses.push(evmAddress);
		}
		catch (error) {
			console.log(`Error processing account ${accountString}:`, error.message);
			return;
		}
	}

	console.log('\n===========================================');
	console.log('ADD TO BADGE WHITELIST');
	console.log('===========================================');
	console.log('Badge ID:', badgeId);

	// Check current whitelist status for each address
	console.log('\nValidating accounts...');
	const validationResults = [];

	// Fetch the entire whitelist for this badge once
	const existingWhitelist = { addresses: [], quantities: [] };
	try {
		const whitelistCommand = minterIface.encodeFunctionData('getBadgeWhitelist', [badgeId]);
		const whitelistResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			whitelistCommand,
			operatorId,
			false,
		);
		const decoded = minterIface.decodeFunctionResult('getBadgeWhitelist', whitelistResult);
		existingWhitelist.addresses = decoded[0].map(addr => addr.toLowerCase());
		existingWhitelist.quantities = decoded[1].map(q => Number(q));
	}
	catch (error) {
		console.log('Note: Could not fetch existing whitelist:', error.message);
	}

	for (let i = 0; i < accountStrings.length; i++) {
		const evmAddress = evmAddresses[i];
		const accountString = accountStrings[i];
		const quantity = quantities[i];

		// Check if address is already in whitelist
		const existingIndex = existingWhitelist.addresses.indexOf(evmAddress.toLowerCase());
		const isAlreadyWhitelisted = existingIndex !== -1;
		const currentWLQuantity = isAlreadyWhitelisted ? existingWhitelist.quantities[existingIndex] : 0;

		validationResults.push({
			accountString,
			evmAddress,
			quantity,
			currentWLQuantity,
			isAlreadyWhitelisted,
		});
	} console.log('\nAccounts to whitelist:');
	let hasWarnings = false;

	for (let i = 0; i < validationResults.length; i++) {
		const result = validationResults[i];
		console.log(`  ${i + 1}. ${result.accountString} (${result.evmAddress})`);
		console.log(`     New Quantity: ${result.quantity === 0 ? 'Unlimited' : result.quantity}`);

		if (result.isAlreadyWhitelisted) {
			console.log(`     ⚠️  Already whitelisted with ${result.currentWLQuantity === 0 ? 'unlimited' : result.currentWLQuantity} allocation`);
			hasWarnings = true;
		}
		else {
			console.log('     ✅ New user - no previous allocation');
		}
	} if (hasWarnings) {
		console.log('\n⚠️  WARNING: Some accounts are already whitelisted or have validation issues.');
		console.log('Adding them again will UPDATE their whitelist allocation.');
	}

	const proceed = readlineSync.question('\nProceed to add these addresses to the whitelist? (y/N): ');
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
			'addToBadgeWhitelist',
			[badgeId, evmAddresses, quantities],
			600_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			minterIface,
			client,
			gasInfo.gasLimit,
			'addToBadgeWhitelist',
			[
				badgeId,
				evmAddresses,
				quantities,
			],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ Addresses added to whitelist successfully!');
		}

		// Centralized transaction result logging
		logTransactionResult(result, 'Whitelist Update', gasInfo);
	}
	catch (error) {
		console.log('❌ Error adding to whitelist:', error.message);
	}
});
