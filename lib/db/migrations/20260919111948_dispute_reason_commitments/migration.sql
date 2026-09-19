ALTER TABLE "disputes" ADD COLUMN "reason_hash" char(66);--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "evidence_ref" char(66);--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "evidence" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "message" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "signature" DROP NOT NULL;