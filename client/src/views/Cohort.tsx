import { useEffect, useState } from 'react';
import { ROLE_BY_ID, skillName } from '../../../shared/catalog';
import { useApp } from '../App';
import { api, type CohortReport } from '../api';
import { SelectMenu } from '../components/hui';
import { Badge, Card, Spinner } from '../components/ui';

/** Institution view: where a cohort's verified and unverified skill gaps are, ranked by readiness impact. */
export function Cohort() {
  const { meta, notify, state } = useApp();
  const [role, setRole] = useState<string>('all');
  const [report, setReport] = useState<CohortReport | null>(null);

  useEffect(() => {
    setReport(null);
    api.cohort(role).then(setReport).catch((e) => notify((e as Error).message));
  }, [role, notify, state.twin.readiness]);

  const maxImpact = Math.max(1, ...(report?.priorities.map((p) => p.impactPoints) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Cohort insights</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/60">
            For universities and employers: which skills a group actually lacks, how much of it is <em>proven</em>, and where training would move readiness most.
          </p>
        </div>
        <SelectMenu label="Target role" srOnlyLabel className="w-56" value={role} onChange={setRole}
          options={[{ value: 'all', label: 'All target roles' }, ...meta.roles.map((r) => ({ value: r.id, label: r.title }))]} />
      </div>

      <div className="rounded-lg border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm text-indigo-300">
        Illustrative sample cohort of 12 learners (not real people) plus your own live profile. All numbers use the same deterministic engine as Career Twin.
      </div>

      {!report ? <p className="flex items-center gap-2 text-sm text-white/60"><Spinner /> Computing cohort…</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Learners', String(report.summary.learners)],
              ['Avg. readiness (est.)', `${report.summary.avgReadiness}%`],
              ['Avg. share proven', `${report.summary.avgProvenShare}%`],
              ['Learners assessed', `${report.summary.assessedLearners}/${report.summary.learners}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">{k}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{v}</div>
              </div>
            ))}
          </div>

          <Card title="Training priorities" subtitle="Ranked by total readiness points the cohort would gain — a deterministic sum of each learner's skill impact">
            {report.priorities.length === 0 ? <p className="text-sm text-white/60">No gaps in this group.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-white/60">
                    <tr><th className="py-2 pr-4">Skill</th><th className="pr-4">Learners with gap</th><th className="pr-4">Verified by assessment</th><th className="pr-4">Unverified claims</th><th className="min-w-40 pr-4">Readiness impact</th><th>Suggested action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {report.priorities.slice(0, 10).map((p) => (
                      <tr key={p.skillId}>
                        <td className="py-2.5 pr-4 font-medium text-white">{skillName(p.skillId)}</td>
                        <td className="pr-4 tabular-nums">{p.learnersNeeding}/{report.summary.learners}</td>
                        <td className="pr-4 tabular-nums">{p.learnersAssessedBelow}</td>
                        <td className="pr-4 tabular-nums">{p.unverifiedClaims}</td>
                        <td className="pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-white/10"><div className="h-2 rounded-full bg-white" style={{ width: `${(p.impactPoints / maxImpact) * 100}%` }} /></div>
                            <span className="w-12 text-right tabular-nums text-white/70">{p.impactPoints}</span>
                          </div>
                        </td>
                        <td className="text-white/70">{p.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Learners" subtitle="Readiness for each learner's own target role">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-white/60">
                  <tr><th className="py-2 pr-4">Learner</th><th className="pr-4">Target role</th><th className="pr-4">Readiness (est.)</th><th className="pr-4">Proven</th><th>Next priority</th></tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {report.learners.map((l) => (
                    <tr key={l.name} className={l.sample ? '' : 'bg-indigo-400/10'}>
                      <td className="py-2.5 pr-4 font-medium text-white">{l.name} {!l.sample && <Badge tone="brand">live</Badge>}</td>
                      <td className="pr-4 text-white/70">{ROLE_BY_ID[l.roleId]?.title}</td>
                      <td className="pr-4 tabular-nums">{l.readiness}%</td>
                      <td className="pr-4 tabular-nums">{l.provenShare}%</td>
                      <td className="text-white/70">{l.topGap ? skillName(l.topGap) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
