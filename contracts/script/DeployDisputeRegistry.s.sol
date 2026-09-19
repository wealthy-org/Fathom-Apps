// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { FathomDisputeRegistry } from "../src/FathomDisputeRegistry.sol";

/// @notice Deploy FathomDisputeRegistry ke Robinhood testnet (46630).
/// @dev TIDAK broadcast tanpa flag eksplisit:
///      forge script script/DeployDisputeRegistry.s.sol \
///        --rpc-url robinhoodTestnet --broadcast
///      Env yang dibaca (tidak ada default kunci/alamat — gagal bila kosong):
///      DEPLOYER_KEY. Alamat hasil dicatat ke deployments/<chainid>.json.
contract DeployDisputeRegistry is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");

        vm.startBroadcast(deployerKey);
        FathomDisputeRegistry registry = new FathomDisputeRegistry();
        vm.stopBroadcast();

        string memory json = string.concat(
            '{"address":"',
            vm.toString(address(registry)),
            '","chainId":',
            vm.toString(block.chainid),
            "}"
        );
        vm.writeFile(
            string.concat(
                "deployments/",
                vm.toString(block.chainid),
                ".json"
            ),
            json
        );
    }
}
