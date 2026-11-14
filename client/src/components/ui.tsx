import type { ReactNode } from 'react';
import { LEVEL_LABELS } from '../../../shared/catalog';
import { proofBreakdown } from '../../../shared/engine';
import type { Confidence, RequirementResult } from '../../../shared/types';

export function Card({ children, className = '', title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-card p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-[19px] font-medium leading-snug text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', className = '', title }: { children: ReactNode; onClick?: () => void; variant?: BtnVariant; disabled?: boolean; type?: 'button' | 'submit'; className?: string; title?: string }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-ink text-white hover:bg-ink-soft disabled:bg-slate-300',
    secondary: 'border border-line-strong bg-card text-ink hover:bg-paper-deep disabled:text-slate-500',
    ghost: 'text-slate-600 hover:bg-paper-deep disabled:text-slate-300',
    danger: 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
  };
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'slate', className = '' }: { children: ReactNode; tone?: 'slate' | 'brand' | 'amber' | 'rose' | 'emerald' | 'violet' | 'sky'; className?: string }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700', brand: 'bg-marigold-soft text-[#7a4a0c] ring-1 ring-[#f1d6a8]', amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100', emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100', violet: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
    sky: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export const CONFIDENCE_META: Record<Confidence, { label: string; tone: 'slate' | 'amber' | 'sky' | 'emerald'; hint: string }> = {
  none: { label: 'No evidence', tone: 'slate', hint: 'Nothing reported yet' },
  unverified: { label: 'Unverified', tone: 'amber', hint: 'Self-reported or claimed — counted at ×0.75' },
  evidence: { label: 'Evidence-backed', tone: 'sky', hint: 'Backed by a project or certification — counted at ×0.9' },
  assessed: { label: 'Assessed', tone: 'emerald', hint: 'Verified by an assessment' },
};

export function ConfidenceBadge({ c }: { c: Confidence }) {
  const m = CONFIDENCE_META[c];
  return <span title={m.hint}><Badge tone={m.tone}>{m.label}</Badge></span>;
}

/** Horizontal level bar: effective level vs. required marker. */
export function LevelBar({ effective, required, self }: { effective: number; required: number; self?: number }) {
  const pct = (v: number) => `${Math.min(v / 4, 1) * 100}%`;
  const met = effective >= required;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-paper-deep" aria-label={`Effective level ${effective} of required ${required}`}>
      {self !== undefined && self > effective && <div className="absolute inset-y-0 left-0 rounded-full bg-amber-200/70" style={{ width: pct(self) }} title={`Self-reported: ${self}`} />}
      <div className={`absolute inset-y-0 left-0 rounded-full ${met ? 'bg-emerald-700' : 'bg-ink'}`} style={{ width: pct(effective) }} />
      <div className="absolute -top-1 h-[18px] w-0.5 rounded bg-slate-800" style={{ left: `calc(${pct(required)} - 1px)` }} title={`Required: ${LEVEL_LABELS[required]}`} />
    </div>
  );
}

export function ReadinessRing({ value, size = 128, label = 'Readiness estimate' }: { value: number; size?: number; label?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e9e1d1" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#d98a1f" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-[28px] font-medium tabular-nums text-ink">{value}%</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">estimate</div>
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-white/60 p-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Delta({ from, to, suffix = '' }: { from: number; to: number; suffix?: string }) {
  const d = Math.round((to - from) * 10) / 10;
  if (d === 0) return <span className="text-slate-500">±0{suffix}</span>;
  return <span className={d > 0 ? 'text-emerald-700' : 'text-rose-700'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{suffix}</span>;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fmtDate = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Proof meter: the readiness estimate split into assessed, evidence-backed and unverified points. */
export function ProofMeter({ requirements }: { requirements: RequirementResult[] }) {
  const pts = proofBreakdown(requirements);
  const proven = pts.provenShare;
  const seg = [
    { key: 'assessed', label: 'Assessed', value: pts.assessed, cls: 'bg-emerald-700' },
    { key: 'evidence', label: 'Evidence-backed', value: pts.evidence, cls: 'bg-ink' },
    { key: 'unverified', label: 'Unverified claims', value: pts.unverified, cls: 'bg-marigold' },
  ];
  return (
    <div>
      <div className="mb-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Proof meter</div>
        <div className="text-sm text-slate-700"><span className="font-display text-lg font-medium text-ink">{proven}%</span> of your readiness is backed by evidence</div>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper-deep" role="img" aria-label={`Readiness ${Math.round(pts.total * 10) / 10}%: ${seg.map((s) => `${s.label} ${Math.round(s.value * 10) / 10} points`).join(', ')}`}>
        {seg.map((s) => s.value > 0 && <div key={s.key} className={s.cls} style={{ width: `${s.value}%` }} title={`${s.label}: ${Math.round(s.value * 10) / 10} pts`} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
        {seg.map((s) => <li key={s.key} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.cls}`} />{s.label} {Math.round(s.value * 10) / 10} pts</li>)}
      </ul>
    </div>
  );
}
