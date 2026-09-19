// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FathomVouchRegistry — Spec 08 (Vouch).
/// @notice Wallet A → VOUCH → Wallet B, opsional stake. Satu-satunya
/// aturan on-chain: tanpa self-vouch, tanpa alamat nol, stake lossless
/// (uint256, tanpa float). Anti-farming resiprokal/scoring BUKAN aturan
/// kontrak — decay & bobot dihitung off-chain dari event (lihat
/// config/thresholds.ts `vouch`, PROVISIONAL). Withdrawal lifecycle juga
/// PROVISIONAL (cooldown + dispute lock); jangan jadikan final.
contract FathomVouchRegistry is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Token stake; address(0) = native. Immutable = ganti aset
    /// berarti deploy registry baru, bukan upgrade diam-diam.
    IERC20 public immutable stakeToken;

    /// @notice Stake minimum per vouch (wei). 0 = vouch reputasional tanpa stake.
    uint256 public minStake;

    /// @notice Cooldown tarik stake (hari). PROVISIONAL — thresholds.ts
    /// vouch.withdrawCooldownDays. 0 = tanpa lock waktu.
    uint256 public cooldownDays;

    uint256 private constant SECONDS_PER_DAY = 86_400;

    struct VouchPosition {
        // Total stake aktif voucher → target. uint128 lossless, cukup
        // untuk pasokan token mana pun yang realistis.
        uint128 stake;
        // Berapa kali pair ini di-vouch — input off-chain anti-farming.
        uint64 pairCount;
        uint64 lastStakedAt;
        // PROVISIONAL hook Spec 09: stake terkunci selama true.
        bool disputed;
    }

    mapping(address => mapping(address => VouchPosition)) public positions;

    event Vouched(
        address indexed voucher,
        address indexed target,
        uint256 stakeAdded,
        uint256 totalStake,
        uint64 pairCount
    );
    event Withdrawn(
        address indexed voucher,
        address indexed target,
        uint256 amount,
        uint256 remainingStake
    );
    event DisputeLockSet(address indexed voucher, address indexed target, bool locked);
    event ParamsUpdated(uint256 minStake, uint256 cooldownDays);

    error SelfVouch();
    error ZeroAddress();
    error BelowMinStake();
    error WrongAsset();
    error InsufficientStake();
    error CooldownActive();
    error DisputedLocked();

    constructor(
        address _stakeToken,
        uint256 _minStake,
        uint256 _cooldownDays
    ) Ownable(msg.sender) {
        stakeToken = IERC20(_stakeToken);
        minStake = _minStake;
        cooldownDays = _cooldownDays;
    }

    /// @notice Vouch dengan native stake. Hanya bila stakeToken == address(0).
    function vouch(address to) external payable {
        if (address(stakeToken) != address(0)) revert WrongAsset();
        _vouch(msg.sender, to, msg.value);
    }

    /// @notice Vouch dengan ERC20 stake (transferFrom). Hanya bila dikonfigurasi.
    function vouchERC20(address to, uint256 amount) external {
        if (address(stakeToken) == address(0)) revert WrongAsset();
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        _vouch(msg.sender, to, amount);
    }

    function _vouch(address voucher, address to, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
        if (to == voucher) revert SelfVouch();
        if (amount < minStake) revert BelowMinStake();

        VouchPosition storage pos = positions[voucher][to];
        uint256 total = uint256(pos.stake) + amount;
        if (total > type(uint128).max) revert InsufficientStake(); // overflow guard, bukan saldo
        pos.stake = uint128(total);
        pos.pairCount += 1;
        pos.lastStakedAt = uint64(block.timestamp);

        emit Vouched(voucher, to, amount, total, pos.pairCount);
    }

    /// @notice Tarik stake. PROVISIONAL: kena cooldown + kunci dispute.
    function withdraw(address to, uint256 amount) external {
        VouchPosition storage pos = positions[msg.sender][to];
        if (pos.disputed) revert DisputedLocked();
        if (uint256(pos.stake) < amount) revert InsufficientStake();
        if (
            block.timestamp <
            uint256(pos.lastStakedAt) + cooldownDays * SECONDS_PER_DAY
        ) revert CooldownActive();

        pos.stake = uint128(uint256(pos.stake) - amount);
        if (address(stakeToken) == address(0)) {
            (bool ok, ) = msg.sender.call{value: amount}("");
            require(ok, "native withdraw failed");
        } else {
            stakeToken.safeTransfer(msg.sender, amount);
        }

        emit Withdrawn(msg.sender, to, amount, pos.stake);
    }

    /// @notice PROVISIONAL hook untuk alur dispute (Spec 09). Hanya owner
    /// (multisig/arbitrator nantinya) — bukan vonis otomatis.
    function setDisputed(address voucher, address to, bool locked) external onlyOwner {
        positions[voucher][to].disputed = locked;
        emit DisputeLockSet(voucher, to, locked);
    }

    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
        emit ParamsUpdated(minStake, cooldownDays);
    }

    function setCooldownDays(uint256 _cooldownDays) external onlyOwner {
        cooldownDays = _cooldownDays;
        emit ParamsUpdated(minStake, cooldownDays);
    }
}
