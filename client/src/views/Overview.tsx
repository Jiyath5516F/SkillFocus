import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentCheckIcon,
  MapIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { useState } from 'react';
import { LEVEL_LABELS, RESOURCE_BY_ID, ROLE_BY_ID, milestoneLabel, skillName } from '../../../shared/catalog';
import { useApp } from '../App';
import { allRoles } from '../roles';
import { FORECAST_TARGET, useForecast } from '../forecast';
import { api } from '../api';
import {
  Badge,
  Button,
  Card,
  ConfidenceBadge,
  Delta,
  Empty,
  LevelBar,
  ProofMeter,
  ReadinessRing,
  fmtDate,
} from '../components/ui';

export function Overview() {
  const { state, meta, track, busy, go, notify } = useApp();
  const forecast = useForecast(state, state.profile.weeklyHours);
  const [starting, setStarting] = useState(false);
  const role = allRoles(meta, state.profile).find((r) => r.id === state.profile.targetRoleId) ?? meta.roles[0];
  const topGaps = [...state.twin.requirements]
    .filter((r) => r.status !== 'met')
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
  const roadmap = state.roadmap;
  const next = roadmap?.milestones.find((m) => state.progress[m.key]?.status !== 'done');
  const done = roadmap ? roadmap.milestones.filter((m) => state.progress[m.key]?.status === 'done').length : 0;

  const analyze = async () => {
    setStarting(true);
    try {
      track((await api.analyze()).runId);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Hi {state.profile.name.split(' ')[0]} — here's where you stand
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Target: {role.title}. Every number below is computed from evidence you can inspect in Career Twin.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1" title="Career readiness" subtitle="Weighted coverage of role requirements">
          <div className="flex items-center gap-5">
            <ReadinessRing value={state.twin.readiness} />
            <div className="space-y-2 text-sm">
              {roadmap?.previous && (
                <div>
                  Last change: <Delta from={roadmap.previous.readiness} to={state.twin.readiness} suffix=" pts" />
                </div>
              )}
              <div className="text-white/60">
                {state.twin.requirements.filter((r) => r.status === 'met').length} of {state.twin.requirements.length}{' '}
                requirements met
              </div>
              <p className="text-xs text-white/60">Estimate of skill coverage — not a hiring probability.</p>
              {forecast?.toTarget != null && (
                <p className="text-xs text-indigo-300">
                  Projection: ~{Math.ceil(forecast.toTarget)} weeks to {FORECAST_TARGET}% at {state.profile.weeklyHours}{' '}
                  h/week
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <ProofMeter requirements={state.twin.requirements} />
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          title="Biggest skill gaps"
          subtitle="Ranked by readiness points you'd gain by mastering each skill"
          action={
            <Button variant="ghost" onClick={() => go('twin')}>
              Open Career Twin →
            </Button>
          }
        >
          {topGaps.length === 0 ? (
            <p className="text-sm text-white/60">No gaps — every requirement is covered.</p>
          ) : (
            <ul className="space-y-4">
              {topGaps.map((g) => (
                <li key={g.skillId}>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{skillName(g.skillId)}</span>
                      <Badge tone={g.priority === 'high' ? 'rose' : g.priority === 'medium' ? 'amber' : 'slate'}>
                        {g.priority} priority
                      </Badge>
                      <ConfidenceBadge c={g.confidence} />
                    </div>
                    <span className="text-white/60">
                      +{g.impact} pts · needs {LEVEL_LABELS[g.required]}
                    </span>
                  </div>
                  <LevelBar effective={g.effective} required={g.required} self={g.selfLevel} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Recommended next step">
          {!roadmap ? (
            <Empty
              title="No roadmap yet"
              action={
                <Button onClick={analyze} disabled={busy || starting}>
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
              Mira's agent team will analyze your profile, match it to {role.title} and build a personalised roadmap.
            </Empty>
          ) : next ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {next.kind === 'remediation' ? (
                  <Badge tone="rose">Remediation</Badge>
                ) : (
                  <Badge tone="brand">Learn</Badge>
                )}
                <span className="font-medium text-white">{next.title}</span>
              </div>
              <p className="mt-2 text-sm text-white/70">{next.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {next.resourceIds
                  .map((id) => RESOURCE_BY_ID[id])
                  .filter(Boolean)
                  .map((r) => (
                    <a
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-indigo-300 hover:bg-white/10"
                    >
                      {r.title} · {r.provider} <ArrowTopRightOnSquareIcon aria-hidden className="inline size-3.5" />
                    </a>
                  ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => go('roadmap')}>
                  <MapIcon aria-hidden className="size-4" /> Open roadmap
                </Button>
                <Button variant="secondary" onClick={() => go('assessments')}>
                  <ClipboardDocumentCheckIcon aria-hidden className="size-4" /> Take an assessment
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/70">All milestones are complete. Verify your skills with an assessment.</p>
          )}
        </Card>

        <Card title="Progress">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white/5 p-3">
              <dt className="text-xs text-white/60">Milestones done</dt>
              <dd className="text-lg font-semibold">
                {done}/{roadmap?.milestones.length ?? 0}
              </dd>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <dt className="text-xs text-white/60">Assessments</dt>
              <dd className="text-lg font-semibold">{state.attempts.length}</dd>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <dt className="text-xs text-white/60">Roadmap version</dt>
              <dd className="text-lg font-semibold">{roadmap ? `v${roadmap.version}` : '—'}</dd>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <dt className="text-xs text-white/60">Plans (all goals)</dt>
              <dd className="text-lg font-semibold">{state.revisions.length}</dd>
            </div>
          </dl>
          {state.attempts[0] && (
            <p className="mt-3 text-xs text-white/60">
              Last assessment: {skillName(state.attempts[0].skillId)} — {state.attempts[0].score}% (
              {fmtDate(state.attempts[0].createdAt)})
            </p>
          )}
        </Card>
      </div>

      <Card>
        <TabGroup>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TabList className="flex flex-wrap gap-2" aria-label="Activity and insights">
              <Tab className="rounded-full px-3 py-1 text-sm/6 font-semibold text-white/70 focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
                Progress timeline
              </Tab>
              <Tab className="rounded-full px-3 py-1 text-sm/6 font-semibold text-white/70 focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
                What the agents concluded
              </Tab>
            </TabList>
            <Button variant="ghost" onClick={() => go('mentor')}>
              Ask Mira why →
            </Button>
          </div>
          <TabPanels>
            <TabPanel>
              <p className="mb-3 text-sm text-white/60">Everything that changed your plan, newest first.</p>
              {(() => {
                type Ev = { at: string; tone: 'emerald' | 'rose' | 'brand' | 'slate'; label: string; detail: string };
                const events: Ev[] = [
                  ...state.attempts.map((a) => ({
                    at: a.createdAt,
                    tone: (a.weakConcepts.length ? 'rose' : 'emerald') as Ev['tone'],
                    label: 'Assessment',
                    detail: `${skillName(a.skillId)}: ${a.score}% → verified ${LEVEL_LABELS[a.verifiedLevel]}`,
                  })),
                  ...state.revisions.map((r) => ({
                    at: r.createdAt,
                    tone: 'brand' as const,
                    label: `Roadmap v${r.version}`,
                    detail: `${ROLE_BY_ID[r.roleId]?.title}: ${r.trigger}${r.previous ? ` (readiness ${r.previous.readiness}% → ${r.snapshot.readiness}%)` : ''}`,
                  })),
                  ...Object.values(state.progress)
                    .filter((p) => p.status === 'done')
                    .map((p) => ({
                      at: p.updatedAt,
                      tone: 'slate' as const,
                      label: 'Milestone done',
                      detail: `${milestoneLabel(p.key)} (claim, not yet verified)`,
                    })),
                ]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .slice(0, 8);
                if (!events.length)
                  return <p className="text-sm text-white/60">No activity yet — run your first skill analysis.</p>;
                return (
                  <ol className="relative space-y-3 border-l border-white/10 pl-5">
                    {events.map((e, i) => (
                      <li key={i} className="relative">
                        <span
                          className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-950 bg-white"
                          aria-hidden
                        />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge tone={e.tone}>{e.label}</Badge>
                          <span className="text-white/80">{e.detail}</span>
                        </div>
                        <div className="text-xs text-white/60">{fmtDate(e.at)}</div>
                      </li>
                    ))}
                  </ol>
                );
              })()}
            </TabPanel>
            <TabPanel>
              {state.matching ? (
                <>
                  <p className="text-sm text-white/80">{state.matching.headline}</p>
                  {state.insights?.summary && <p className="mt-2 text-sm text-white/60">{state.insights.summary}</p>}
                  {roadmap && (
                    <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/60">
                      Roadmap v{roadmap.version} · {roadmap.trigger}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-white/60">Run a skill analysis to see the agents' conclusions.</p>
              )}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Card>
    </div>
  );
}
