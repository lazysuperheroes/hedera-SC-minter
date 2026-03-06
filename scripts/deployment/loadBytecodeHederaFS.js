const {
	AccountId,
	PrivateKey,
	FileCreateTransaction,
	FileAppendTransaction,
	Hbar,
	FileContentsQuery,
	FileId,
} = require('@hashgraph/sdk');
const fs = require('fs');
const readlineSync = require('readline-sync');
require('dotenv').config();
const { createClient, runScript } = require('../lib/scriptBase');

// Get operator from .env file
const operatorKey = PrivateKey.fromString(process.env.PRIVATE_KEY);
const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
const contractName = process.env.CONTRACT_NAME ?? null;

const CHUNK_SIZE = 5120;

const env = process.env.ENVIRONMENT ?? null;

let client;

async function createFileOnHedera() {
	// Create a file on Hedera and store the hex-encoded bytecode
	const fileCreateTx = new FileCreateTransaction().setKeys([operatorKey]);
	const fileSubmit = await fileCreateTx.execute(client);
	const fileCreateRx = await fileSubmit.getReceipt(client);
	const bytecodeFileId = fileCreateRx.fileId;
	console.log(`- The smart contract bytecode file ID is: ${bytecodeFileId}`);
}

async function appendChunk(bytecodeFileId, bytecode, chunk) {
	// Append contents to the file
	const toAppend = bytecode.slice(chunk * CHUNK_SIZE, CHUNK_SIZE * (chunk + 1));

	if (toAppend) {
		const fileAppendTx = new FileAppendTransaction()
			.setFileId(bytecodeFileId)
			.setContents(bytecode.slice(chunk * CHUNK_SIZE, CHUNK_SIZE * (chunk + 1)))
			.setChunkSize(CHUNK_SIZE)
			.setMaxChunks(1)
			.setMaxTransactionFee(new Hbar(4))
			.freezeWith(client);
		const fileAppendSubmit = await fileAppendTx.execute(client);
		const fileAppendRx = await fileAppendSubmit.getReceipt(client);
		console.log(`- Content added: ${fileAppendRx.status} \n`);
	}
	else {
		console.log('Already uploaded all chunks');
	}

}

async function viewFileContents(bytecodeFileId) {
	// Create the query
	const query = new FileContentsQuery()
		.setFileId(bytecodeFileId);

	// Sign with client operator private key and submit the query to a Hedera network
	const contents = await query.execute(client);

	console.log(contents.toString());
}

runScript(async () => {
	if (contractName === undefined || contractName == null) {
		console.log('Environment required, please specify CONTRACT_NAME for ABI in the .env file');
		return;
	}

	const args = process.argv.slice(2);

	console.log('\n-Using ENVIRONMENT:', env);
	console.log('\n-Using Operator:', operatorId.toString());

	if (args.length == 1) {
		// Need client for viewing file contents too
		client = createClient(env, operatorId, operatorKey);
		console.log('Examining file contents @:', args[0]);
		await viewFileContents(FileId.fromString(args[0]));
		return;
	}

	const proceed = readlineSync.keyInYNStrict('Do you want to upload bytecode?');

	if (proceed) {
		client = createClient(env, operatorId, operatorKey);
		console.log(`deploying in *${env.toUpperCase()}*`);

		const json = JSON.parse(fs.readFileSync(`./artifacts/contracts/${contractName}.sol/${contractName}.json`));

		const contractBytecode = json.bytecode;

		console.log('Using chunk size', CHUNK_SIZE, ' => ', contractBytecode.length / CHUNK_SIZE);

		if (args.length == 2) {

			const chunk = Number(args[1]);

			console.log('\n- Uploading chunk', chunk);
			await appendChunk(FileId.fromString(args[0]), contractBytecode, Number(args[1]));
		}
		else {
			// create the new file
			console.log('Creating file');
			await createFileOnHedera();
		}
	}
	else {
		console.log('User aborted');
	}
});
