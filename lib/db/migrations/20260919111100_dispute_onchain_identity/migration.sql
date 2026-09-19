ALTER TABLE "disputes" ADD COLUMN "registry_id" varchar(64);--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "chain_id" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "tx_hash" char(66);--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "block_number" bigint;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "log_index" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_onchain_identity" UNIQUE("registry_id","chain_id","tx_hash","log_index");