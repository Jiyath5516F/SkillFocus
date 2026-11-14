import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ListBulletIcon,
  MapIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid';
import { useState } from 'react';
import { LEVEL_LABELS, RESOURCE_BY_ID, ROLE_BY_ID, milestoneLabel, skillName } from '../../../shared/catalog';
import type { MilestoneStatus } from '../../../shared/types';
import { useApp } from '../App';
import { api } from '../api';
import { SelectMenu, Segmented } from '../components/hui';
import { RoadmapMap } from '../components/RoadmapMap';
import { Badge, Button, Card, Empty, fmtDate } from '../components/ui';

const STATUS: { value: MilestoneStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export function Roadmap() {
  const { state, setState, track, busy, notify } = useApp();
  const forRole = state.revisions.filter((r) => r.roleId === state.profile.targetRoleId);
  const [viewId, setViewId] = useState<number | null>(null);
  const rev = forRole.find((r) => r.id === viewId) ?? state.roadmap;
  const isCurrent = rev?.id === state.roadmap?.id;
  const [saving, setSaving] = useState<string | null>(null);

  const regenerate = async () => {
    try {
      track((await api.analyze()).runId);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const setStatus = async (key: string, status: MilestoneStatus) => {
    setSaving(key);
    try {
      setState(await api.setMilestone(key, status));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (!rev) {
    return (
      <Empty
        title="No roadmap yet"
        action={
          <Button onClick={regenerate} disabled={busy}>
            {busy ? (
              'Agents working…'
            ) : (
              <>
                <SparklesIcon aria-hidden className="size-4" /> Analyze my skills
              </>
            )}
          </Button>
        }
      >
        Run a skill analysis to generate your personalised roadmap.
      </Empty>
    );
  }
  const done = rev.milestones.filter((m) => state.progress[m.key]?.status === 'done').length;
  const hours = rev.milestones
    .filter((m) => state.progress[m.key]?.status !== 'done')
    .reduce((h, m) => h + m.effortHours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Learning roadmap <span className="text-white/60">v{rev.version}</span>
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {rev.trigger} · {fmtDate(rev.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {forRole.length > 1 && (
            <SelectMenu
              label="Roadmap version"
              srOnlyLabel
              className="w-40"
              value={rev.id}
              onChange={(id: number) => setViewId(id)}
              options={forRole.map((r) => ({
                value: r.id,
                label: `v${r.version}${r.id === state.roadmap?.id ? ' (current)' : ''}`,
              }))}
            />
          )}
          <Button variant="secondary" onClick={regenerate} disabled={busy}>
            {busy ? (
              'Agents working…'
            ) : (
              <>
                <ArrowPathIcon aria-hidden className="size-4" /> Re-analyze
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="font-semibold text-white">
              {done}/{rev.milestones.length}
            </span>{' '}
            <span className="text-white/60">milestones done</span>
          </div>
          <div>
            <span className="font-semibold text-white">~{hours}h</span>{' '}
            <span className="text-white/60">
              remaining · ~{Math.ceil(hours / Math.max(1, state.profile.weeklyHours))} weeks at{' '}
              {state.profile.weeklyHours}h/week
            </span>
          </div>
          <div className="h-2 min-w-40 flex-1 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-indigo-400"
              style={{ width: `${(done / Math.max(1, rev.milestones.length)) * 100}%` }}
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-white/70">{rev.changeSummary}</p>
        {rev.diff && (rev.diff.added.length > 0 || rev.diff.removed.length > 0 || rev.diff.moved.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-xs">
            <span className="text-white/60">Changes vs v{rev.version - 1}:</span>
            {rev.diff.added.length > 0 && <Badge tone="emerald">{rev.diff.added.length} added</Badge>}
            {rev.diff.removed.length > 0 && (
              <Badge tone="rose">
                {rev.diff.removed.length} removed: {rev.diff.removed.map(milestoneLabel).join(', ')}
              </Badge>
            )}
            {rev.diff.moved.length > 0 && <Badge tone="amber">{rev.diff.moved.length} reordered</Badge>}
          </div>
        )}
        <p className="mt-3 text-xs text-white/60">
          Marking a milestone done records a <em>claim</em>; it counts as unverified until you pass an assessment.
        </p>
      </Card>

      {!isCurrent && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-300">
          You're viewing an earlier version (read-only).
        </div>
      )}

      <TabGroup>
        <TabList className="mb-4 flex gap-2" aria-label="Roadmap view">
          <Tab className="flex items-center gap-1.5 px-3 py-1 text-sm/6 font-semibold text-white/70 rounded-full focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
            <MapIcon aria-hidden className="size-4" /> Map
          </Tab>
          <Tab className="flex items-center gap-1.5 px-3 py-1 text-sm/6 font-semibold text-white/70 rounded-full focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
            <ListBulletIcon aria-hidden className="size-4" /> Details
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <RoadmapMap
              milestones={rev.milestones}
              progress={state.progress}
              roleTitle={ROLE_BY_ID[rev.roleId]?.title ?? ''}
              editable={isCurrent}
              onStatus={setStatus}
            />
          </TabPanel>
          <TabPanel>
            <ol className="space-y-3">
              {rev.milestones.map((m, i) => {
                const status = state.progress[m.key]?.status ?? 'todo';
                const isNew = rev.diff?.added.includes(m.key);
                return (
                  <li
                    key={m.key}
                    className={`rounded-xl border bg-white/5 p-5 ${m.kind === 'remediation' ? 'border-rose-400/30' : 'border-white/10'} ${status === 'done' ? 'border-emerald-400/30' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${status === 'done' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'}`}
                        >
                          {status === 'done' ? '✓' : i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-semibold text-white">{m.title}</h3>
                            {m.kind === 'remediation' ? (
                              <Badge tone="rose">Targeted remediation</Badge>
                            ) : (
                              <Badge tone="brand">
                                {skillName(m.skillId)} → {LEVEL_LABELS[m.targetLevel]}
                              </Badge>
                            )}
                            {isNew && <Badge tone="emerald">New in v{rev.version}</Badge>}
                            <Badge tone={m.authoredBy === 'ai' ? 'violet' : 'amber'}>
                              {m.authoredBy === 'ai' ? 'AI-personalised' : 'Rule-based'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-white/70">{m.reason}</p>
                        </div>
                      </div>
                      {isCurrent && (
                        <Segmented
                          label={`Status for ${m.title}`}
                          value={status}
                          options={STATUS}
                          disabled={saving === m.key}
                          onChange={(v) => setStatus(m.key, v)}
                        />
                      )}
                    </div>
                    <div className="mt-4 grid gap-4 pl-10 md:grid-cols-2">
                      <div>
                        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/60">
                          Resources
                        </div>
                        <ul className="space-y-1.5">
                          {m.resourceIds
                            .map((id) => RESOURCE_BY_ID[id])
                            .filter(Boolean)
                            .map((r) => (
                              <li key={r.id} className="text-sm">
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-indigo-300 hover:underline"
                                >
                                  {r.title} <ArrowTopRightOnSquareIcon aria-hidden className="inline size-3.5" />
                                </a>
                                <span className="text-white/60">
                                  {' '}
                                  · {r.provider} · {r.kind} · ~{r.hours}h
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/60">
                          Practical exercise
                        </div>
                        <p className="text-sm text-white/80">{m.exercise}</p>
                        <p className="mt-2 text-xs text-white/60">
                          Effort ~{m.effortHours}h
                          {m.prerequisites.length ? ` · after: ${m.prerequisites.map(skillName).join(', ')}` : ''}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
