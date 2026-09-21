import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

// ponytail: singleton via globalThis — hindari connection leak saat HMR/dev.
// prepare:false wajib untuk Supabase Transaction Pooler (port 6543);
// max:1 karena Next serverless — pooling diurus Supabase, bukan app.
const globalForDb = globalThis as unknown as { postgresClient?: postgres.Sql };

const client =
  globalForDb.postgresClient ??
  postgres(connectionString(), { max: 1, prepare: false });

if (!globalForDb.postgresClient) {
  globalForDb.postgresClient = client;
}

export const db = drizzle({ client });
