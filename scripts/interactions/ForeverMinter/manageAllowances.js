const {
	ContractId,
	TokenId,
	HbarUnit,
} = require('@hashgraph/sdk');
const readlineSync = require('readline-sync');
const { initScript, runScript } = require('../../lib/scriptBase');
const {
	setHbarAllowance,
	setFTAllowance,
	setNFTAllowanceAll,
	clearNFTAllowances,
} = require('../../../utils/hederaHelpers');
const {
	getBaseURL,
	getTokenDetails,
} = require('../../../utils/hederaMirrorHelpers');
const { default: axios } = require('axios');

// Token details cache to avoid duplicate API calls
const tokenCache = new Map();

// These will be set after initScript
let operatorId, client, env;

/**
 * Get HBAR allowances from mirror node
 */
async function getHbarAllowances(baseUrl, accountId) {
	const url = `${baseUrl}/api/v1/accounts/${accountId}/allowances/crypto?limit=100`;

	try {
		const response = await axios.get(url);
		return response.data.allowances || [];
	}
	catch (error) {
		if (error.response?.status === 404) {
			return [];
		}
		throw error;
	}
}

/**
 * Get FT allowances from mirror node
 */
async function getFTAllowances(baseUrl, accountId) {
	const url = `${baseUrl}/api/v1/accounts/${accountId}/allowances/tokens?limit=100`;

	try {
		const response = await axios.get(url);
		return response.data.allowances || [];
	}
	catch (error) {
		if (error.response?.status === 404) {
			return [];
		}
		throw error;
	}
}

/**
 * Get NFT allowances (approved for all) from mirror node
 */
async function getNFTAllowances(baseUrl, accountId) {
	const url = `${baseUrl}/api/v1/accounts/${accountId}/allowances/nfts?limit=100`;

	try {
		const response = await axios.get(url);
		return response.data.allowances || [];
	}
	catch (error) {
		if (error.response?.status === 404) {
			return [];
		}
		throw error;
	}
}

/**
 * Get token details with caching
 */
async function getCachedTokenDetails(tokenId) {
	const tokenIdStr = tokenId.toString();

	if (tokenCache.has(tokenIdStr)) {
		return tokenCache.get(tokenIdStr);
	}

	const details = await getTokenDetails(env, tokenId);
	if (details) {
		tokenCache.set(tokenIdStr, details);
	}

	return details;
}

/**
 * Format amount with proper decimals
 */
function formatTokenAmount(amount, decimals) {
	const divisor = Math.pow(10, decimals);
	return (amount / divisor).toFixed(decimals);
}

/**
 * Display current allowances
 */
