ALTER TABLE "indexer_state" ADD COLUMN "status" varchar(16);--> statement-breakpoint
ALTER TABLE "indexer_state" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "indexer_state" ADD COLUMN "last_indexed_at" timestamp with time zone;