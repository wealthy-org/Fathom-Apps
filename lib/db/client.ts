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
// max > 1 supaya request konkuren (metadata + render) tidak antre satu soket;
// idle_timeout membuang koneksi idle SEBELUM pooler menutupnya di sisi server
// (soket setengah-terbuka = query gantung lalu CONNECTION_CLOSED);
// connect_timeout agar gagal cepat, bukan gantung menit-menit.
const globalForDb = globalThis as unknown as { postgresClient?: postgres.Sql };

const client =
  globalForDb.postgresClient ??
  postgres(connectionString(), {
    max: 10,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (!globalForDb.postgresClient) {
  globalForDb.postgresClient = client;
}

export const db = drizzle({ client });
