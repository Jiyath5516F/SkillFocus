import { ArrowPathIcon, CheckIcon, SparklesIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { LEVEL_LABELS, skillName } from '../../../shared/catalog';
import type { RoleDef } from '../../../shared/types';
import { api, type DesignedRole } from '../api';
import { MiraAvatar } from './MiraAvatar';
import { Badge, Button, Spinner } from './ui';

/** Type any career aim; Mira designs 3 role profiles from catalog skills; shuffle for alternatives; pick one. */
export function AimDesigner({ onSelect }: { onSelect: (role: RoleDef) => void | Promise<void> }) {
  const [aim, setAim] = useState('');
  const [options, setOptions] = useState<DesignedRole[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [busy, setBusy] = useState<'ask' | 'use' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (shuffle: boolean) => {
    if (aim.trim().length < 3) return;
    setBusy('ask'); setError(null);
    try {
      const avoid = shuffle ? seen : [];
      const r = await api.suggestRoles(aim.trim(), avoid);
      setOptions(r.options);
      setSeen([...(shuffle ? seen : []), ...r.options.map((o) => o.title)].slice(-12));
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const use = async (o: DesignedRole) => {
    setBusy('use'); setError(null);
    try { await onSelect((await api.createRole(o)).role); setOptions([]); setAim(''); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl bg-indigo-500/5 p-4 ring-1 ring-indigo-400/20">
      <div className="flex items-center gap-2 text-sm font-semibold text-white"><MiraAvatar size="sm" /> Design your own aim with Mira</div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(false); }}>
        <label className="sr-only" htmlFor="aim-input">Your career aim</label>
        <input id="aim-input" value={aim} onChange={(e) => setAim(e.target.value)} maxLength={160} placeholder="e.g. Cloud engineer at a startup, BI analyst in healthcare…"
          className="min-w-0 flex-1 rounded-lg border-none bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-2 focus:-outline-offset-2 focus:outline-white/25" />
        <Button type="submit" disabled={busy !== null || aim.trim().length < 3}>{busy === 'ask' ? <Spinner /> : <SparklesIcon aria-hidden className="size-4" />} Ask Mira</Button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
      {options.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-white/60">Built only from skills Mira can assess and teach. Illustrative benchmarks, not hiring standards.</p>
            <Button variant="ghost" onClick={() => ask(true)} disabled={busy !== null}><ArrowPathIcon aria-hidden className={`size-4 ${busy === 'ask' ? 'animate-spin' : ''}`} /> Shuffle</Button>
          </div>
          <ul className="mt-2 grid gap-3 md:grid-cols-3">
            {options.map((o) => (
              <li key={o.title} className="flex flex-col rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-sm font-semibold text-white">{o.title}</div>
                <p className="mt-1 text-xs text-white/60">{o.summary}</p>
                <ul className="mt-3 flex flex-wrap gap-1">
                  {o.requirements.map((q) => <li key={q.skillId}><Badge tone={q.weight === 3 ? 'brand' : 'slate'}>{skillName(q.skillId)} · {LEVEL_LABELS[q.level]}</Badge></li>)}
                </ul>
                <Button className="mt-4 self-start" variant="secondary" onClick={() => use(o)} disabled={busy !== null}><CheckIcon aria-hidden className="size-4" /> Use this aim</Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
