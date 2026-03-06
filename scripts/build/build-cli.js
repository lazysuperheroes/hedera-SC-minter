#!/usr/bin/env node
/**
 * Build @lazysuperheroes/hedera-minter-cli package.
 * Copies interaction scripts with rewritten imports and generates a Commander.js entry point.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist', 'cli');
const SCRIPTS_SRC = path.join(ROOT, 'scripts', 'interactions');
const DEPLOY_SRC = path.join(ROOT, 'scripts', 'deployment');
const DEBUG_SRC = path.join(ROOT, 'scripts', 'debug');
const PKG_TEMPLATE = path.join(ROOT, 'packages', 'cli', 'package.json');

// Import path rewrites: regex pattern -> replacement
const IMPORT_REWRITES = [
	// scriptBase and contractHelpers -> SDK package
	[/require\(['"]\.\.?\/(?:\.\.\/)*lib\/scriptBase['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk')"],
	[/require\(['"]\.\.?\/(?:\.\.\/)*lib\/contractHelpers['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/lib/contractHelpers')"],
	// utils -> SDK package modules
	[/require\(['"]\.\.?\/(?:\.\.\/)*utils\/solidityHelpers['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/contract')"],
	[/require\(['"]\.\.?\/(?:\.\.\/)*utils\/hederaHelpers['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/hedera')"],
	[/require\(['"]\.\.?\/(?:\.\.\/)*utils\/hederaMirrorHelpers['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/mirror')"],
	[/require\(['"]\.\.?\/(?:\.\.\/)*utils\/gasHelpers['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/gas')"],
	[/require\(['"]\.\.?\/(?:\.\.\/)*utils\/transactionHelpers['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/transaction')"],
	[/require\(['"]\.\.?\/(?:\.\.\/)*utils\/nodeHelpers['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/node')"],
	// readline-sync -> SDK readline wrapper (supports --no-input mode)
	[/require\(['"]readline-sync['"]\)/g, "require('@lazysuperheroes/hedera-minter-sdk/readline')"],
];

// Command tree: group -> commands
// Each command: { name, description, script (relative to SCRIPTS_SRC or special prefix), args? }
const COMMAND_TREE = {
	forever: {
		description: 'ForeverMinter — pool-based NFT distribution',
		commands: [
			{ name: 'info', description: 'Show contract configuration', script: 'ForeverMinter/getContractInfo.js' },
			{ name: 'mint', description: 'Mint NFTs (interactive)', script: 'ForeverMinter/mint.js', args: '[quantity]' },
			{ name: 'cost', description: 'Calculate mint cost', script: 'ForeverMinter/checkMintCost.js', args: '<quantity>' },
			{ name: 'discounts', description: 'Check available discounts', script: 'ForeverMinter/checkDiscounts.js' },
			{ name: 'refund', description: 'Refund minted NFTs', script: 'ForeverMinter/refund.js' },
			{ name: 'refund-check', description: 'Check refund eligibility', script: 'ForeverMinter/checkRefundEligibility.js' },
			{ name: 'pool', description: 'Show pool status', script: 'ForeverMinter/getPoolStatus.js' },
			{ name: 'history', description: 'Show mint history', script: 'ForeverMinter/getMintHistory.js' },
			{ name: 'events', description: 'Scan contract events', script: 'ForeverMinter/scanEvents.js' },
			{ name: 'wl-check', description: 'Check whitelist slots', script: 'ForeverMinter/checkWLSlots.js' },
			{ name: 'wl-buy', description: 'Buy whitelist slots', script: 'ForeverMinter/buyWhitelistSlots.js' },
			{ name: 'allowances', description: 'Manage token allowances', script: 'ForeverMinter/manageAllowances.js' },
		],
		admin: [
			{ name: 'pause', description: 'Pause/unpause minting', script: 'ForeverMinter/admin/setPause.js', args: '<true|false>' },
			{ name: 'wl-add', description: 'Add to whitelist', script: 'ForeverMinter/admin/addToWhitelist.js' },
			{ name: 'wl-batch', description: 'Batch add to whitelist', script: 'ForeverMinter/admin/batchAddToWhitelist.js' },
			{ name: 'wl-remove', description: 'Remove from whitelist', script: 'ForeverMinter/admin/removeFromWhitelist.js' },
			{ name: 'pool-add', description: 'Add NFTs to pool', script: 'ForeverMinter/admin/addToPool.js' },
			{ name: 'pool-register', description: 'Register pool NFTs', script: 'ForeverMinter/admin/registerPoolNFTs.js' },
			{ name: 'economics', description: 'Update mint economics', script: 'ForeverMinter/admin/updateMintEconomics.js' },
			{ name: 'timing', description: 'Update mint timing', script: 'ForeverMinter/admin/updateMintTiming.js' },
			{ name: 'discount-add', description: 'Add discount tier', script: 'ForeverMinter/admin/addDiscountTier.js' },
			{ name: 'discount-remove', description: 'Remove discount tier', script: 'ForeverMinter/admin/removeDiscountTier.js' },
			{ name: 'discount-update', description: 'Update discount tier', script: 'ForeverMinter/admin/updateDiscountTier.js' },
			{ name: 'discount-usage', description: 'Manage discount serial usage', script: 'ForeverMinter/admin/manageDiscountUsage.js' },
			{ name: 'sacrifice-dest', description: 'Set sacrifice destination', script: 'ForeverMinter/admin/setSacrificeDestination.js' },
			{ name: 'lazy-burn', description: 'Set LAZY burn percentage', script: 'ForeverMinter/admin/setLazyBurnPercentage.js' },
			{ name: 'admins', description: 'List admins', script: 'ForeverMinter/admin/listAdmins.js' },
			{ name: 'add-admin', description: 'Add admin', script: 'ForeverMinter/admin/addAdmin.js' },
			{ name: 'remove-admin', description: 'Remove admin', script: 'ForeverMinter/admin/removeAdmin.js' },
			{ name: 'withdraw', description: 'Withdraw HBAR', script: 'ForeverMinter/admin/withdrawHbar.js' },
			{ name: 'emergency-nft', description: 'Emergency withdraw NFT', script: 'ForeverMinter/admin/emergencyWithdrawNFT.js' },
		],
	},
	badge: {
		description: 'SoulboundBadgeMinter — multiple badge types in one contract',
		commands: [
			{ name: 'info', description: 'Show contract configuration', script: 'BadgeMinter/getContractInfo.js' },
			{ name: 'create', description: 'Create a new badge type', script: 'BadgeMinter/createBadge.js', args: '<name> <metadata> <maxSupply>' },
			{ name: 'update', description: 'Update badge metadata', script: 'BadgeMinter/updateBadge.js' },
			{ name: 'get', description: 'Get badge details', script: 'BadgeMinter/getBadge.js' },
			{ name: 'activate', description: 'Activate a badge type', script: 'BadgeMinter/activateBadge.js' },
			{ name: 'mint', description: 'Mint a badge', script: 'BadgeMinter/mintBadge.js' },
			{ name: 'burn', description: 'Burn a badge', script: 'BadgeMinter/burnBadge.js' },
			{ name: 'check', description: 'Check user eligibility', script: 'BadgeMinter/checkUserEligibility.js' },
			{ name: 'revoke', description: 'Revoke soulbound token', script: 'BadgeMinter/revokeSBT.js' },
			{ name: 'wl-add', description: 'Add to badge whitelist', script: 'BadgeMinter/addToBadgeWhitelist.js' },
			{ name: 'prepare', description: 'Prepare badge minter', script: 'BadgeMinter/prepareBadgeMinter.js' },
			{ name: 'admins', description: 'List admins', script: 'BadgeMinter/listAdmins.js' },
			{ name: 'add-admin', description: 'Add admin', script: 'BadgeMinter/addAdmin.js' },
			{ name: 'remove-admin', description: 'Remove admin', script: 'BadgeMinter/removeAdmin.js' },
			{ name: 'withdraw', description: 'Withdraw HBAR', script: 'BadgeMinter/transferHbar.js' },
		],
	},
	edition: {
		description: 'EditionWithPrize — limited editions with prize lottery',
		commands: [
			{ name: 'info', description: 'Show contract state', script: 'EditionWithPrize/getContractState.js' },
			{ name: 'mint', description: 'Mint an edition', script: 'EditionWithPrize/mint.js' },
			{ name: 'cost', description: 'Check mint cost', script: 'EditionWithPrize/checkMintCost.js' },
			{ name: 'wl-check', description: 'Check whitelist status', script: 'EditionWithPrize/checkWLStatus.js' },
			{ name: 'wl-lazy', description: 'Purchase WL with LAZY', script: 'EditionWithPrize/purchaseWLWithLazy.js' },
			{ name: 'wl-token', description: 'Purchase WL with token', script: 'EditionWithPrize/purchaseWLWithToken.js' },
			{ name: 'claim', description: 'Claim prize', script: 'EditionWithPrize/claimPrize.js' },
			{ name: 'select-winner', description: 'Select lottery winner', script: 'EditionWithPrize/selectWinner.js' },
			{ name: 'winners', description: 'Show winner list', script: 'EditionWithPrize/getWinnerList.js' },
		],
		admin: [
			{ name: 'pause', description: 'Pause/unpause minting', script: 'EditionWithPrize/admin/setPause.js', args: '<true|false>' },
			{ name: 'wl-add', description: 'Add to whitelist', script: 'EditionWithPrize/admin/addToWhitelist.js' },
			{ name: 'wl-remove', description: 'Remove from whitelist', script: 'EditionWithPrize/admin/removeFromWhitelist.js' },
			{ name: 'wl-only', description: 'Set whitelist-only mode', script: 'EditionWithPrize/admin/setWlOnly.js' },
			{ name: 'wl-options', description: 'Set WL purchase options', script: 'EditionWithPrize/admin/setWlPurchaseOptions.js' },
			{ name: 'economics', description: 'Update mint economics', script: 'EditionWithPrize/admin/updateMintEconomics.js' },
			{ name: 'timing', description: 'Update mint timing', script: 'EditionWithPrize/admin/updateMintTiming.js' },
			{ name: 'init-edition', description: 'Initialize edition token', script: 'EditionWithPrize/admin/initializeEditionToken.js' },
			{ name: 'init-prize', description: 'Initialize prize token', script: 'EditionWithPrize/admin/initializePrizeToken.js' },
			{ name: 'withdraw-hbar', description: 'Withdraw HBAR', script: 'EditionWithPrize/admin/withdrawHbar.js' },
			{ name: 'withdraw-lazy', description: 'Withdraw LAZY', script: 'EditionWithPrize/admin/withdrawLazy.js' },
			{ name: 'withdraw-usdc', description: 'Withdraw USDC', script: 'EditionWithPrize/admin/withdrawUsdc.js' },
		],
	},
	minter: {
		description: 'MinterContract/SoulboundMinter — standard NFT minting',
		commands: [
			{ name: 'mint', description: 'Mint NFTs (interactive)', script: 'mint.js' },
			{ name: 'mint-behalf', description: 'Mint on behalf of another wallet', script: 'mintOnBehalfOf.js' },
			{ name: 'pause', description: 'Toggle pause state', script: 'setPause.js' },
			{ name: 'wl-add', description: 'Add to whitelist', script: 'addToWhiteList.js' },
			{ name: 'wl-remove', description: 'Remove whitelist-only mode', script: 'removeWLOnly.js' },
			{ name: 'wl-only', description: 'Set whitelist-only mode', script: 'setWLOnly.js' },
			{ name: 'wl-check', description: 'Check whitelist status', script: 'getWL.js' },
			{ name: 'mints-remaining', description: 'Check remaining mints', script: 'getRemainingMints.js' },
			{ name: 'cost', description: 'Update mint cost', script: 'updateCost.js' },
			{ name: 'max-mint', description: 'Update max mint per wallet', script: 'updateMaxMintPerWallet.js' },
			{ name: 'cid', description: 'Set metadata CID', script: 'setCID.js' },
			{ name: 'prepare', description: 'Prepare minter contract', script: 'prepareMinter.js' },
			{ name: 'reset', description: 'Reset contract', script: 'resetContract.js' },
			{ name: 'burn', description: 'Burn NFTs', script: 'burnNFTs.js' },
			{ name: 'revoke', description: 'Revoke soulbound token', script: 'revokeSBT.js' },
			{ name: 'withdraw', description: 'Withdraw funds', script: 'withdrawFunds.js' },
			{ name: 'withdraw-wallet', description: 'Withdraw to specific wallet', script: 'withdrawToWallet.js' },
			{ name: 'lazy-pays', description: 'Toggle contract-pays-LAZY', script: 'updateContractPaysLazy.js' },
			{ name: 'retry-abstract', description: 'Retry failed abstraction mints', script: 'retryFailedAbstractionMints.js' },
		],
	},
};

// Deployment scripts
const DEPLOY_COMMANDS = [
	{ name: 'minter', description: 'Deploy MinterContract', script: 'deploy-MC.js' },
	{ name: 'soulbound', description: 'Deploy SoulboundMinter', script: 'deploy-SBT.js' },
	{ name: 'forever', description: 'Deploy ForeverMinter', script: 'deploy-ForeverMinter.js' },
	{ name: 'badge', description: 'Deploy SoulboundBadgeMinter', script: 'deploy-SoulboundBadgeMinter.js' },
	{ name: 'edition', description: 'Deploy EditionWithPrize', script: 'deploy-EditionWithPrize.js' },
	{ name: 'fungible', description: 'Deploy FungibleTokenCreator', script: 'deploy-FTC.js' },
];

// Debug scripts
const DEBUG_COMMANDS = [
	{ name: 'decode', description: 'Decode smart contract error', script: 'decodeSmartContractError.js' },
	{ name: 'decode-abi', description: 'Decode error with specific ABI', script: 'decodeWithABI.js' },
	{ name: 'logs', description: 'Get contract logs', script: 'getContractLogs.js' },
	{ name: 'info', description: 'Get contract info from mirror node', script: 'getContractInfo.js' },
];

/**
 * Rewrite require() paths in a script to use SDK package imports.
 */
