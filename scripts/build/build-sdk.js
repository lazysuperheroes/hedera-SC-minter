#!/usr/bin/env node
/**
 * Build @lazysuperheroes/hedera-minter-sdk package.
 * Copies utils with cleaner names and generates a unified index.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist', 'sdk');
const UTILS_SRC = path.join(ROOT, 'utils');
const LIB_SRC = path.join(ROOT, 'scripts', 'lib');
const PKG_TEMPLATE = path.join(ROOT, 'packages', 'sdk', 'package.json');

// Mapping: source file -> dist name
const FILE_MAP = {
	'solidityHelpers.js': 'contract.js',
	'hederaHelpers.js': 'hedera.js',
	'hederaMirrorHelpers.js': 'mirror.js',
	'gasHelpers.js': 'gas.js',
	'transactionHelpers.js': 'transaction.js',
	'nodeHelpers.js': 'node.js',
};

// Internal require path rewrites: old path -> new path
const REQUIRE_REWRITES = {
	"'./nodeHelpers'": "'./node'",
	"'./hederaMirrorHelpers'": "'./mirror'",
	"'./solidityHelpers'": "'./contract'",
	"'./hederaHelpers'": "'./hedera'",
	"'./gasHelpers'": "'./gas'",
	"'./transactionHelpers'": "'./transaction'",
};

function build() {
	console.log('Building @lazysuperheroes/hedera-minter-sdk...');

	// Clean and create dist
	if (fs.existsSync(DIST)) {
		fs.rmSync(DIST, { recursive: true });
	}
	fs.mkdirSync(DIST, { recursive: true });

	// Copy package.json
	fs.copyFileSync(PKG_TEMPLATE, path.join(DIST, 'package.json'));

	// Copy and rename utils
	for (const [srcName, distName] of Object.entries(FILE_MAP)) {
		const srcPath = path.join(UTILS_SRC, srcName);
		if (!fs.existsSync(srcPath)) {
			console.warn(`  Warning: ${srcName} not found`);
			continue;
		}

		let content = fs.readFileSync(srcPath, 'utf8');

		// Rewrite internal require paths
		for (const [oldReq, newReq] of Object.entries(REQUIRE_REWRITES)) {
			content = content.replaceAll(oldReq, newReq);
		}

		fs.writeFileSync(path.join(DIST, distName), content);
	}

	// Copy scriptBase as lib/scriptBase.js
	fs.mkdirSync(path.join(DIST, 'lib'), { recursive: true });
	const scriptBaseSrc = path.join(LIB_SRC, 'scriptBase.js');
	if (fs.existsSync(scriptBaseSrc)) {
		let content = fs.readFileSync(scriptBaseSrc, 'utf8');

		// Rewrite loadABI to try @lazysuperheroes/hedera-minter-contracts first,
		// then fall back to hardhat artifacts (development mode)
		content = content.replace(
			/function loadABI\(contractName\)\s*\{[\s\S]*?return new ethers\.Interface\(json\.abi\);\s*\}/,
			`function loadABI(contractName) {
\t// Try loading from @lazysuperheroes/hedera-minter-contracts package
\ttry {
\t\tconst contracts = require('@lazysuperheroes/hedera-minter-contracts');
\t\treturn new ethers.Interface(contracts.loadABI(contractName));
\t}
\tcatch {
\t\t// Fallback to hardhat artifacts (development/repo context)
\t\tconst artifactPath = path.resolve(
\t\t\t__dirname, '../../artifacts/contracts',
\t\t\t\`\${contractName}.sol\`, \`\${contractName}.json\`,
\t\t);
\t\tif (!fs.existsSync(artifactPath)) {
\t\t\tthrow new Error(
\t\t\t\t\`ABI not found for \${contractName}. Install @lazysuperheroes/hedera-minter-contracts or run 'npx hardhat compile'.\`,
\t\t\t);
\t\t}
\t\tconst json = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
\t\treturn new ethers.Interface(json.abi);
\t}
}`,
		);
		fs.writeFileSync(path.join(DIST, 'lib', 'scriptBase.js'), content);
	}

	const contractHelpersSrc = path.join(LIB_SRC, 'contractHelpers.js');
	if (fs.existsSync(contractHelpersSrc)) {
		let content = fs.readFileSync(contractHelpersSrc, 'utf8');
		// Rewrite imports to use SDK paths
		content = content.replace(
			/require\('\.\.\/\.\.\/utils\/solidityHelpers'\)/g,
			"require('../contract')",
		);
		content = content.replace(
			/require\('\.\.\/\.\.\/utils\/hederaMirrorHelpers'\)/g,
			"require('../mirror')",
		);
		fs.writeFileSync(path.join(DIST, 'lib', 'contractHelpers.js'), content);
	}

	// Generate index.js
	const index = `'use strict';

// Contract interaction utilities
const contract = require('./contract');
// Hedera account/token operations
const hedera = require('./hedera');
// Mirror node queries
const mirror = require('./mirror');
// Gas estimation
const gas = require('./gas');
// Transaction parsing and analysis
const transaction = require('./transaction');
// Node utilities (sleep, arg parsing)
const node = require('./node');
// Script infrastructure
const { createClient, loadABI, initScript, runScript } = require('./lib/scriptBase');
const { readContract } = require('./lib/contractHelpers');

module.exports = {
	// Contract interaction
	...contract,
	// Hedera helpers
	...hedera,
	// Mirror node
	...mirror,
	// Gas
	...gas,
	// Transaction
	...transaction,
	// Node utilities
	...node,
	// Script infrastructure
	createClient,
	loadABI,
	initScript,
	runScript,
	readContract,

	// Namespaced access
	contract,
	hedera,
	mirror,
	gas,
	transaction,
	node,
};
`;

	fs.writeFileSync(path.join(DIST, 'index.js'), index);

	// Generate README
	const readme = `# @lazysuperheroes/hedera-minter-sdk

Utilities for deploying, querying, and interacting with Hedera minter contracts.

## Usage

\`\`\`javascript
const {
  contractDeployFunction,
  contractExecuteFunction,
  readOnlyEVMFromMirrorNode,
  accountCreator,
  associateTokenToAccount,
  checkMirrorBalance,
  createClient,
  readContract,
} = require('@lazysuperheroes/hedera-minter-sdk');
\`\`\`

## Modules

| Module | Description |
|--------|-------------|
| \`contract\` | Contract deploy, execute, and read-only EVM calls |
| \`hedera\` | Account creation, token operations, allowances, transfers |
| \`mirror\` | Mirror node queries for balances, serials, events |
| \`gas\` | Gas estimation via mirror node |
| \`transaction\` | Transaction record parsing and failure analysis |
| \`node\` | Utilities: sleep, hex conversion, argument parsing |
`;

	fs.writeFileSync(path.join(DIST, 'README.md'), readme);

	// Generate readline wrapper for --no-input mode
	const readlineWrapper = `'use strict';

/**
 * Wrapper around readline-sync that supports --no-input mode.
 * When HEDERA_MINT_NO_INPUT=1, confirmation prompts auto-accept
 * and data prompts throw with a helpful message.
 */
