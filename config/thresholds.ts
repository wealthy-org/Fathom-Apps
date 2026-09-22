export const THRESHOLDS = {
  chain: {
    // Confirmation depth indexer — jangan proses blok paling ujung untuk menghindari reorg
    confirmations: 3,
  },

  explorer: {
    // Sumber indexed (Blockscout) untuk riwayat per-address. RPC-only tidak bisa (Spec 01).
    // TTL cache read-through; setelah lewat, refetch dari explorer.
    cacheTtlHours: 24,
    // Batas halaman walk pagination (Blockscout v2 default 50/halaman) —
    // cegah query tak terbatas untuk wallet sangat aktif.
    maxPages: 40,
    // Timeout per request ke explorer (ms).
    requestTimeoutMs: 10000,
  },

  trustGraph: {
    // Definisi deterministik "repeat relationship" (Spec 04): >= 2 interaksi langsung.
    repeatInteractionMin: 2,
    // Batas halaman walk tx list untuk derivasi counterparty (selaras explorer.maxPages).
    maxCounterpartyPages: 40,
    // TTL cache read-through relationship.
    cacheTtlHours: 24,
  },

  metrics: {
    // TTL cache read-through agregat turunan wallet_metrics — dihitung ulang
    // bila lewat TTL atau bila trust graph punya data lebih baru.
    cacheTtlHours: 24,
  },

  attestation: {
    // Batas input attestation terstruktur (Spec 07). Bukan nilai scoring.
    maxRelationshipLength: 64,
    // Batas atas durasi (bulan) — sekadar validasi input, bukan bobot.
    maxDurationMonths: 1200,
  },

  proof: {
    // Model confidence Spec 02: nilai statis per verification_method (bukan dituning per-proof).
    // indexed  = diambil langsung dari sumber indexed apa adanya.
    // derived  = dihitung/diturunkan dari data indexed.
    confidenceByMethod: {
      indexed: 1.0,
      derived: 0.7,
    },
  },

  risk: {
    // Spec 05. Signal dievaluasi on-the-fly dari data yang sudah diindeks
    // (reproducible) — bukan tabel baru, bukan klasifikasi otomatis "malicious".
    //
    // Semua sub-bagian detector di bawah PROVISIONAL (Fase 13 tuning):
    // ganti nilai di sini, bukan di modul detector. Modul hanya membaca.
    //
    // fresh_wallet: umur wallet (hari) di bawah ini dianggap baru.
    freshWalletMaxAgeDays: 30,
    // fresh_wallet: jumlah tx langsung di bawah ini melengkapi evidence umur.
    freshWalletMaxTxCount: 10,
    // circular_relationship_graph: minimal counterparty dengan arus dua arah
    // (valueSent > 0 dan valueReceived > 0) sebelum pola dianggap muncul.
    circularMinMutualCounterparties: 3,
    // concentrated_counterparty_graph: minimal counterparty sebelum distribusi
    // dinilai bermakna (hindari "100% dari 1 lawan" sebagai temuan palsu).
    concentrationMinCounterparties: 5,
    // concentrated_counterparty_graph: share interaksi counterparty teratas
    // (0.5 = 50%) untuk memicu sinyal.
    concentrationTopShare: 0.5,

    // abnormal_transaction_pattern: BLOCKED_BY_PRODUCT_RULE (Spec 05).
    // No detection rule defined — no abnormal* thresholds are guessed.

    // suspicious_vouch_clustering: minimal pasangan resiprokal (A↔B aktif)
    // sebelum cluster dianggap muncul.
    vouchMinReciprocalPairs: 2,
    // suspicious_vouch_clustering: share vouch aktif dari voucher teratas.
    vouchTopShare: 0.5,
    // suspicious_vouch_clustering: minimal vouch aktif sebelum dinilai.
    vouchMinActive: 3,

    // flagged_counterparty_exposure: nilai dievaluasi apa adanya — daftar
    // flagged tidak punya threshold hitung; satu match = detected.
    // flagged_addresses kosong (belum ada sumber) = not_evaluable, bukan clear.

    // malicious_contract_interaction: satu interaksi dengan kontrak terdaftar
    // = detected. malicious_contracts kosong = not_evaluable, bukan clear.

    // high_sybil_similarity: share counterparty yang juga dipakai wallet lain
    // dalam kohort (>= ambang ini) = kemiripan tinggi.
    sybilMinOverlapShare: 0.7,
    // high_sybil_similarity: minimal counterparty bersama sebelum dinilai.
    sybilMinSharedCounterparties: 3,
  },

  score: {
    // PROVISIONAL — ScoreStrategyV1 (Spec 10), bukan formula final Fathom.
    // Ganti bobot/kap di sini, bukan di strategi. V1 = compression layer
    // evidence-based; missing data tidak memberi kontribusi positif.
    formulaVersion: "1.0.0-provisional",
    maxScore: 1000,
    dimensions: {
      economicHistory: {
        maxPoints: 250,
        walletAgeMaxPoints: 100,
        walletAgeFullAtDays: 365,
        txCountMaxPoints: 100,
        txCountFullAt: 100,
        volumeMaxPoints: 50,
        volumeFullAtWei: "1000000000000000000",
      },
      counterpartyHistory: {
        maxPoints: 200,
        uniqueMaxPoints: 100,
        uniqueFullAt: 10,
        repeatMaxPoints: 50,
        repeatFullAt: 5,
        longevityMaxPoints: 50,
        longevityFullAtDays: 365,
      },
      contractHistory: {
        maxPoints: 150,
        maxPointsPerProtocol: 50,
        maxCountedProtocols: 3,
      },
      communityTrust: {
        maxPoints: 300,
        vouchMaxPoints: 200,
        vouchCapWei: "1000000000000000000",
        vouchDecayDays: 365,
        attestationMaxPoints: 100,
        attestationMaxCounted: 3,
      },
      riskSignals: {
        maxPenalty: 300,
        low: 20,
        medium: 50,
        high: 100,
      },
    },
    vouchFarming: {
      minActiveVouches: 3,
      reciprocalPairs: 2,
      topVoucherShare: 0.5,
      singleDiscount: 0.5,
      bothDiscount: 0.25,
    },
  },

  tier: {
    // PROVISIONAL — TierStrategyV1 (Spec 10), bukan ambang final Fathom.
    // unavailable = null tier (tidak pernah menebak tier).
    boundaries: [
      { minScore: 750, id: "exceptional", label: "Exceptional" },
      { minScore: 500, id: "established", label: "Established" },
      { minScore: 250, id: "emerging", label: "Emerging" },
      { minScore: 0, id: "new", label: "New" },
    ],
    eligibility: {
      // PROVISIONAL — sumber yang wajib usable sebelum tier boleh diturunkan.
      // Sumber di luar daftar ini (contract/attestation/vouch) tidak diminta
      // hanya karena tabelnya ada; sumber yang belum di-index tetap partial.
      requiredSources: [
        "onchain",
        "economicHistory",
        "counterpartyHistory",
        "riskSignals",
      ],
    },
  },

  baseline: {
    max: 100,
    // TBD — indikator & bobot baseline on-chain belum diputuskan (PRD §10.2)
    walletAgeMaxPoints: 50,
    walletAgeFullAtDays: 365,
    txCountMaxPoints: 50,
    txCountFullAt: 100,
  },

  vouch: {
    max: 400,
    // Vouch ke-n dari wallet yang sama ke target yang sama:
    // bobot = stake * decayFactor^(n-1)
    decayFactor: 0.5,
    // Konversi stake (wei) ke poin skor — TBD, bergantung tokenomics (PRD §10.3)
    pointsPerToken: 1,
    // Cooldown penarikan stake (hari) — TBD, tuning Fase 13.
    // Stake yang sedang terlibat dispute dikunci sementara (Disputed/Slashed tidak bisa withdraw).
    withdrawCooldownDays: 30,
  },

  review: {
    max: 100,
    multiplier: 20, // rata_rata_rating (1-5) * 20
  },

  invite: {
    bonus: 50,
    // Dampak negatif ke inviter kalau yang diundang kena dispute — TBD (Fase 6)
    inviterPenaltyOnInviteeDispute: 25,
  },

  badge: {
    bonusPerBadge: 50,
    maxCountedBadges: 2,
    // TBD — skor minimum untuk bisa memberi attestation (PRD §10.1)
    minScoreToAttest: 200,
    // TBD — jumlah attestation dari wallet berbeda untuk jadi terverifikasi
    minAttestationsToVerify: 3,
  },

  dispute: {
    // Batas input (bukan parameter skor) untuk reason/evidence dispute (Spec 09).
    maxReasonLength: 500,
    maxEvidenceLength: 2000,
    // Penalti = subtotal * penaltyRatio, dipotong selama dispute open
    penaltyRatio: 0.5,
    // TBD — jumlah report dari wallet berbeda yang memicu freeze (PRD §10.1)
    minReportsToFreeze: 3,
    // TBD — skor minimum agar sebuah wallet boleh mengajukan report
    minScoreToReport: 300,
  },

  gatedAccess: {
    // TBD — skor minimum untuk membuka konten ter-gate (PRD §10.1)
    minScore: 400,
  },
} as const;
