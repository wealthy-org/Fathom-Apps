"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Palet permukaan kode gelap (docs spec): warm ink + lime keys. */
const CODE_TEXT = "#EDEAE0";
const KEY_LIME = "#D7FF45";
const STRING_CREAM = "#EEF9C8";
const NUMBER_AMBER = "#F0B45A";
const LITERAL_CORAL = "#FF8A7A";
const COMMENT_GRAY = "#8B8A80";

/** Sumber regex dipakai ulang; instance baru per render (regex global mutable). */
const TOKEN_SOURCE =
  '(//.*)|("(?:[^"\\\\]|\\\\.)*"|`(?:[^`\\\\]|\\\\.)*`|\'(?:[^\'\\\\]|\\\\.)*\')|(\\b-?\\d+(?:\\.\\d+)?\\b)|(\\b(?:null|undefined|true|false|const|let|await|async|function|return|if|throw|new|import|from|export|def|print|curl|True|False|None)\\b)';

function HighlightedLine({
  line,
  language,
}: {
  line: string;
  language: "json" | "js" | "curl" | "python";
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const tokenRe = new RegExp(TOKEN_SOURCE, "g");
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={`t${last}`} style={{ color: CODE_TEXT }}>
          {line.slice(last, match.index)}
        </span>,
      );
    }
    const [raw, comment, str, num, literal] = match;
    if (comment) {
      parts.push(
        <span key={`c${match.index}`} style={{ color: COMMENT_GRAY }}>
          {comment}
        </span>,
      );
    } else if (str) {
      // JSON: string sebelum ':' = key. Bahasa lain: semua = string value.
      const isKey =
        language === "json" &&
        line.slice(match.index + str.length).match(/^\s*:/) !== null;
      parts.push(
        <span
          key={`s${match.index}`}
          style={{ color: isKey ? KEY_LIME : STRING_CREAM }}
        >
          {str}
        </span>,
      );
    } else if (num) {
      parts.push(
        <span key={`n${match.index}`} style={{ color: NUMBER_AMBER }}>
          {num}
        </span>,
      );
    } else if (literal) {
      parts.push(
        <span key={`l${match.index}`} style={{ color: LITERAL_CORAL }}>
          {literal}
        </span>,
      );
    }
    last = match.index + raw.length;
  }
  if (last < line.length) {
    parts.push(
      <span key={`t${last}`} style={{ color: CODE_TEXT }}>
        {line.slice(last)}
      </span>,
    );
  }
  return <span className="block min-h-[1em]">{parts}</span>;
}

/**
 * Jendela kode gelap ala docs spec: bar atas (route/file + COPY),
 * tokenizer warm palette, scroll horizontal di dalam container sendiri.
 */
export function DocsCode({
  title,
  badge,
  status,
  code,
  language = "json",
  className = "",
  bodyClassName = "",
}: {
  title: string;
  badge?: string;
  status?: string;
  code: string;
  language?: "json" | "js" | "curl" | "python";
  className?: string;
  /** Batas tinggi + scroll internal untuk blok kode (header tetap terlihat). */
  bodyClassName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard tidak tersedia — biarkan state.
    }
  }, [code]);

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-coal ${className}`}
      style={{ boxShadow: "0 14px 30px -18px rgba(23, 23, 25, 0.45)" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {badge && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/90">
              {badge}
            </span>
          )}
          <span className="truncate font-mono text-[11px] text-white/60">
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {status && (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
              {status}
            </span>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 transition hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre
        className={`overflow-auto px-4 py-3.5 font-mono text-xs leading-6 ${bodyClassName}`}
      >
        <code>
          {code.split("\n").map((line, index) => (
            <HighlightedLine
              key={index}
              line={line}
              language={language}
            />
          ))}
        </code>
      </pre>
    </div>
  );
}