async function viewAllowances(baseUrl) {
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('📊 VIEWING CURRENT ALLOWANCES');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	// Fetch all allowances in parallel
	console.log('🔍 Fetching allowances from mirror node...\n');

	const [hbarAllowances, ftAllowances, nftAllowances] = await Promise.all([
		getHbarAllowances(baseUrl, operatorId.toString()),
		getFTAllowances(baseUrl, operatorId.toString()),
		getNFTAllowances(baseUrl, operatorId.toString()),
	]);

	// Display HBAR allowances
	console.log('💎 HBAR ALLOWANCES');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	if (hbarAllowances.length === 0) {
		console.log('   No HBAR allowances set\n');
	}
	else {
		console.log('   Spender                   Amount (tℏ)     Granted (tℏ)');
		console.log('   ─────────────────────────────────────────────────────');

		for (const allowance of hbarAllowances) {
			const spender = allowance.spender.padEnd(25);
			const amount = allowance.amount.toString().padEnd(15);
			const granted = allowance.amount_granted.toString();
			console.log(`   ${spender} ${amount} ${granted}`);
		}
		console.log();
	}

	// Display FT allowances
	console.log('🪙 FUNGIBLE TOKEN ALLOWANCES');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	if (ftAllowances.length === 0) {
		console.log('   No FT allowances set\n');
	}
	else {
		// Fetch token details for all FTs in parallel
		const tokenDetailsPromises = ftAllowances.map(allowance =>
			getCachedTokenDetails(TokenId.fromString(allowance.token_id)),
		);
		const tokenDetails = await Promise.all(tokenDetailsPromises);

		console.log('   Token                     Symbol    Amount           Spender');
		console.log('   ─────────────────────────────────────────────────────────────────');

		for (let i = 0; i < ftAllowances.length; i++) {
			const allowance = ftAllowances[i];
			const details = tokenDetails[i];

			const tokenId = allowance.token_id.padEnd(25);
			const symbol = (details?.symbol || 'UNKNOWN').padEnd(9);
			const amount = details
				? formatTokenAmount(allowance.amount, details.decimals).padEnd(16)
				: allowance.amount.toString().padEnd(16);
			const spender = allowance.spender;

			console.log(`   ${tokenId} ${symbol} ${amount} ${spender}`);
		}
		console.log();
	}

	// Display NFT allowances
	console.log('🖼️  NFT ALLOWANCES (Approved for All)');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	if (nftAllowances.length === 0) {
		console.log('   No NFT allowances set\n');
	}
	else {
		// Fetch token details for all NFTs in parallel
		const nftDetailsPromises = nftAllowances
			.filter(allowance => allowance.approved_for_all)
			.map(allowance => getCachedTokenDetails(TokenId.fromString(allowance.token_id)));
		const nftDetails = await Promise.all(nftDetailsPromises);

		const approvedForAll = nftAllowances.filter(a => a.approved_for_all);

		console.log('   Token                     Name                      Spender');
		console.log('   ─────────────────────────────────────────────────────────────────');

		for (let i = 0; i < approvedForAll.length; i++) {
			const allowance = approvedForAll[i];
			const details = nftDetails[i];

			const tokenId = allowance.token_id.padEnd(25);
			const name = (details?.name || 'UNKNOWN').substring(0, 25).padEnd(25);
			const spender = allowance.spender;

			console.log(`   ${tokenId} ${name} ${spender}`);
		}
		console.log();
	}

	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Add HBAR allowance
 */
async function addHbarAllowance() {
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('💎 ADD HBAR ALLOWANCE');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	const spenderInput = readlineSync.question('Enter spender account/contract ID (e.g., 0.0.123456): ').trim();

	if (!spenderInput) {
		console.log('❌ Spender ID required');
		return;
	}

	const spenderId = ContractId.fromString(spenderInput);

	const amountInput = readlineSync.question('Enter HBAR amount in tinybar (e.g., 100000000 for 1 HBAR): ').trim();
	const amount = parseInt(amountInput);

	if (isNaN(amount) || amount <= 0) {
		console.log('❌ Invalid amount');
		return;
	}

	console.log('\n📋 Summary:');
	console.log(`   Spender: ${spenderId.toString()}`);
	console.log(`   Amount: ${amount} tℏ (${amount / 100_000_000} HBAR)`);

	const confirm = readlineSync.question('\nProceed with setting HBAR allowance? (y/N): ');
	if (confirm.toLowerCase() !== 'y') {
		console.log('❌ Cancelled');
		return;
	}

	console.log('\n⏳ Setting HBAR allowance...');
	const result = await setHbarAllowance(client, operatorId, spenderId, amount, HbarUnit.Tinybar);

	if (result === 'SUCCESS') {
		console.log('✅ HBAR allowance set successfully!');
	}
	else {
		console.log('❌ Failed to set HBAR allowance:', result);
	}
}

/**
 * Remove HBAR allowance
 */
async function removeHbarAllowance(baseUrl) {
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('💎 REMOVE HBAR ALLOWANCE');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	const hbarAllowances = await getHbarAllowances(baseUrl, operatorId.toString());

	if (hbarAllowances.length === 0) {
		console.log('No HBAR allowances to remove\n');
		return;
	}

	console.log('Current HBAR Allowances:\n');
	hbarAllowances.forEach((allowance, index) => {
		console.log(`${index + 1}. Spender: ${allowance.spender}, Amount: ${allowance.amount} tℏ`);
	});

	const selection = readlineSync.question('\nSelect allowance to remove (number): ').trim();
	const index = parseInt(selection) - 1;

	if (isNaN(index) || index < 0 || index >= hbarAllowances.length) {
		console.log('❌ Invalid selection');
		return;
	}

	const allowance = hbarAllowances[index];
	const spenderId = ContractId.fromString(allowance.spender);

	console.log('\n📋 Removing:');
	console.log(`   Spender: ${allowance.spender}`);
	console.log(`   Current Amount: ${allowance.amount} tℏ`);

	const confirm = readlineSync.question('\nProceed with removing (setting to 0)? (y/N): ');
	if (confirm.toLowerCase() !== 'y') {
		console.log('❌ Cancelled');
		return;
	}

	console.log('\n⏳ Removing HBAR allowance...');
	const result = await setHbarAllowance(client, operatorId, spenderId, 0, HbarUnit.Tinybar);

	if (result === 'SUCCESS') {
		console.log('✅ HBAR allowance removed successfully!');
	}
	else {
		console.log('❌ Failed to remove HBAR allowance:', result);
	}
}

/**
 * Add FT allowance
 */
async function addFTAllowance() {
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('🪙 ADD FUNGIBLE TOKEN ALLOWANCE');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	const tokenInput = readlineSync.question('Enter token ID (e.g., 0.0.123456): ').trim();

	if (!tokenInput) {
		console.log('❌ Token ID required');
		return;
	}

	const tokenId = TokenId.fromString(tokenInput);

	console.log('\n⏳ Fetching token details...');
	const tokenDetails = await getCachedTokenDetails(tokenId);

	if (!tokenDetails) {
		console.log('❌ Failed to fetch token details. Token may not exist.');
		return;
	}

	console.log(`✅ Token: ${tokenDetails.name} (${tokenDetails.symbol})`);
	console.log(`   Decimals: ${tokenDetails.decimals}\n`);

	const spenderInput = readlineSync.question('Enter spender account/contract ID (e.g., 0.0.123456): ').trim();

	if (!spenderInput) {
		console.log('❌ Spender ID required');
		return;
	}

	const spenderId = ContractId.fromString(spenderInput);

	const amountInput = readlineSync.question(`Enter amount (in ${tokenDetails.symbol}): `).trim();
	const amount = parseFloat(amountInput);

	if (isNaN(amount) || amount <= 0) {
		console.log('❌ Invalid amount');
		return;
	}

	// Convert to smallest denomination
	const amountInSmallestUnit = Math.floor(amount * Math.pow(10, tokenDetails.decimals));

	console.log('\n📋 Summary:');
	console.log(`   Token: ${tokenId.toString()} (${tokenDetails.symbol})`);
	console.log(`   Spender: ${spenderId.toString()}`);
	console.log(`   Amount: ${amount} ${tokenDetails.symbol} (${amountInSmallestUnit} in smallest units)`);

	const confirm = readlineSync.question('\nProceed with setting FT allowance? (y/N): ');
	if (confirm.toLowerCase() !== 'y') {
		console.log('❌ Cancelled');
		return;
	}

	console.log('\n⏳ Setting FT allowance...');
	const result = await setFTAllowance(client, tokenId, operatorId, spenderId, amountInSmallestUnit);

	if (result === 'SUCCESS') {
		console.log('✅ FT allowance set successfully!');
	}
	else {
		console.log('❌ Failed to set FT allowance:', result);
	}
}

/**
 * Remove FT allowance
 */
async function removeFTAllowance(baseUrl) {
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('🪙 REMOVE FUNGIBLE TOKEN ALLOWANCE');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	const ftAllowances = await getFTAllowances(baseUrl, operatorId.toString());

	if (ftAllowances.length === 0) {
		console.log('No FT allowances to remove\n');
		return;
	}

	// Fetch token details in parallel
	console.log('⏳ Fetching token details...\n');
	const tokenDetailsPromises = ftAllowances.map(allowance =>
		getCachedTokenDetails(TokenId.fromString(allowance.token_id)),
	);
	const tokenDetails = await Promise.all(tokenDetailsPromises);

	console.log('Current FT Allowances:\n');
	ftAllowances.forEach((allowance, index) => {
		const details = tokenDetails[index];
		const symbol = details?.symbol || 'UNKNOWN';
		const amount = details
			? formatTokenAmount(allowance.amount, details.decimals)
			: allowance.amount.toString();
		console.log(`${index + 1}. Token: ${allowance.token_id} (${symbol}), Spender: ${allowance.spender}, Amount: ${amount}`);
	});

	const selection = readlineSync.question('\nSelect allowance to remove (number): ').trim();
	const index = parseInt(selection) - 1;

	if (isNaN(index) || index < 0 || index >= ftAllowances.length) {
		console.log('❌ Invalid selection');
		return;
	}

	const allowance = ftAllowances[index];
	const details = tokenDetails[index];
	const tokenId = TokenId.fromString(allowance.token_id);
	const spenderId = ContractId.fromString(allowance.spender);

	console.log('\n📋 Removing:');
	console.log(`   Token: ${allowance.token_id} (${details?.symbol || 'UNKNOWN'})`);
	console.log(`   Spender: ${allowance.spender}`);
	console.log(`   Current Amount: ${details ? formatTokenAmount(allowance.amount, details.decimals) : allowance.amount}`);

	const confirm = readlineSync.question('\nProceed with removing (setting to 0)? (y/N): ');
	if (confirm.toLowerCase() !== 'y') {
		console.log('❌ Cancelled');
		return;
	}

	console.log('\n⏳ Removing FT allowance...');
	const result = await setFTAllowance(client, tokenId, operatorId, spenderId, 0);

	if (result === 'SUCCESS') {
		console.log('✅ FT allowance removed successfully!');
	}
	else {
		console.log('❌ Failed to remove FT allowance:', result);
	}
}

/**
 * Add NFT allowance (approved for all)
 */
async function addNFTAllowance() {
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('🖼️  ADD NFT ALLOWANCE (All Serials)');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	const tokensInput = readlineSync.question('Enter NFT token IDs (comma separated, e.g., 0.0.123456,0.0.789012): ').trim();

	if (!tokensInput) {
		console.log('❌ Token ID(s) required');
		return;
	}

	const tokenIds = tokensInput.split(',').map(t => TokenId.fromString(t.trim()));

	console.log('\n⏳ Fetching token details...');
	const tokenDetailsPromises = tokenIds.map(tokenId => getCachedTokenDetails(tokenId));
	const tokenDetails = await Promise.all(tokenDetailsPromises);

	console.log('\nTokens to approve:');
	tokenIds.forEach((tokenId, index) => {
		const details = tokenDetails[index];
		console.log(`   ${index + 1}. ${tokenId.toString()} - ${details?.name || 'UNKNOWN'}`);
	});

	const spenderInput = readlineSync.question('\nEnter spender account/contract ID (e.g., 0.0.123456): ').trim();

	if (!spenderInput) {
		console.log('❌ Spender ID required');
		return;
	}

	const spenderId = ContractId.fromString(spenderInput);

	console.log('\n📋 Summary:');
	console.log(`   Tokens: ${tokenIds.length} NFT collection(s)`);
	console.log(`   Spender: ${spenderId.toString()}`);
	console.log('   Scope: All serials (approved for all)');

	const confirm = readlineSync.question('\nProceed with setting NFT allowance? (y/N): ');
	if (confirm.toLowerCase() !== 'y') {
		console.log('❌ Cancelled');
		return;
	}

	console.log('\n⏳ Setting NFT allowance...');
	const result = await setNFTAllowanceAll(client, tokenIds, operatorId, spenderId);

	if (result === 'SUCCESS') {
		console.log('✅ NFT allowance set successfully!');
	}
	else {
		console.log('❌ Failed to set NFT allowance:', result);
	}
}

/**
 * Remove NFT allowance
 */
async function removeNFTAllowance(baseUrl) {
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('🖼️  REMOVE NFT ALLOWANCE');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	const nftAllowances = await getNFTAllowances(baseUrl, operatorId.toString());
	const approvedForAll = nftAllowances.filter(a => a.approved_for_all);

	if (approvedForAll.length === 0) {
		console.log('No NFT allowances to remove\n');
		return;
	}

	// Fetch token details in parallel
	console.log('⏳ Fetching token details...\n');
	const tokenDetailsPromises = approvedForAll.map(allowance =>
		getCachedTokenDetails(TokenId.fromString(allowance.token_id)),
	);
	const tokenDetails = await Promise.all(tokenDetailsPromises);

	console.log('Current NFT Allowances (Approved for All):\n');
	approvedForAll.forEach((allowance, index) => {
		const details = tokenDetails[index];
		console.log(`${index + 1}. Token: ${allowance.token_id} (${details?.name || 'UNKNOWN'}), Spender: ${allowance.spender}`);
	});

	const selection = readlineSync.question('\nSelect allowance to remove (number): ').trim();
	const index = parseInt(selection) - 1;

	if (isNaN(index) || index < 0 || index >= approvedForAll.length) {
		console.log('❌ Invalid selection');
		return;
	}

	const allowance = approvedForAll[index];
	const details = tokenDetails[index];
	const tokenId = TokenId.fromString(allowance.token_id);
	const spenderId = ContractId.fromString(allowance.spender);

	console.log('\n📋 Removing:');
	console.log(`   Token: ${allowance.token_id} (${details?.name || 'UNKNOWN'})`);
	console.log(`   Spender: ${allowance.spender}`);
	console.log('   Scope: All serials');

	const confirm = readlineSync.question('\nProceed with removing NFT allowance? (y/N): ');
	if (confirm.toLowerCase() !== 'y') {
		console.log('❌ Cancelled');
		return;
	}

	console.log('\n⏳ Removing NFT allowance...');
	const result = await clearNFTAllowances(client, [{
		tokenId: tokenId,
		owner: operatorId,
		spender: spenderId,
	}]);

	if (result === 'SUCCESS') {
		console.log('✅ NFT allowance removed successfully!');
	}
	else {
		console.log('❌ Failed to remove NFT allowance:', result);
	}
}

/**
 * Main menu
 */
async function mainMenu(baseUrl) {
	while (true) {
		console.log('\n╔════════════════════════════════════════════════╗');
		console.log('║      🔐 ALLOWANCE MANAGEMENT UTILITY 🔐       ║');
		console.log('╚════════════════════════════════════════════════╝\n');
		console.log('What would you like to do?\n');
		console.log('   1. 📊 View all allowances');
		console.log('   2. 💎 Add HBAR allowance');
		console.log('   3. 💎 Remove HBAR allowance');
		console.log('   4. 🪙 Add FT allowance');
		console.log('   5. 🪙 Remove FT allowance');
		console.log('   6. 🖼️  Add NFT allowance (all serials)');
		console.log('   7. 🖼️  Remove NFT allowance');
		console.log('   8. ❌ Exit\n');

		const choice = readlineSync.question('Enter your choice (1-8): ').trim();

		switch (choice) {
		case '1':
			await viewAllowances(baseUrl);
			break;
		case '2':
			await addHbarAllowance();
			break;
		case '3':
			await removeHbarAllowance(baseUrl);
			break;
		case '4':
			await addFTAllowance();
			break;
		case '5':
			await removeFTAllowance(baseUrl);
			break;
		case '6':
			await addNFTAllowance();
			break;
		case '7':
			await removeNFTAllowance(baseUrl);
			break;
		case '8':
			console.log('\n👋 Goodbye!\n');
			return;
		default:
			console.log('\n❌ Invalid choice. Please select 1-8.\n');
		}

		// Pause before showing menu again
		readlineSync.question('\nPress Enter to continue...');
	}
}

runScript(async () => {
	const scriptContext = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Set module-level variables for use in helper functions
	operatorId = scriptContext.operatorId;
	client = scriptContext.client;
	env = scriptContext.env;

	console.log('\n🔐 Allowance Management Utility');
	console.log('════════════════════════════════════════════════\n');
	console.log(`Account: ${operatorId.toString()}`);
	console.log(`Network: ${env.toUpperCase()}`);

	const baseUrl = getBaseURL(env);

	console.log('\n💡 TIP: This utility allows you to manage HBAR, FT, and NFT');
	console.log('   allowances for the ForeverMinter contract or any spender.\n');

	await mainMenu(baseUrl);
});
