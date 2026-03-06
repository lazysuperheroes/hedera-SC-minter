#!/usr/bin/env node
/**
 * Build all @lazysuperheroes packages.
 * Orchestrates build-contracts, build-sdk, and build-cli.
 */

const { build: buildContracts } = require('./build-contracts');
const { build: buildSdk } = require('./build-sdk');
const { build: buildCli } = require('./build-cli');

console.log('=== Building @lazysuperheroes packages ===\n');

const start = Date.now();

try {
	buildContracts();
	console.log('');
	buildSdk();
	console.log('');
	buildCli();
}
catch (error) {
	console.error('\nBuild failed:', error.message);
	process.exit(1);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n=== All packages built in ${elapsed}s ===`);
console.log('\nPackages:');
console.log('  dist/contracts/  @lazysuperheroes/hedera-minter-contracts');
console.log('  dist/sdk/        @lazysuperheroes/hedera-minter-sdk');
console.log('  dist/cli/        @lazysuperheroes/hedera-minter-cli');
console.log('\nTo publish:');
console.log('  cd dist/contracts && npm pack');
console.log('  cd dist/sdk && npm pack');
console.log('  cd dist/cli && npm pack');
