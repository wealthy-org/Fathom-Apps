CREATE TABLE "watches" (
	"watcher_address" char(42) NOT NULL REFERENCES "wallets"("address"),
	"target_address" char(42) NOT NULL REFERENCES "wallets"("address"),
	"created_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "watches_pkey" PRIMARY KEY("watcher_address","target_address")
);--> statement-breakpoint
CREATE INDEX "idx_watches_watcher" ON "watches" ("watcher_address");--> statement-breakpoint
CREATE INDEX "idx_watches_target" ON "watches" ("target_address");
