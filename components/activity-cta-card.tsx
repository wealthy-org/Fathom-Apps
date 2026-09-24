"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ADDRESS_RE } from "@/lib/chain/address";
import { Logo } from "@/components/layout/Navbar";

/**
 * CTA card above Recently Claimed on /activity.
 * Light palette: white panel, ink serif headline, light pill input.
 * Address submit routes to the wallet profile — same target as search.
 */
export function ActivityCtaCard() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const errorId = useId();

  function submit() {
    if (isPending) return;
    const trimmed = value.trim();
    if (!ADDRESS_RE.test(trimmed)) {
      setError("Enter a valid 0x address.");
      return;
    }
    setError(null);
    startTransition(() => {
      router.push(`/wallets/${trimmed.toLowerCase()}`);
    });
  }

  return (
    <section aria-label="Check credibility score" className="panel-brutal p-6 text-center">
      <div className="flex justify-center">
        <Logo wordmark={false} />
      </div>
      <h2 className="font-serif-accent mt-4 text-3xl leading-tight text-ink">
        What&apos;s your credibility score?
      </h2>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Wallet address
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={isPending}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Search any address, e.g. 0x…"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          inputMode="text"
          enterKeyHint="search"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-brutal h-11 w-full px-4 font-mono text-sm disabled:opacity-60"
        />
        {error && (
          <p id={errorId} role="alert" className="mt-2 font-mono text-xs text-red-600">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
