const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../../lib/scriptBase');
const {
	contractExecuteFunction,
	readOnlyEVMFromMirrorNode,
} = require('../../../../utils/solidityHelpers');
const { estimateGas } = require('../../../../utils/gasHelpers');

runScript(async () => {
	const { client, operatorId, contractId, env, iface: abi } = initScript({
		contractName: 'EditionWithPrize',
		contractEnvVar: 'EDITION_WITH_PRIZE_CONTRACT_ID',
	});

	console.log('\n╔══════════════════════════════════════════╗');
	console.log('║     Set WL-Only Mode (Owner)            ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Check current state
		console.log('\n📊 Checking current WL-only state...');

		const wlOnlyCmd = abi.encodeFunctionData('wlOnly');
		const wlOnlyResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlOnlyCmd,
			operatorId,
			false,
		);
		const currentWlOnly = abi.decodeFunctionResult('wlOnly', wlOnlyResult)[0];

		console.log('\nCurrent State:', currentWlOnly ? '🎟️  WL-ONLY' : '🌐 PUBLIC');
		console.log('═══════════════════════════════════════════');

		if (currentWlOnly) {
			console.log('  Only whitelisted addresses can mint');
		}
		else {
			console.log('  Any address can mint (subject to timing/pause)');
		}

		// Get new state
		console.log('\n📝 Select New WL-Only Mode:');
		console.log('  1. 🎟️  Enable WL-Only (whitelist required)');
		console.log('  2. 🌐 Disable WL-Only (public minting)');
		console.log('  3. Cancel');

		const choice = readlineSync.question('\nChoice [1-3]: ');

		let newWlOnly;
		if (choice === '1') {
			newWlOnly = true;
		}
		else if (choice === '2') {
			newWlOnly = false;
		}
		else {
			console.log('❌ Operation cancelled');
			return;
		}

		if (newWlOnly === currentWlOnly) {
			console.log('⚠️  No change - mode is already', newWlOnly ? 'WL-ONLY' : 'PUBLIC');
			return;
		}

		console.log('\n📋 Mode Change:');
		console.log('═══════════════════════════════════════════');
		console.log('  From:', currentWlOnly ? '🎟️  WL-ONLY' : '🌐 PUBLIC');
		console.log('  To:', newWlOnly ? '🎟️  WL-ONLY' : '🌐 PUBLIC');
		console.log();

		if (newWlOnly) {
			console.log('  ⚠️  Warning: Only whitelisted addresses can mint');
			console.log('     Ensure whitelist is configured');
		}
		else {
			console.log('  ✓ Public minting will be enabled');
			console.log('    Any address can mint (subject to timing/pause)');
		}
		console.log();

		const proceed = readlineSync.keyInYNStrict('Proceed with mode change?');
		if (!proceed) {
			console.log('❌ Update cancelled');
			return;
		}

		// Estimate gas
		console.log('\n⛽ Estimating gas...');
		const gasEstimate = await estimateGas(
			env,
			contractId,
			abi,
			operatorId,
			'setWlOnly',
			[newWlOnly],
			100_000,
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Execute update
		console.log('\n🚀 Updating WL-only mode...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'setWlOnly',
			[newWlOnly],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Update failed');
			console.log('Status:', result[0]?.status?.toString());
			return;
		}

		console.log('\n✅ WL-only mode updated successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());
		console.log('\nNew Mode:', newWlOnly ? '🎟️  WL-ONLY' : '🌐 PUBLIC');

		if (newWlOnly) {
			console.log('\n📊 Next Steps:');
			console.log('  • Verify whitelist:');
			console.log('    node scripts/interactions/EditionWithPrize/admin/addToWhitelist.js');
		}

	}
	catch (error) {
		console.error('\n❌ Error setting WL-only mode:', error.message || error);
	}
});
