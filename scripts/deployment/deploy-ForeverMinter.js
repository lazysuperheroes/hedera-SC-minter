const {
	AccountId,
	PrivateKey,
	ContractFunctionParameters,
	ContractId,
	TokenId,
} = require('@hashgraph/sdk');
const fs = require('fs');
const readlineSync = require('readline-sync');
const { contractDeployFunction } = require('../../utils/solidityHelpers');
require('dotenv').config();
const { createClient, runScript } = require('../lib/scriptBase');

// Get operator from .env file
const operatorKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY);
const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
const contractName = 'ForeverMinter';

const env = process.env.ENVIRONMENT ?? null;

// Required dependencies - can be passed as args or from .env
let nftTokenId, prngGeneratorId, lazyTokenId, lazyGasStationId, lazyDelegateRegistryId;

let client;

/**
 * Display deployment summary
 */
function displaySummary(contractId, contractAddress) {
	console.log('\n===========================================');
	console.log('DEPLOYMENT COMPLETE');
	console.log('===========================================');
	console.log('Contract Name:', contractName);
	console.log('Contract ID:', contractId.toString());
	console.log('Contract Address:', contractAddress);
	console.log('NFT Token:', nftTokenId.toString());
	console.log('PRNG Generator:', prngGeneratorId.toString());
	console.log('LAZY Token:', lazyTokenId.toString());
	console.log('LazyGasStation:', lazyGasStationId.toString());
	console.log('LazyDelegateRegistry:', lazyDelegateRegistryId.toString());
	console.log('Environment:', env);
	console.log('===========================================');
	console.log('\n📝 Next Steps:');
	console.log('1. Add CONTRACT_ID to your .env file:');
	console.log(`   FOREVER_MINTER_CONTRACT_ID=${contractId.toString()}`);
	console.log('\n2. Register ForeverMinter with LazyGasStation:');
	console.log('   Run: node scripts/deployment/register-FM-with-LGS.js');
	console.log('\n3. Configure economics and timing:');
	console.log('   node scripts/interactions/ForeverMinter/admin/updateMintEconomics.js');
	console.log('   node scripts/interactions/ForeverMinter/admin/updateMintTiming.js');
	console.log('\n4. Add discount tiers (if applicable):');
	console.log('   node scripts/interactions/ForeverMinter/admin/addDiscountTier.js');
	console.log('\n5. Add NFTs to pool:');
	console.log('   - Transfer NFTs to contract first');
	console.log('   - node scripts/interactions/ForeverMinter/admin/registerPoolNFTs.js');
	console.log('\n6. Configure whitelist (optional):');
	console.log('   node scripts/interactions/ForeverMinter/admin/addToWhitelist.js');
	console.log('   or');
	console.log('   node scripts/interactions/ForeverMinter/admin/batchAddToWhitelist.js');
	console.log('\n7. Unpause minting:');
	console.log('   node scripts/interactions/ForeverMinter/admin/setPause.js');
	console.log('\n8. Test minting:');
	console.log('   node scripts/interactions/ForeverMinter/mint.js');
	console.log('\n===========================================\n');
}

/**
 * Parse command line arguments or read from .env
 */
function loadDependencies() {
	const args = process.argv.slice(2);

	console.log('\n📋 Loading deployment dependencies...');

	// Check for command line args first, then .env
	if (args.length >= 5) {
		// Command line: node deploy-ForeverMinter.js <nftToken> <prngGenerator> <lazyToken> <lazyGasStation> <lazyDelegateRegistry>
		nftTokenId = TokenId.fromString(args[0]);
		prngGeneratorId = ContractId.fromString(args[1]);
		lazyTokenId = TokenId.fromString(args[2]);
		lazyGasStationId = ContractId.fromString(args[3]);
		lazyDelegateRegistryId = ContractId.fromString(args[4]);
		console.log('✓ Using dependencies from command line arguments');
	}
	else {
		// Load from .env
		if (!process.env.NFT_TOKEN_ID) {
			console.log('❌ ERROR: NFT_TOKEN_ID not found in .env file');
			console.log('Please set NFT_TOKEN_ID=0.0.xxxxx in your .env file');
			console.log('Or pass as argument: node deploy-ForeverMinter.js <nftToken> <prngGenerator> <lazyToken> <lazyGasStation> <lazyDelegateRegistry>');
			process.exit(1);
		}
		if (!process.env.PRNG_CONTRACT_ID) {
			console.log('❌ ERROR: PRNG_CONTRACT_ID not found in .env file');
			console.log('Please set PRNG_CONTRACT_ID=0.0.xxxxx in your .env file');
			process.exit(1);
		}
		if (!process.env.LAZY_TOKEN_ID) {
			console.log('❌ ERROR: LAZY_TOKEN_ID not found in .env file');
			console.log('Please set LAZY_TOKEN_ID=0.0.xxxxx in your .env file');
			process.exit(1);
		}
		if (!process.env.LAZY_GAS_STATION_CONTRACT_ID) {
			console.log('❌ ERROR: LAZY_GAS_STATION_CONTRACT_ID not found in .env file');
			console.log('Please set LAZY_GAS_STATION_CONTRACT_ID=0.0.xxxxx in your .env file');
			process.exit(1);
		}
		if (!process.env.LAZY_DELEGATE_REGISTRY_CONTRACT_ID) {
			console.log('❌ ERROR: LAZY_DELEGATE_REGISTRY_CONTRACT_ID not found in .env file');
			console.log('Please set LAZY_DELEGATE_REGISTRY_CONTRACT_ID=0.0.xxxxx in your .env file');
			process.exit(1);
		}

		nftTokenId = TokenId.fromString(process.env.NFT_TOKEN_ID);
		prngGeneratorId = ContractId.fromString(process.env.PRNG_CONTRACT_ID);
		lazyTokenId = TokenId.fromString(process.env.LAZY_TOKEN_ID);
		lazyGasStationId = ContractId.fromString(process.env.LAZY_GAS_STATION_CONTRACT_ID);
		lazyDelegateRegistryId = ContractId.fromString(process.env.LAZY_DELEGATE_REGISTRY_CONTRACT_ID);
		console.log('✓ Using dependencies from .env file');
	}

	console.log('\n📦 Dependency Summary:');
	console.log('  NFT Token:', nftTokenId.toString());
	console.log('  PRNG Generator:', prngGeneratorId.toString());
	console.log('  LAZY Token:', lazyTokenId.toString());
	console.log('  LazyGasStation:', lazyGasStationId.toString());
	console.log('  LazyDelegateRegistry:', lazyDelegateRegistryId.toString());
}

