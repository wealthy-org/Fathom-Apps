"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

export type ProfileTabId =
  | "overview"
  | "evidence"
  | "graph"
  | "risk"
  | "community";

const TABS: { id: ProfileTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "graph", label: "Trust Graph" },
  { id: "risk", label: "Risk" },
  { id: "community", label: "Community" },
];

function tabIdFromHash(hash: string): ProfileTabId | null {
  const id = hash.replace(/^#/, "").split(/[/?]/)[0];
  return TABS.some((t) => t.id === id) ? (id as ProfileTabId) : null;
}

/** Element id after the tab in a deep link, e.g. #evidence/proof-wallet_age. */
function elementIdFromHash(hash: string): string | null {
  const parts = hash.replace(/^#/, "").split("/");
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

/**
 * Deep-link helper: switch tab + scroll target card into view + flash.
 * Plain <a href="#evidence/proof-x"> links work via the hash sync below —
 * call this from client handlers when a button (not a link) triggers it.
 */
export function gotoProfile(tab: ProfileTabId, elementId?: string) {
  window.location.hash = elementId ? `${tab}/${elementId}` : tab;
}

// ponytail: no tab dep — 5 buttons + hash sync. All panels server-render
// once, so switching is instant with zero refetch.
export function ProfileTabs({
  overview,
  evidence,
  graph,
  risk,
  community,
  badges,
}: {
  overview: ReactNode;
  evidence: ReactNode;
  graph: ReactNode;
  risk: ReactNode;
  community: ReactNode;
  badges?: Partial<Record<ProfileTabId, string>>;
}) {
  const [active, setActive] = useState<ProfileTabId>("overview");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tablistRef = useRef<HTMLDivElement | null>(null);
  // Hash changes we cause ourselves (clicking a pill) must not scroll —
  // only external deep links (#evidence, cold load) do.
  const ownHashNav = useRef(false);

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      const id = tabIdFromHash(hash);
      if (!id) return;
      setActive((prev) => (prev === id ? prev : id));
      // Panels are hidden pre-hydration, so the browser's native hash
      // scroll on cold load never fires — bring the tablist into view.
      // behavior "auto" follows CSS scroll-behavior (smooth; auto under
      // prefers-reduced-motion via the html override).
      if (!ownHashNav.current) {
        tablistRef.current?.scrollIntoView({ block: "start" });
      }
      ownHashNav.current = false;
      // Deep link to a card inside the tab (#evidence/proof-x):
      // panel unhides on this tick, so scroll + flash after paint.
      const elId = elementIdFromHash(hash);
      if (elId) {
        requestAnimationFrame(() =>
          setTimeout(() => {
            const el = document.getElementById(elId);
            if (!el) return;
            el.scrollIntoView({ block: "center" });
            el.classList.add("flash");
            setTimeout(() => el.classList.remove("flash"), 1800);
          }, 60),
        );
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const select = useCallback((id: ProfileTabId) => {
    setActive(id);
    // Phase 0 instrumentation — user opened evidence beyond score alone.
    if (id === "evidence" || id === "graph" || id === "risk") {
      trackEvent(ANALYTICS_EVENTS.evidenceExpanded, { tab: id });
    }
    if (tabIdFromHash(window.location.hash) !== id) {
      ownHashNav.current = true;
      window.location.hash = id;
    }
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === active);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  const panels: Record<ProfileTabId, ReactNode> = {
    overview,
    evidence,
    graph,
    risk,
    community,
  };

  return (
    <div className="mt-8">
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Wallet profile sections"
        onKeyDown={onKeyDown}
        className="flex scroll-mt-6 gap-2 overflow-x-auto pb-1"
      >
        {TABS.map((tab, i) => {
          const selected = active === tab.id;
          const badge = badges?.[tab.id];
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={`min-touch shrink-0 whitespace-nowrap px-4 py-2 text-xs ${
                selected ? "btn-brutal" : "btn-brutal-light"
              }`}
            >
              {tab.label}
              {badge ? (
                <span className="ml-2 rounded-sm border border-current px-1 font-mono text-[11px]">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={active !== tab.id}
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
