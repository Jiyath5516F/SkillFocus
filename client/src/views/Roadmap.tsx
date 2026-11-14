import { useState } from 'react';
import { LEVEL_LABELS, RESOURCE_BY_ID, milestoneLabel, skillName } from '../../../shared/catalog';
import type { MilestoneStatus } from '../../../shared/types';
import { useApp } from '../App';
import { api } from '../api';
import { SelectMenu, Segmented } from '../components/hui';
import { Badge, Button, Card, Empty, fmtDate } from '../components/ui';

const STATUS: { value: MilestoneStatus; label: string }[] = [
  { value: 'todo', label: 'To do' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' },
];

export function Roadmap() {
  const { state, setState, track, busy, notify } = useApp();
  const forRole = state.revisions.filter((r) => r.roleId === state.profile.targetRoleId);
  const [viewId, setViewId] = useState<number | null>(null);
  const rev = forRole.find((r) => r.id === viewId) ?? state.roadmap;
  const isCurrent = rev?.id === state.roadmap?.id;
  const [saving, setSaving] = useState<string | null>(null);

  const regenerate = async () => {
    try { track((await api.analyze()).runId); } catch (e) { notify((e as Error).message); }
  };
  const setStatus = async (key: string, status: MilestoneStatus) => {
    setSaving(key);
    try { setState(await api.setMilestone(key, status)); } catch (e) { notify((e as Error).message); } finally { setSaving(null); }
  };

  if (!rev) {
    return <Empty title="No roadmap yet" action={<Button onClick={regenerate} disabled={busy}>{busy ? 'Agents working…' : 'Analyze my skills'}</Button>}>Run a skill analysis to generate your personalised roadmap.</Empty>;
  }
  const done = rev.milestones.filter((m) => state.progress[m.key]?.status === 'done').length;
  const hours = rev.milestones.filter((m) => state.progress[m.key]?.status !== 'done').reduce((h, m) => h + m.effortHours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Learning roadmap <span className="text-slate-500">v{rev.version}</span></h1>
          <p className="mt-1 text-sm text-slate-500">{rev.trigger} · {fmtDate(rev.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {forRole.length > 1 && (
            <SelectMenu label="Roadmap version" srOnlyLabel className="w-40" value={rev.id} onChange={(id: number) => setViewId(id)}
              options={forRole.map((r) => ({ value: r.id, label: `v${r.version}${r.id === state.roadmap?.id ? ' (current)' : ''}` }))} />
          )}
          <Button variant="secondary" onClick={regenerate} disabled={busy}>{busy ? 'Agents working…' : 'Re-analyze'}</Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div><span className="font-semibold text-slate-900">{done}/{rev.milestones.length}</span> <span className="text-slate-500">milestones done</span></div>
          <div><span className="font-semibold text-slate-900">~{hours}h</span> <span className="text-slate-500">remaining · ~{Math.ceil(hours / Math.max(1, state.profile.weeklyHours))} weeks at {state.profile.weeklyHours}h/week</span></div>
          <div className="h-2 min-w-40 flex-1 rounded-full bg-paper-deep"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${(done / Math.max(1, rev.milestones.length)) * 100}%` }} /></div>
        </div>
        <p className="mt-3 text-sm text-slate-600">{rev.changeSummary}</p>
        {rev.diff && (rev.diff.added.length > 0 || rev.diff.removed.length > 0 || rev.diff.moved.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3 text-xs">
            <span className="text-slate-500">Changes vs v{rev.version - 1}:</span>
            {rev.diff.added.length > 0 && <Badge tone="emerald">{rev.diff.added.length} added</Badge>}
            {rev.diff.removed.length > 0 && <Badge tone="rose">{rev.diff.removed.length} removed: {rev.diff.removed.map(milestoneLabel).join(', ')}</Badge>}
            {rev.diff.moved.length > 0 && <Badge tone="amber">{rev.diff.moved.length} reordered</Badge>}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Marking a milestone done records a <em>claim</em>; it counts as unverified until you pass an assessment.</p>
      </Card>

      {!isCurrent && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">You're viewing an earlier version (read-only).</div>}

      <ol className="space-y-3">
        {rev.milestones.map((m, i) => {
          const status = state.progress[m.key]?.status ?? 'todo';
          const isNew = rev.diff?.added.includes(m.key);
          return (
            <li key={m.key} className={`rounded-xl border bg-card p-5 ${m.kind === 'remediation' ? 'border-rose-200' : 'border-line'} ${status === 'done' ? 'border-emerald-200' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${status === 'done' ? 'bg-emerald-700 text-white' : 'bg-paper-deep text-slate-600'}`}>{status === 'done' ? '✓' : i + 1}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-semibold text-slate-900">{m.title}</h3>
                      {m.kind === 'remediation' ? <Badge tone="rose">Targeted remediation</Badge> : <Badge tone="brand">{skillName(m.skillId)} → {LEVEL_LABELS[m.targetLevel]}</Badge>}
                      {isNew && <Badge tone="emerald">New in v{rev.version}</Badge>}
                      <Badge tone={m.authoredBy === 'ai' ? 'violet' : 'amber'}>{m.authoredBy === 'ai' ? 'AI-personalised' : 'Rule-based'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{m.reason}</p>
                  </div>
                </div>
                {isCurrent && (
                  <Segmented label={`Status for ${m.title}`} value={status} options={STATUS} disabled={saving === m.key} onChange={(v) => setStatus(m.key, v)} />
                )}
              </div>
              <div className="mt-4 grid gap-4 pl-10 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Resources</div>
                  <ul className="space-y-1.5">
                    {m.resourceIds.map((id) => RESOURCE_BY_ID[id]).filter(Boolean).map((r) => (
                      <li key={r.id} className="text-sm">
                        <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-brand-800 hover:underline">{r.title} ↗</a>
                        <span className="text-slate-500"> · {r.provider} · {r.kind} · ~{r.hours}h</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Practical exercise</div>
                  <p className="text-sm text-slate-700">{m.exercise}</p>
                  <p className="mt-2 text-xs text-slate-500">Effort ~{m.effortHours}h{m.prerequisites.length ? ` · after: ${m.prerequisites.map(skillName).join(', ')}` : ''}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
