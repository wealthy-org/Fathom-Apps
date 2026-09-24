CREATE TABLE "risk_detections" (
	"id" bigserial PRIMARY KEY,
	"wallet_address" char(42) NOT NULL REFERENCES "wallets"("address"),
	"signal_id" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"evidence_reference" text,
	"detected_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "risk_detections_first" ON "risk_detections" ("wallet_address","signal_id");--> statement-breakpoint
CREATE INDEX "idx_risk_detections_recent" ON "risk_detections" ("detected_at");--> statement-breakpoint
CREATE TABLE "attestation_reactions" (
	"id" bigserial PRIMARY KEY,
	"attestation_id" bigint NOT NULL REFERENCES "attestations"("id") ON DELETE CASCADE,
	"voter_address" char(42) NOT NULL REFERENCES "wallets"("address"),
	"value" varchar(16) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "attestation_reactions_identity" ON "attestation_reactions" ("attestation_id","voter_address");--> statement-breakpoint
CREATE INDEX "idx_attestation_reactions_attestation" ON "attestation_reactions" ("attestation_id");