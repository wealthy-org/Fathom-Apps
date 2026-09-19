CREATE TABLE "flagged_addresses" (
	"chain_id" integer,
	"address" char(42),
	"source" varchar(64) NOT NULL,
	"reason" text NOT NULL,
	"evidence_reference" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flagged_addresses_pkey" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "malicious_contracts" (
	"chain_id" integer,
	"address" char(42),
	"source" varchar(64) NOT NULL,
	"reason" text NOT NULL,
	"evidence_reference" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "malicious_contracts_pkey" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE INDEX "idx_flagged_source" ON "flagged_addresses" ("source");--> statement-breakpoint
CREATE INDEX "idx_malicious_source" ON "malicious_contracts" ("source");