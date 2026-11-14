import { useEffect, useState } from 'react';
import { LEVEL_LABELS, SKILLS, skillName } from '../../../shared/catalog';
import type { Profile } from '../../../shared/types';
import { useApp } from '../App';
import { api } from '../api';
import { Badge, Button, Card } from '../components/ui';

const input = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none';

export function ProfileView() {
  const { state, meta, track, busy, notify, setState } = useApp();
  const [p, setP] = useState<Profile>(state.profile);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setP(state.profile), [state.profile]);

  const dirty = JSON.stringify(p) !== JSON.stringify(state.profile);
  const save = async () => {
    setSaving(true);
    try { track((await api.saveProfile(p)).runId); notify('Profile saved — agents are re-analyzing.', 'info'); } catch (e) { notify((e as Error).message); } finally { setSaving(false); }
  };
  const changeGoal = async (roleId: string) => {
    try { track((await api.changeGoal(roleId)).runId); } catch (e) { notify((e as Error).message); }
  };
  const reset = async () => {
    if (!window.confirm('Reset to the demo learner? This clears all progress, assessments and plans.')) return;
    try { setState(await api.reset()); notify('Demo learner restored.', 'info'); } catch (e) { notify((e as Error).message); }
  };

  const available = SKILLS.filter((s) => !p.skills.some((x) => x.skillId === s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Profile</h1>
          <p className="mt-1 text-sm text-slate-500">Saving re-runs the agent team. Self-reported levels are treated as claims until evidence or an assessment backs them.</p>
        </div>
        <Button onClick={save} disabled={!dirty || saving || busy}>{busy ? 'Agents working…' : dirty ? 'Save & re-analyze' : 'Saved'}</Button>
      </div>

      <Card title="Career goal" subtitle="Switching keeps all certifications, projects, assessments and previous plans">
        <div className="grid gap-3 md:grid-cols-3">
          {meta.roles.map((r) => (
            <div key={r.id} className={`rounded-lg border p-4 ${r.id === state.profile.targetRoleId ? 'border-brand-600 bg-brand-50/50' : 'border-stone-200'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium text-slate-900">{r.title}</span>{r.id === state.profile.targetRoleId && <Badge tone="brand">current</Badge>}</div>
              <p className="mt-1 text-xs text-slate-500">{r.summary}</p>
              <p className="mt-2 text-xs text-slate-500">Needs: {r.requirements.map((q) => skillName(q.skillId)).join(', ')}</p>
              {r.id !== state.profile.targetRoleId && <Button variant="secondary" className="mt-3" disabled={busy || dirty} title={dirty ? 'Save profile changes first' : undefined} onClick={() => changeGoal(r.id)}>Make this my goal</Button>}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="About you">
          <div className="grid gap-3">
            <label className="text-sm"><span className="mb-1 block text-slate-600">Name</span><input className={input} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Background / education</span><input className={input} value={p.background} onChange={(e) => setP({ ...p, background: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Current role</span><input className={input} value={p.currentRole} onChange={(e) => setP({ ...p, currentRole: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Career interests</span><input className={input} value={p.interests} onChange={(e) => setP({ ...p, interests: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Weekly learning hours</span><input type="number" min={1} max={60} className={input} value={p.weeklyHours} onChange={(e) => setP({ ...p, weeklyHours: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} /></label>
          </div>
        </Card>

        <Card title="Skills (self-reported)">
          <ul className="space-y-2">
            {p.skills.map((s) => (
              <li key={s.skillId} className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-800">{skillName(s.skillId)}</span>
                <div className="flex items-center gap-2">
                  <select aria-label={`${skillName(s.skillId)} level`} className="rounded-lg border border-stone-300 px-2 py-1 text-sm" value={s.selfLevel} onChange={(e) => setP({ ...p, skills: p.skills.map((x) => (x.skillId === s.skillId ? { ...x, selfLevel: Number(e.target.value) } : x)) })}>
                    {LEVEL_LABELS.slice(1).map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
                  </select>
                  <button aria-label={`Remove ${skillName(s.skillId)}`} className="rounded px-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setP({ ...p, skills: p.skills.filter((x) => x.skillId !== s.skillId) })}>✕</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <select aria-label="Add skill" className="flex-1 rounded-lg border border-stone-300 px-2 py-2 text-sm" value={newSkill} onChange={(e) => setNewSkill(e.target.value)}>
              <option value="">Add a skill…</option>
              {available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button variant="secondary" disabled={!newSkill} onClick={() => { setP({ ...p, skills: [...p.skills, { skillId: newSkill, selfLevel: 1 }] }); setNewSkill(''); }}>Add</Button>
          </div>
        </Card>

        <Card title="Certifications">
          <ul className="space-y-2">
            {p.certifications.map((c, i) => (
              <li key={i} className="grid grid-cols-12 gap-2">
                <input aria-label="Certification name" className={`${input} col-span-6`} value={c.name} onChange={(e) => setP({ ...p, certifications: p.certifications.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input aria-label="Issuer" className={`${input} col-span-4`} value={c.issuer} onChange={(e) => setP({ ...p, certifications: p.certifications.map((x, j) => (j === i ? { ...x, issuer: e.target.value } : x)) })} />
                <button aria-label="Remove certification" className="col-span-2 rounded text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setP({ ...p, certifications: p.certifications.filter((_, j) => j !== i) })}>✕</button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-3" onClick={() => setP({ ...p, certifications: [...p.certifications, { name: 'New certification', issuer: '' }] })}>Add certification</Button>
        </Card>

        <Card title="Projects & experience">
          <ul className="space-y-3">
            {p.projects.map((pr, i) => (
              <li key={i} className="space-y-1.5">
                <div className="flex gap-2">
                  <input aria-label="Project name" className={input} value={pr.name} onChange={(e) => setP({ ...p, projects: p.projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <button aria-label="Remove project" className="rounded px-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setP({ ...p, projects: p.projects.filter((_, j) => j !== i) })}>✕</button>
                </div>
                <textarea aria-label="Project description" rows={2} className={input} value={pr.description} onChange={(e) => setP({ ...p, projects: p.projects.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-3" onClick={() => setP({ ...p, projects: [...p.projects, { name: 'New project', description: '' }] })}>Add project</Button>
        </Card>
      </div>

      <Card title="Demo controls">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Restore the preloaded learner (Python, SQL, basic HTML → Full Stack Developer) for a clean demo.</p>
          <Button variant="danger" onClick={reset} disabled={busy}>Reset demo learner</Button>
        </div>
      </Card>
    </div>
  );
}
