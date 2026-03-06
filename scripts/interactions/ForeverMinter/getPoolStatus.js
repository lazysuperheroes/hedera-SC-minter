const { initScript, runScript } = require('../../lib/scriptBase');
const { readContract } = require('../../lib/contractHelpers');
const { readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const { client, operatorId, operatorKey, contractId, env, iface } = initScript({
		contractName: 'ForeverMinter',
		contractEnvVar: 'FOREVER_MINTER_CONTRACT_ID',
	});

	// Parse pagination from arguments
	let page = 1;
	let pageSize = 50;

	if (process.argv.length >= 3) {
		page = parseInt(process.argv[2]);
		if (isNaN(page) || page < 1) {
			console.log('❌ Error: Invalid page number');
			return;
		}
	}

	if (process.argv.length >= 4) {
		pageSize = parseInt(process.argv[3]);
		if (isNaN(pageSize) || pageSize < 1 || pageSize > 200) {
			console.log('❌ Error: Invalid page size (must be 1-200)');
			return;
		}
	}

	if (!jsonMode) console.log('\n📦 ForeverMinter - NFT Pool Status');
	if (!jsonMode) console.log('=====================================\n');

	try {
		// Get remaining supply
		const remainingSupply = Number((await readContract(iface, env, contractId, operatorId, 'getRemainingSupply'))[0]);

		if (!jsonMode) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		if (!jsonMode) console.log('📊 Pool Overview');
		if (!jsonMode) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		if (!jsonMode) console.log(`Remaining Supply: ${remainingSupply} NFTs`);

		if (remainingSupply === 0) {
			if (jsonMode) {
				console.log(JSON.stringify({
					remainingSupply: 0,
					page,
					pageSize,
					startIndex: (page - 1) * pageSize,
					serialsReturned: 0,
					serials: [],
					hasMore: false,
				}, null, 2));
				return;
			}
			console.log('\n⚠️  Pool is empty - no NFTs available for minting');
			return;
		}

		// Get paginated serials
		const startIndex = (page - 1) * pageSize;
		const limit = pageSize;

		if (!jsonMode) console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		if (!jsonMode) console.log(`📋 Available Pool Serials (Page ${page})`);
		if (!jsonMode) console.log(`   Offset: ${startIndex}, Limit: ${limit}`);
		if (!jsonMode) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		// Get paginated available serials
		const serialsCommand = iface.encodeFunctionData('getAvailableSerialsPaginated', [startIndex, limit]);
		const serialsResult = await readOnlyEVMFromMirrorNode(env, contractId, serialsCommand, operatorId, false);
		const serials = iface.decodeFunctionResult('getAvailableSerialsPaginated', serialsResult)[0];

		if (jsonMode) {
			const serialNumbers = serials.map(s => Number(s));
			console.log(JSON.stringify({
				remainingSupply,
				page,
				pageSize,
				startIndex,
				serialsReturned: serialNumbers.length,
				serials: serialNumbers,
				hasMore: serials.length === limit,
			}, null, 2));
			return;
		}

		if (serials.length === 0) {
			if (startIndex === 0) {
				console.log('No serials available in pool\n');
			}
			else {
				console.log(`❌ No serials at offset ${startIndex}`);
				console.log(`   Pool may have fewer than ${startIndex + 1} serials\n`);
			}
			return;
		}

		// Display serials
		console.log(`Found ${serials.length} serials:\n`);

		// Display in rows of 10
		for (let i = 0; i < serials.length; i += 10) {
			const chunk = serials.slice(i, Math.min(i + 10, serials.length));
			const serialNumbers = chunk.map(s => Number(s));
			console.log(`   ${serialNumbers.join(', ')}`);
		}

		// Pagination info
		const hasMore = serials.length === limit;

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('📖 Pagination');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		console.log(`Page ${page} (showing ${serials.length} serials)`);
		console.log(`Remaining in pool: ${remainingSupply}`);

		if (page > 1) {
			console.log(`\n⬅️  Previous page: node getPoolStatus.js ${page - 1} ${pageSize}`);
		}

		if (hasMore) {
			console.log(`➡️  Next page: node getPoolStatus.js ${page + 1} ${pageSize}`);
		}

		console.log('\n💡 Usage:');
		console.log('   node getPoolStatus.js [page] [pageSize]');
		console.log('   • page: Page number (default: 1)');
		console.log('   • pageSize: Serials per page (default: 50, max: 200)');

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	}
	catch (error) {
		console.log('❌ Error loading pool status:', error.message);
	}
});
