import type { ReactNode } from 'react';
import { LEVEL_LABELS } from '../../../shared/catalog';
import type { Confidence } from '../../../shared/types';

export function Card({ children, className = '', title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
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
    primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-300',
    secondary: 'border border-stone-300 bg-white text-slate-700 hover:bg-stone-50 disabled:text-slate-400',
    ghost: 'text-slate-600 hover:bg-stone-100 disabled:text-slate-300',
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
    slate: 'bg-slate-100 text-slate-700', brand: 'bg-brand-50 text-brand-800 ring-1 ring-brand-100', amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
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
    <div className="relative h-2.5 w-full rounded-full bg-stone-100" aria-label={`Effective level ${effective} of required ${required}`}>
      {self !== undefined && self > effective && <div className="absolute inset-y-0 left-0 rounded-full bg-amber-200/70" style={{ width: pct(self) }} title={`Self-reported: ${self}`} />}
      <div className={`absolute inset-y-0 left-0 rounded-full ${met ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: pct(effective) }} />
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e7e5e4" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#0f766e" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-semibold tabular-nums text-slate-900">{value}%</div>
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
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Delta({ from, to, suffix = '' }: { from: number; to: number; suffix?: string }) {
  const d = Math.round((to - from) * 10) / 10;
  if (d === 0) return <span className="text-slate-400">±0{suffix}</span>;
  return <span className={d > 0 ? 'text-emerald-600' : 'text-rose-600'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{suffix}</span>;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fmtDate = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
