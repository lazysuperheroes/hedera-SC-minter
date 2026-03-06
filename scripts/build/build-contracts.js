#!/usr/bin/env node
/**
 * Build @lazysuperheroes/hedera-minter-contracts package.
 * Copies ABIs, Solidity sources, and generates an index.js that exports all ABIs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist', 'contracts');
const ABI_SRC = path.join(ROOT, 'abi');
const SOL_SRC = path.join(ROOT, 'contracts');
const PKG_TEMPLATE = path.join(ROOT, 'packages', 'contracts', 'package.json');

// Main contract ABIs that consumers need
const MAIN_CONTRACTS = [
	'MinterContract',
	'SoulboundMinter',
	'ForeverMinter',
	'SoulboundBadgeMinter',
	'EditionWithPrize',
	'FungibleTokenCreator',
];

// Supporting contract ABIs (included but not primary exports)
const SUPPORT_CONTRACTS = [
	'PrngGenerator',
	'LazyGasStation',
	'LazyDelegateRegistry',
	'TokenStakerV2',
];

function build() {
	console.log('Building @lazysuperheroes/hedera-minter-contracts...');

	// Clean and create dist
	if (fs.existsSync(DIST)) {
		fs.rmSync(DIST, { recursive: true });
	}
	fs.mkdirSync(path.join(DIST, 'abi'), { recursive: true });
	fs.mkdirSync(path.join(DIST, 'contracts'), { recursive: true });

	// Copy package.json
	fs.copyFileSync(PKG_TEMPLATE, path.join(DIST, 'package.json'));

	// Copy ABIs
	const allContracts = [...MAIN_CONTRACTS, ...SUPPORT_CONTRACTS];
	for (const name of allContracts) {
		const src = path.join(ABI_SRC, `${name}.json`);
		if (fs.existsSync(src)) {
			fs.copyFileSync(src, path.join(DIST, 'abi', `${name}.json`));
		}
		else {
			console.warn(`  Warning: ABI not found for ${name}`);
		}
	}

	// Copy Solidity sources (flat + interfaces + libraries)
	const solFiles = fs.readdirSync(SOL_SRC).filter(f => f.endsWith('.sol'));
	for (const file of solFiles) {
		fs.copyFileSync(path.join(SOL_SRC, file), path.join(DIST, 'contracts', file));
	}

	// Copy interfaces
	const ifaceDir = path.join(SOL_SRC, 'interfaces');
	if (fs.existsSync(ifaceDir)) {
		const destIface = path.join(DIST, 'contracts', 'interfaces');
		fs.mkdirSync(destIface, { recursive: true });
		for (const file of fs.readdirSync(ifaceDir).filter(f => f.endsWith('.sol'))) {
			fs.copyFileSync(path.join(ifaceDir, file), path.join(destIface, file));
		}
	}

	// Copy libraries
	const libDir = path.join(SOL_SRC, 'libraries');
	if (fs.existsSync(libDir)) {
		const destLib = path.join(DIST, 'contracts', 'libraries');
		fs.mkdirSync(destLib, { recursive: true });
		for (const file of fs.readdirSync(libDir).filter(f => f.endsWith('.sol'))) {
			fs.copyFileSync(path.join(libDir, file), path.join(destLib, file));
		}
	}

	// Generate index.js
	const indexLines = [
		"'use strict';",
		'',
		'const path = require(\'path\');',
		'const fs = require(\'fs\');',
		'',
		'function loadABI(name) {',
		'  return JSON.parse(fs.readFileSync(path.join(__dirname, \'abi\', `${name}.json`), \'utf8\'));',
		'}',
		'',
	];

	for (const name of MAIN_CONTRACTS) {
		const camelName = name.charAt(0).toLowerCase() + name.slice(1);
		indexLines.push(`/** ABI for ${name} */`);
		indexLines.push(`exports.${camelName}ABI = loadABI('${name}');`);
		indexLines.push('');
	}

	indexLines.push('// Supporting contracts');
	for (const name of SUPPORT_CONTRACTS) {
		const camelName = name.charAt(0).toLowerCase() + name.slice(1);
		indexLines.push(`exports.${camelName}ABI = loadABI('${name}');`);
	}

	indexLines.push('');
	indexLines.push('/** Load any ABI by contract name */');
	indexLines.push('exports.loadABI = loadABI;');
	indexLines.push('');

	fs.writeFileSync(path.join(DIST, 'index.js'), indexLines.join('\n'));

	// Generate README
	const readme = [
		'# @lazysuperheroes/hedera-minter-contracts',
		'',
		'Hedera NFT minting smart contract ABIs and Solidity sources.',
		'',
		'## Usage',
		'',
		'```javascript',
		"const { minterContractABI, foreverMinterABI, loadABI } = require('@lazysuperheroes/hedera-minter-contracts');",
		'```',
		'',
		'## Available ABIs',
		'',
		...MAIN_CONTRACTS.map(n => `- \`${n.charAt(0).toLowerCase() + n.slice(1)}ABI\` — ${n}`),
		...SUPPORT_CONTRACTS.map(n => `- \`${n.charAt(0).toLowerCase() + n.slice(1)}ABI\` — ${n}`),
		'- `loadABI(name)` — Load any ABI by contract name',
		'',
		'## Solidity Sources',
		'',
		'Import in Hardhat/Foundry:',
		'```solidity',
		'import "@lazysuperheroes/hedera-minter-contracts/contracts/ForeverMinter.sol";',
		'```',
		'',
	].join('\n');

	fs.writeFileSync(path.join(DIST, 'README.md'), readme);

	const abiCount = fs.readdirSync(path.join(DIST, 'abi')).length;
	const solCount = fs.readdirSync(path.join(DIST, 'contracts')).filter(f => f.endsWith('.sol')).length;
	console.log(`  ${abiCount} ABIs, ${solCount} Solidity sources`);
	console.log('  Output: dist/contracts/');
}

module.exports = { build };

if (require.main === module) {
	build();
}
