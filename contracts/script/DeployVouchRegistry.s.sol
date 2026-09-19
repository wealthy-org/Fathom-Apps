// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { FathomVouchRegistry } from "../src/FathomVouchRegistry.sol";

/// @notice Deploy FathomVouchRegistry ke Robinhood testnet (46630).
/// @dev TIDAK broadcast tanpa flag eksplisit:
///      forge script script/DeployVouchRegistry.s.sol \
///        --rpc-url robinhoodTestnet --broadcast
///      Env yang dibaca (tidak ada default kunci/alamat — gagal bila kosong):
///      DEPLOYER_KEY, STAKE_TOKEN (0x0...0 = native), MIN_STAKE_WEI,
///      COOLDOWN_DAYS. Alamat hasil dicatat ke deployments/<chainid>.json.
contract DeployVouchRegistry is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address stakeToken = vm.envAddress("STAKE_TOKEN");
        uint256 minStake = vm.envUint("MIN_STAKE_WEI");
        uint256 cooldownDays = vm.envUint("COOLDOWN_DAYS");

        vm.startBroadcast(deployerKey);
        FathomVouchRegistry registry = new FathomVouchRegistry(
            stakeToken,
            minStake,
            cooldownDays
        );
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
