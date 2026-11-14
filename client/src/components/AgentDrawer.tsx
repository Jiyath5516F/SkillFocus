import { XMarkIcon } from '@heroicons/react/20/solid';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useEffect, useState } from 'react';
import type { AgentRun, AgentStep } from '../../../shared/types';
import { api } from '../api';
import { Badge, Spinner, fmtTime } from './ui';

const AGENT_COLORS: Record<string, string> = {
  'Skill Intelligence': 'bg-sky-600',
  'Career Matching': 'bg-violet-600',
  'Learning Path Architect': 'bg-amber-600',
  'Assessment & Progress': 'bg-rose-600',
  'Mira (Mentor)': 'bg-indigo-500',
};

const TRIGGER_LABEL: Record<string, string> = {
  analyze: 'Skill analysis',
  profile_updated: 'Profile updated',
  assessment: 'Assessment submitted',
  goal_change: 'Career goal changed',
  mentor_question: 'Question to Mira',
};

function KindBadge({ s }: { s: AgentStep }) {
  if (s.kind === 'llm') return <Badge tone="violet">LLM · {s.model}</Badge>;
  if (s.kind === 'fallback') return <Badge tone="amber">Rule-based fallback</Badge>;
  return <Badge tone="slate">Deterministic</Badge>;
}

function StatusIcon({ s }: { s: AgentStep['status'] }) {
  if (s === 'running') return <Spinner className="text-indigo-300" />;
  if (s === 'completed')
    return (
      <span className="text-emerald-300" aria-label="completed">
        ✓
      </span>
    );
  if (s === 'failed')
    return (
      <span className="text-rose-300" aria-label="failed">
        ✕
      </span>
    );
  return <span className="text-white/60">–</span>;
}

/** Two model calls that started within half a second of each other were launched concurrently by the orchestrator. */
const isParallel = (a: AgentStep, b: AgentStep) =>
  a.kind === 'llm' &&
  b.kind === 'llm' &&
  Math.abs(new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) < 500;

export function RunView({ run }: { run: AgentRun }) {
  const llmSteps = run.steps.filter((s) => s.kind === 'llm' && s.status === 'completed');
  const tokens = llmSteps.reduce((t, s) => t + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {run.steps.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1.5">
            {i > 0 &&
              (isParallel(run.steps[i - 1], s) ? (
                <span className="font-semibold text-indigo-300" title="Ran in parallel">
                  ‖
                </span>
              ) : (
                <span className="text-white/60" aria-hidden>
                  →
                </span>
              ))}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${s.kind === 'llm' ? (AGENT_COLORS[s.agent] ?? 'bg-white/15') : 'bg-white/10 text-white/80 ring-1 ring-inset ring-white/15'} ${s.status === 'failed' ? 'opacity-50 line-through' : ''}`}
            >
              {s.status === 'running' && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-white" />}
              {s.agent.replace(' (Mentor)', '')}
            </span>
          </span>
        ))}
      </div>
      <div className="mb-3 text-xs text-white/60">
        {llmSteps.length} model calls · {run.steps.filter((s) => s.kind === 'deterministic').length} deterministic steps
        {tokens ? ` · ${tokens.toLocaleString()} tokens` : ''} · ‖ = ran in parallel
      </div>
      <ol className="space-y-2">
        {run.steps.map((s) => (
          <li key={s.id} className="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${AGENT_COLORS[s.agent] ?? 'bg-white/40'}`} />
                <span className="truncate text-sm font-medium text-white">{s.agent}</span>
                <StatusIcon s={s.status} />
              </div>
              <KindBadge s={s} />
            </div>
            <div className="mt-1 text-[11px] text-white/60">
              {fmtTime(s.startedAt)}
              {s.durationMs !== null ? ` · ${(s.durationMs / 1000).toFixed(1)}s` : ''}
              {s.tokensIn ? ` · ${s.tokensIn}→${s.tokensOut} tokens` : ''}
            </div>
            <p className="mt-1.5 text-xs text-white/60">
              <span className="font-medium text-white/70">In:</span> {s.inputSummary}
            </p>
            {s.outputSummary && (
              <p className="mt-1 text-xs text-white/80">
                <span className="font-medium text-white/70">Out:</span> {s.outputSummary}
              </p>
            )}
            {s.error && <p className="mt-1 rounded bg-rose-400/10 px-2 py-1 text-xs text-rose-300">Error: {s.error}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AgentDrawer({
  open,
  onClose,
  activeRun,
  refreshKey,
}: {
  open: boolean;
  onClose: () => void;
  activeRun: AgentRun | null;
  refreshKey: number;
}) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    api
      .runs()
      .then(setRuns)
      .catch(() => setRuns([]));
  }, [open, refreshKey, activeRun?.status]);
  useEffect(() => {
    if (activeRun) setSelected(activeRun.id);
  }, [activeRun?.id]);

  const shown =
    activeRun && selected === activeRun.id
      ? activeRun
      : (runs.find((r) => r.id === selected) ?? activeRun ?? runs[0] ?? null);

  return (
    // Headless UI Dialog: focus trap, Escape to close, aria-modal and scroll locking — styled with Mira's own tokens.
    <Dialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/60 transition-opacity duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-y-0 right-0 flex w-full max-w-md">
        <DialogPanel
          transition
          className="flex w-full flex-col border-l border-white/10 bg-neutral-950 shadow-2xl transition-transform duration-200 ease-out data-closed:translate-x-full"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <DialogTitle className="text-base font-semibold text-white">Agent activity</DialogTitle>
              <p className="text-xs text-white/60">Real executions, recorded by the orchestrator</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-white/60 hover:bg-white/10"
              aria-label="Close agent activity"
            >
              <XMarkIcon aria-hidden className="size-5" />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 px-5 py-2">
            {(activeRun && !runs.some((r) => r.id === activeRun.id) ? [activeRun, ...runs] : runs)
              .slice(0, 10)
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${shown?.id === r.id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
                >
                  #{r.id} {TRIGGER_LABEL[r.trigger] ?? r.trigger}
                </button>
              ))}
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {shown ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-white">
                    Run #{shown.id} · {TRIGGER_LABEL[shown.trigger] ?? shown.trigger}
                  </div>
                  <Badge
                    tone={
                      shown.status === 'running'
                        ? 'brand'
                        : shown.status === 'completed'
                          ? 'emerald'
                          : shown.status === 'failed'
                            ? 'rose'
                            : 'amber'
                    }
                  >
                    {shown.status === 'running' && <Spinner className="h-2.5 w-2.5" />}{' '}
                    {shown.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <RunView run={shown} />
              </>
            ) : (
              <p className="text-sm text-white/60">
                No agent runs yet. Run a skill analysis to see the agents collaborate.
              </p>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
