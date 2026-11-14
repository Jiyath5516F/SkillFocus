import { CheckIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { useEffect, useState } from 'react';
import { LEVEL_LABELS, SKILLS, skillName } from '../../../shared/catalog';
import type { Profile } from '../../../shared/types';
import { useApp } from '../App';
import { AimDesigner } from '../components/AimDesigner';
import { allRoles } from '../roles';
import { api } from '../api';
import { SelectMenu, TextAreaField, TextField } from '../components/hui';
import { Badge, Button, Card } from '../components/ui';

const LEVEL_OPTIONS = LEVEL_LABELS.slice(1).map((label, i) => ({ value: i + 1, label }));

export function ProfileView() {
  const { state, meta, track, busy, notify } = useApp();
  const [p, setP] = useState<Profile>(state.profile);
  const [saving, setSaving] = useState(false);
  useEffect(() => setP(state.profile), [state.profile]);

  const dirty = JSON.stringify(p) !== JSON.stringify(state.profile);
  const save = async () => {
    setSaving(true);
    try { const { runId } = await api.saveProfile(p); if (runId) track(runId); notify('Profile saved — agents are re-analyzing.', 'info'); } catch (e) { notify((e as Error).message); } finally { setSaving(false); }
  };
  const changeGoal = async (roleId: string) => {
    try { track((await api.changeGoal(roleId)).runId); } catch (e) { notify((e as Error).message); }
  };
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  const available = SKILLS.filter((s) => !p.skills.some((x) => x.skillId === s.id)).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-white/60">Saving re-runs the agent team. Self-reported levels are treated as claims until evidence or an assessment backs them.</p>
        </div>
        <Button onClick={save} disabled={!dirty || saving || busy}>{busy ? 'Agents working…' : dirty ? <><SparklesIcon aria-hidden className="size-4" /> Save & re-analyze</> : <><CheckIcon aria-hidden className="size-4" /> Saved</>}</Button>
      </div>

      <Card title="Career goal" subtitle="Switching keeps all certifications, projects, assessments and previous plans">
        <div className="grid gap-3 md:grid-cols-3">
          {allRoles(meta, state.profile).map((r) => {
            const current = r.id === state.profile.targetRoleId;
            return (
              <div key={r.id} className={`rounded-lg p-4 ring-1 ${current ? 'bg-indigo-400/10 ring-2 ring-indigo-400' : 'ring-white/10'}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white">{r.title}</span>{current && <Badge tone="brand">current</Badge>}</div>
                <p className="mt-1 text-xs text-white/60">{r.summary}</p>
                <p className="mt-2 text-xs text-white/60">Needs: {r.requirements.map((q) => skillName(q.skillId)).join(', ')}</p>
                {!current && <Button variant="secondary" className="mt-3" disabled={busy || dirty} title={dirty ? 'Save profile changes first' : undefined} onClick={() => changeGoal(r.id)}>Make this my goal</Button>}
              </div>
            );
          })}
        </div>
              <div className="mt-4"><AimDesigner onSelect={async (r) => { if (busy || dirty) { notify('Save or wait for the agents first.'); return; } await changeGoal(r.id); }} /></div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="About you">
          <div className="grid gap-4">
            <TextField label="Name" value={p.name} onChange={(v) => set('name', v)} />
            <TextField label="Background / education" value={p.background} onChange={(v) => set('background', v)} />
            <TextField label="Current role" value={p.currentRole} onChange={(v) => set('currentRole', v)} />
            <TextField label="Career interests" value={p.interests} onChange={(v) => set('interests', v)} />
            <TextField label="Weekly learning hours" type="number" min={1} max={60} value={p.weeklyHours} hint="Used to size milestones and project your readiness timeline."
              onChange={(v) => set('weeklyHours', Math.max(1, Math.min(60, Number(v) || 1)))} />
          </div>
        </Card>

        <Card title="Skills (self-reported)">
          <ul className="space-y-2">
            {p.skills.map((s) => (
              <li key={s.skillId} className="flex items-center justify-between gap-3">
                <span className="text-sm text-white">{skillName(s.skillId)}</span>
                <div className="flex items-center gap-2">
                  <SelectMenu label={`${skillName(s.skillId)} level`} srOnlyLabel className="w-36" value={s.selfLevel} options={LEVEL_OPTIONS}
                    onChange={(v) => set('skills', p.skills.map((x) => (x.skillId === s.skillId ? { ...x, selfLevel: v } : x)))} />
                  <button aria-label={`Remove ${skillName(s.skillId)}`} className="rounded px-1.5 text-white/50 hover:bg-rose-400/10 hover:text-rose-300" onClick={() => set('skills', p.skills.filter((x) => x.skillId !== s.skillId))}><XMarkIcon aria-hidden className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          {available.length > 0 && (
            <SelectMenu label="Add a skill" className="mt-4" value={null} placeholder="Choose a skill to add…" options={available}
              onChange={(id) => set('skills', [...p.skills, { skillId: id, selfLevel: 1 }])} />
          )}
        </Card>

        <Card title="Certifications">
          <ul className="space-y-3">
            {p.certifications.map((c, i) => (
              <li key={i} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-6"><TextField label="Certification" value={c.name} onChange={(v) => set('certifications', p.certifications.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></div>
                <div className="col-span-5"><TextField label="Issuer" value={c.issuer} onChange={(v) => set('certifications', p.certifications.map((x, j) => (j === i ? { ...x, issuer: v } : x)))} /></div>
                <button aria-label={`Remove certification ${c.name}`} className="col-span-1 rounded py-1.5 text-white/50 hover:bg-rose-400/10 hover:text-rose-300" onClick={() => set('certifications', p.certifications.filter((_, j) => j !== i))}><XMarkIcon aria-hidden className="mx-auto size-4" /></button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-4" onClick={() => set('certifications', [...p.certifications, { name: 'New certification', issuer: '' }])}>Add certification</Button>
        </Card>

        <Card title="Projects & experience">
          <ul className="space-y-4">
            {p.projects.map((pr, i) => (
              <li key={i} className="space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1"><TextField label="Project name" value={pr.name} onChange={(v) => set('projects', p.projects.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></div>
                  <button aria-label={`Remove project ${pr.name}`} className="rounded px-2 py-1.5 text-white/50 hover:bg-rose-400/10 hover:text-rose-300" onClick={() => set('projects', p.projects.filter((_, j) => j !== i))}><XMarkIcon aria-hidden className="size-4" /></button>
                </div>
                <TextAreaField label={`Description of ${pr.name}`} srOnlyLabel value={pr.description} onChange={(v) => set('projects', p.projects.map((x, j) => (j === i ? { ...x, description: v } : x)))} />
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-4" onClick={() => set('projects', [...p.projects, { name: 'New project', description: '' }])}>Add project</Button>
        </Card>
      </div>


    </div>
  );
}
