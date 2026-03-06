const {
	AccountId,
	PrivateKey,
	ContractCreateFlow,
} = require('@hashgraph/sdk');
const fs = require('fs');
require('dotenv').config();
const { createClient, runScript } = require('../lib/scriptBase');

// Get operator from .env file
const operatorKey = PrivateKey.fromString(process.env.PRIVATE_KEY);
const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
const contractName = process.env.CONTRACT_NAME ?? null;

const env = process.env.ENVIRONMENT ?? null;

let client;

async function contractDeployFcn(bytecode, gasLim) {
	const contractCreateTx = new ContractCreateFlow().setBytecode(bytecode).setGas(gasLim).setAutoRenewAccountId(operatorId);
	const contractCreateSubmit = await contractCreateTx.execute(client);
	const contractCreateRx = await contractCreateSubmit.getReceipt(client);
	const contractId = contractCreateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	return [contractId, contractAddress];
}

runScript(async () => {
	if (contractName === undefined || contractName == null) {
		console.log('Environment required, please specify CONTRACT_NAME for ABI in the .env file');
		return;
	}


	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());

	client = createClient(env, operatorId, operatorKey);
	console.log(`deploying in *${env.toUpperCase()}*`);

	const json = JSON.parse(fs.readFileSync(`./artifacts/contracts/${contractName}.sol/${contractName}.json`));

	const contractBytecode = json.bytecode;

	console.log('\n- Deploying contract...');
	const gasLimit = 1200000;

	const [contractId, contractAddress] = await contractDeployFcn(contractBytecode, gasLimit);

	console.log(`Contract created with ID: ${contractId} / ${contractAddress}`);

});
