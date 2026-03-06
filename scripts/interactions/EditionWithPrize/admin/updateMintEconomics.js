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
	console.log('║    Update Mint Economics (Owner)        ║');
	console.log('╚══════════════════════════════════════════╝\n');

	console.log('Using account:', operatorId.toString());
	console.log('Contract ID:', contractId.toString());
	console.log('Environment:', env);

	try {
		// Check current state
		console.log('\n📊 Checking current mint economics...');

		const hbarCostCmd = abi.encodeFunctionData('hbarCost');
		const hbarCostResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			hbarCostCmd,
			operatorId,
			false,
		);
		const currentHbarCost = abi.decodeFunctionResult('hbarCost', hbarCostResult)[0];

		const lazyCostCmd = abi.encodeFunctionData('lazyCost');
		const lazyCostResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			lazyCostCmd,
			operatorId,
			false,
		);
		const currentLazyCost = abi.decodeFunctionResult('lazyCost', lazyCostResult)[0];

		const usdcCostCmd = abi.encodeFunctionData('usdcCost');
		const usdcCostResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			usdcCostCmd,
			operatorId,
			false,
		);
		const currentUsdcCost = abi.decodeFunctionResult('usdcCost', usdcCostResult)[0];

		const wlDiscountCmd = abi.encodeFunctionData('wlDiscountPerc');
		const wlDiscountResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			wlDiscountCmd,
			operatorId,
			false,
		);
		const currentWlDiscount = abi.decodeFunctionResult('wlDiscountPerc', wlDiscountResult)[0];

		const maxMintsPerAddrCmd = abi.encodeFunctionData('maxMintPerAddr');
		const maxMintsPerAddrResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			maxMintsPerAddrCmd,
			operatorId,
			false,
		);
		const currentMaxMints = abi.decodeFunctionResult('maxMintPerAddr', maxMintsPerAddrResult)[0];

		console.log('\nCurrent Mint Economics:');
		console.log('═══════════════════════════════════════════');
		console.log('  HBAR Cost:', ethers.formatUnits(currentHbarCost, 8), 'HBAR');
		console.log('  LAZY Cost:', ethers.formatUnits(currentLazyCost, 8), 'LAZY');
		console.log('  USDC Cost:', ethers.formatUnits(currentUsdcCost, 6), 'USDC');
		console.log('  WL Discount:', currentWlDiscount.toString() + '%');
		console.log('  Max Mints/Addr:', currentMaxMints.toString());

		// Get new values
		console.log('\n📝 Enter New Mint Economics:');
		console.log('   (Press Enter to keep current value)\n');

		let hbarCost = readlineSync.question(`HBAR Cost [${ethers.formatUnits(currentHbarCost, 8)}]: `);
		if (!hbarCost || hbarCost.trim() === '') {
			hbarCost = ethers.formatUnits(currentHbarCost, 8);
		}
		const hbarCostTinybar = BigInt(Math.floor(parseFloat(hbarCost) * 100_000_000));

		let lazyCost = readlineSync.question(`LAZY Cost [${ethers.formatUnits(currentLazyCost, 8)}]: `);
		if (!lazyCost || lazyCost.trim() === '') {
			lazyCost = ethers.formatUnits(currentLazyCost, 8);
		}
		const lazyCostWei = BigInt(Math.floor(parseFloat(lazyCost) * 100_000_000));

		let usdcCost = readlineSync.question(`USDC Cost [${ethers.formatUnits(currentUsdcCost, 6)}]: `);
		if (!usdcCost || usdcCost.trim() === '') {
			usdcCost = ethers.formatUnits(currentUsdcCost, 6);
		}
		const usdcCostWei = BigInt(Math.floor(parseFloat(usdcCost) * 1_000_000));

		let wlDiscount = readlineSync.question(`WL Discount % [${currentWlDiscount.toString()}]: `);
		if (!wlDiscount || wlDiscount.trim() === '') {
			wlDiscount = currentWlDiscount.toString();
		}
		const wlDiscountNum = parseInt(wlDiscount);
		if (isNaN(wlDiscountNum) || wlDiscountNum < 0 || wlDiscountNum > 100) {
			console.log('❌ Invalid discount percentage (must be 0-100)');
			return;
		}

		let maxMints = readlineSync.question(`Max Mints per Address [${currentMaxMints.toString()}]: `);
		if (!maxMints || maxMints.trim() === '') {
			maxMints = currentMaxMints.toString();
		}
		const maxMintsNum = parseInt(maxMints);
		if (isNaN(maxMintsNum) || maxMintsNum < 0) {
			console.log('❌ Invalid max mints value');
			return;
		}

		// Display summary
		console.log('\n📋 New Mint Economics:');
		console.log('═══════════════════════════════════════════');
		console.log('  HBAR Cost:', ethers.formatUnits(hbarCostTinybar, 8), 'HBAR');
		console.log('  LAZY Cost:', ethers.formatUnits(lazyCostWei, 8), 'LAZY');
		console.log('  USDC Cost:', ethers.formatUnits(usdcCostWei, 6), 'USDC');
		console.log('  WL Discount:', wlDiscountNum + '%');
		console.log('  Max Mints/Addr:', maxMintsNum);
		console.log();

		// Calculate WL pricing
		if (wlDiscountNum > 0) {
			const wlHbar = hbarCostTinybar * BigInt(100 - wlDiscountNum) / 100n;
			const wlLazy = lazyCostWei * BigInt(100 - wlDiscountNum) / 100n;
			const wlUsdc = usdcCostWei * BigInt(100 - wlDiscountNum) / 100n;

			console.log('  WL Pricing Preview:');
			console.log('    HBAR:', ethers.formatUnits(wlHbar, 8), 'HBAR');
			console.log('    LAZY:', ethers.formatUnits(wlLazy, 8), 'LAZY');
			console.log('    USDC:', ethers.formatUnits(wlUsdc, 6), 'USDC');
			console.log();
		}

		const proceed = readlineSync.keyInYNStrict('Update mint economics?');
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
			'updateMintEconomics',
			[hbarCostTinybar, lazyCostWei, usdcCostWei, wlDiscountNum, maxMintsNum],
			100_000,
		);

		console.log(`  Estimated gas: ${gasEstimate.gasLimit.toLocaleString()}`);

		// Execute update
		console.log('\n🚀 Updating mint economics...');
		const result = await contractExecuteFunction(
			contractId,
			abi,
			client,
			gasEstimate.gasLimit,
			'updateMintEconomics',
			[hbarCostTinybar, lazyCostWei, usdcCostWei, wlDiscountNum, maxMintsNum],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ ERROR: Update failed');
			console.log('Status:', result[0]?.status?.toString());
			return;
		}

		console.log('\n✅ Mint economics updated successfully!');
		console.log('Transaction ID:', result[2]?.transactionId?.toString());

		console.log('\n📊 Next Steps:');
		console.log('  • Check updated state:');
		console.log('    node scripts/interactions/EditionWithPrize/getContractState.js');
		console.log('  • Test mint costs:');
		console.log('    node scripts/interactions/EditionWithPrize/checkMintCost.js');

	}
	catch (error) {
		console.error('\n❌ Error updating mint economics:', error.message || error);
	}
});
