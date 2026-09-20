// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { FathomVouchRegistry } from "../src/FathomVouchRegistry.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC20 mock minimal untuk path stakeToken — bukan fixture umum.
contract MockStakeToken is ERC20 {
    constructor() ERC20("Mock Stake", "MST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Dijalankan dengan `forge test` dari direktori contracts/.
/// Gagal = perilaku registry berubah.
contract FathomVouchRegistryTest is Test {
    FathomVouchRegistry internal registry;
    MockStakeToken internal token;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function setUp() public {
        // Registry native, minStake 1 wei, tanpa cooldown default.
        registry = new FathomVouchRegistry(address(0), 1, 0);
        token = new MockStakeToken();
        vm.deal(ALICE, 100 ether);
        token.mint(ALICE, 1000 ether);
    }

    // 1. Vouch native tercatat: stake + pairCount + event.
    function test_vouch_recordsStakeAndCount() public {
        vm.expectEmit(true, true, false, true);
        emit FathomVouchRegistry.Vouched(ALICE, BOB, 5, 5, 1);
        vm.prank(ALICE);
        registry.vouch{value: 5}(BOB);

        (uint128 stake, uint64 pairCount, , ) = registry.positions(ALICE, BOB);
        assertEq(stake, 5);
        assertEq(pairCount, 1);

        // Vouch kedua ke pair sama: akumulasi + count naik (input anti-farming off-chain).
        vm.prank(ALICE);
        registry.vouch{value: 7}(BOB);
        (stake, pairCount, , ) = registry.positions(ALICE, BOB);
        assertEq(stake, 12);
        assertEq(pairCount, 2);
    }

    // 2. Self-vouch ditolak — satu-satunya aturan anti-farming on-chain.
    function test_selfVouch_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomVouchRegistry.SelfVouch.selector);
        registry.vouch{value: 5}(ALICE);
    }

    // 3. Target nol ditolak.
    function test_zeroTarget_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomVouchRegistry.ZeroAddress.selector);
        registry.vouch{value: 5}(address(0));
    }

    // 4. Di bawah minStake ditolak.
    function test_belowMinStake_reverts() public {
        FathomVouchRegistry strictRegistry = new FathomVouchRegistry(address(0), 1 ether, 0);
        vm.prank(ALICE);
        vm.expectRevert(FathomVouchRegistry.BelowMinStake.selector);
        strictRegistry.vouch{value: 5}(BOB);
    }

    // 5. Withdraw tanpa cooldown berhasil, stake berkurang.
    function test_withdraw_reducesStake() public {
        vm.prank(ALICE);
        registry.vouch{value: 10}(BOB);
        vm.prank(ALICE);
        registry.withdraw(BOB, 4);
        (uint128 stake, , , ) = registry.positions(ALICE, BOB);
        assertEq(stake, 6);
    }

    // 6. Withdraw sebelum cooldown ditolak (PROVISIONAL lifecycle).
    function test_withdrawDuringCooldown_reverts() public {
        FathomVouchRegistry locked = new FathomVouchRegistry(address(0), 1, 30);
        vm.prank(ALICE);
        locked.vouch{value: 10}(BOB);
        vm.prank(ALICE);
        vm.expectRevert(FathomVouchRegistry.CooldownActive.selector);
        locked.withdraw(BOB, 4);

        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(ALICE);
        locked.withdraw(BOB, 4);
        (uint128 stake, , , ) = locked.positions(ALICE, BOB);
        assertEq(stake, 6);
    }

    // 6b. Batas cooldown eksak: revert sebelum, sukses tepat saat kedaluwarsa.
    function test_withdrawAtExactCooldown_succeeds() public {
        FathomVouchRegistry locked = new FathomVouchRegistry(address(0), 1, 30);
        vm.prank(ALICE);
        locked.vouch{value: 10}(BOB);
        (, , uint64 stakedAt, ) = locked.positions(ALICE, BOB);

        // Satu detik sebelum kedaluwarsa: masih revert.
        vm.warp(uint256(stakedAt) + 30 days - 1);
        vm.prank(ALICE);
        vm.expectRevert(FathomVouchRegistry.CooldownActive.selector);
        locked.withdraw(BOB, 4);

        // Tepat saat kedaluwarsa (block.timestamp < stakedAt + 30d salah): sukses.
        vm.warp(uint256(stakedAt) + 30 days);
        vm.prank(ALICE);
        locked.withdraw(BOB, 4);
        (uint128 stake, , , ) = locked.positions(ALICE, BOB);
        assertEq(stake, 6);
    }

    // 7. Kunci dispute memblokir withdraw; buka kunci memulihkan.
    function test_disputedLock_blocksWithdraw() public {
        vm.prank(ALICE);
        registry.vouch{value: 10}(BOB);
        registry.setDisputed(ALICE, BOB, true);
        vm.prank(ALICE);
        vm.expectRevert(FathomVouchRegistry.DisputedLocked.selector);
        registry.withdraw(BOB, 4);

        registry.setDisputed(ALICE, BOB, false);
        vm.prank(ALICE);
        registry.withdraw(BOB, 4);
        (uint128 stake, , , ) = registry.positions(ALICE, BOB);
        assertEq(stake, 6);
    }

    // 8. Path ERC20: transferFrom + catat; vouch native ditolak.
    function test_erc20Stake_path() public {
        FathomVouchRegistry erc20Registry = new FathomVouchRegistry(
            address(token),
            1,
            0
        );
        vm.prank(ALICE);
        token.approve(address(erc20Registry), 50);
        vm.prank(ALICE);
        erc20Registry.vouchERC20(BOB, 50);
        (uint128 stake, uint64 pairCount, , ) = erc20Registry.positions(ALICE, BOB);
        assertEq(stake, 50);
        assertEq(pairCount, 1);
        assertEq(token.balanceOf(address(erc20Registry)), 50);

        vm.prank(ALICE);
        vm.expectRevert(FathomVouchRegistry.WrongAsset.selector);
        erc20Registry.vouch{value: 5}(BOB);
    }

    // 9. Hanya owner yang boleh ubah param & kunci dispute.
    function test_onlyOwner_guardsAdmin() public {
        vm.prank(ALICE);
        vm.expectRevert();
        registry.setMinStake(99);
        vm.prank(ALICE);
        vm.expectRevert();
        registry.setDisputed(ALICE, BOB, true);
    }
}