function rewriteImports(content) {
	for (const [pattern, replacement] of IMPORT_REWRITES) {
		content = content.replace(pattern, replacement);
	}
	return content;
}

/**
 * Copy a script file to dist, rewriting imports.
 */
function copyScript(srcPath, destPath) {
	const dir = path.dirname(destPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	let content = fs.readFileSync(srcPath, 'utf8');
	content = rewriteImports(content);
	fs.writeFileSync(destPath, content);
}

/**
 * Recursively copy all .js files from src to dest with import rewrites.
 */
function copyScripts(srcDir, destDir) {
	if (!fs.existsSync(srcDir)) return 0;

	let count = 0;
	const entries = fs.readdirSync(srcDir, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry.name);
		const destPath = path.join(destDir, entry.name);

		if (entry.isDirectory()) {
			count += copyScripts(srcPath, destPath);
		}
		else if (entry.name.endsWith('.js')) {
			copyScript(srcPath, destPath);
			count++;
		}
	}

	return count;
}

/**
 * Generate the Commander.js entry point.
 * Commands don't declare positional args in Commander — they pass all trailing
 * arguments through to the underlying script via process.argv passthrough.
 */
function generateEntryPoint() {
	const lines = [
		'#!/usr/bin/env node',
		"'use strict';",
		'',
		"const { Command } = require('commander');",
		"const path = require('path');",
		"const { execFileSync } = require('child_process');",
		'',
		'const program = new Command();',
		'',
		'program',
		"  .name('hedera-mint')",
		"  .description('CLI for deploying and managing Hedera NFT minting contracts')",
		"  .version(require('../package.json').version)",
		"  .option('--json', 'Output results as JSON (read-only commands)')",
		"  .option('--no-input', 'Non-interactive mode: auto-confirm prompts, fail on required input')",
		"  .hook('preAction', (thisCommand) => {",
		"    const root = thisCommand.root();",
		"    if (root.opts().json) process.env.HEDERA_MINT_JSON = '1';",
		"    if (root.opts().input === false) process.env.HEDERA_MINT_NO_INPUT = '1';",
		'  });',
		'',
		'// Helper: run a bundled script with inherited stdio',
		'// Passes all arguments after the command name to the script as process.argv[2+]',
		'function runScript(scriptPath, cmdArgs) {',
		'  const fullPath = path.join(__dirname, \'../commands\', scriptPath);',
		'  const args = [fullPath, ...cmdArgs];',
		'  try {',
		'    execFileSync(process.execPath, args, {',
		'      stdio: \'inherit\',',
		'      env: process.env,',
		'    });',
		'  }',
		'  catch (e) {',
		'    process.exitCode = e.status || 1;',
		'  }',
		'}',
		'',
	];

	// Generate command groups
	for (const [groupName, group] of Object.entries(COMMAND_TREE)) {
		lines.push(`// --- ${groupName} ---`);
		lines.push(`const ${groupName} = program.command('${groupName}').description('${group.description}');`);
		lines.push('');

		// Generate a helper for command creation to reduce repetition
		const genCmd = (varName, cmd, scriptPrefix = '') => {
			const desc = cmd.args
				? `${cmd.description} (${cmd.args})`
				: cmd.description;
			lines.push(`${varName}.command('${cmd.name}')`);
			lines.push(`  .description('${desc}')`);
			lines.push('  .allowUnknownOption(true)');
			lines.push('  .allowExcessArguments(true)');
			lines.push('  .action(function() {');
			lines.push(`    runScript('${scriptPrefix}${cmd.script}', this.args);`);
			lines.push('  });');
			lines.push('');
		};

		// User commands
		for (const cmd of group.commands) {
			genCmd(groupName, cmd);
		}

		// Admin subgroup
		if (group.admin) {
			lines.push(`const ${groupName}Admin = ${groupName}.command('admin').description('Admin operations for ${groupName}');`);
			lines.push('');

			for (const cmd of group.admin) {
				genCmd(`${groupName}Admin`, cmd);
			}
		}
	}

	// Deploy group
	lines.push('// --- deploy ---');
	lines.push("const deploy = program.command('deploy').description('Deploy minting contracts');");
	lines.push('');
	for (const cmd of DEPLOY_COMMANDS) {
		lines.push(`deploy.command('${cmd.name}')`);
		lines.push(`  .description('${cmd.description}')`);
		lines.push('  .allowUnknownOption(true)');
		lines.push('  .allowExcessArguments(true)');
		lines.push('  .action(function() {');
		lines.push(`    runScript('deploy/${cmd.script}', this.args);`);
		lines.push('  });');
		lines.push('');
	}

	// Debug group
	lines.push('// --- debug ---');
	lines.push("const debug = program.command('debug').description('Debug and diagnostic tools');");
	lines.push('');
	for (const cmd of DEBUG_COMMANDS) {
		lines.push(`debug.command('${cmd.name}')`);
		lines.push(`  .description('${cmd.description}')`);
		lines.push('  .allowUnknownOption(true)');
		lines.push('  .allowExcessArguments(true)');
		lines.push('  .action(function() {');
		lines.push(`    runScript('debug/${cmd.script}', this.args);`);
		lines.push('  });');
		lines.push('');
	}

	lines.push('program.parse();');
	lines.push('');

	return lines.join('\n');
}

