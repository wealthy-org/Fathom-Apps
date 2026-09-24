import Link from "next/link";
import type { FeedTab } from "@/lib/activity/feed";

const TABS: Array<{ id: FeedTab; label: string; path: string }> = [
  {
    id: "signal",
    label: "Signal",
    path: "M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z",
  },
  {
    id: "latest",
    label: "Latest",
    path: "M12 3v10m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  },
  {
    id: "established",
    label: "Established",
    path: "M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z",
  },
  {
    id: "disputed",
    label: "Disputed",
    path: "M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5",
  },
];

/**
 * Tab filter bar for /activity (Spec 04 section 3.5).
 * Plain links (?tab=, cursor reset) — zero client JS.
 * Icons are inline SVG, never emoji.
 */
export function ActivityTabs({ active }: { active: FeedTab }) {
  return (
    <nav aria-label="Activity filters" className="mt-5">
      <ul className="flex flex-wrap gap-2" role="list">
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.id === "latest" ? "/activity" : `/activity?tab=${tab.id}`}
                aria-current={selected ? "page" : undefined}
                className={
                  selected
                    ? "btn-brutal inline-flex items-center gap-2 px-4 py-2 text-sm"
                    : "inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm text-ink hover:border-ink"
                }
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={tab.path} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
