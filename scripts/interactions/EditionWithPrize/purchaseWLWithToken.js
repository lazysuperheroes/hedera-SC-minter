const {
	AccountId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const {
	contractExecuteFunction,
	readOnlyEVMFromMirrorNode,
} = require('../../../utils/solidityHelpers');
const { estimateGas } = require('../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: abi } = initScript({
		contractName: 'EditionWithPrize',
		contractEnvVar: 'EDITION_WITH_PRIZE_CONTRACT_ID',
	});

	console.log('\n╔══════════════════════════════════════════╗');
	console.log('║   Purchase WL Spot with Token Holding   ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Check WL purchase requirements
		console.log('\n📊 Checking WL purchase requirements...');

		const wlTokenCmd = abi.encodeFunctionData('wlPurchaseToken');
		const wlTokenResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlTokenCmd,
			operatorId,
			false,
		);
		const wlToken = abi.decodeFunctionResult('wlPurchaseToken', wlTokenResult)[0];

		if (wlToken === '0x0000000000000000000000000000000000000000') {
			console.log('❌ ERROR: Token WL purchase is disabled');
			console.log('   Contact contract owner to configure');
			return;
		}

		const wlSerialCmd = abi.encodeFunctionData('wlPurchaseSerial');
		const wlSerialResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlSerialCmd,
			operatorId,
			false,
		);
		const wlSerial = abi.decodeFunctionResult('wlPurchaseSerial', wlSerialResult)[0];

		console.log('  Required Token:', wlToken);
		console.log('  Required Serial:', wlSerial.toString() === '0' ? 'Any serial' : `#${wlSerial.toString()}`);

		// Check current WL status
		const userEvmAddr = '0x' + operatorId.toSolidityAddress();
		const wlStatusCmd = abi.encodeFunctionData('whitelist', [userEvmAddr]);
		const wlStatusResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlStatusCmd,
			operatorId,
			false,
		);
		const isWhitelisted = abi.decodeFunctionResult('whitelist', wlStatusResult)[0];

		if (isWhitelisted) {
			console.log('\n✓ You are already whitelisted!');
			console.log('  No need to purchase');
			return;
		}

		console.log('\n📝 Purchase Summary:');
		console.log('═══════════════════════════════════════════');
		console.log('  Required Token:', wlToken);
		console.log('  Required Serial:', wlSerial.toString() === '0' ? 'Any serial (must own at least 1)' : `Must own serial #${wlSerial.toString()}`);
		console.log('  Your Account:', operatorId.toString());
		console.log('  ⚠️  You must currently hold the required token');
		console.log();

		const proceed = readlineSync.keyInYNStrict('Purchase whitelist spot?');
		if (!proceed) {
			console.log('❌ Purchase cancelled');
			return;
		}

		// Estimate gas
		console.log('\n⛽ Estimating gas...');
		const gasEstimate = await estimateGas(
			env,
			contractId,
			abi,
			operatorId,
			'purchaseWLWithToken',
			[],
			200_000,
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Execute purchase
		console.log('\n🚀 Purchasing whitelist spot...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'purchaseWLWithToken',
			[],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Purchase failed');
			console.log('Status:', result[0]?.status?.toString());
			console.log('\n⚠️  Common issues:');
			console.log('   • Do not hold the required token');
			console.log('   • Do not hold the required serial');
			console.log('   • Not associated with the required token');
			return;
		}

		console.log('\n✅ Whitelist spot purchased successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());
		console.log('\n✓ You are now whitelisted');
		console.log('✓ Token verified');

		console.log('\n📊 Next Steps:');
		console.log('  • Check mint cost with WL discount:');
		console.log('    node scripts/interactions/EditionWithPrize/checkMintCost.js');
		console.log('  • Mint an edition:');
		console.log('    node scripts/interactions/EditionWithPrize/mint.js');

	}
	catch (error) {
		console.error('\n❌ Error purchasing WL spot:', error.message || error);
	}
});
