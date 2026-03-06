/**
 * Shared constants for test files.
 * Centralizes magic values that appear across multiple test suites.
 */

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Matches Hedera entity IDs like 0.0.12345
const ADDRESS_REGEX = /(\d+\.\d+\.[1-9]\d+)/i;

// Default gas limits for common operations
const GAS_LIMITS = {
	contractDeploy: 8_000_000,
	prngDeploy: 1_800_000,
	lazyGasStationDeploy: 8_000_000,
	tokenCreate: 3_500_000,
	mint: 1_000_000,
	batchMint: 8_000_000,
	transfer: 500_000,
	setter: 500_000,
	associateToken: 800_000,
};

// Sleep durations for mirror node propagation
const MIRROR_NODE_DELAY = 5000;
const SHORT_DELAY = 3000;

// Default test economics
const DEFAULT_MINT_PAYMENT = 50;
const DEFAULT_LAZY_DECIMAL = 1;
const DEFAULT_LAZY_MAX_SUPPLY = 250_000_000;
const DEFAULT_LAZY_BURN_PERC = 25;

module.exports = {
	ZERO_ADDRESS,
	ADDRESS_REGEX,
	GAS_LIMITS,
	MIRROR_NODE_DELAY,
	SHORT_DELAY,
	DEFAULT_MINT_PAYMENT,
	DEFAULT_LAZY_DECIMAL,
	DEFAULT_LAZY_MAX_SUPPLY,
	DEFAULT_LAZY_BURN_PERC,
};
