import type { ReactNode } from 'react';
import { LEVEL_LABELS } from '../../../shared/catalog';
import { proofBreakdown } from '../../../shared/engine';
import type { Confidence, RequirementResult } from '../../../shared/types';

export function Card({
  children,
  className = '',
  title,
  action,
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-xl bg-white/[0.03] p-6 ring-1 ring-white/10 backdrop-blur-sm ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base/7 font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-white/60">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-gray-700 text-white shadow-inner shadow-white/10 hover:bg-gray-600 disabled:opacity-50',
    secondary: 'bg-white/5 text-white ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:text-white/50',
    ghost: 'text-white/80 hover:bg-white/5 hover:text-white disabled:text-white/40',
    danger: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/20',
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm/6 font-semibold transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'slate',
  className = '',
}: {
  children: ReactNode;
  tone?: 'slate' | 'brand' | 'amber' | 'rose' | 'emerald' | 'violet' | 'sky';
  className?: string;
}) {
  const tones = {
    slate: 'bg-white/5 text-white/80 ring-1 ring-inset ring-white/10',
    brand: 'bg-indigo-400/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/30',
    amber: 'bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20',
    rose: 'bg-rose-400/10 text-rose-300 ring-1 ring-inset ring-rose-400/20',
    emerald: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20',
    violet: 'bg-violet-400/10 text-violet-300 ring-1 ring-inset ring-violet-400/30',
    sky: 'bg-sky-400/10 text-sky-300 ring-1 ring-inset ring-sky-400/30',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const CONFIDENCE_META: Record<
  Confidence,
  { label: string; tone: 'slate' | 'amber' | 'sky' | 'emerald'; hint: string }
> = {
  none: { label: 'No evidence', tone: 'slate', hint: 'Nothing reported yet' },
  unverified: { label: 'Unverified', tone: 'amber', hint: 'Self-reported or claimed — counted at ×0.75' },
  evidence: { label: 'Evidence-backed', tone: 'sky', hint: 'Backed by a project or certification — counted at ×0.9' },
  assessed: { label: 'Assessed', tone: 'emerald', hint: 'Verified by an assessment' },
};

export function ConfidenceBadge({ c }: { c: Confidence }) {
  const m = CONFIDENCE_META[c];
  return (
    <span title={m.hint}>
      <Badge tone={m.tone}>{m.label}</Badge>
    </span>
  );
}

/** Horizontal level bar: effective level vs. required marker. */
export function LevelBar({ effective, required, self }: { effective: number; required: number; self?: number }) {
  const pct = (v: number) => `${Math.min(v / 4, 1) * 100}%`;
  const met = effective >= required;
  return (
    <div
      className="relative h-2.5 w-full rounded-full bg-white/10"
      aria-label={`Effective level ${effective} of required ${required}`}
    >
      {self !== undefined && self > effective && (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-amber-300/40"
          style={{ width: pct(self) }}
          title={`Self-reported: ${self}`}
        />
      )}
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${met ? 'bg-emerald-400' : 'bg-indigo-400'}`}
        style={{ width: pct(effective) }}
      />
      <div
        className="absolute -top-1 h-[18px] w-0.5 rounded bg-white"
        style={{ left: `calc(${pct(required)} - 1px)` }}
        title={`Required: ${LEVEL_LABELS[required]}`}
      />
    </div>
  );
}

export function ReadinessRing({
  value,
  size = 128,
  label = 'Readiness estimate',
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${value}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff1a" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#818cf8"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset .8s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold tabular-nums tracking-tight text-white">{value}%</div>
        <div className="text-[10px] uppercase tracking-wide text-white/60">estimate</div>
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <p className="font-medium text-white">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-white/60">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Delta({ from, to, suffix = '' }: { from: number; to: number; suffix?: string }) {
  const d = Math.round((to - from) * 10) / 10;
  if (d === 0) return <span className="text-white/60">±0{suffix}</span>;
  return (
    <span className={d > 0 ? 'text-emerald-300' : 'text-rose-300'}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d)}
      {suffix}
    </span>
  );
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Proof meter: the readiness estimate split into assessed, evidence-backed and unverified points. */
export function ProofMeter({ requirements }: { requirements: RequirementResult[] }) {
  const pts = proofBreakdown(requirements);
  const proven = pts.provenShare;
  const seg = [
    { key: 'assessed', label: 'Assessed', value: pts.assessed, cls: 'bg-emerald-500' },
    { key: 'evidence', label: 'Evidence-backed', value: pts.evidence, cls: 'bg-indigo-500' },
    { key: 'unverified', label: 'Unverified claims', value: pts.unverified, cls: 'bg-amber-400' },
  ];
  return (
    <div>
      <div className="mb-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-white/60">Proof meter</div>
        <div className="text-sm text-white/80">
          <span className="text-lg font-semibold text-white">{proven}%</span> of your readiness is backed by evidence
        </div>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={`Readiness ${Math.round(pts.total * 10) / 10}%: ${seg.map((s) => `${s.label} ${Math.round(s.value * 10) / 10} points`).join(', ')}`}
      >
        {seg.map(
          (s) =>
            s.value > 0 && (
              <div
                key={s.key}
                className={s.cls}
                style={{ width: `${s.value}%` }}
                title={`${s.label}: ${Math.round(s.value * 10) / 10} pts`}
              />
            ),
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/70">
        {seg.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.cls}`} />
            {s.label} {Math.round(s.value * 10) / 10} pts
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dark tooltip styling for Recharts, matching the translucent Headless UI surfaces. */
export const CHART_TOOLTIP = {
  contentStyle: {
    background: 'rgba(23,23,23,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 12,
  },
  labelStyle: { color: 'rgba(255,255,255,0.7)' },
  itemStyle: { color: '#fff' },
  cursor: { stroke: 'rgba(255,255,255,0.2)' },
} as const;
