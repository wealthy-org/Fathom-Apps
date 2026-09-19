CREATE TABLE "proofs" (
	"id" bigserial PRIMARY KEY,
	"wallet_address" char(42) NOT NULL,
	"proof_type" varchar(32) NOT NULL,
	"source" varchar(32) NOT NULL,
	"value" jsonb NOT NULL,
	"confidence" numeric(5,4) NOT NULL,
	"verification_method" varchar(16) NOT NULL,
	"evidence_reference" text NOT NULL,
	"evidence_references" jsonb,
	"attestation_id" bigint,
	"stats_fetched_at" timestamp with time zone,
	"graph_fetched_at" timestamp with time zone,
	"attestations_stamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_proofs_subject" ON "proofs" ("wallet_address");--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_wallet_address_wallets_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "wallets"("address");--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_attestation_id_attestations_id_fkey" FOREIGN KEY ("attestation_id") REFERENCES "attestations"("id");