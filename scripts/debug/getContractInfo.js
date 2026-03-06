const {
	AccountId,
	PrivateKey,
	ContractId,
	ContractInfoQuery,
} = require('@hashgraph/sdk');
require('dotenv').config();
const { createClient, runScript } = require('../lib/scriptBase');

// Get operator from .env file
const operatorKey = PrivateKey.fromString(process.env.PRIVATE_KEY);
const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
const contractName = process.env.CONTRACT_NAME ?? null;

const contractId = ContractId.fromString(process.env.CONTRACT_ID);

const env = process.env.ENVIRONMENT ?? null;

// check-out the deployed script - test read-only method
runScript(async () => {
	if (contractName === undefined || contractName == null) {
		console.log('Environment required, please specify CONTRACT_NAME for ABI in the .env file');
		return;
	}


	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());

	const client = createClient(env, operatorId, operatorKey);
	console.log(`interacting in *${env.toUpperCase()}*`);

	console.log('Using contract:', contractId.toString());

	const contractInfo = new ContractInfoQuery().setContractId(contractId);
	const txResp = await contractInfo.execute(client);
	// console.log(JSON.stringify(txResp, null, 4));
	console.log('Storage:', txResp.storage.toString());
	console.log('Balance:', txResp.balance.toString());
	console.log('AutoRenew Account:', txResp.autoRenewAccountId ? txResp.autoRenewAccountId.toString() : txResp.autoRenewAccountId);
	console.log('Expires:', txResp.expirationTime.toDate().toISOString());
});
