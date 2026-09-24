"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ADDRESS_RE } from "@/lib/chain/address";
import { shortAddress } from "@/components/activity-utils";
import { DocsCode } from "@/components/docs-code";

export interface DocsPlaygroundHandle {
  run: (address: string) => void;
  focusInput: () => void;
}

type LangTab = "curl" | "javascript" | "python";
type OutputTab = "preview" | "json";

interface PlaygroundResult {
  address: string;
  status: number;
  ms: number;
  body: unknown;
}

/** Respons 17 field — subset yang dipakai kartu pratinjau. Semua nullable-safe. */
interface ReputationPreview {
  address?: string;
  score?: number | null;
  tier?: { id?: string; label?: string } | null;
  riskLevel?: string | null;
  walletAgeDays?: number | null;
  uniqueCounterparties?: number | null;
  attestations?: number | null;
  activeDisputes?: number | null;
}

function asPreview(body: unknown): ReputationPreview | null {
  if (typeof body !== "object" || body === null) return null;
  return body as ReputationPreview;
}

const RISK_COLOR: Record<string, string> = {
  low: "text-ink",
  medium: "text-[#F0B45A]",
  high: "text-accent-ink",
};

function requestSnippet(kind: LangTab, address: string): string {
  if (kind === "curl") {
    return `curl -s "https://app.fathom.example/api/reputation/${address}" \\
  -H "accept: application/json"`;
  }
  if (kind === "javascript") {
    return `const res = await fetch(
  "https://app.fathom.example/api/reputation/${address}",
  { headers: { accept: "application/json" } },
);
if (!res.ok) throw new Error("fathom: " + res.status);
const profile = await res.json();
// null means unknown — never treat it as zero.`;
  }
  return `import requests

res = requests.get(
    f"https://app.fathom.example/api/reputation/${address}",
    headers={"accept": "application/json"},
)
res.raise_for_status()
profile = res.json()  # null means unknown — never treat it as zero.`;
}

const QUICK_PILLS: Array<{ label: string; address: string }> = [
  { label: "Sample wallet", address: "0x71c4e2a9b30d18f6a5e7c4b2d91f04a83b6c4a3f" },
  { label: "Invalid address", address: "0x1234" },
  { label: "Unknown wallet", address: `0x${"0".repeat(40)}` },
];

/**
 * Playground 01 — fetch REAL ke /api/reputation/{address}. Input invalid
 * divalidasi lokal (400 invalid_address, sama seperti server). Unknown
 * wallet tetap 200 dengan nulls — pratinjau menampilkan "Unrated".
 */
export const DocsPlayground = forwardRef<
  DocsPlaygroundHandle,
  { defaultAddress: string }
