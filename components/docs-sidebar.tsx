"use client";

import { useEffect, useState } from "react";

/**
 * Docs navigation: sticky anchor list (desktop) + collapsible
 * "Jump to section" (mobile). Active section via IntersectionObserver
 * — no library. Same tokens as the rest of /docs (panel-brutal,
 * font-mono, slate400/ink states).
 */

export const DOCS_SECTIONS: Array<{ id: string; label: string }> = [
  { id: "endpoint", label: "Endpoint" },
  { id: "request", label: "Request" },
  { id: "response", label: "Response" },
  { id: "fields", label: "Response fields" },
  { id: "errors", label: "Errors" },
  { id: "limits", label: "Limits & notes" },
  { id: "changelog", label: "Changelog" },
];

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visible.delete(entry.target.id);
          }
        }
        // Section paling atas yang masih terlihat = aktif.
        let best: string | null = null;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const [id, top] of visible) {
          if (top < bestTop) {
            bestTop = top;
            best = id;
          }
        }
        setActive(best);
      },
      // scroll-mt-28 offset — trigger sedikit di bawah navbar.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")]);

  return active;
}

function SectionLinks({
  active,
  onNavigate,
}: {
  active: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {DOCS_SECTIONS.map(({ id, label }) => {
        const isActive = id === active;
        return (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={onNavigate}
              aria-current={isActive ? "location" : undefined}
              className={`flex min-touch items-center rounded-2xl px-4 text-sm transition ${
                isActive ? "font-medium text-ink" : "text-slate400 hover:text-ink"
              }`}
            >
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function DocsSidebar() {
  const ids = DOCS_SECTIONS.map((s) => s.id);
  const active = useActiveSection(ids);

  return (
    <aside className="w-full shrink-0 space-y-3 lg:w-80">
      {/* Desktop: sticky nav */}
      <nav
        aria-label="Docs sections"
        className="panel-brutal sticky top-28 hidden p-3 lg:block"
      >
        <SectionLinks active={active} />
      </nav>

      {/* Mobile: collapsible */}
      <details className="panel-brutal lg:hidden">
        <summary className="flex min-touch cursor-pointer select-none items-center justify-between px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
          Jump to section
          <span aria-hidden="true" className="text-slate400">
            ▾
          </span>
        </summary>
        <div className="border-t border-ink/10 pt-1 pb-2">
          <SectionLinks active={active} />
        </div>
      </details>
    </aside>
  );
}
