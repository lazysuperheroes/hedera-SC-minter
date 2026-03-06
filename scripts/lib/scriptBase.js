const {
	Client,
	AccountId,
	PrivateKey,
	ContractId,
} = require('@hashgraph/sdk');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

/**
 * Create a Hedera client for the specified environment.
 * @param {string} env - Environment name: TEST, MAIN, PREVIEW, or LOCAL
 * @param {AccountId} operatorId - Operator account ID
 * @param {PrivateKey} operatorKey - Operator private key
 * @returns {Client}
 */
function createClient(env, operatorId, operatorKey) {
	let client;
	const envUpper = (env || '').toUpperCase();

	if (envUpper === 'TEST') {
		client = Client.forTestnet();
	}
	else if (envUpper === 'MAIN') {
		client = Client.forMainnet();
	}
	else if (envUpper === 'PREVIEW') {
		client = Client.forPreviewnet();
	}
	else if (envUpper === 'LOCAL') {
		const node = { '127.0.0.1:50211': new AccountId(3) };
		client = Client.forNetwork(node).setMirrorNetwork('127.0.0.1:5600');
	}
	else {
		throw new Error(
			`Invalid ENVIRONMENT "${env}" in .env file. Must be TEST, MAIN, PREVIEW, or LOCAL.`,
		);
	}

	client.setOperator(operatorId, operatorKey);
	return client;
}

/**
 * Load an ABI from the artifacts directory and return an ethers Interface.
 * @param {string} contractName - Name of the contract (e.g., 'ForeverMinter')
 * @returns {ethers.Interface}
 */
function loadABI(contractName) {
	const artifactPath = path.resolve(
		__dirname,
		'../../artifacts/contracts',
		`${contractName}.sol`,
		`${contractName}.json`,
	);

	if (!fs.existsSync(artifactPath)) {
		throw new Error(
			`ABI not found at ${artifactPath}. Run 'npx hardhat compile' first.`,
		);
	}

	const json = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
	return new ethers.Interface(json.abi);
}

/**
 * Initialize a script with standard env vars, client, and ABI.
 * @param {Object} options
 * @param {string} options.contractName - Contract name for ABI loading
 * @param {string} [options.contractEnvVar] - Env var name for the contract ID (e.g., 'FOREVER_MINTER_CONTRACT_ID')
 * @returns {{ client: Client, operatorId: AccountId, operatorKey: PrivateKey, contractId: ContractId, env: string, iface: ethers.Interface }}
 */
function initScript({ contractName, contractEnvVar }) {
	const privateKeyStr = process.env.PRIVATE_KEY;
	const accountIdStr = process.env.ACCOUNT_ID;
	const env = process.env.ENVIRONMENT ?? null;

	if (!privateKeyStr) throw new Error('Missing PRIVATE_KEY in .env file');
	if (!accountIdStr) throw new Error('Missing ACCOUNT_ID in .env file');
	if (!env) throw new Error('Missing ENVIRONMENT in .env file');

	const operatorKey = PrivateKey.fromStringED25519(privateKeyStr);
	const operatorId = AccountId.fromString(accountIdStr);

	let contractId = null;
	if (contractEnvVar) {
		const contractIdStr = process.env[contractEnvVar];
		if (!contractIdStr) {
			throw new Error(`Missing ${contractEnvVar} in .env file`);
		}
		contractId = ContractId.fromString(contractIdStr);
		if (contractId.toString() === '0.0.0') {
			throw new Error(`Invalid ${contractEnvVar} in .env file (got 0.0.0)`);
		}
	}

	const client = createClient(env, operatorId, operatorKey);
	const iface = loadABI(contractName);

	return { client, operatorId, operatorKey, contractId, env, iface };
}

/**
 * Wrap a main function with standard error handling and process.exit.
 * @param {Function} mainFn - Async function to run
 */
function runScript(mainFn) {
	mainFn()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}

module.exports = {
	createClient,
	loadABI,
	initScript,
	runScript,
};
