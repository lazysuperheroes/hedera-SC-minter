const {
	AccountId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { ethers } = require('ethers');
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
	console.log('║  Set WL Purchase Options (Owner)        ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Check current settings
		console.log('\n📊 Checking current WL purchase options...');

		const wlCostCmd = abi.encodeFunctionData('wlCostInLazy');
		const wlCostResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlCostCmd,
			operatorId,
			false,
		);
		const currentWlCost = abi.decodeFunctionResult('wlCostInLazy', wlCostResult)[0];

		const wlTokenCmd = abi.encodeFunctionData('wlPurchaseToken');
		const wlTokenResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlTokenCmd,
			operatorId,
			false,
		);
		const currentWlToken = abi.decodeFunctionResult('wlPurchaseToken', wlTokenResult)[0];

		const wlSerialCmd = abi.encodeFunctionData('wlPurchaseSerial');
		const wlSerialResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlSerialCmd,
			operatorId,
			false,
		);
		const currentWlSerial = abi.decodeFunctionResult('wlPurchaseSerial', wlSerialResult)[0];

		console.log('\nCurrent WL Purchase Options:');
		console.log('═══════════════════════════════════════════');
		console.log('  LAZY Cost:', ethers.formatUnits(currentWlCost, 8), 'LAZY');
		console.log('  Token Address:', currentWlToken === '0x0000000000000000000000000000000000000000' ? 'Not set' : currentWlToken);
		console.log('  Required Serial:', currentWlSerial.toString() === '0' ? 'Any serial' : `#${currentWlSerial.toString()}`);

		// Get new values
		console.log('\n📝 Configure WL Purchase Options:');
		console.log('   Users can buy whitelist spots by:');
		console.log('   1. Burning LAZY tokens');
		console.log('   2. Holding a specific NFT/token\n');

		let wlCost = readlineSync.question(`LAZY Cost [${ethers.formatUnits(currentWlCost, 8)}]: `);
		if (!wlCost || wlCost.trim() === '') {
			wlCost = ethers.formatUnits(currentWlCost, 8);
		}
		const wlCostWei = BigInt(Math.floor(parseFloat(wlCost) * 100_000_000));

		console.log('\nToken Requirement (optional):');
		console.log('  Leave blank to disable token requirement');
		const wlToken = readlineSync.question('Token Address (0x... or Account ID): ');

		let wlTokenAddress = '0x0000000000000000000000000000000000000000';
		if (wlToken && wlToken.trim() !== '') {
			if (wlToken.startsWith('0x')) {
				wlTokenAddress = wlToken;
			}
			else if (wlToken.match(/^\d+\.\d+\.\d+$/)) {
				const tokenId = AccountId.fromString(wlToken);
				wlTokenAddress = '0x' + tokenId.toSolidityAddress();
			}
			else {
				console.log('❌ Invalid token address or account ID');
				return;
			}
		}

		let wlSerial = '0';
		if (wlTokenAddress !== '0x0000000000000000000000000000000000000000') {
			wlSerial = readlineSync.question('Required Serial (0 for any serial): ');
		}
		const wlSerialNum = BigInt(wlSerial);

		// Display summary
		console.log('\n📋 New WL Purchase Options:');
		console.log('═══════════════════════════════════════════');
		console.log('  LAZY Cost:', ethers.formatUnits(wlCostWei, 8), 'LAZY');

		if (wlTokenAddress === '0x0000000000000000000000000000000000000000') {
			console.log('  Token Requirement: None');
		}
		else {
			console.log('  Token Address:', wlTokenAddress);
			console.log('  Required Serial:', wlSerialNum.toString() === '0' ? 'Any serial' : `#${wlSerialNum.toString()}`);
		}
		console.log();

		if (wlCostWei === 0n && wlTokenAddress === '0x0000000000000000000000000000000000000000') {
			console.log('⚠️  Warning: Both LAZY cost and token requirement are disabled');
			console.log('   Users can get whitelist for free!');
		}
		console.log();

		const proceed = readlineSync.keyInYNStrict('Update WL purchase options?');
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
			'setWlPurchaseOptions',
			[wlCostWei, wlTokenAddress, wlSerialNum],
			100_000,
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Execute update
		console.log('\n🚀 Updating WL purchase options...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'setWlPurchaseOptions',
			[wlCostWei, wlTokenAddress, wlSerialNum],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Update failed');
			console.log('Status:', result[0]?.status?.toString());
			return;
		}

		console.log('\n✅ WL purchase options updated successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());

		console.log('\n📊 Next Steps:');
		console.log('  • Users can purchase WL with:');
		console.log('    node scripts/interactions/EditionWithPrize/purchaseWLWithLazy.js');
		if (wlTokenAddress !== '0x0000000000000000000000000000000000000000') {
			console.log('    node scripts/interactions/EditionWithPrize/purchaseWLWithToken.js');
		}

	}
	catch (error) {
		console.error('\n❌ Error setting WL purchase options:', error.message || error);
	}
});
