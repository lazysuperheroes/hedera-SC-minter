/**
 * Shared test setup utilities.
 * Reduces boilerplate across test files by providing common initialization patterns.
 */

const {
	AccountId,
	PrivateKey,
} = require('@hashgraph/sdk');
const { createClient, loadABI } = require('../../scripts/lib/scriptBase');
const { accountCreator } = require('../../utils/hederaHelpers');

require('dotenv').config();

/**
 * Create a test environment with client and operator credentials.
 * Handles LOCAL environment specially by creating a fresh operator account.
 *
 * @param {Object} [options]
 * @param {string} [options.env] - Override ENVIRONMENT from .env
 * @returns {Promise<{ client: Client, operatorId: AccountId, operatorKey: PrivateKey, env: string }>}
 */
async function createTestEnvironment(options = {}) {
	const env = options.env || process.env.ENVIRONMENT;
	if (!env) throw new Error('Missing ENVIRONMENT in .env file');

	let operatorKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY);
	let operatorId = AccountId.fromString(process.env.ACCOUNT_ID);

	const client = createClient(env, operatorId, operatorKey);

	// For LOCAL environment, create a fresh operator from the root account
	if (env.toUpperCase() === 'LOCAL') {
		const rootId = AccountId.fromString('0.0.2');
		const rootKey = PrivateKey.fromStringECDSA(
			'302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
		);
		client.setOperator(rootId, rootKey);
		operatorKey = PrivateKey.generateED25519();
		operatorId = await accountCreator(client, operatorKey, 1000);
		client.setOperator(operatorId, operatorKey);
	}

	console.log('\n-Using ENVIRONMENT:', env.toUpperCase());
	console.log('-Using Operator:', operatorId.toString());

	return { client, operatorId, operatorKey, env };
}

/**
 * Create a test account with initial HBAR balance.
 *
 * @param {Client} client - Hedera client
 * @param {number} [initialHbar=200] - Initial HBAR balance
 * @returns {Promise<{ privateKey: PrivateKey, accountId: AccountId }>}
 */
async function createTestAccount(client, initialHbar = 200) {
	const privateKey = PrivateKey.generateED25519();
	const accountId = await accountCreator(client, privateKey, initialHbar);
	return { privateKey, accountId };
}

/**
 * Create a separate client for a test account.
 *
 * @param {string} env - Environment name
 * @param {AccountId} accountId - Account ID
 * @param {PrivateKey} privateKey - Private key
 * @returns {Client}
 */
function createAccountClient(env, accountId, privateKey) {
	return createClient(env, accountId, privateKey);
}

module.exports = {
	createTestEnvironment,
	createTestAccount,
	createAccountClient,
	loadABI,
};
