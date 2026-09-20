// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title FathomAttestationRegistry — Spec 07 (Structured Attestations).
/// @notice Attester → ATTEST → Subject dengan role/relationship/duration.
/// @dev Aturan on-chain minimal: tanpa self-attestation, tanpa alamat nol,
///      role/relationship tidak kosong, duration > 0. Scoring, tier, decay,
///      dan bobot reputasi BUKAN aturan kontrak — dihitung off-chain dari
///      event (lihat config/thresholds.ts, PROVISIONAL). Tanpa upgradeability:
///      perubahan aturan berarti deploy registry baru, bukan upgrade diam-diam.
contract FathomAttestationRegistry is Ownable {
    using SafeCast for uint256;

    uint256 private nextAttestationId = 1;

    struct Attestation {
        address attester;
        address subject;
        string role;
        string relationship;
        uint32 durationMonths;
        uint64 createdAt;
        bool revoked;
    }

    mapping(uint256 => Attestation) public attestations;

    event AttestationCreated(
        uint256 indexed attestationId,
        address indexed attester,
        address indexed subject,
        string role,
        string relationship,
        uint32 durationMonths
    );
    event AttestationRevoked(
        uint256 indexed attestationId,
        address indexed attester,
        address indexed subject
    );

    error SelfAttestation();
    error ZeroAddress();
    error EmptyRole();
    error EmptyRelationship();
    error InvalidDuration();
    error UnknownAttestation();
    error NotAttester();
    error AlreadyRevoked();

    constructor() Ownable(msg.sender) {}

    /// @notice Buat attestation baru. Mengembalikan id kanonik on-chain.
    function attest(
        address subject,
        string calldata role,
        string calldata relationship,
        uint32 durationMonths
    ) external returns (uint256 attestationId) {
        if (subject == address(0) || msg.sender == address(0)) revert ZeroAddress();
        if (subject == msg.sender) revert SelfAttestation();
        if (bytes(role).length == 0) revert EmptyRole();
        if (bytes(relationship).length == 0) revert EmptyRelationship();
        if (durationMonths == 0) revert InvalidDuration();

        attestationId = nextAttestationId;
        nextAttestationId += 1;

        attestations[attestationId] = Attestation({
            attester: msg.sender,
            subject: subject,
            role: role,
            relationship: relationship,
            durationMonths: durationMonths,
            createdAt: block.timestamp.toUint64(),
            revoked: false
        });

        emit AttestationCreated(
            attestationId,
            msg.sender,
            subject,
            role,
            relationship,
            durationMonths
        );
    }

    /// @notice Cabut attestation milik sendiri. Revoke bersifat final —
    ///        lifecycle lanjutan (banding, ganti) di luar kontrak.
    function revoke(uint256 attestationId) external {
        Attestation storage attestation = attestations[attestationId];
        if (attestation.attester == address(0)) revert UnknownAttestation();
        if (attestation.attester != msg.sender) revert NotAttester();
        if (attestation.revoked) revert AlreadyRevoked();

        attestation.revoked = true;
        emit AttestationRevoked(attestationId, msg.sender, attestation.subject);
    }
}
