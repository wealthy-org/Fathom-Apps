import type {
  attestations,
  badgeAttestations,
  counterparties,
  disputes,
  disputeReports,
  indexerState,
  proofs,
  reviews,
  roleBadges,
  scoreSnapshots,
  trustGraphState,
  vouches,
  walletOnchainStats,
  walletRelationships,
  wallets,
} from "@/lib/db/schema";
/** Tipe baris DB — di-infer dari schema, bukan didefinisikan ulang. */
export type Wallet = typeof wallets.$inferSelect;
export type WalletOnchainStats = typeof walletOnchainStats.$inferSelect;
export type Counterparty = typeof counterparties.$inferSelect;
export type WalletRelationship = typeof walletRelationships.$inferSelect;
export type TrustGraphState = typeof trustGraphState.$inferSelect;
export type Vouch = typeof vouches.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
export type DisputeReport = typeof disputeReports.$inferSelect;
export type RoleBadge = typeof roleBadges.$inferSelect;
export type BadgeAttestation = typeof badgeAttestations.$inferSelect;
export type Attestation = typeof attestations.$inferSelect;
export type ProofRow = typeof proofs.$inferSelect;
export type ScoreSnapshot = typeof scoreSnapshots.$inferSelect;
export type IndexerState = typeof indexerState.$inferSelect;
