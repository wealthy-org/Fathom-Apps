/**
 * Reference page shell (docs/design/reference.html).
 *
 * White rounded container over the neutral canvas with soft atmo blooms.
 * Presentational only — page content goes in as children.
 */

export function MainShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-0 sm:px-3 lg:px-5">
      <div className="main-shell relative overflow-hidden rounded-none sm:rounded-[40px]">
        <div aria-hidden="true" className="bloom" />
        <div aria-hidden="true" className="atmo atmo-a" />
        <div aria-hidden="true" className="atmo atmo-b" />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
