ALTER TABLE "score_snapshots" ADD COLUMN "formula_version" varchar(32) NOT NULL DEFAULT '1.0.0-provisional';--> statement-breakpoint
ALTER TABLE "score_snapshots" ALTER COLUMN "formula_version" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "idx_snapshots_dedupe" ON "score_snapshots" USING btree ("address","formula_version","total_score","trigger_event");
