CREATE TABLE "protocols" (
	"id" bigserial PRIMARY KEY,
	"chain_id" integer NOT NULL,
	"contract_address" char(42) NOT NULL,
	"protocol_id" varchar(64) NOT NULL,
	"protocol_name" varchar(128) NOT NULL,
	"source" varchar(32) NOT NULL,
	"source_url" text,
	"verification_status" varchar(16) DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protocols_chain_contract_source" UNIQUE("chain_id","contract_address","source")
);
--> statement-breakpoint
ALTER TABLE "proofs" ADD COLUMN "protocols_stamp" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_protocols_chain_contract" ON "protocols" ("chain_id","contract_address");