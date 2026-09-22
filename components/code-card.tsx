"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Code snippet card with filename/language header + Copy button.
 * Reused on the landing #api section and the /docs page.
 *
 * Coloring = Opsi A hand tokenizer (no dependency): tiny regex
 * highlighter for the two languages actually used (js, json).
 * Unknown language falls back to plain text.
 */

// ponytail: single exec-loop per regex — gaps stay plain, matches get color.
// Order inside each alternation matters: strings/comments before keywords.
const JSON_RE =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

const JS_RE =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|await|async|if|throw|new|return|import|from|export|function|for|of|let|var)\b|(-?\b\d+(?:\.\d+)?\b)/g;

function tokenize(code: string, language: string): ReactNode {
  const re = language === "json" ? JSON_RE : language === "js" ? JS_RE : null;
  if (!re) return code;
  re.lastIndex = 0;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [full, str, colon, num, lit] = m;
    if (str !== undefined) {
      // JSON key (string followed by colon) vs plain string value.
      out.push(
        <span
          key={key++}
          className={colon !== undefined ? "text-sky-800" : "text-emerald-800"}
        >
          {full}
        </span>,
      );
    } else if (language === "js" && m[1] !== undefined) {
      out.push(
        <span key={key++} className="text-slate400">
          {full}
        </span>,
      );
    } else if (num !== undefined || (language === "js" && m[4] !== undefined)) {
      out.push(
        <span key={key++} className="text-amber-700">
          {full}
        </span>,
      );
    } else if (lit !== undefined) {
      out.push(
        <span key={key++} className="text-purple-700">
          {full}
        </span>,
      );
    } else {
      // JS keyword branch.
      out.push(
        <span key={key++} className="text-purple-700">
          {full}
        </span>,
      );
    }
    last = m.index + full.length;
    // ponytail: zero-length guard — patterns always consume, but never loop forever.
    if (full.length === 0) re.lastIndex += 1;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeCard({
  title,
  language,
  code,
}: {
  title: string;
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="panel-brutal overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs font-medium text-ink">
            {title}
          </span>
          <span className="chip-mono shrink-0 text-slate400">{language}</span>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-full border border-ink/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/70 transition hover:text-ink"
          aria-live="polite"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-black/5 p-4 font-mono text-xs leading-6 text-ink">
        {tokenize(code, language)}
      </pre>
    </div>
  );
}
