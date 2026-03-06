const { AccountId } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Optional: Check specific address
	let targetAddress = operatorId.toSolidityAddress();

	if (process.argv.length >= 3) {
		try {
			const targetId = AccountId.fromString(process.argv[2]);
			targetAddress = targetId.toSolidityAddress();
		}
		catch {
			console.log('❌ Error: Invalid account ID');
			console.log('   Usage: node checkWLSlots.js [accountId]');
			return;
		}
	}

	if (!jsonMode) console.log('\n🎟️  ForeverMinter - Whitelist Slots');
	if (!jsonMode) console.log('======================================\n');

	try {
		// Get whitelist slots
		const slotsArray = (await readContract(iface, env, contractId, operatorId, 'getBatchWhitelistSlots', [[targetAddress]]))[0];
		const wlSlots = Number(slotsArray[0]);

		// Get WL slot cost and discount info
		const economics = (await readContract(iface, env, contractId, operatorId, 'getMintEconomics'))[0];
		const wlSlotCost = Number(economics[6]); // buyWlWithLazy
		const slotsPerPurchase = Number(economics[7]); // buyWlSlotCount
		const wlDiscount = Number(economics[2]); // wlDiscount
		const sacrificeDiscount = Number(economics[3]); // sacrificeDiscount

		if (jsonMode) {
			console.log(JSON.stringify({
				account: AccountId.fromSolidityAddress(targetAddress).toString(),
				wlSlots,
				wlDiscount,
				sacrificeDiscount,
				wlSlotCost,
				slotsPerPurchase,
			}, null, 2));
			return;
		}

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('🎟️  Whitelist Slot Status');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Account: ${AccountId.fromSolidityAddress(targetAddress).toString()}`);
		console.log(`Whitelist Slots: ${wlSlots}`);

		if (wlSlots > 0) {
			console.log(`\n✅ You have ${wlSlots} whitelist slot(s) available!`);
		}
		else {
			console.log('\n❌ You have 0 whitelist slots');
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('💡 What are Whitelist Slots?');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log('Whitelist slots allow you to mint at a discount BEFORE');
		console.log('the waterfall discount system applies holder discounts.');
		console.log('');
		console.log('Discount Logic:');
		console.log(`   • Sacrifice: ${sacrificeDiscount}% discount (STOPS HERE - mutually exclusive)`);
		console.log('');
		console.log('OR if no sacrifice, waterfall applies:');
		console.log('   1. Holder Discounts (consume holder slots first)');
		console.log(`   2. Whitelist: ${wlDiscount}% discount (consume WL slots)`);
		console.log('   3. Full Price (no slots consumed)');
		console.log('');
		console.log(`Cost to purchase: ${wlSlotCost} LAZY per purchase`);
		console.log(`Slots per purchase: ${slotsPerPurchase}`);

		if (wlSlots === 0) {
			console.log('\n📝 To purchase whitelist slots:');
			console.log('   node buyWhitelistSlots.js <quantity>');
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	}
	catch (error) {
		console.log('❌ Error checking whitelist slots:', error.message);
	}
});
