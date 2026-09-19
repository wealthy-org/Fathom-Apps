ALTER TABLE "score_snapshots" ADD COLUMN "fingerprint" char(64) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "score_snapshots" ALTER COLUMN "fingerprint" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_fingerprint" UNIQUE("address","fingerprint");
