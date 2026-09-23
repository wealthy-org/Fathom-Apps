export const ANALYTICS_EVENTS = {
  walletSearched: "wallet_searched",
  evidenceExpanded: "evidence_expanded",
  ownWalletChecked: "own_wallet_checked",
  profileClaimed: "profile_claimed",
  reputationCardShared: "reputation_card_shared",
  attestationCreated: "attestation_created",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

