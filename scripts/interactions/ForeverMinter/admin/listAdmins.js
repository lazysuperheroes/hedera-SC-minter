const { AccountId } = require('@hashgraph/sdk');
const { initScript, runScript } = require('../../../lib/scriptBase');
const { readOnlyEVMFromMirrorNode } = require('../../../../utils/solidityHelpers');

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	console.log('\n👥 ForeverMinter - List Admins');
	console.log('=================================\n');

	try {
		console.log('🔍 Loading admin list...\n');

		// Get admin list
		const adminsCommand = iface.encodeFunctionData('getAdminList');
		const adminsResult = await readOnlyEVMFromMirrorNode(env, contractId, adminsCommand, operatorId, false);
		const adminAddresses = iface.decodeFunctionResult('getAdminList', adminsResult)[0];

		if (adminAddresses.length === 0) {
			console.log('❌ No admins found (contract may not be initialized)');
			return;
		}

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📋 Contract Admins');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Total Admins: ${adminAddresses.length}\n`);

		for (let i = 0; i < adminAddresses.length; i++) {
			const address = adminAddresses[i];
			const accountId = AccountId.fromSolidityAddress(address);

			console.log(`${i + 1}. ${accountId.toString()}`);
			console.log(`   Address: ${address}`);

			// Check if this is the operator
			if (address.toLowerCase() === operatorId.toSolidityAddress().toLowerCase()) {
				console.log('   ⭐ (You)');
			}
		}

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('💡 Admin Management');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log('Add admin:    node addAdmin.js <accountId>');
		console.log('Remove admin: node removeAdmin.js <accountId>');

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	}
	catch (error) {
		console.log('❌ Error listing admins:', error.message);
	}
});
