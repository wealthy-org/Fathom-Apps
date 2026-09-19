// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { FathomAttestationRegistry } from "../src/FathomAttestationRegistry.sol";

/// @notice Dijalankan dengan `forge test` dari direktori contracts/.
/// Gagal = perilaku registry berubah.
contract FathomAttestationRegistryTest is Test {
    FathomAttestationRegistry internal registry;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function setUp() public {
        registry = new FathomAttestationRegistry();
    }

    // 1. Attestation tercatat: field + id + event.
    function test_attest_recordsFieldsAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit FathomAttestationRegistry.AttestationCreated(
            1, ALICE, BOB, "mentor", "worked together", 6
        );
        vm.prank(ALICE);
        uint256 id = registry.attest(BOB, "mentor", "worked together", 6);
        assertEq(id, 1);

        (
            address attester,
            address subject,
            string memory role,
            string memory relationship,
            uint32 durationMonths,
            ,
            bool revoked
        ) = registry.attestations(id);
        assertEq(attester, ALICE);
        assertEq(subject, BOB);
        assertEq(role, "mentor");
        assertEq(relationship, "worked together");
        assertEq(durationMonths, 6);
        assertFalse(revoked);
    }

    // 2. Id naik berurutan — identitas kanonik deterministik.
    function test_attest_incrementsId() public {
        vm.prank(ALICE);
        uint256 first = registry.attest(BOB, "mentor", "worked together", 6);
        vm.prank(ALICE);
        uint256 second = registry.attest(BOB, "peer", "same team", 3);
        assertEq(first, 1);
        assertEq(second, 2);
    }

    // 3. Self-attestation ditolak.
    function test_selfAttestation_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomAttestationRegistry.SelfAttestation.selector);
        registry.attest(ALICE, "mentor", "worked together", 6);
    }

    // 4. Subject nol ditolak.
    function test_zeroSubject_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomAttestationRegistry.ZeroAddress.selector);
        registry.attest(address(0), "mentor", "worked together", 6);
    }

    // 5. Role kosong ditolak.
    function test_emptyRole_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomAttestationRegistry.EmptyRole.selector);
        registry.attest(BOB, "", "worked together", 6);
    }

    // 6. Relationship kosong ditolak.
    function test_emptyRelationship_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomAttestationRegistry.EmptyRelationship.selector);
        registry.attest(BOB, "mentor", "", 6);
    }

    // 7. Duration nol ditolak.
    function test_zeroDuration_reverts() public {
        vm.prank(ALICE);
        vm.expectRevert(FathomAttestationRegistry.InvalidDuration.selector);
        registry.attest(BOB, "mentor", "worked together", 0);
    }

    // 8. Revoke oleh attester menandai revoked + event; revoke ganda ditolak.
    function test_revoke_marksRevokedAndEmits() public {
        vm.prank(ALICE);
        uint256 id = registry.attest(BOB, "mentor", "worked together", 6);

        vm.expectEmit(true, true, true, false);
        emit FathomAttestationRegistry.AttestationRevoked(id, ALICE, BOB);
        vm.prank(ALICE);
        registry.revoke(id);

        (, , , , , , bool revoked) = registry.attestations(id);
        assertTrue(revoked);

        vm.prank(ALICE);
        vm.expectRevert(FathomAttestationRegistry.AlreadyRevoked.selector);
        registry.revoke(id);
    }

    // 9. Bukan attester dan id asing tidak bisa revoke; hanya owner untuk admin.
    function test_revoke_guardsAttesterAndUnknown() public {
        vm.prank(ALICE);
        uint256 id = registry.attest(BOB, "mentor", "worked together", 6);

        vm.prank(BOB);
        vm.expectRevert(FathomAttestationRegistry.NotAttester.selector);
        registry.revoke(id);

        vm.prank(ALICE);
        vm.expectRevert(FathomAttestationRegistry.UnknownAttestation.selector);
        registry.revoke(999);
    }
}
