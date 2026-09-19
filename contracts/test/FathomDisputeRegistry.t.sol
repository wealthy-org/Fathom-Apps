// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { FathomDisputeRegistry } from "../src/FathomDisputeRegistry.sol";

/// @notice Dijalankan dengan `forge test` dari direktori contracts/.
/// Gagal = perilaku registry berubah.
contract FathomDisputeRegistryTest is Test {
    FathomDisputeRegistry internal registry;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA201);

    bytes32 internal constant REASON = keccak256("spam");
    bytes32 internal constant EVIDENCE = keccak256("https://example.com/e/1");

    function setUp() public {
        registry = new FathomDisputeRegistry();
    }

    // 1. Open tercatat: field + id + event.
    function test_openDispute_recordsFieldsAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit FathomDisputeRegistry.DisputeOpened(1, ALICE, BOB, REASON, EVIDENCE);
        vm.prank(ALICE);
        uint256 id = registry.openDispute(BOB, REASON, EVIDENCE);
        assertEq(id, 1);

        (
            address reporter,
            address target,
            bytes32 reasonHash,
            bytes32 evidenceRef,
            uint8 status,
            ,
        ) = registry.disputes(id);
        assertEq(reporter, ALICE);
        assertEq(target, BOB);
        assertEq(reasonHash, REASON);
        assertEq(evidenceRef, EVIDENCE);
        assertEq(status, 1); // Open
    }

    // 2. Open → disputed oleh reporter + event.
    function test_markDisputed_transitionsAndEmits() public {
        vm.prank(ALICE);
        uint256 id = registry.openDispute(BOB, REASON, EVIDENCE);

        vm.expectEmit(true, true, true, false);
        emit FathomDisputeRegistry.DisputeDisputed(id, ALICE, BOB);
        vm.prank(ALICE);
        registry.markDisputed(id);

        (, , , , uint8 status, , ) = registry.disputes(id);
        assertEq(status, 2); // Disputed
    }

    // 3. Disputed → upheld oleh target + event.
    function test_uphold_fromDisputed() public {
        vm.prank(ALICE);
        uint256 id = registry.openDispute(BOB, REASON, EVIDENCE);
        vm.prank(ALICE);
        registry.markDisputed(id);

        vm.expectEmit(true, true, true, false);
        emit FathomDisputeRegistry.DisputeUpheld(id, ALICE, BOB);
        vm.prank(BOB);
        registry.uphold(id);

        (, , , , uint8 status, , uint64 resolvedAt) = registry.disputes(id);
        assertEq(status, 3); // Upheld
        assertGt(resolvedAt, 0);
    }

    // 4. Open → dismissed langsung oleh reporter + event.
    function test_dismiss_fromOpen() public {
        vm.prank(ALICE);
        uint256 id = registry.openDispute(BOB, REASON, EVIDENCE);

        vm.expectEmit(true, true, true, false);
        emit FathomDisputeRegistry.DisputeDismissed(id, ALICE, BOB);
        vm.prank(ALICE);
        registry.dismiss(id);

        (, , , , uint8 status, , ) = registry.disputes(id);
        assertEq(status, 4); // Dismissed
    }

    // 5. Transisi dari final state ditolak.
    function test_transitionFromResolved_reverts() public {
        vm.prank(ALICE);
        uint256 id = registry.openDispute(BOB, REASON, EVIDENCE);
        vm.prank(ALICE);
        registry.dismiss(id);

        vm.prank(ALICE);
        vm.expectRevert(FathomDisputeRegistry.InvalidTransition.selector);
        registry.markDisputed(id);

        vm.prank(BOB);
        vm.expectRevert(FathomDisputeRegistry.InvalidTransition.selector);
        registry.uphold(id);
    }

    // 6. Hanya reporter yang boleh markDisputed; pihak luar tak bisa resolve.
    function test_authorization_guardsTransitions() public {
        vm.prank(ALICE);
        uint256 id = registry.openDispute(BOB, REASON, EVIDENCE);

        vm.prank(BOB);
        vm.expectRevert(FathomDisputeRegistry.NotReporter.selector);
        registry.markDisputed(id);

        vm.prank(ALICE);
        registry.markDisputed(id);

        vm.prank(CAROL);
        vm.expectRevert(FathomDisputeRegistry.NotParty.selector);
        registry.uphold(id);
    }

    // 7. Self-dispute, target nol, reason kosong ditolak.
    function test_invalidOpen_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomDisputeRegistry.SelfDispute.selector);
        registry.openDispute(ALICE, REASON, EVIDENCE);

        vm.prank(ALICE);
        vm.expectRevert(FathomDisputeRegistry.ZeroAddress.selector);
        registry.openDispute(address(0), REASON, EVIDENCE);

        vm.prank(ALICE);
        vm.expectRevert(FathomDisputeRegistry.EmptyReason.selector);
        registry.openDispute(BOB, bytes32(0), EVIDENCE);
    }

    // 8. Id asing ditolak di semua transisi.
    function test_unknownDispute_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomDisputeRegistry.UnknownDispute.selector);
        registry.markDisputed(999);

        vm.prank(ALICE);
        vm.expectRevert(FathomDisputeRegistry.UnknownDispute.selector);
        registry.uphold(999);

        vm.prank(ALICE);
        vm.expectRevert(FathomDisputeRegistry.UnknownDispute.selector);
        registry.dismiss(999);
    }

    // 9. Id naik berurutan — identitas kanonik deterministik.
    function test_openDispute_incrementsId() public {
        vm.prank(ALICE);
        uint256 first = registry.openDispute(BOB, REASON, EVIDENCE);
        vm.prank(BOB);
        uint256 second = registry.openDispute(ALICE, REASON, EVIDENCE);
        assertEq(first, 1);
        assertEq(second, 2);
    }
}
