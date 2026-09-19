CREATE TABLE "profile_claims" (
	"address" char(42) PRIMARY KEY,
	"status" varchar(16) DEFAULT 'claimed' NOT NULL,
	"message" text NOT NULL,
	"signature" char(132) NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_metrics" (
	"address" char(42) PRIMARY KEY,
	"active_days" integer,
	"active_months" integer,
	"total_sent_wei" numeric(78,0),
	"total_received_wei" numeric(78,0),
	"avg_value_wei" numeric(78,0),
	"largest_value_wei" numeric(78,0),
	"source" varchar(32),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_address_wallets_address_fkey" FOREIGN KEY ("address") REFERENCES "wallets"("address");--> statement-breakpoint
ALTER TABLE "wallet_metrics" ADD CONSTRAINT "wallet_metrics_address_wallets_address_fkey" FOREIGN KEY ("address") REFERENCES "wallets"("address");