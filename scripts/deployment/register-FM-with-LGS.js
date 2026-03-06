const {
	AccountId,
	PrivateKey,
	ContractId,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { contractExecuteFunction } = require('../../utils/solidityHelpers');
require('dotenv').config();
const { createClient, loadABI, runScript } = require('../lib/scriptBase');

// Get operator from .env file
const operatorKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY);
const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);

const env = process.env.ENVIRONMENT ?? null;

let client;

/**
 * Register ForeverMinter as a contract user with LazyGasStation
 * This allows ForeverMinter to call drawLazyFrom() and payoutLazy()
 */
runScript(async () => {
	console.log('\n╔═══════════════════════════════════════════╗');
	console.log('║  Register ForeverMinter with LazyGasStation  ║');
	console.log('╚═══════════════════════════════════════════╝');

	if (operatorKey === undefined || operatorKey == null || operatorId === undefined || operatorId == null) {
		console.log('❌ ERROR: Environment required, please specify PRIVATE_KEY & ACCOUNT_ID in the .env file');
		process.exit(1);
	}

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('-Using Operator:', operatorId.toString());

	// Load contract IDs
	if (!process.env.FOREVER_MINTER_CONTRACT_ID && !process.env.CONTRACT_ID) {
		console.log('❌ ERROR: ForeverMinter contract ID not found in .env file');
		console.log('Please set FOREVER_MINTER_CONTRACT_ID=0.0.xxxxx in your .env file');
		process.exit(1);
	}

	if (!process.env.LAZY_GAS_STATION_CONTRACT_ID) {
		console.log('❌ ERROR: LAZY_GAS_STATION_CONTRACT_ID not found in .env file');
		console.log('Please set LAZY_GAS_STATION_CONTRACT_ID=0.0.xxxxx in your .env file');
		process.exit(1);
	}

	const foreverMinterId = ContractId.fromString(
		process.env.FOREVER_MINTER_CONTRACT_ID || process.env.CONTRACT_ID,
	);
	const lazyGasStationId = ContractId.fromString(process.env.LAZY_GAS_STATION_CONTRACT_ID);

	console.log('\n📦 Contract Summary:');
	console.log('  ForeverMinter:', foreverMinterId.toString());
	console.log('  LazyGasStation:', lazyGasStationId.toString());

	// Confirm action
	console.log('\n⚠️  This will register ForeverMinter as an authorized contract user');
	console.log('   with LazyGasStation, allowing it to process LAZY payments.');
	const proceed = readlineSync.keyInYNStrict('Do you want to proceed?');

	if (!proceed) {
		console.log('❌ Registration cancelled by user');
		process.exit(0);
	}

	// Setup client
	client = createClient(env, operatorId, operatorKey);
	console.log(`\n🌐 Using ${env.toUpperCase()}`);

	try {
		// Load LazyGasStation ABI
		const lazyGasStationIface = loadABI('LazyGasStation');

		console.log('\n🚀 Registering ForeverMinter with LazyGasStation...');

		const result = await contractExecuteFunction(
			lazyGasStationId,
			lazyGasStationIface,
			client,
			300_000,
			'addContractUser',
			[foreverMinterId.toSolidityAddress()],
		);

		if (result[0]?.status?.toString() !== 'SUCCESS') {
			console.log('❌ Registration FAILED:', result);
			process.exit(1);
		}

		console.log('✅ ForeverMinter successfully registered with LazyGasStation!');
		console.log('   Transaction ID:', result[2]?.transactionId?.toString());

		console.log('\n📝 Next Steps:');
		console.log('1. Configure mint economics:');
		console.log('   node scripts/interactions/ForeverMinter/admin/updateMintEconomics.js');
		console.log('\n2. Configure mint timing:');
		console.log('   node scripts/interactions/ForeverMinter/admin/updateMintTiming.js');
		console.log('\n3. Add NFTs to pool and start minting!');

	}
	catch (error) {
		console.error('\n❌ Registration failed:', error);
		process.exit(1);
	}
});
