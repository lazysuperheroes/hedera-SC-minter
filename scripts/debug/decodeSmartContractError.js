const {
	AccountId,
} = require('@hashgraph/sdk');

const { ethers } = require('ethers');
const axios = require('axios');

let contractId = '';
let mirrorUrl = '';

function errorSignature(error_message) {
	const data = error_message.startsWith('0x') ? error_message : '0x' + error_message;
	const signature = data.slice(0, 10);
	return { data, signature };
}

async function getErrorFromMirror(silent, depth = 1) {
	const url = `https://${mirrorUrl}.mirrornode.hedera.com/api/v1/contracts/${contractId}/results?order=desc&limit=${depth}`;

	const response = await axios(url);
	const jsonResponse = response.data;

	if (jsonResponse.results[depth - 1].error_message) {
		const error_message = jsonResponse.results[depth - 1].error_message;
		if (error_message) {
			return errorSignature(error_message);
		}
	}

	if (!silent) {
		console.error('no error message found');
	}
	return { data: '', signature: '' };
}

async function getAbi(signature, silent) {
	const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${signature}`;

	const response = await axios(url);
	const jsonResponse = response.data;

	if (jsonResponse.count == 1) {
		return jsonResponse.results[0].text_signature;
	}
	else if (jsonResponse.count == 0) {
		if (!silent) {
			console.error('response from www.4byte.directory contained no data');
		}
	}
	else if (!silent) {
		console.error('response from www.4byte.directory resulted in too many results');
	}
	return '';
}

async function processError(error, silent, indent) {
	if (error.signature) {
		const errorFunction = await getAbi(error.signature);
		if (errorFunction != '') {
			// Build an ethers Interface from the text signature (e.g. "BootstrapCallFailedError(address,bytes)")
			const iface = new ethers.Interface([`function ${errorFunction}`]);
			const decoded = iface.decodeFunctionData(errorFunction.split('(')[0], error.data);
			const fragment = iface.getFunction(errorFunction.split('(')[0]);

			if (decoded && fragment) {
				console.log(`${'.'.repeat(indent)}Error is ${fragment.name}`);
				fragment.inputs.forEach((input, i) => {
					const value = decoded[i];
					console.log(`${'.'.repeat(indent)}Parameter (${input.type}) = ${value}`);

					if (input.type == 'address') {
						console.log(`${'.'.repeat(indent)}=> Hedera address ${AccountId.fromSolidityAddress(value)}`);
					}
					console.log('');

					if ((input.type == 'bytes') && (value != null)) {
						const innerError = errorSignature(value);
						processError(innerError, true, indent + 2);
					}
				});
			}
		}
	}
	else if (!silent) {
		console.error('no error signature found');
	}
}

async function main() {

	console.log('');
	const args = process.argv.slice(2);
	if (args.length == 1) {
		const error = errorSignature(args[0]);
		await processError(error, false, 0);
	}
	else if (args.length == 2) {
		mirrorUrl = args[0];
		contractId = args[1];

		const error = await getErrorFromMirror(false);
		await processError(error, false, 0);
	}
	else if (args.length == 3) {
		mirrorUrl = args[0];
		contractId = args[1];

		const depth = args[2];
		for (let d = 1; d <= depth; d++) {
			console.log('Depth:', d);
			const error = await getErrorFromMirror(false, d);
			await processError(error, false, 0);
		}
	}
	else {
		console.error('invalid command line arguments supplied, please consult README.md');
	}
}

void main();