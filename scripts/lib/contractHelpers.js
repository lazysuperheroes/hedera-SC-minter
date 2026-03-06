const { readOnlyEVMFromMirrorNode } = require('../../utils/solidityHelpers');

/**
 * Read a contract function via mirror node (read-only EVM call).
 * Encodes the call, executes via mirror node, and decodes the result.
 *
 * @param {import('ethers').Interface} iface - ethers Interface for the contract
 * @param {string} env - Environment (TEST, MAIN, etc.)
 * @param {import('@hashgraph/sdk').ContractId} contractId - Contract to call
 * @param {import('@hashgraph/sdk').AccountId} operatorId - Caller account
 * @param {string} functionName - Solidity function name
 * @param {Array} [args=[]] - Function arguments
 * @returns {Promise<import('ethers').Result>} Decoded function result
 */
async function readContract(iface, env, contractId, operatorId, functionName, args = []) {
	const encodedCommand = iface.encodeFunctionData(functionName, args);
	const result = await readOnlyEVMFromMirrorNode(env, contractId, encodedCommand, operatorId, false);
	return iface.decodeFunctionResult(functionName, result);
}

module.exports = {
	readContract,
};
