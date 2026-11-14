import { ChevronRightIcon } from '@heroicons/react/20/solid';
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@headlessui/react';
import { BeakerIcon, ClockIcon, FingerPrintIcon, Squares2X2Icon } from '@heroicons/react/20/solid';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LEVEL_LABELS, ROLE_BY_ID, milestoneLabel, skillName } from '../../../shared/catalog';
import { computeTwin, estimateSkill } from '../../../shared/engine';
import { useApp } from '../App';
import { allRoles } from '../roles';
import { api } from '../api';
import { ForecastCard } from '../components/Forecast';
import { CheckChip } from '../components/hui';
import {
  Badge,
  Button,
  Card,
  ConfidenceBadge,
  Delta,
  LevelBar,
  ProofMeter,
  ReadinessRing,
  fmtDate,
  CHART_TOOLTIP,
} from '../components/ui';

export function Twin() {
  const { state, meta, track, busy, notify } = useApp();
  const [whatIf, setWhatIf] = useState<string[]>([]);
  const twin = state.twin;
  const role = ROLE_BY_ID[twin.roleId];
  const rev = state.roadmap;

  const radar = twin.requirements.map((r) => ({
    skill: skillName(r.skillId).replace(' & ', ' & '),
    Required: r.required,
    Effective: r.effective,
    'Self-reported': r.selfLevel,
  }));
  const history = state.revisions
    .filter((r) => r.roleId === twin.roleId)
    .slice()
    .reverse()
    .map((r) => ({ v: `v${r.version}`, readiness: r.snapshot.readiness }));

  const sim = useMemo(() => {
    if (!whatIf.length) return null;
    const overrides = Object.fromEntries(
      whatIf.map((id) => [id, twin.requirements.find((r) => r.skillId === id)!.required]),
    );
    return computeTwin(state.profile, state.evidence, twin.roleId, overrides);
  }, [whatIf, state, twin]);

  const comparisons = allRoles(meta, state.profile).map((r) => ({
    role: r,
    twin: computeTwin(state.profile, state.evidence, r.id),
  }));

  const switchGoal = async (roleId: string) => {
    try {
      track((await api.changeGoal(roleId)).runId);
    } catch (e) {
      notify((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Career Twin</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/60">
          A live, evidence-based model of your readiness for{' '}
          <span className="font-medium text-white/80">{role.title}</span>. Self-reported skills are discounted until a
          project, certification or assessment backs them; assessments override everything they supersede.
        </p>
      </div>

      <TabGroup>
        <TabList className="flex flex-wrap gap-2" aria-label="Career Twin sections">
          <Tab className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm/6 font-semibold text-white/70 focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
            <Squares2X2Icon aria-hidden className="size-4" /> Overview
          </Tab>
          <Tab className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm/6 font-semibold text-white/70 focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
            <FingerPrintIcon aria-hidden className="size-4" /> Evidence ledger
          </Tab>
          <Tab className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm/6 font-semibold text-white/70 focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
            <BeakerIcon aria-hidden className="size-4" /> Forecast & scenarios
          </Tab>
          <Tab className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm/6 font-semibold text-white/70 focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white">
            <ClockIcon aria-hidden className="size-4" /> History & insights
          </Tab>
        </TabList>
        <TabPanels className="mt-5">
          <TabPanel className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Readiness estimate" subtitle="Not a hiring probability">
                <div className="flex flex-col items-center gap-3">
                  <ReadinessRing value={twin.readiness} size={148} />
                  <div className="w-full">
                    <ProofMeter requirements={twin.requirements} />
                  </div>
                  <div className="w-full rounded-lg bg-white/5 p-3 font-mono text-[11px] leading-relaxed text-white/70">
                    readiness = Σ weight × min(effective / required, 1) ÷ Σ weight
                    <br />
                    effective = assessed level, or claim × 0.75 (× 0.9 with evidence)
                    <br />
                    weights: critical 3 · important 2 · nice-to-have 1
                  </div>
                </div>
              </Card>
              <Card
                className="lg:col-span-2"
                title="Skill shape"
                subtitle="Required vs. effective (evidence-weighted) vs. self-reported level"
              >
                <div
                  className="h-80"
                  role="img"
                  aria-label="Radar chart of required, effective and self-reported levels per skill. The same values are listed in the evidence ledger below."
                >
                  <ResponsiveContainer>
                    <RadarChart data={radar} outerRadius="70%">
                      <PolarGrid stroke="#ffffff1a" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#ffffffb3' }} />
                      <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={false} axisLine={false} />
                      <Radar
                        name="Required"
                        dataKey="Required"
                        stroke="#a3a3a3"
                        fill="#a3a3a3"
                        fillOpacity={0.06}
                        strokeDasharray="4 3"
                      />
                      <Radar
                        name="Self-reported"
                        dataKey="Self-reported"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.12}
                      />
                      <Radar
                        name="Effective"
                        dataKey="Effective"
                        stroke="#818cf8"
                        fill="#818cf8"
                        fillOpacity={0.45}
                        strokeWidth={2}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Tooltip {...CHART_TOOLTIP} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {rev?.previous && rev.diff && (
              <Card title={`What changed in roadmap v${rev.version}`} subtitle={rev.trigger}>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-white/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-white/60">Readiness</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {rev.previous.readiness}% → {rev.snapshot.readiness}%
                    </div>
                    <Delta from={rev.previous.readiness} to={rev.snapshot.readiness} suffix=" pts" />
                  </div>
                  <div className="rounded-lg border border-white/10 p-4 md:col-span-2">
                    <div className="mb-2 text-xs uppercase tracking-wide text-white/60">
                      Skill estimates (before → after)
                    </div>
                    <ul className="grid gap-1 text-sm sm:grid-cols-2">
                      {Object.entries(rev.snapshot.levels).map(([id, after]) => {
                        const before = rev.previous!.levels[id];
                        if (before === undefined || before === after) return null;
                        return (
                          <li key={id} className="flex justify-between gap-2">
                            <span>{skillName(id)}</span>
                            <span className="tabular-nums">
                              {before} → {after} <Delta from={before} to={after} />
                            </span>
                          </li>
                        );
                      })}
                      {Object.entries(rev.snapshot.levels).every(([id, a]) => rev.previous!.levels[id] === a) && (
                        <li className="text-white/60">No skill estimates changed.</li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {rev.diff.added.map((k) => (
                    <Badge key={k} tone="emerald">
                      + {rev.milestones.find((m) => m.key === k)?.title ?? k}
                    </Badge>
                  ))}
                  {rev.diff.removed.map((k) => (
                    <Badge key={k} tone="rose">
                      − {milestoneLabel(k)}
                    </Badge>
                  ))}
                  {rev.diff.moved.length > 0 && <Badge tone="amber">{rev.diff.moved.length} reordered</Badge>}
                </div>
                <p className="mt-3 text-sm text-white/70">{rev.changeSummary}</p>
              </Card>
            )}
          </TabPanel>
          <TabPanel className="space-y-6">
            <Card title="Evidence ledger" subtitle="Click a skill to see exactly where its estimate comes from">
              <div className="divide-y divide-white/10">
                {twin.requirements.map((r) => {
                  const est = estimateSkill(r.skillId, state.profile, state.evidence);
                  const note = state.matching?.notes.find((n) => n.skillId === r.skillId)?.note;
                  return (
                    <Disclosure key={r.skillId} as="div" className="py-3">
                      <DisclosureButton className="group grid w-full grid-cols-12 items-center gap-3 rounded-md text-left">
                        <div className="col-span-12 sm:col-span-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-white">{skillName(r.skillId)}</span>
                            {r.weight === 3 && <Badge tone="slate">critical</Badge>}
                            <ChevronRightIcon
                              aria-hidden
                              className="size-4 text-white/50 transition-transform group-data-open:rotate-90"
                            />
                          </div>
                          <div className="mt-1 flex gap-1.5">
                            <ConfidenceBadge c={r.confidence} />
                            {r.status === 'met' && <Badge tone="emerald">met</Badge>}
                          </div>
                        </div>
                        <div className="col-span-8 sm:col-span-5">
                          <LevelBar effective={r.effective} required={r.required} self={r.selfLevel} />
                        </div>
                        <div className="col-span-4 text-right text-xs text-white/60 sm:col-span-3">
                          <span className="tabular-nums font-semibold text-white">{r.effective}</span> / {r.required} ·{' '}
                          {r.status === 'met' ? 'covered' : `+${r.impact} pts`}
                        </div>
                      </DisclosureButton>
                      <DisclosurePanel
                        as="ul"
                        className="mt-2 space-y-1 rounded-lg bg-white/5 p-3 text-xs text-white/70"
                      >
                        <li>
                          Required: {LEVEL_LABELS[r.required]} ({r.required}) · weight {r.weight}
                        </li>
                        {est.sources.length ? (
                          est.sources.map((src, i) => <li key={i}>• {src}</li>)
                        ) : (
                          <li>• No evidence yet</li>
                        )}
                        {note && <li className="text-white">Career Matching Agent: {note}</li>}
                      </DisclosurePanel>
                    </Disclosure>
                  );
                })}
              </div>
            </Card>
          </TabPanel>
          <TabPanel className="space-y-6">
            <ForecastCard state={state} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card
                title="What-if simulator"
                subtitle="Preview the effect of mastering a skill. Simulation only — never saved."
              >
                <div className="flex flex-wrap gap-2">
                  {twin.requirements
                    .filter((r) => r.status !== 'met')
                    .map((r) => (
                      <CheckChip
                        key={r.skillId}
                        label={skillName(r.skillId)}
                        checked={whatIf.includes(r.skillId)}
                        onChange={(c) => setWhatIf(c ? [...whatIf, r.skillId] : whatIf.filter((x) => x !== r.skillId))}
                      />
                    ))}
                </div>
                {sim ? (
                  <div className="mt-4 rounded-lg border border-dashed border-indigo-400/40 bg-indigo-400/10/40 p-4">
                    <div className="flex items-center gap-2">
                      <Badge tone="violet">Simulation</Badge>
                      <span className="text-sm text-white/70">
                        If you mastered {whatIf.map(skillName).join(' + ')}:
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums">
                      {twin.readiness}% → {sim.readiness}%{' '}
                      <span className="text-base">
                        <Delta from={twin.readiness} to={sim.readiness} suffix=" pts" />
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/70">
                      Next priorities would be:{' '}
                      {sim.orderedGaps.slice(0, 3).map(skillName).join(' → ') || 'none — fully covered'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/60">Select one or more gap skills.</p>
                )}
              </Card>

              <Card
                title="Career matching"
                subtitle={
                  state.matching?.alternatives
                    ? 'Ranked by the Career Matching Agent — same evidence, every role'
                    : 'Same evidence, different role requirements'
                }
              >
                <ol className="space-y-3">
                  {(
                    state.matching?.alternatives ??
                    comparisons.map(({ role: r, twin: t }) => ({
                      roleId: r.id,
                      title: r.title,
                      readiness: t.readiness,
                      provenShare: 0,
                      topGaps: t.orderedGaps.slice(0, 3),
                    }))
                  )
                    .filter((a) => ROLE_BY_ID[a.roleId])
                    .map((a, i) => (
                      <li key={a.roleId} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{a.title}</span>
                              {a.roleId === twin.roleId && <Badge tone="brand">current</Badge>}
                            </div>
                            <div className="truncate text-xs text-white/60">
                              Top gaps: {a.topGaps.map(skillName).join(', ') || 'none'}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="tabular-nums text-sm font-semibold">{a.readiness}%</span>
                          {a.roleId !== twin.roleId && (
                            <Button variant="secondary" disabled={busy} onClick={() => switchGoal(a.roleId)}>
                              Switch goal
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
                <p className="mt-3 text-xs text-white/60">
                  Switching keeps your evidence, assessments and earlier plans.
                </p>
              </Card>
            </div>
          </TabPanel>
          <TabPanel className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Readiness over roadmap versions" subtitle={role.title}>
                {history.length < 1 ? (
                  <p className="text-sm text-white/60">Run an analysis to start your history.</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer>
                      <LineChart data={history} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke="#ffffff14" />
                        <XAxis dataKey="v" tick={{ fontSize: 11, fill: '#ffffffb3' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#ffffffb3' }} />
                        <Tooltip {...CHART_TOOLTIP} formatter={(v) => [`${v}%`, 'Readiness']} />
                        <Line type="monotone" dataKey="readiness" stroke="#818cf8" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
              <Card title="Skill Intelligence Agent" subtitle={state.insights ? 'Latest analysis' : 'Not run yet'}>
                {state.insights ? (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-300">Strengths</div>
                      <ul className="space-y-1 text-white/70">
                        {state.insights.strengths.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-rose-300">Weaknesses</div>
                      <ul className="space-y-1 text-white/70">
                        {state.insights.weaknesses.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    {state.insights.uncertainties.length > 0 && (
                      <div className="sm:col-span-2">
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-300">Uncertain</div>
                        <ul className="space-y-1 text-white/70">
                          {state.insights.uncertainties.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-white/60">Run a skill analysis from Overview.</p>
                )}
                {state.evidence.length > 0 && (
                  <p className="mt-3 text-xs text-white/60">
                    {state.evidence.length} evidence records · last{' '}
                    {fmtDate(state.evidence[state.evidence.length - 1].createdAt)}
                  </p>
                )}
              </Card>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
