const { initScript, runScript } = require('../../lib/scriptBase');
const { readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');
const { homebrewPopulateAccountNum } = require('../../../utils/hederaMirrorHelpers');

runScript(async () => {
	const { operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());
	console.log('\n-Using contract:', contractId.toString());

	try {
		console.log('\n===========================================');
		console.log('ADMIN LIST');
		console.log('===========================================');

		// Get all admins
		const encodedCommand = minterIface.encodeFunctionData('getAdmins');

		const result = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			encodedCommand,
			operatorId,
			false,
		);

		const adminList = minterIface.decodeFunctionResult('getAdmins', result);
		const admins = adminList[0];

		if (admins.length === 0) {
			console.log('No admins found (this should not happen).');
		}
		else {
			console.log(`Found ${admins.length} admin(s):\n`);

			for (let i = 0; i < admins.length; i++) {
				const adminAddress = admins[i];

				// Try to convert EVM address back to Hedera account ID
				try {
					const accountId = await homebrewPopulateAccountNum(env, adminAddress);
					console.log(`${i + 1}. ${accountId.toString()} (${adminAddress})`);
				}
				catch {
					console.log(`${i + 1}. ${adminAddress} (EVM address only)`);
				}

				// Check if this is the current operator
				if (adminAddress.toLowerCase() === operatorId.toEvmAddress().toLowerCase()) {
					console.log('   ^ This is you (current operator)');
				}
			}
		}

		// Also check if the current operator is an admin
		console.log('\n===========================================');
		console.log('OPERATOR ADMIN STATUS');
		console.log('===========================================');

		const isAdminCommand = minterIface.encodeFunctionData('isAdmin', [operatorId.toSolidityAddress()]);

		const isAdminResult = await readOnlyEVMFromMirrorNode(
			env,
			contractId,
			isAdminCommand,
			operatorId,
			false,
		);

		const isAdmin = minterIface.decodeFunctionResult('isAdmin', isAdminResult);

		if (isAdmin[0]) {
			console.log('✅ Current operator IS an admin');
		}
		else {
			console.log('❌ Current operator is NOT an admin');
		}

	}
	catch (error) {
		console.log('❌ Error fetching admin list:', error.message);
	}
});
