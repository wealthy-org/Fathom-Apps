# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary (confirmed): individual crypto users who encounter an unknown wallet and need to decide whether to trust it before transacting, trading, or working with that party.

Secondary audiences from the PRD (not the current focus): OTC/marketplace participants, communities/DAOs screening wallets, protocol and app developers consuming the Reputation API.

## Product Purpose

Fathom is a pseudonymous reputation network. It turns a wallet's on-chain history, economic relationships, behavioral signals, counterparty graph, and human attestations into verifiable, explainable reputation evidence ("Proof of Reputation").

Core principles from the PRD:

- "Don't trust the profile. Verify the wallet."
- "Know the wallet before you trust it."
- Evidence before score: the score is a compression layer, not the source of truth; on-chain evidence is the foundation.
- Fathom never decides trust — it provides evidence and context; the user makes the trust decision.
- Reputation ≠ wealth. Reputation ≠ popularity.

Success for the current stage: a working, end-to-end credible MVP on Robinhood Chain testnet that proves the product loop (search wallet → evidence → trust decision).

## Positioning

"The place people check before trusting a pseudonymous wallet."

A neighboring product could not truthfully copy: reputation evidence that is reproducible from indexed/normalized on-chain data, with proofs, explicit risk signals, and human attestations as supporting (not primary) evidence — all tied to an economic identity (wallet), never a real-world identity.

## Operating Context

- Deployment chain: Robinhood Chain (testnet `46630` for development; mainnet `4663` exists). Current work targets testnet.
- Indexed history comes from the chain's Blockscout explorer; RPC-only cannot satisfy `tx_count` / `first_tx_at` (see Spec 01).
- Sign-in is SIWE (Sign-In with Ethereum) with iron-session; wallet connection via wagmi/viem (injected wallets).
- Development follows a 12-phase plan (01 Wallet Search → 12 External Integrations), one phase/task at a time. Phases 01–09 are substantially implemented (search, proofs, reputation profile, trust graph, risk signals, claim profile, attestations, vouch, disputes), plus the reputation card and reputation API surface.
- Repo conventions in `AGENTS.md` are binding: chain access only via `lib/chain/`, score logic only via `lib/score/`, thresholds only in `config/thresholds.ts`, migrations append-only.

## Capabilities and Constraints

Implemented capabilities (evidence-backed): wallet search, reputation profile (dimensions, tier, history via `reputation_snapshots`), proof engine (reproducible from indexed data), trust graph visualization, risk signals (sybil, flagged exposure, malicious contract, abnormal activity, active disputes, vouch risk), claim profile, structured attestations, vouch (with withdraw), disputes, reputation card, reputation API endpoints.

Constraints:

- Privacy model: wallet address is the only required input; alias is optional. Never require real name, email, social handle, phone, or government ID.
- Unavailable data is represented as `null`, never fabricated as `0`.
- Token/money values: `numeric(78,0)` in DB, `bigint` in TypeScript; timestamps `timestamptz` in UTC.
- Scoring thresholds/weights with `TBD` values must not be invented; they live in `config/thresholds.ts`.

Explicitly undecided: none recorded beyond TBD threshold values tracked in `config/thresholds.ts`.

## Brand Commitments

- `docs/design/reference.html` is the binding visual source of truth for all pages.
- Color tokens in `app/globals.css`: accent `#14F195`, purple `#9945FF`, surface `#0B0F17`, void `#020408`, slate400 `#94A3B8`.
- Fonts: Inter (body), Space Grotesk (display), JetBrains Mono (mono).
- Utility classes: `bg-grid`, `bg-stars`, `glow-spot`, `shine-border`, `glass`, `terminal-line`, `solana-button`, `process-line`.
- Animation: GSAP + ScrollTrigger (`.animate-title`, `.card` scroll reveal, parallax glow). Icons: lucide (inline SVG), not Iconify. No Unicorn Studio.
- Logo: `public/logo-accent.png` (accent #E34A32, recolored from `logo-no-bg.png`); favicon via `app/favicon.ico` + `app/icon.png`.

## Evidence on Hand

- `docs/Fathom_PRD_v2.0.md` — full product requirements (v2.0).
- `docs/specs/v2/00-foundation.md` … `12-external-integrations.md` — implementation specs with acceptance criteria.
- `docs/design/reference.html` — committed visual reference implementation.
- `docs/product-validation-observer-run-sheet.md` — validation run sheet.
- Live evidence source: real wallet history via Robinhood Chain testnet + Blockscout indexer.

Absences future work must not fabricate: user research, testimonials, adoption metrics, press, mainnet deployment evidence.

## Product Principles

1. Evidence before score — proofs and raw signals outrank any compressed number.
2. Reproducibility — every on-chain claim can be re-derived from indexed data.
3. The user decides — Fathom exposes evidence and context, never a trust verdict.
4. Pseudonymous by default — a wallet address is the whole identity; no real-world identity, ever.
5. Honest absence — missing data is `null` and labeled, never manufactured.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet. Standard web accessibility practice applies.