>(function DocsPlayground({ defaultAddress }, ref) {
  const [address, setAddress] = useState(defaultAddress);
  const [lang, setLang] = useState<LangTab>("curl");
  const [output, setOutput] = useState<OutputTab>("preview");
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      run: (next: string) => {
        setAddress(next);
        setOutput("preview");
        void send(next);
      },
      focusInput: () => inputRef.current?.focus(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const send = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!ADDRESS_RE.test(trimmed)) {
      setResult({
        address: trimmed,
        status: 400,
        ms: 0,
        body: {
          error: {
            code: "invalid_address",
            message: "Address must be a valid EVM address.",
          },
        },
      });
      return;
    }
    setRunning(true);
    try {
      const started = performance.now();
      const res = await fetch(`/api/reputation/${trimmed.toLowerCase()}`);
      const ms = Math.round(performance.now() - started);
      const body = (await res.json().catch(() => null)) as unknown;
      setResult({ address: trimmed, status: res.status, ms, body });
    } catch {
      setResult({
        address: trimmed,
        status: 0,
        ms: 0,
        body: {
          error: {
            code: "network_error",
            message: "Request could not reach the API.",
          },
        },
      });
    } finally {
      setRunning(false);
    }
  }, []);

  const preview = asPreview(result?.body ?? null);
  const isError =
    result !== null &&
    (result.status >= 400 || preview === null || "error" in (preview as object));
  const jsonCode =
    result === null
      ? "// Send a request to see the real response here."
      : JSON.stringify(result.body, null, 2);

  const statusLine =
    result === null
      ? "Ready · edge cache 60s"
      : `${result.status === 0 ? "network" : result.status} · ${result.ms} ms · edge cache 60s`;

  return (
    <div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void send(address);
        }}
      >
        <input
          ref={inputRef}
          id="docs-playground-input"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          spellCheck={false}
          aria-label="Wallet address"
          className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-ink bg-white px-4 font-mono text-sm text-ink outline-none transition placeholder:text-slate400 focus:ring-2 focus:ring-accent/30"
          placeholder="0x…"
        />
        <button
          type="submit"
          disabled={running}
          className="btn-brutal h-12 shrink-0 bg-accent px-7 text-sm hover:bg-accent-ink"
        >
          {running ? "Sending…" : "Send"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_PILLS.map((pill) => (
          <button
            key={pill.label}
            type="button"
            onClick={() => {
              setAddress(pill.address);
              void send(pill.address);
            }}
            className="rounded-full border border-ink/20 bg-white px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400 transition hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex gap-2" role="tablist" aria-label="Request language">
            {(
              [
                ["curl", "cURL"],
                ["javascript", "JavaScript"],
                ["python", "Python"],
              ] as Array<[LangTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={lang === id}
                onClick={() => setLang(id)}
                className={`rounded-full px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  lang === id
                    ? "bg-ink text-white"
                    : "border border-ink/20 bg-white text-slate400 hover:border-ink hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <DocsCode
            className="mt-3"
            badge="GET"
            title="/api/reputation/{address}"
            language={lang === "curl" ? "curl" : lang === "python" ? "python" : "js"}
            code={requestSnippet(lang, address.trim() || "{address}")}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2" role="tablist" aria-label="Response view">
              {(
                [
                  ["preview", "Preview"],
                  ["json", "JSON"],
                ] as Array<[OutputTab, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={output === id}
                  onClick={() => setOutput(id)}
                  className={`rounded-full px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    output === id
                      ? "bg-ink text-white"
                      : "border border-ink/20 bg-white text-slate400 hover:border-ink hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                isError ? "text-accent-ink" : "text-slate400"
              }`}
            >
              {statusLine}
            </span>
          </div>

          {output === "json" ? (
            <DocsCode className="mt-3" title="response.json" code={jsonCode} />
          ) : (
            <div className="mt-3 rounded-2xl border border-ink/10 bg-white p-6 shadow-[0_14px_30px_-18px_rgba(35,36,39,0.25)]">
              {preview === null || isError ? (
                <div className="text-center">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-ink">
                    {result === null
                      ? "No response yet"
                      : result.status === 400
                        ? "400 · invalid_address"
                        : result.status === 0
                          ? "network · unreachable"
                          : `${result.status} · server_error`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate400">
                    {result === null
                      ? "Send a request — the card fills with the wallet's real evidence."
                      : "The response carries an error object. See the Errors section below."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm text-ink">
                      {shortAddress(preview.address ?? result?.address ?? "0x…")}
                    </span>
                    <span className="chip-mono gap-1.5 text-slate400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                      Live
                    </span>
                  </div>
                  <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                    Proof of Reputation
                  </p>
                  <div className="mt-1 flex flex-wrap items-end gap-3">
                    <span className="font-serif-accent text-7xl leading-none text-ink tabular-nums">
                      {preview.score ?? "—"}
                    </span>
                    <span className="chip-mono mb-2 text-accent-ink">
                      {preview.tier?.label ?? "Unrated"}
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                    Risk ·{" "}
                    <span className={RISK_COLOR[preview.riskLevel ?? ""] ?? "text-slate400"}>
                      {preview.riskLevel ?? "unknown"}
                    </span>
                  </p>
                  <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink/10 pt-4">
                    {(
                      [
                        ["Wallet age", preview.walletAgeDays, (v: number) => `${v} days`],
                        ["Counterparties", preview.uniqueCounterparties, (v: number) => String(v)],
                        ["Attestations", preview.attestations, (v: number) => String(v)],
                        ["Active disputes", preview.activeDisputes, (v: number) => String(v)],
                      ] as Array<[string, number | null | undefined, (v: number) => string]>
                    ).map(([label, value, format]) => (
                      <div key={label}>
                        <dt className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                          {label}
                        </dt>
                        <dd
                          className={`mt-1 font-display text-xl tabular-nums ${
                            label === "Active disputes" && (value ?? 0) > 0
                              ? "text-accent-ink"
                              : "text-ink"
                          }`}
                        >
                          {value === null || value === undefined ? "—" : format(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
