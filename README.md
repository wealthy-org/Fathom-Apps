# Fathom

**Proof of Reputation for pseudonymous wallets.**

Fathom turns a wallet's on-chain history, economic relationships, behavioral
signals, and human attestations into verifiable, inspectable trust evidence.
Evidence comes before score: the product exposes what can be proven from data,
and labels what cannot. No real-world identity is required — a wallet address is
the only mandatory input.

## Stack

- Next.js 16 (App Router) + TypeScript (strict)
- Tailwind CSS v4
- PostgreSQL (Supabase) via Drizzle ORM v1 rc
- wagmi + viem (injected wallets)
- SIWE + iron-session
- Zod for input validation

## Quick start

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run db:migrate           # apply migrations
npm run dev
```

Open http://localhost:3000.

### Required environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (Supabase Transaction Pooler). |
| `SESSION_SECRET` | Random string ≥ 32 chars for signed session cookies. |
| `NEXT_PUBLIC_ROBINHOOD_CHAIN_ID` | Chain id (`46630` testnet, `4663` mainnet). |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Chain RPC endpoint. |
| `NEXT_PUBLIC_FATHOM_VOUCH_REGISTRY_ADDRESS` | Deployed `FathomVouchRegistry` (frontend writes). |
| `NEXT_PUBLIC_FATHOM_ATTESTATION_REGISTRY_ADDRESS` | Deployed `FathomAttestationRegistry` (frontend writes). |
| `NEXT_PUBLIC_FATHOM_DISPUTE_REGISTRY_ADDRESS` | Deployed `FathomDisputeRegistry` (frontend writes). |
| `FATHOM_VOUCH_REGISTRY_ADDRESS` | Same registry for the server-side indexer. |
| `FATHOM_ATTESTATION_REGISTRY_ADDRESS` | Same registry for the server-side indexer. |
| `FATHOM_DISPUTE_REGISTRY_ADDRESS` | Same registry for the server-side indexer. |
| `CRON_SECRET` | Bearer token for `GET /api/cron/index` (scheduled + manual reindex). |
| `ROBINHOOD_EXPLORER_URL` | Optional Blockscout base URL for indexed history. Defaults to the testnet explorer. |

See `.env.example` for the full list.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Vitest unit suite (score, proofs, address, payloads). |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts`. |
| `npm run db:migrate` | Apply pending migrations. |
| `npm run chain:index` | Run all three registry indexers once (vouch/attestation/dispute). |
| `npm run db:seed:protocols` | Seed verified protocol mappings (Fathom registries). |
| `npm run db:seed:risk` | Add a flagged/malicious registry entry (requires `--reason` + `--evidence-ref`). |

> All scripts run with plain `npm` — no extra tooling needed.

## Architecture

```text
app/          App Router pages + API routes
components/   Client + presentational components
lib/chain/    All blockchain/explorer access (RPC, Blockscout adapters)
lib/db/       Drizzle schema, client, row types
lib/score/    Proofs, dimensions, risk engine, shared score types
lib/wallet/   Profile assembly, alias rules
lib/auth/     SIWE + session
config/       thresholds.ts — all thresholds and parameters
```

Rules of the road (see `AGENTS.md` for the full set):

- All chain access goes through `lib/chain/`; never instantiate clients in UI.
- Addresses are stored lowercase and normalized only via `lib/chain/address.ts`.
- Token amounts use `numeric(78,0)` / `bigint`, never `number`.
- Timestamps are `timestamptz`, stored UTC.
- Every threshold/weight/cap lives in `config/thresholds.ts` — no magic numbers.
- Migrations are append-only.
- Unavailable data is represented as `null`, never fabricated as `0`.

## Data sources

- **RPC** — direct chain reads only (balance, code, nonce, block data). RPC
  cannot enumerate per-address transaction history on this chain.
- **Blockscout** (`ROBINHOOD_EXPLORER_URL`) — indexed per-address transactions,
  read through a 24h cache in `wallet_onchain_stats`, `wallet_relationships`,
  and `trust_graph_state`. If a query cannot complete, the count is stored as
  `null` rather than an invented total.

## Scheduler

Registry events reach the database through two paths:

- **Per-submit refresh** — after a vouch/attestation/dispute confirms, the form
  calls `POST /api/index` (same payload kind), which runs the relevant indexer
  before refreshing the profile.
- **Scheduled reindex** — `GET /api/cron/index` (Bearer `CRON_SECRET`) runs all
  three registry indexers. Wired to an external cron (cron-job.org, hourly) on
  Hobby; see `vercel.json` history. Manual backfill: `npm run chain:index`.

## Testing

```bash
npm run test   # vitest run — pure-logic unit tests, no DB/RPC
```

Covers score strategy + tiers, vouch-farming discounts, proof generation,
address normalization, attestation/dispute payloads, and wallet-metrics helpers.
Contract tests live in `contracts/` (Foundry, `forge test`).

## Public API

`GET /api/reputation/{address}` returns score, tier, `riskLevel`, `vouchesCount`,
dimensions, proofs, risk signals, vouches, and claim state (CORS-open, 60s
edge cache). Full reference with request/response examples: `/docs` in the app.

## Phase status

Implemented:

- 01 Wallet Search
- 02 Proof Engine — `wallet_age`, `transaction_history`, `unique_counterparty`,
  `repeat_counterparty`, `economic_history`, `contract_history`,
  `protocol_history`, `role_attestation`
- 03 Reputation Profile + Score — dimension framework with formula
  `1.1.0-provisional` (see `config/thresholds.ts`); UI shows score/tier without
  internal formula jargon
- 04 Trust Graph — unique/repeat counterparties and relationship duration
- 05 Risk Engine — `fresh_wallet`, `circular_relationship_graph`,
  `concentrated_counterparty_graph`, `suspicious_vouch_clustering`,
  `flagged_counterparty_exposure`, `malicious_contract_interaction` derived on
  the fly with evidence. `abnormal_transaction_pattern` is intentionally
  unevaluated (blocked by product rule); flagged/malicious signals need seeded
  registry content (`npm run db:seed:risk`).
- 06 Claim Profile (SIWE) + alias editing
- 07 Structured Attestations — on-chain via `FathomAttestationRegistry`,
  emitted as `role_attestation` proofs
- 08 Vouch — on-chain with stake via `FathomVouchRegistry`, indexed with
  farming discounts
- 09 Disputes — on-chain via `FathomDisputeRegistry` (open-only reports)
- 10 Reputation Card (Open Graph image, shareable from the profile)
- 11 Reputation API — `GET /api/reputation/{address}` with score, tier,
  `riskLevel`, `vouchesCount`, dimensions, proofs, and evidence

Notes:

- Off-chain attestation/dispute write routes are deprecated (`410 Gone`);
  the indexers are the sole writers for those tables.
- Legacy `reviews` / `role_badges` / `badge_attestations` / `dispute_reports`
  tables were dropped; only `wallets.invited_by` remains as a read-side field.

Not yet implemented, pending product decisions:

- 12 External Integrations — public API + docs exist; no API keys, rate
  limiting, or formal OpenAPI yet.
