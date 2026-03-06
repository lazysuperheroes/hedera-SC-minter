const {
	AccountId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const { contractExecuteFunction } = require('../../../utils/solidityHelpers');
const { homebrewPopulateAccountEvmAddress } = require('../../../utils/hederaMirrorHelpers');
const { estimateGas, logTransactionResult } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	// Check for required arguments
	if (process.argv.length < 3) {
		console.log('Usage: node transferHbar.js <amount> [recipient]');
		console.log('Example: node transferHbar.js 1000000      # Transfer 0.01 HBAR to operator');
		console.log('Example: node transferHbar.js 1000000 0.0.12345  # Transfer 0.01 HBAR to specific account');
		console.log('Note: amount is in tinybar (1 HBAR = 100,000,000 tinybar)');
		return;
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	const amount = parseInt(process.argv[2]);
	const recipientInput = process.argv.length > 3 ? process.argv[3] : operatorId.toString();

	// Convert recipient to EVM address
	let recipientEvmAddress;
	if (recipientInput.startsWith('0.0.')) {
		const accountId = AccountId.fromString(recipientInput);
		try {
			recipientEvmAddress = await homebrewPopulateAccountEvmAddress(env, accountId);
		}
		catch {
			recipientEvmAddress = accountId.toSolidityAddress();
		}
	}
	else if (recipientInput.startsWith('0x')) {
		recipientEvmAddress = recipientInput;
	}
	else {
		console.log('Invalid account format. Use either 0.0.xxxxx or 0x...');
		return;
	}

	const amountInHbar = amount / 100_000_000;

	console.log('\n===========================================');
	console.log('TRANSFER HBAR FROM CONTRACT');
	console.log('===========================================');
	console.log('Amount (tinybar):', amount.toLocaleString());
	console.log('Amount (HBAR):', amountInHbar.toFixed(8));
	console.log('Recipient:', recipientInput);
	console.log('Recipient EVM:', recipientEvmAddress);

	console.log('\n⚠️  WARNING: This will transfer HBAR from the contract to the specified address.');
	console.log('⚠️  Make sure the contract has sufficient balance.');

	const proceed = readlineSync.question('\nProceed with HBAR transfer? (y/N): ');
	if (proceed.toLowerCase() !== 'y') {
		console.log('Cancelled.');
		return;
	}

	try {
		console.log('\n💰 Transferring HBAR...');

		// Estimate gas for the operation
		const gasInfo = await estimateGas(
			env,
			contractId,
			minterIface,
			operatorId,
			'transferHbar',
			[recipientEvmAddress, amount],
			300_000,
		);

		const result = await contractExecuteFunction(
			contractId,
			minterIface,
			client,
			gasInfo.gasLimit,
			'transferHbar',
			[
				recipientEvmAddress,
				amount,
			],
		);

		if (result[0]?.status?.toString() === 'SUCCESS') {
			console.log('✅ HBAR transferred successfully!');
		}
		else {
			console.log('❌ Failed to transfer HBAR:', result[0]?.status?.toString());
			if (result[2]?.transactionId) {
				console.log('📝 Failed Transaction ID:', result[2].transactionId.toString());
			}
			if (result[0]?.status?.name === 'NotAdmin') {
				console.log('Error: You are not an admin of this contract.');
			}
			else if (result[0]?.status?.name === 'INSUFFICIENT_PAYER_BALANCE') {
				console.log('Error: Contract has insufficient HBAR balance.');
			}
			else if (result[0]?.status?.name === 'INVALID_RECEIVING_NODE_ACCOUNT') {
				console.log('Error: Invalid recipient address.');
			}
		}

		// Centralized transaction result logging
		logTransactionResult(result, 'HBAR Transfer', gasInfo);
	}
	catch (error) {
		console.log('❌ Error transferring HBAR:', error.message);
	}
});
