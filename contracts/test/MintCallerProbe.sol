// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.12 <0.9.0;

/// @title MintCallerProbe (TEST-ONLY)
/// @author security audit remediation
/// @notice Calls a minter's `mintNFT` from within a contract so the EOA-only gate
///         (`msg.sender == tx.origin`, error `OnlyEOA`) can be exercised in tests.
/// @dev NOT part of the production system. Lives under contracts/test/ and is only
///      referenced by the Hardhat regression tests. Uses a low-level call and returns
///      the inner call's success flag + raw return/revert data so the test can assert
///      the mint was rejected specifically by the `OnlyEOA` selector.
contract MintCallerProbe {
    function tryMint(
        address target,
        bytes calldata data
    ) external payable returns (bool ok, bytes memory ret) {
        // forwards the encoded mintNFT(...) call; because the caller is this contract,
        // tx.origin (the EOA that sent the outer tx) != msg.sender (this probe)
        (ok, ret) = target.call{value: msg.value}(data);
    }
}