/**
 * Deploy ForeverMinter contract
 */
async function deployForeverMinter() {
	const json = JSON.parse(
		fs.readFileSync(
			`./artifacts/contracts/${contractName}.sol/${contractName}.json`,
		),
	);

	const contractBytecode = json.bytecode;

	console.log('\n📄 Contract bytecode loaded');
	console.log('  Size:', contractBytecode.length / 2, 'bytes');

	const gasLimit = 6_500_000;

	console.log('\n🚀 Deploying contract...', contractName);
	console.log('  Gas limit:', gasLimit.toLocaleString());

	// Constructor params: (nftToken, prngGenerator, lazyToken, lazyGasStation, lazyDelegateRegistry)
	const constructorParams = new ContractFunctionParameters()
		.addAddress(nftTokenId.toSolidityAddress())
		.addAddress(prngGeneratorId.toSolidityAddress())
		.addAddress(lazyTokenId.toSolidityAddress())
		.addAddress(lazyGasStationId.toSolidityAddress())
		.addAddress(lazyDelegateRegistryId.toSolidityAddress());

	const [contractId, contractAddress] = await contractDeployFunction(
		client,
		contractBytecode,
		gasLimit,
		constructorParams,
	);

	console.log('✅ Contract deployed successfully!');
	console.log('  Contract ID:', contractId.toString());
	console.log('  Contract Address:', contractAddress);

	return [contractId, contractAddress];
}

/**
 * Main deployment function
 */
runScript(async () => {
	console.log('\n╔═══════════════════════════════════════════╗');
	console.log('║   ForeverMinter v1.0.5 Deployment Tool   ║');
	console.log('╚═══════════════════════════════════════════╝');

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('-Using Operator:', operatorId.toString());

	if (contractName === undefined || contractName == null) {
		console.log('ERROR: Contract name not defined');
		process.exit(1);
	}
	if (operatorKey === undefined || operatorKey == null || operatorId === undefined || operatorId == null) {
		console.log('ERROR: Environment required, please specify PRIVATE_KEY & ACCOUNT_ID in the .env file');
		process.exit(1);
	}

	// Load dependencies
	loadDependencies();

	// Confirm deployment
	console.log('\n⚠️  You are about to deploy ForeverMinter v1.0.5');
	const proceed = readlineSync.keyInYNStrict('Do you want to proceed with deployment?');

	if (!proceed) {
		console.log('❌ Deployment cancelled by user');
		process.exit(0);
	}

	// Setup client
	client = createClient(env, operatorId, operatorKey);
	console.log(`\n🌐 Deploying to ${env.toUpperCase()}`);

	try {
		// Deploy contract
		const [contractId, contractAddress] = await deployForeverMinter();

		// Display summary
		displaySummary(contractId, contractAddress);

		// Save to file for easy reference
		const deploymentInfo = {
			contractName,
			contractId: contractId.toString(),
			contractAddress,
			nftTokenId: nftTokenId.toString(),
			prngGeneratorId: prngGeneratorId.toString(),
			lazyTokenId: lazyTokenId.toString(),
			lazyGasStationId: lazyGasStationId.toString(),
			lazyDelegateRegistryId: lazyDelegateRegistryId.toString(),
			environment: env,
			deployedAt: new Date().toISOString(),
			deployedBy: operatorId.toString(),
		};

		const filename = `deployment-${contractName}-${env}-${Date.now()}.json`;
		fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
		console.log(`\n💾 Deployment info saved to: ${filename}`);

		console.log('\n✅ Deployment process complete!');
		console.log('\n⚠️  IMPORTANT: Remember to register ForeverMinter with LazyGasStation!');
		console.log('Run: node scripts/deployment/register-FM-with-LGS.js');

	}
	catch (error) {
		console.error('\n❌ Deployment failed:', error);
		process.exit(1);
	}
});
