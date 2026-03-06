const { TokenId } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');
const { readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');
const { getSerialsOwned } = require('../../../utils/hederaMirrorHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	if (!jsonMode) console.log('\n🔄 ForeverMinter - Refund Eligibility Check');
	if (!jsonMode) console.log('==============================================\n');

	try {
		// Get NFT token address
		const nftTokenAddress = (await readContract(iface, env, contractId, operatorId, 'NFT_TOKEN'))[0];
		const nftTokenId = TokenId.fromSolidityAddress(nftTokenAddress);

		// Get timing for refund window info
		const timing = (await readContract(iface, env, contractId, operatorId, 'getMintTiming'))[0];

		if (!jsonMode) console.log('📊 Refund Configuration:');
		if (!jsonMode) console.log(`   Refund Window: ${Number(timing.refundWindow) / 3600} hours`);
		if (!jsonMode) console.log(`   Refund Percentage: ${Number(timing.refundPercentage)}%`);
		if (!jsonMode) console.log('');

		// Get owned NFTs
		if (!jsonMode) console.log('🔍 Checking your NFT holdings...');
		const ownedSerials = await getSerialsOwned(env, operatorId, nftTokenId);

		if (ownedSerials.length === 0) {
			if (jsonMode) {
				console.log(JSON.stringify({
					nftToken: nftTokenId.toString(),
					refundWindowHours: Number(timing.refundWindow) / 3600,
					refundPercentage: Number(timing.refundPercentage),
					ownedSerials: [],
					eligibleSerials: [],
					expiredSerials: [],
					neverMintedSerials: [],
					totalHbarRefund: 0,
					totalLazyRefund: 0,
				}, null, 2));
				return;
			}
			console.log(`\n❌ You do not own any NFTs from token ${nftTokenId.toString()}`);
			console.log('   No refunds available');
			return;
		}

		if (!jsonMode) console.log(`✅ You own ${ownedSerials.length} NFT(s)`);
		if (!jsonMode) console.log(`   Token: ${nftTokenId.toString()}`);
		if (!jsonMode) console.log(`   Serials: ${ownedSerials.join(', ')}`);

		// Check refund eligibility
		if (!jsonMode) console.log('\n⏰ Checking refund eligibility...\n');

		const eligibilityCommand = iface.encodeFunctionData('isRefundOwed', [ownedSerials]);
		const eligibilityResult = await readOnlyEVMFromMirrorNode(env, contractId, eligibilityCommand, operatorId, false);
		const [isOwed, expiryTimes] = iface.decodeFunctionResult('isRefundOwed', eligibilityResult);

		const now = Math.floor(Date.now() / 1000);
		const eligibleSerials = [];
		const expiredSerials = [];
		const neverMintedSerials = [];

		for (let i = 0; i < ownedSerials.length; i++) {
			const serial = ownedSerials[i];
			const expiry = Number(expiryTimes[i]);
			const owed = isOwed[i];

			if (expiry === 0) {
				// Never minted via this contract
				neverMintedSerials.push(serial);
			}
			else if (owed && expiry > now) {
				// Eligible
				const timeLeft = expiry - now;
				const hours = Math.floor(timeLeft / 3600);
				const minutes = Math.floor((timeLeft % 3600) / 60);
				const seconds = timeLeft % 60;

				eligibleSerials.push({ serial, expiry, timeLeft });

				if (!jsonMode) console.log(`✅ Serial ${serial}: ELIGIBLE`);
				if (!jsonMode) console.log(`   Time remaining: ${hours}h ${minutes}m ${seconds}s`);
				if (!jsonMode) console.log(`   Expires: ${new Date(expiry * 1000).toLocaleString()}`);
			}
			else {
				// Expired
				expiredSerials.push(serial);
				if (!jsonMode) console.log(`❌ Serial ${serial}: EXPIRED`);
			}
		}

		if (jsonMode) {
			const refundDetails = [];
			for (const { serial, expiry, timeLeft } of eligibleSerials) {
				const payment = (await readContract(iface, env, contractId, operatorId, 'getSerialPayment', [serial]))[0];
				const hbarPaid = Number(payment.hbarPaid);
				const lazyPaid = Number(payment.lazyPaid);
				const hbarRefund = Math.floor((hbarPaid * Number(timing.refundPercentage)) / 100);
				const lazyRefund = Math.floor((lazyPaid * Number(timing.refundPercentage)) / 100);
				refundDetails.push({ serial, expiry, timeLeftSeconds: timeLeft, hbarPaid, lazyPaid, hbarRefund, lazyRefund });
			}
			console.log(JSON.stringify({
				nftToken: nftTokenId.toString(),
				refundWindowHours: Number(timing.refundWindow) / 3600,
				refundPercentage: Number(timing.refundPercentage),
				ownedSerials: ownedSerials,
				eligibleSerials: refundDetails,
				expiredSerials,
				neverMintedSerials,
				totalHbarRefund: refundDetails.reduce((sum, r) => sum + r.hbarRefund, 0),
				totalLazyRefund: refundDetails.reduce((sum, r) => sum + r.lazyRefund, 0),
			}, null, 2));
			return;
		}

		if (neverMintedSerials.length > 0) {
			console.log('\n📝 Not eligible (not minted via this contract):');
			console.log(`   ${neverMintedSerials.join(', ')}`);
		}

		if (eligibleSerials.length > 0) {
			console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
			console.log('💰 Refund Details');
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

			let totalHbarRefund = 0;
			let totalLazyRefund = 0;

			for (const { serial } of eligibleSerials) {
				const payment = (await readContract(iface, env, contractId, operatorId, 'getSerialPayment', [serial]))[0];

				const hbarPaid = Number(payment.hbarPaid);
				const lazyPaid = Number(payment.lazyPaid);

				const hbarRefund = Math.floor((hbarPaid * Number(timing.refundPercentage)) / 100);
				const lazyRefund = Math.floor((lazyPaid * Number(timing.refundPercentage)) / 100);

				totalHbarRefund += hbarRefund;
				totalLazyRefund += lazyRefund;

				console.log(`Serial ${serial}:`);
				console.log(`   Paid: ${hbarPaid} tℏ + ${lazyPaid} LAZY`);
				console.log(`   Refund: ${hbarRefund} tℏ + ${lazyRefund} LAZY`);
			}

			console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
			console.log('📋 SUMMARY');
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

			console.log(`Eligible NFTs: ${eligibleSerials.length}`);
			console.log(`   Serials: ${eligibleSerials.map(e => e.serial).join(', ')}`);

			console.log('\nTotal Refund Available:');
			console.log(`   ${totalHbarRefund} tℏ + ${totalLazyRefund} LAZY`);

			console.log('\n⚠️  Warning: Refunding NFTs returns them to the contract pool');

			console.log('\n📝 To process refund:');
			console.log(`   node refund.js ${eligibleSerials.map(e => e.serial).join(' ')}`);

			// Show expiry order
			const sortedByExpiry = [...eligibleSerials].sort((a, b) => a.expiry - b.expiry);

			console.log('\n⏰ Expiry Order (refund soonest first):');
			for (const { serial, expiry } of sortedByExpiry) {
				const timeLeft = expiry - now;
				const hours = Math.floor(timeLeft / 3600);
				const minutes = Math.floor((timeLeft % 3600) / 60);
				console.log(`   Serial ${serial}: ${hours}h ${minutes}m remaining`);
			}
		}
		else {
			console.log('\n❌ No eligible NFTs for refund');

			if (expiredSerials.length > 0) {
				console.log('\n⚠️  Some NFTs have expired refund windows:');
				console.log(`   ${expiredSerials.join(', ')}`);
			}
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	}
	catch (error) {
		console.log('❌ Error checking refund eligibility:', error.message);
	}
});