function build() {
	console.log('Building @lazysuperheroes/hedera-minter-cli...');

	// Clean and create dist
	if (fs.existsSync(DIST)) {
		fs.rmSync(DIST, { recursive: true });
	}
	fs.mkdirSync(path.join(DIST, 'bin'), { recursive: true });
	fs.mkdirSync(path.join(DIST, 'commands'), { recursive: true });

	// Copy package.json
	fs.copyFileSync(PKG_TEMPLATE, path.join(DIST, 'package.json'));

	// Copy interaction scripts with import rewrites
	const interactionCount = copyScripts(SCRIPTS_SRC, path.join(DIST, 'commands'));
	console.log(`  ${interactionCount} interaction scripts`);

	// Copy deployment scripts
	const deployDir = path.join(DIST, 'commands', 'deploy');
	fs.mkdirSync(deployDir, { recursive: true });
	let deployCount = 0;
	for (const cmd of DEPLOY_COMMANDS) {
		const src = path.join(DEPLOY_SRC, cmd.script);
		if (fs.existsSync(src)) {
			copyScript(src, path.join(deployDir, cmd.script));
			deployCount++;
		}
		else {
			console.warn(`  Warning: ${cmd.script} not found`);
		}
	}
	console.log(`  ${deployCount} deployment scripts`);

	// Copy debug scripts
	const debugDir = path.join(DIST, 'commands', 'debug');
	fs.mkdirSync(debugDir, { recursive: true });
	let debugCount = 0;
	for (const cmd of DEBUG_COMMANDS) {
		const src = path.join(DEBUG_SRC, cmd.script);
		if (fs.existsSync(src)) {
			copyScript(src, path.join(debugDir, cmd.script));
			debugCount++;
		}
		else {
			console.warn(`  Warning: ${cmd.script} not found`);
		}
	}
	console.log(`  ${debugCount} debug scripts`);

	// Generate Commander.js entry point
	const entryPoint = generateEntryPoint();
	fs.writeFileSync(path.join(DIST, 'bin', 'hedera-mint.js'), entryPoint);
	console.log('  Generated bin/hedera-mint.js');

	// Generate README
	const readme = generateReadme();
	fs.writeFileSync(path.join(DIST, 'README.md'), readme);

	const totalScripts = interactionCount + deployCount + debugCount;
	console.log(`  ${totalScripts} total scripts`);
	console.log('  Output: dist/cli/');
}

