// Bottom-right XP toast stack. Max 4 visible, each lives ~2.5s.

const ACCENT = {
  selfStarter: "from-cyan-500/30 to-cyan-700/30 ring-cyan-400/60 text-cyan-100",
  sparkedWorker: "from-cyan-500/30 to-blue-700/30 ring-cyan-400/60 text-cyan-100",
  sparkIssuer:
    "from-fuchsia-500/30 to-fuchsia-800/30 ring-fuchsia-400/60 text-fuchsia-100",
  voucher: "from-amber-500/30 to-amber-800/30 ring-amber-400/60 text-amber-100",
  crowdVouchBonus:
    "from-yellow-400/30 to-amber-700/30 ring-yellow-300/70 text-yellow-50",
};

export default function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter pointer-events-auto rounded-xl border bg-gradient-to-br px-4 py-2.5 text-sm font-bold shadow-lg ring-1 backdrop-blur ${ACCENT[t.kind] ?? ACCENT.voucher}`}
        >
          {t.label}
          {t.subtitle ? (
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider opacity-80">
              {t.subtitle}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
