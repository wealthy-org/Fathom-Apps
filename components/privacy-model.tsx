/**
 * Privacy Model section (static copy only — no data, no inputs, no controls).
 *
 * States Fathom's pseudonymous identity model: wallet address required,
 * alias optional, real-world identity never required; Fathom evaluates
 * economic identity, not real-world identity. Reused on the landing page;
 * linked subtly from the wallet header. Claims stay limited to what the
 * product implements — no absolute-anonymity language.
 */

const NOT_REQUIRED = [
  "Real Name",
  "Profile Photo",
  "Twitter",
  "Email",
  "Discord",
  "Phone",
  "Government ID",
];

const ECONOMIC_IDENTITY = [
  "Wallet history",
  "Economic behavior",
  "Relationships",
  "Attestations",
  "Risk signals",
];

const REAL_WORLD_IDENTITY = [
  "Name",
  "Government ID",
  "Phone",
  "Email",
  "Social identity",
];

export function PrivacyModel() {
  return (
    <div className="panel-brutal max-w-2xl space-y-6 p-6 sm:p-8">
      <div>
        <h3 className="font-display text-lg">Pseudonymous by default</h3>
        <p className="mt-2 text-sm text-slate400">
          Fathom is designed to evaluate wallet behavior without requiring
          users to reveal who they are. Your wallet is the identity object.
          Your behavior provides the evidence.
        </p>
      </div>

      <div className="border-t-2 border-ink/10 pt-5">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Required
        </h4>
        <p className="mt-2 font-display text-base">Wallet Address</p>
        <p className="mt-1 text-sm text-slate400">
          Your wallet address is the primary pseudonymous identity object
          used by Fathom. It does not identify the real person behind the
          wallet.
        </p>
      </div>

      <div className="border-t-2 border-ink/10 pt-5">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Optional
        </h4>
        <p className="mt-2 font-display text-base">Alias</p>
        <p className="mt-1 text-sm text-slate400">
          You may associate an alias with your claimed profile. It is
          cosmetic, never verified, and never required to claim or use a
          profile.
        </p>
      </div>

      <div className="border-t-2 border-ink/10 pt-5">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Not required
        </h4>
        <ul className="mt-2 flex flex-wrap gap-2">
          {NOT_REQUIRED.map((item) => (
            <li
              key={item}
              className="rounded-full border border-black/10 px-2.5 py-1 font-mono text-[11px] text-slate400"
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-slate400">
          Fathom does not require real-world identity information to use the
          core product.
        </p>
      </div>

      <div className="border-t-2 border-ink/10 pt-5">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Fathom evaluates
        </h4>
        <p className="mt-2 font-display text-base text-accent-ink">
          Economic identity
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-slate400">
          {ECONOMIC_IDENTITY.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Not real-world identity
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-slate400">
          {REAL_WORLD_IDENTITY.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      </div>

      <div className="border-t-2 border-ink/10 pt-5 text-sm text-slate400">
        <p>
          Searching a wallet requires no ownership — anyone can inspect
          public wallet evidence. Claiming a profile proves control of the
          wallet; it reveals no real-world identity and creates no
          reputation. Reputation comes from wallet evidence alone.
        </p>
      </div>
    </div>
  );
}
