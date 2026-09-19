// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title FathomDisputeRegistry — Spec 09 (Disputes).
/// @notice Lifecycle sengketa on-chain: open → disputed → upheld | dismissed.
/// @dev Aturan on-chain minimal: reporter != target, tanpa alamat nol,
///      reason tak kosong, transisi eksplisit, hanya aktor berwenang.
///      Report != vonis: registry mencatat klaim + status, bukan kebenaran.
///      Scoring, tier, penalti reputasi BUKAN aturan kontrak — risk detection
///      off-chain membaca status (lihat lib/score/risk.ts, PROVISIONAL).
///      Tanpa upgradeability: perubahan aturan berarti deploy registry baru.
contract FathomDisputeRegistry is Ownable {
    uint256 private nextDisputeId = 1;

    /// @dev Status disimpan sebagai uint8 agar transisi eksplisit & murah.
    ///      0=None (tak ada), 1=Open, 2=Disputed, 3=Upheld, 4=Dismissed.
    uint8 internal constant STATUS_OPEN = 1;
    uint8 internal constant STATUS_DISPUTED = 2;
    uint8 internal constant STATUS_UPHELD = 3;
    uint8 internal constant STATUS_DISMISSED = 4;

    struct Dispute {
        address reporter;
        address target;
        bytes32 reasonHash;
        bytes32 evidenceRef;
        uint8 status;
        uint64 openedAt;
        uint64 resolvedAt;
    }

    mapping(uint256 => Dispute) public disputes;

    event DisputeOpened(
        uint256 indexed disputeId,
        address indexed reporter,
        address indexed target,
        bytes32 reasonHash,
        bytes32 evidenceRef
    );
    event DisputeDisputed(
        uint256 indexed disputeId,
        address indexed reporter,
        address indexed target
    );
    event DisputeUpheld(
        uint256 indexed disputeId,
        address indexed reporter,
        address indexed target
    );
    event DisputeDismissed(
        uint256 indexed disputeId,
        address indexed reporter,
        address indexed target
    );

    error SelfDispute();
    error ZeroAddress();
    error EmptyReason();
    error UnknownDispute();
    error NotReporter();
    error NotParty();
    error InvalidTransition();

    constructor() Ownable(msg.sender) {}

    /// @notice Buka dispute baru. Mengembalikan id kanonik on-chain.
    /// @param reasonHash keccak256 dari teks reason (teks penuh off-chain).
    /// @param evidenceRef hash referensi evidence (URI/hash dokumen off-chain).
    function openDispute(
        address target,
        bytes32 reasonHash,
        bytes32 evidenceRef
    ) external returns (uint256 disputeId) {
        if (target == address(0) || msg.sender == address(0)) revert ZeroAddress();
        if (target == msg.sender) revert SelfDispute();
        if (reasonHash == bytes32(0)) revert EmptyReason();

        disputeId = nextDisputeId;
        nextDisputeId += 1;

        disputes[disputeId] = Dispute({
            reporter: msg.sender,
            target: target,
            reasonHash: reasonHash,
            evidenceRef: evidenceRef,
            status: STATUS_OPEN,
            openedAt: uint64(block.timestamp),
            resolvedAt: 0
        });

        emit DisputeOpened(disputeId, msg.sender, target, reasonHash, evidenceRef);
    }

    /// @notice Tandai dispute sebagai disengketakan aktif. Hanya reporter.
    function markDisputed(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        if (dispute.reporter == address(0)) revert UnknownDispute();
        if (dispute.reporter != msg.sender) revert NotReporter();
        if (dispute.status != STATUS_OPEN) revert InvalidTransition();

        dispute.status = STATUS_DISPUTED;
        emit DisputeDisputed(disputeId, dispute.reporter, dispute.target);
    }

    /// @notice Selesaikan sebagai upheld. Reporter atau target boleh menutup.
    function uphold(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        if (dispute.reporter == address(0)) revert UnknownDispute();
        if (msg.sender != dispute.reporter && msg.sender != dispute.target) {
            revert NotParty();
        }
        if (dispute.status != STATUS_OPEN && dispute.status != STATUS_DISPUTED) {
            revert InvalidTransition();
        }

        dispute.status = STATUS_UPHELD;
        dispute.resolvedAt = uint64(block.timestamp);
        emit DisputeUpheld(disputeId, dispute.reporter, dispute.target);
    }

    /// @notice Selesaikan sebagai dismissed. Reporter atau target boleh menutup.
    function dismiss(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        if (dispute.reporter == address(0)) revert UnknownDispute();
        if (msg.sender != dispute.reporter && msg.sender != dispute.target) {
            revert NotParty();
        }
        if (dispute.status != STATUS_OPEN && dispute.status != STATUS_DISPUTED) {
            revert InvalidTransition();
        }

        dispute.status = STATUS_DISMISSED;
        dispute.resolvedAt = uint64(block.timestamp);
        emit DisputeDismissed(disputeId, dispute.reporter, dispute.target);
    }
}
