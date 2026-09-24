/**
 * Section heading for the landing narrative:
 * display headline, optional sub copy.
 */

export function LandingSectionHead({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-base leading-7 text-slate400">{sub}</p>}
    </div>
  );
}
