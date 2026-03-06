const { initScript, runScript } = require('../../lib/scriptBase');
const { readOnlyEVMFromMirrorNode } = require('../../../utils/solidityHelpers');

const jsonMode = process.env.HEDERA_MINT_JSON === '1';

runScript(async () => {
	const { operatorId, contractId, env, iface: minterIface } = initScript({
		contractName: 'SoulboundBadgeMinter',
		contractEnvVar: 'CONTRACT_ID',
	});

	// Check for optional badge ID or "all" argument
	let badgeId = null;
	let showAll = false;

	if (process.argv.length === 3) {
		const arg = process.argv[2];
		if (arg.toLowerCase() === 'all') {
			showAll = true;
		}
		else {
			badgeId = parseInt(arg);
			if (isNaN(badgeId)) {
				console.log('Usage: node getBadge.js [badgeId|all]');
				console.log('Example: node getBadge.js 1     # Get info for badge ID 1');
				console.log('Example: node getBadge.js       # Get info for active badges only');
				console.log('Example: node getBadge.js all   # Get info for all badges (active and inactive)');
				return;
			}
		}
	}

	if (!jsonMode) {
		console.log('\n-Using ENVIRONMENT:', env);
		console.log('\n-Using Operator:', operatorId.toString());
		console.log('\n-Using contract:', contractId.toString());
	}

	async function getBadgeInfo(badgeId) {
		try {
			const encodedCommand = minterIface.encodeFunctionData('getBadge', [badgeId]);

			const result = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				encodedCommand,
				operatorId,
				false,
			);

			const [name, metadata, totalMinted, maxSupply, active] = minterIface.decodeFunctionResult('getBadge', result);

			// Get remaining supply
			const remainingCommand = minterIface.encodeFunctionData('getBadgeRemainingSupply', [badgeId]);
			const remainingResult = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				remainingCommand,
				operatorId,
				false,
			);
			const remainingSupply = minterIface.decodeFunctionResult('getBadgeRemainingSupply', remainingResult);

			const remaining = Number(remainingSupply[0]);
			const mintedPercentage = Number(maxSupply) > 0
				? ((Number(totalMinted) / Number(maxSupply)) * 100).toFixed(2)
				: null;

			if (jsonMode) {
				console.log(JSON.stringify({
					contractId: contractId.toString(),
					badgeId,
					name,
					metadata,
					totalMinted: Number(totalMinted),
					maxSupply: Number(maxSupply),
					active,
					remainingSupply: remaining,
					mintedPercentage: mintedPercentage !== null ? Number(mintedPercentage) : null,
				}, null, 2));
				return;
			}

			console.log('\n===========================================');
			console.log(`BADGE ID ${badgeId} INFORMATION`);
			console.log('===========================================');

			console.log('Name:', name);
			console.log('Metadata:', metadata);
			console.log('Total Minted:', Number(totalMinted));
			console.log('Max Supply:', Number(maxSupply) === 0 ? 'Unlimited' : Number(maxSupply));
			console.log('Active:', active ? '✅ Yes' : '❌ No');
			console.log('Remaining Supply:', remaining > 1000000000 ? 'Unlimited' : remaining);

			// Calculate mint percentage if limited supply
			if (mintedPercentage !== null) {
				console.log('Minted Percentage:', `${mintedPercentage}%`);
			}

		}
		catch (error) {
			if (error.message.includes('TypeNotFound')) {
				if (jsonMode) {
					console.log(JSON.stringify({ error: `Badge ID ${badgeId} does not exist` }, null, 2));
					return;
				}
				console.log(`❌ Badge ID ${badgeId} does not exist.`);
			}
			else {
				if (jsonMode) {
					console.log(JSON.stringify({ error: error.message }, null, 2));
					return;
				}
				console.log('❌ Error fetching badge info:', error.message);
			}
		}
	}

	async function getAllBadgesInfo(showAll = false) {
		try {
			let badgeIds = [];

			if (showAll) {
				// Try to get all badges by iterating through IDs until we hit TypeNotFound
				// Start from ID 1 and keep going until we get an error
				let currentId = 1;
				// Safety limit to prevent infinite loops
				const maxAttempts = 100;

				while (currentId <= maxAttempts) {
					try {
						const testCommand = minterIface.encodeFunctionData('getBadge', [currentId]);
						await readOnlyEVMFromMirrorNode(
							env,
							contractId,
							testCommand,
							operatorId,
							false,
						);
						// If we got here, the badge exists
						badgeIds.push(currentId);
						currentId++;
					}
					catch (error) {
						if (error.message.includes('TypeNotFound')) {
							// We've reached the end of existing badges
							break;
						}
						else {
							// Some other error, skip this ID and continue
							currentId++;
						}
					}
				}

				if (badgeIds.length === 0) {
					if (jsonMode) {
						console.log(JSON.stringify({ contractId: contractId.toString(), badges: [], totalMinted: 0 }, null, 2));
						return;
					}
					console.log('No badges found.');
					return;
				}
			}
			else {
				// Get active badge IDs only
				const activeCommand = minterIface.encodeFunctionData('getActiveBadgeIds');
				const activeResult = await readOnlyEVMFromMirrorNode(
					env,
					contractId,
					activeCommand,
					operatorId,
					false,
				);
				const activeBadgeIds = minterIface.decodeFunctionResult('getActiveBadgeIds', activeResult);

				if (activeBadgeIds[0].length === 0) {
					if (jsonMode) {
						console.log(JSON.stringify({ contractId: contractId.toString(), badges: [], totalMinted: 0 }, null, 2));
						return;
					}
					console.log('No active badges found.');
					return;
				}

				badgeIds = activeBadgeIds[0].map(id => Number(id));
			}

			const badgesData = [];
			for (let i = 0; i < badgeIds.length; i++) {
				const badgeId = badgeIds[i];

				try {
					const encodedCommand = minterIface.encodeFunctionData('getBadge', [badgeId]);
					const result = await readOnlyEVMFromMirrorNode(
						env,
						contractId,
						encodedCommand,
						operatorId,
						false,
					);

					const [name, metadata, totalMinted, maxSupply, active] = minterIface.decodeFunctionResult('getBadge', result);

					badgesData.push({
						badgeId,
						name,
						metadata,
						totalMinted: Number(totalMinted),
						maxSupply: Number(maxSupply),
						active,
						progress: Number(maxSupply) > 0
							? Number(((Number(totalMinted) / Number(maxSupply)) * 100).toFixed(2))
							: null,
					});
				}
				catch (error) {
					badgesData.push({
						badgeId,
						error: error.message.includes('TypeNotFound')
							? `Badge ID ${badgeId} does not exist`
							: error.message,
					});
				}
			}

			// Get total minted across all badges
			const totalCommand = minterIface.encodeFunctionData('totalMinted');
			const totalResult = await readOnlyEVMFromMirrorNode(
				env,
				contractId,
				totalCommand,
				operatorId,
				false,
			);
			const totalMinted = minterIface.decodeFunctionResult('totalMinted', totalResult);

			if (jsonMode) {
				console.log(JSON.stringify({
					contractId: contractId.toString(),
					showAll,
					badges: badgesData,
					totalMinted: Number(totalMinted[0]),
				}, null, 2));
				return;
			}

			// Display output
			console.log('\n===========================================');
			console.log(showAll ? 'ALL BADGES INFORMATION (ACTIVE & INACTIVE)' : 'ACTIVE BADGES INFORMATION');
			console.log('===========================================');

			console.log(`Found ${badgeIds.length} badge(s):\n`);

			for (const badge of badgesData) {
				console.log(`--- Badge ID: ${badge.badgeId} ---`);

				if (badge.error) {
					console.log(`❌ ${badge.error}`);
				}
				else {
					console.log('Name:', badge.name);
					console.log('Metadata:', badge.metadata);
					console.log('Total Minted:', badge.totalMinted);
					console.log('Max Supply:', badge.maxSupply === 0 ? 'Unlimited' : badge.maxSupply);
					console.log('Active:', badge.active ? '✅' : '❌');

					if (badge.progress !== null) {
						console.log('Progress:', `${badge.progress}%`);
					}
				}

				console.log('');
			}

			console.log('===========================================');
			console.log('TOTAL MINTED ACROSS ALL BADGES:', Number(totalMinted[0]));

		}
		catch (error) {
			if (jsonMode) {
				console.log(JSON.stringify({ error: error.message }, null, 2));
				return;
			}
			console.log('❌ Error fetching badges info:', error.message);
		}
	}

	try {
		if (badgeId !== null) {
			// Get specific badge info
			await getBadgeInfo(badgeId);
		}
		else {
			// Get all badges info (active only or all badges)
			await getAllBadgesInfo(showAll);
		}
	}
	catch (error) {
		console.log('❌ Error fetching badge info:', error.message);
	}
});
