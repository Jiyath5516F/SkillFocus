import { useEffect, useState } from 'react';
import type { AgentRun, AgentStep } from '../../../shared/types';
import { api } from '../api';
import { Badge, Spinner, fmtTime } from './ui';

const AGENT_COLORS: Record<string, string> = {
  'Skill Intelligence': 'bg-sky-600',
  'Career Matching': 'bg-violet-600',
  'Learning Path Architect': 'bg-amber-600',
  'Assessment & Progress': 'bg-rose-600',
  'Mira (Mentor)': 'bg-brand-700',
};

const TRIGGER_LABEL: Record<string, string> = {
  analyze: 'Skill analysis', profile_updated: 'Profile updated', assessment: 'Assessment submitted', goal_change: 'Career goal changed', mentor_question: 'Question to Mira',
};

function KindBadge({ s }: { s: AgentStep }) {
  if (s.kind === 'llm') return <Badge tone="violet">LLM · {s.model}</Badge>;
  if (s.kind === 'fallback') return <Badge tone="amber">Rule-based fallback</Badge>;
  return <Badge tone="slate">Deterministic</Badge>;
}

function StatusIcon({ s }: { s: AgentStep['status'] }) {
  if (s === 'running') return <Spinner className="text-brand-700" />;
  if (s === 'completed') return <span className="text-emerald-600" aria-label="completed">✓</span>;
  if (s === 'failed') return <span className="text-rose-600" aria-label="failed">✕</span>;
  return <span className="text-slate-400">–</span>;
}

export function RunView({ run }: { run: AgentRun }) {
  const llmSteps = run.steps.filter((s) => s.kind === 'llm' && s.status === 'completed');
  const tokens = llmSteps.reduce((t, s) => t + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {run.steps.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-300">→</span>}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${s.kind === 'llm' ? AGENT_COLORS[s.agent] ?? 'bg-slate-600' : 'bg-slate-400'} ${s.status === 'failed' ? 'opacity-50 line-through' : ''}`}>
              {s.status === 'running' && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-white" />}
              {s.agent.replace(' (Mentor)', '')}
            </span>
          </span>
        ))}
      </div>
      <div className="mb-3 text-xs text-slate-500">
        {llmSteps.length} model calls · {run.steps.filter((s) => s.kind === 'deterministic').length} deterministic steps{tokens ? ` · ${tokens.toLocaleString()} tokens` : ''}
      </div>
      <ol className="space-y-2">
        {run.steps.map((s) => (
          <li key={s.id} className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${AGENT_COLORS[s.agent] ?? 'bg-slate-400'}`} />
                <span className="truncate text-sm font-medium text-slate-900">{s.agent}</span>
                <StatusIcon s={s.status} />
              </div>
              <KindBadge s={s} />
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {fmtTime(s.startedAt)}{s.durationMs !== null ? ` · ${(s.durationMs / 1000).toFixed(1)}s` : ''}{s.tokensIn ? ` · ${s.tokensIn}→${s.tokensOut} tokens` : ''}
            </div>
            <p className="mt-1.5 text-xs text-slate-500"><span className="font-medium text-slate-600">In:</span> {s.inputSummary}</p>
            {s.outputSummary && <p className="mt-1 text-xs text-slate-700"><span className="font-medium text-slate-600">Out:</span> {s.outputSummary}</p>}
            {s.error && <p className="mt-1 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">Error: {s.error}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AgentDrawer({ open, onClose, activeRun, refreshKey }: { open: boolean; onClose: () => void; activeRun: AgentRun | null; refreshKey: number }) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    api.runs().then(setRuns).catch(() => setRuns([]));
  }, [open, refreshKey, activeRun?.status]);
  useEffect(() => { if (activeRun) setSelected(activeRun.id); }, [activeRun?.id]);

  const shown = activeRun && selected === activeRun.id ? activeRun : runs.find((r) => r.id === selected) ?? activeRun ?? runs[0] ?? null;

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-slate-900/20 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onClose} />
      <aside className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-stone-200 bg-stone-50 shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`} aria-label="Agent activity" aria-hidden={!open}>
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Agent activity</h2>
            <p className="text-xs text-slate-500">Real executions, recorded by the orchestrator</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-stone-100" aria-label="Close agent activity">✕</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-b border-stone-200 bg-white px-5 py-2">
          {(activeRun && !runs.some((r) => r.id === activeRun.id) ? [activeRun, ...runs] : runs).slice(0, 10).map((r) => (
            <button key={r.id} onClick={() => setSelected(r.id)} className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${shown?.id === r.id ? 'bg-brand-700 text-white' : 'bg-stone-100 text-slate-600 hover:bg-stone-200'}`}>
              #{r.id} {TRIGGER_LABEL[r.trigger] ?? r.trigger}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {shown ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-slate-800">Run #{shown.id} · {TRIGGER_LABEL[shown.trigger] ?? shown.trigger}</div>
                <Badge tone={shown.status === 'running' ? 'brand' : shown.status === 'completed' ? 'emerald' : shown.status === 'failed' ? 'rose' : 'amber'}>
                  {shown.status === 'running' && <Spinner className="h-2.5 w-2.5" />} {shown.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <RunView run={shown} />
            </>
          ) : (
            <p className="text-sm text-slate-500">No agent runs yet. Run a skill analysis to see the agents collaborate.</p>
          )}
        </div>
      </aside>
    </>
  );
}
