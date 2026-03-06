const readlineSync = require('readline-sync');
const { ethers } = require('ethers');
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
	console.log('║     Purchase WL Spot with LAZY          ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Check WL purchase cost
		console.log('\n📊 Checking WL purchase requirements...');

		const wlCostCmd = abi.encodeFunctionData('wlCostInLazy');
		const wlCostResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlCostCmd,
			operatorId,
			false,
		);
		const wlCost = abi.decodeFunctionResult('wlCostInLazy', wlCostResult)[0];

		if (wlCost === 0n) {
			console.log('❌ ERROR: LAZY WL purchase is disabled (cost = 0)');
			console.log('   Contact contract owner to enable');
			return;
		}

		console.log('  LAZY Cost:', ethers.formatUnits(wlCost, 8), 'LAZY');

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
		console.log('  Cost:', ethers.formatUnits(wlCost, 8), 'LAZY');
		console.log('  Your Account:', operatorId.toString());
		console.log('  ⚠️  LAZY will be BURNED (sent to 0.0.0)');
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
			'purchaseWLWithLazy',
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
			'purchaseWLWithLazy',
			[],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Purchase failed');
			console.log('Status:', result[0]?.status?.toString());
			console.log('\n⚠️  Common issues:');
			console.log('   • Insufficient LAZY balance');
			console.log('   • Not associated with LAZY token');
			console.log('   • Contract not associated with LAZY');
			return;
		}

		console.log('\n✅ Whitelist spot purchased successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());
		console.log('\n✓ You are now whitelisted');
		console.log('✓', ethers.formatUnits(wlCost, 8), 'LAZY burned');

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
