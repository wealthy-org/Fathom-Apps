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
npm run db:migrate        # apply migrations
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
| `ROBINHOOD_EXPLORER_URL` | Optional Blockscout base URL for indexed history. Defaults to the testnet explorer. |

See `.env.example` for the full list.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts`. |
| `npm run db:migrate` | Apply pending migrations. |

> On Windows PowerShell, `npm.ps1` may be blocked by execution policy — use
> `npm.cmd run <script>`.

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

## Phase status

Implemented:

- 01 Wallet Search
- 02 Proof Engine — `wallet_age`, `transaction_history`, `unique_counterparty`,
  `repeat_counterparty`, `economic_history`, `contract_history`,
  `role_attestation`
- 03 Reputation Profile — dimension framework; no global score
- 04 Trust Graph — unique/repeat counterparties and relationship duration
- 05 Risk Engine — `fresh_wallet`, `circular_relationship_graph`,
  `concentrated_counterparty_graph` derived on the fly with evidence. The other
  three signals (`abnormal_transaction_pattern`, `flagged_counterparty_exposure`,
  `suspicious_vouch_clustering`) are reported as `not_evaluable` — their sources
  do not exist yet.
- 06 Claim Profile (implicit on SIWE) + alias editing
- 07 Structured Attestations — emitted as `role_attestation` proofs
- 09 Disputes (signed reports, open-only)
- 10 Reputation Card (Open Graph image)
- 11 Reputation API — evidence-only (`GET /api/reputation/{address}`); omits
  `score`, `tier`, `riskLevel`, and `vouches` rather than fabricate them

Not yet implemented, pending product decisions:

- 03 Reputation Score — the compression layer is not built by product decision.
  The evidence model and scoring inputs are not concrete enough to lock a
  formula (see `docs/specs/v2/03-reputation-profile.md`, PRD §13).
- 08 Vouch — anti-farming rules and the withdrawal lifecycle are undefined; no
  `FathomVouchRegistry` ABI/address exists.
- 12 External Integrations — no concrete consumer yet.

Reputation Score is intentionally deferred until the evidence model and scoring
inputs are sufficiently concrete. The score is a compression layer over
evidence, not the foundation of the product.
