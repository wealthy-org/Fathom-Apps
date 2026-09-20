"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

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

  useEffect(() => {
    const sync = () => {
      const id = tabIdFromHash(window.location.hash);
      if (id) setActive((prev) => (prev === id ? prev : id));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const select = useCallback((id: ProfileTabId) => {
    setActive(id);
    if (tabIdFromHash(window.location.hash) !== id) {
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
        role="tablist"
        aria-label="Wallet profile sections"
        onKeyDown={onKeyDown}
        className="flex gap-2 overflow-x-auto pb-1"
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
              className={`shrink-0 whitespace-nowrap px-4 py-2 text-xs ${
                selected ? "btn-brutal" : "btn-brutal-light"
              }`}
            >
              {tab.label}
              {badge ? (
                <span className="ml-2 rounded-sm border border-current px-1 font-mono text-[10px]">
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
