/**
 * JSON-safe serializer untuk response API (Spec 11 §Serialization).
 *
 * `NextResponse.json()` memakai `JSON.stringify` yang melempar TypeError
 * untuk `bigint` — padahal nilai uang/token di repo ini memang `bigint`
 * (AGENTS.md §9: numeric(78,0) → bigint). Helper ini:
 * - bigint → string desimal (presisi penuh, bukan float);
 * - Date → ISO string;
 * - sisanya rekursif (array/objek), primitif lain apa adanya.
 *
 * Tidak mengubah domain types — hanya boundary presentasi API.
 */
export function toJsonSafe<T>(value: T): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toJsonSafe(v)]),
    );
  }
  return value;
}