function generateReadme() {
	const lines = [
		'# @lazysuperheroes/hedera-minter-cli',
		'',
		'CLI for deploying and managing Hedera NFT minting contracts.',
		'',
		'## Installation',
		'',
		'```bash',
		'npm install -g @lazysuperheroes/hedera-minter-cli',
		'```',
		'',
		'## Setup',
		'',
		'Create a `.env` file in your working directory:',
		'',
		'```env',
		'ACCOUNT_ID=0.0.12345',
		'PRIVATE_KEY=302e...',
		'ENVIRONMENT=TEST',
		'```',
		'',
		'For contract-specific commands, add the relevant contract ID:',
		'```env',
		'FOREVER_MINTER_CONTRACT_ID=0.0.67890',
		'CONTRACT_ID=0.0.67890',
		'```',
		'',
		'## Commands',
		'',
	];

	for (const [groupName, group] of Object.entries(COMMAND_TREE)) {
		lines.push(`### ${groupName}`);
		lines.push(`${group.description}`);
		lines.push('');
		lines.push('| Command | Description |');
		lines.push('|---------|-------------|');
		for (const cmd of group.commands) {
			lines.push(`| \`hedera-mint ${groupName} ${cmd.name}\` | ${cmd.description} |`);
		}
		if (group.admin) {
			for (const cmd of group.admin) {
				lines.push(`| \`hedera-mint ${groupName} admin ${cmd.name}\` | ${cmd.description} |`);
			}
		}
		lines.push('');
	}

	lines.push('### deploy');
	lines.push('');
	lines.push('| Command | Description |');
	lines.push('|---------|-------------|');
	for (const cmd of DEPLOY_COMMANDS) {
		lines.push(`| \`hedera-mint deploy ${cmd.name}\` | ${cmd.description} |`);
	}
	lines.push('');

	lines.push('### debug');
	lines.push('');
	lines.push('| Command | Description |');
	lines.push('|---------|-------------|');
	for (const cmd of DEBUG_COMMANDS) {
		lines.push(`| \`hedera-mint debug ${cmd.name}\` | ${cmd.description} |`);
	}
	lines.push('');

	return lines.join('\n');
}

module.exports = { build };

if (require.main === module) {
	build();
}
