import { WalletShell } from "@/components/wallet-shell";
import { CodeCard } from "@/components/code-card";
import { DocsSidebar } from "@/components/docs-sidebar";

/**
 * Public API documentation for external integrators (Phase 11).
 * Static server component — no client JS except CodeCard copy buttons,
 * no auth, no secrets.
 */

const REQUEST_SNIPPET = `const res = await fetch(
  "https://YOUR-APP/api/reputation/0x71c4…4a3f",
  { headers: { accept: "application/json" } },
);
if (!res.ok) throw new Error(\`fathom: \${res.status}\`);
const profile = await res.json();
// profile.score, profile.tier, profile.riskLevel,
// profile.proofs[] — each with evidence_reference.
// Never treat null as zero: null means unknown.`;

const RESPONSE_SNIPPET = `{
  "address": "0x71c4…4a3f",
  "score": 332,
  "tier": { "id": "emerging", "label": "Emerging" },
  "completeness": "complete",
  "riskLevel": "medium",
  "vouchesCount": 2,
  "walletAgeDays": 812,
  "txCount": 4291,
  "uniqueCounterparties": 284,
  "repeatCounterparties": 71,
  "attestations": 8,
  "activeDisputes": 0,
  "proofs": [
    {
      "type": "wallet_age",
      "value": { "ageDays": 812 },
      "evidence_reference": "https://explorer…/tx/0x…"
    }
  ],
  "dimensions": [ /* per-dimension contributions + evidence */ ],
  "formulaVersion": "1.1.0"
}`;

const ERROR_SNIPPET = `// Error shape — always this, never a stack trace.
{ "error": { "code": "invalid_address", "message": "…" } }`;

const FIELDS: Array<[string, string]> = [
  ["address", "Lowercase wallet address (the identity object)."],
  ["score", "Compressed reputation score, 0–1000. Provisional — always inspect evidence."],
  ["tier", "{ id, label }: new | emerging | established | exceptional. null when evidence is partial."],
  ["completeness", "complete | partial | unavailable — how much evidence could be evaluated."],
  ["riskLevel", "low | medium | high. null when risk evidence is not evaluable (not a clean bill)."],
  ["vouchesCount", "Active on-chain vouches, or null when the vouch index has not run."],
  ["walletAgeDays, txCount", "Wallet history from indexed on-chain data. null = unknown, not zero."],
  ["uniqueCounterparties, repeatCounterparties", "Counterparty graph metrics. null when the graph walk is incomplete."],
  ["attestations, activeDisputes", "Structured attestations count; open disputes count."],
  ["proofs", "Reproducible proof objects, each with evidence_reference you can inspect."],
  ["dimensions", "Per-dimension contributions with evidence references and explanations."],
  ["claim", "Whether the wallet owner proved ownership (never creates reputation)."],
  ["availability", "Per-source state: available | empty | unavailable | not_indexed | incomplete."],
  ["formulaVersion", "Scoring formula version used (internal audit field)."],
];

const ERRORS: Array<[string, string, string]> = [
  ["400", "invalid_address", "Address is not a valid 0x wallet address."],
  ["404", "wallet_not_found", "No profile row exists for this address yet."],
  ["405", "method_not_allowed", "Only GET (and CORS preflight OPTIONS) are served."],
];

/** Field name → stable anchor slug (mis. "walletAgeDays, txCount" → "field-walletagedays-txcount"). */
function fieldSlug(field: string): string {
  return `field-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default function DocsPage() {
  return (
    <WalletShell>
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink">
          Docs
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Reputation API
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate400">
          Query any wallet&apos;s Proof of Reputation. Read-only, no API key,
          CORS-open for browser apps. Evidence first — the response carries the
          proofs behind the score, not just the number.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-6 lg:flex-row">
        <DocsSidebar />
        <div className="min-w-0 flex-1">
          <section id="endpoint" className="panel-brutal mt-10 scroll-mt-28 p-7 first:mt-0">
          <h2 className="font-display text-xl font-medium">Endpoint</h2>
          <div className="mt-4">
            <CodeCard
              title="request.http"
              language="http"
              code="GET /api/reputation/{address}"
            />
          </div>
          <p className="mt-3 text-sm leading-7 text-slate400">
            Replace <span className="font-mono">{`{address}`}</span> with a
            checksummed or lowercase <span className="font-mono">0x</span>{" "}
            address. Data covers Robinhood Chain Testnet. Responses are cached
            at the edge for 60 seconds.
          </p>
        </section>

        <section id="request" className="mt-6 scroll-mt-28">
          <h2 className="mt-2 font-display text-xl font-medium">Request</h2>
          <div className="mt-4">
            <CodeCard
              title="example.js"
              language="js"
              code={REQUEST_SNIPPET}
            />
          </div>
        </section>

        <section id="response" className="mt-6 scroll-mt-28">
          <h2 className="mt-2 font-display text-xl font-medium">Response</h2>
          <div className="mt-4">
            <CodeCard
              title="response.json"
              language="json"
              code={RESPONSE_SNIPPET}
            />
          </div>
        </section>

        <section id="fields" className="panel-brutal mt-6 scroll-mt-28 p-7">
          <h2 className="font-display text-xl font-medium">Response fields</h2>
          <ul className="mt-4 space-y-3">
            {FIELDS.map(([field, desc]) => (
              <li
                key={field}
                id={fieldSlug(field)}
                className="scroll-mt-28 border-b border-ink/10 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="font-mono text-sm text-ink">{field}</span>
                <p className="mt-1 text-sm leading-6 text-slate400">{desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="errors" className="mt-6 scroll-mt-28">
          <div className="mt-4">
            <CodeCard
              title="error.json"
              language="json"
              code={ERROR_SNIPPET}
            />
          </div>
          <ul className="mt-4 space-y-3">
            {ERRORS.map(([status, code, desc]) => (
              <li
                key={code}
                className="border-b border-ink/10 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="font-mono text-sm text-ink">
                  {status} {code}
                </span>
                <p className="mt-1 text-sm leading-6 text-slate400">{desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="limits" className="panel-brutal mt-6 scroll-mt-28 p-7">
          <h2 className="font-display text-xl font-medium">Limits & notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate400">
            <li>No API key required. No rate limits are enforced yet — be reasonable.</li>
            <li>Data covers Robinhood Chain Testnet only.</li>
            <li>
              A score is provisional compression over evidence, not a verdict.
              Surface the proofs and risk signals in your own UI before letting
              users act on a number.
            </li>
            <li>
              Fields that cannot be evaluated return{" "}
              <span className="font-mono">null</span> — never treat null as
              zero.
            </li>
          </ul>
        </section>

        <section id="changelog" className="panel-brutal mt-6 scroll-mt-28 p-7">
          <h2 className="font-display text-xl font-medium">Changelog</h2>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate400">
            <li>
              <span className="font-mono text-ink">1.1.0</span> — Added{" "}
              <span className="font-mono">riskLevel</span> and{" "}
              <span className="font-mono">vouchesCount</span>; conservative
              calibration floors.
            </li>
            <li>
              <span className="font-mono text-ink">1.0.0</span> — Initial
              public shape: score, tier, proofs, dimensions, completeness.
            </li>
          </ul>
        </section>
        </div>
      </div>
    </WalletShell>
  );
}
