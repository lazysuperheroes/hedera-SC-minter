const { AccountId } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../lib/scriptBase');
const { readContract } = require('../lib/contractHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const contractName = process.env.CONTRACT_NAME ?? 'MinterContract';
	const { client, operatorId, contractId, env, iface } = initScript({
		contractName,
		contractEnvVar: 'CONTRACT_ID',
	});

	if (!jsonMode) {
		console.log('\n-Using ENVIRONMENT:', env);
		console.log('\n-Using Operator:', operatorId.toString());
		console.log('\n-Using contract:', contractId.toString());
		console.log('\n-Using contract name:', contractName);
	}

	// get current pause status vis getMintTiming from mirror nodes
	const mintTiming = (await readContract(iface, env, contractId, operatorId, 'getMintTiming'))[0];

	if (!jsonMode) {
		console.log('Current mint timing:');
		console.log('last mint:', mintTiming[0], ' -> ', new Date(Number(mintTiming[0]) * 1000).toISOString());
		console.log('mint start:', mintTiming[1], ' -> ', new Date(Number(mintTiming[1]) * 1000).toISOString());
		console.log('PAUSE STATUS:', Boolean(mintTiming[2]));
		console.log('Cooldown period:', Number(mintTiming[3]), ' seconds');
		console.log('Refund Window (if applicable):', Number(mintTiming[4]));
		console.log('WL ONLY:', Boolean(mintTiming[5]));
	}

	// get the current WL
	const whitelist = (await readContract(iface, env, contractId, operatorId, 'getWhitelist'))[0];

	if (jsonMode) {
		const wlMembers = [];
		await Promise.all(whitelist.map(async (element, index) => {
			if (element === '0x0000000000000000000000000000000000000000') {
				wlMembers.push({ index: index + 1, address: element, isNull: true });
				return;
			}
			const wlAddy = await (await (AccountId.fromString(element)).populateAccountNum(client)).populateAccountEvmAddress(client);
			wlMembers.push({
				index: index + 1,
				address: element,
				accountId: `${wlAddy.realm}.${wlAddy.shard}.${wlAddy.num}`,
				evmAddress: wlAddy.evmAddress,
				isNull: false,
			});
		}));
		console.log(JSON.stringify({
			contractId: contractId.toString(),
			contractName,
			mintTiming: {
				lastMint: Number(mintTiming[0]),
				lastMintDate: new Date(Number(mintTiming[0]) * 1000).toISOString(),
				mintStart: Number(mintTiming[1]),
				mintStartDate: new Date(Number(mintTiming[1]) * 1000).toISOString(),
				paused: Boolean(mintTiming[2]),
				cooldownPeriod: Number(mintTiming[3]),
				refundWindow: Number(mintTiming[4]),
				wlOnly: Boolean(mintTiming[5]),
			},
			whitelist: wlMembers,
			whitelistCount: whitelist.length,
		}, null, 2));
		return;
	}

	// output each member of the WL converted to an AccountId
	console.log('Current Whitelist:');
	await Promise.all(whitelist.map(async (element, index) => {
		// if the element is null account 0x0000000000000000000000000000000000000000 then skip
		if (element === '0x0000000000000000000000000000000000000000') {
			console.log(`WL member ${index + 1}:`, element, 'NULL ACCOUNT');
			return;
		}
		const wlAddy = await (await (AccountId.fromString(element)).populateAccountNum(client)).populateAccountEvmAddress(client);
		console.log(`WL member ${index + 1}:`, `${element} / ${wlAddy.realm}.${wlAddy.shard}.${wlAddy.num} / ${wlAddy.evmAddress}`);
	}));
});
