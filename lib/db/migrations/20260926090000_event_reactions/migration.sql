CREATE TABLE "dispute_reactions" (
	"id" bigserial PRIMARY KEY,
	"dispute_id" bigint NOT NULL REFERENCES "disputes"("id") ON DELETE CASCADE,
	"voter_address" char(42) NOT NULL REFERENCES "wallets"("address"),
	"value" varchar(16) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_reactions_identity" ON "dispute_reactions" ("dispute_id","voter_address");--> statement-breakpoint
CREATE INDEX "idx_dispute_reactions_dispute" ON "dispute_reactions" ("dispute_id");--> statement-breakpoint
CREATE TABLE "vouch_reactions" (
	"id" bigserial PRIMARY KEY,
	"vouch_id" bigint NOT NULL REFERENCES "vouches"("id") ON DELETE CASCADE,
	"voter_address" char(42) NOT NULL REFERENCES "wallets"("address"),
	"value" varchar(16) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "vouch_reactions_identity" ON "vouch_reactions" ("vouch_id","voter_address");--> statement-breakpoint
CREATE INDEX "idx_vouch_reactions_vouch" ON "vouch_reactions" ("vouch_id");--> statement-breakpoint
CREATE TABLE "profile_claim_reactions" (
	"id" bigserial PRIMARY KEY,
	"claim_address" char(42) NOT NULL REFERENCES "profile_claims"("address") ON DELETE CASCADE,
	"voter_address" char(42) NOT NULL REFERENCES "wallets"("address"),
	"value" varchar(16) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "profile_claim_reactions_identity" ON "profile_claim_reactions" ("claim_address","voter_address");--> statement-breakpoint
CREATE INDEX "idx_profile_claim_reactions_claim" ON "profile_claim_reactions" ("claim_address");