const noInput = process.env.HEDERA_MINT_NO_INPUT === '1';

if (noInput) {
\tconst handler = {
\t\tquestion(prompt) {
\t\t\t// Auto-accept confirmation prompts
\t\t\tif (/\\(y\\/N\\)/i.test(prompt) || /\\(Y\\/n\\)/i.test(prompt) || /proceed/i.test(prompt)) {
\t\t\t\tconsole.log(prompt + 'y (auto-confirmed)');
\t\t\t\treturn 'y';
\t\t\t}
\t\t\tthrow new Error(
\t\t\t\t'Interactive input required in --no-input mode. ' +
\t\t\t\t'Provide this value via command-line arguments instead. ' +
\t\t\t\t'Prompt: "' + prompt.trim() + '"',
\t\t\t);
\t\t},
\t\tkeyInSelect(items, query, options) {
\t\t\tthrow new Error('Interactive selection required in --no-input mode.');
\t\t},
\t\tkeyInYN(query) {
\t\t\tconsole.log(query + ' true (auto-confirmed)');
\t\t\treturn true;
\t\t},
\t\tkeyInYNStrict(query) {
\t\t\tconsole.log(query + ' true (auto-confirmed)');
\t\t\treturn true;
\t\t},
\t};
\tmodule.exports = handler;
}
else {
\tmodule.exports = require('readline-sync');
}
`;

	fs.writeFileSync(path.join(DIST, 'readline.js'), readlineWrapper);

	const fileCount = fs.readdirSync(DIST).filter(f => f.endsWith('.js')).length;
	console.log(`  ${fileCount} JS files`);
	console.log('  Output: dist/sdk/');
}

module.exports = { build };

if (require.main === module) {
	build();
}
