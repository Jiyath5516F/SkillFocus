import { Radio, RadioGroup } from '@headlessui/react';
import { CheckCircleIcon, PlusIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { LEVEL_LABELS, SKILLS, registerRoles, registerSkills, skillName } from '../../../shared/catalog';
import type { Profile } from '../../../shared/types';
import { api, type Meta } from '../api';
import { AimDesigner } from '../components/AimDesigner';
import { MiraAvatar } from '../components/MiraAvatar';
import { SelectMenu, SkillCombobox, TextAreaField, TextField } from '../components/hui';
import { Button, Spinner } from '../components/ui';

const STEPS = ['Your goal', 'Your skills', 'About you'] as const;
const LEVELS = LEVEL_LABELS.slice(1).map((label, i) => ({ value: i + 1, label }));
const HOURS = [2, 4, 6, 8, 10, 12, 15, 20].map((h) => ({ value: h, label: `${h} hours / week` }));

/** First-run setup: collects goal, skills and background. Every step can be skipped and finished later in Profile. */
export function Onboarding({ meta, profile, onDone }: { meta: Meta; profile: Profile; onDone: (runId: number | null) => void }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({ ...profile });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });

  const finish = async (analyze: boolean) => {
    setBusy(true); setError(null);
    try { onDone((await api.saveProfile({ ...p, onboarded: true }, analyze)).runId); } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const useSample = async () => {
    setBusy(true);
    try { await api.reset(); onDone(null); } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const available = [...SKILLS, ...(p.customSkills ?? [])].filter((s) => !p.skills.some((x) => x.skillId === s.id)).map((s) => ({ id: s.id, name: s.name }));
  const addTyped = async (name: string) => {
    try {
      const { skill } = await api.addSkill(name);
      registerSkills([skill]);
      setP((cur) => ({ ...cur, customSkills: skill.id.startsWith('cs-') ? [...(cur.customSkills ?? []).filter((x) => x.id !== skill.id), skill] : cur.customSkills, skills: cur.skills.some((x) => x.skillId === skill.id) ? cur.skills : [...cur.skills, { skillId: skill.id, selfLevel: 1 }] }));
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <MiraAvatar size="lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Welcome, {p.name.split(' ')[0]} — let's set up your Career Twin</h1>
            <p className="mt-1 text-sm text-white/60">Three quick steps. You can skip any of them and fill them in later from Profile.</p>
          </div>
        </div>

        <ol className="mb-5 flex gap-2" aria-label="Setup progress">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? 'step' : undefined}
              className={`flex flex-1 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${i === step ? 'bg-white/10 text-white ring-white/20' : i < step ? 'text-emerald-300 ring-emerald-400/30' : 'text-white/60 ring-white/10'}`}>
              {i < step ? <CheckCircleIcon aria-hidden className="size-4" /> : <span className="flex size-4 items-center justify-center rounded-full bg-white/10 text-[10px]">{i + 1}</span>}
              {label}
            </li>
          ))}
        </ol>

        <section className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-2xl">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">Which role are you aiming for?</h2>
                <p className="text-sm text-white/60">Mira compares your evidence with this role's requirements. You can switch any time without losing history.</p>
              </div>
              <RadioGroup value={p.targetRoleId} onChange={(v) => { registerRoles(p.customRoles); set('targetRoleId', v); }} aria-label="Target role" className="grid gap-3 sm:grid-cols-3">
                {[...meta.roles, ...(p.customRoles ?? [])].map((r) => (
                  <Radio key={r.id} value={r.id} className="group cursor-pointer rounded-xl bg-white/5 p-4 ring-1 ring-white/10 transition focus:outline-none data-checked:bg-indigo-500/15 data-checked:ring-2 data-checked:ring-indigo-400 data-focus:outline-2 data-focus:outline-white/40 data-hover:bg-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{r.title}</span>
                      <CheckCircleIcon aria-hidden className="size-5 text-indigo-300 opacity-0 group-data-checked:opacity-100" />
                    </div>
                    <p className="mt-1 text-xs text-white/60">{r.summary}</p>
                  </Radio>
                ))}
              </RadioGroup>
              <AimDesigner onSelect={(r, skills) => setP({ ...p, customSkills: skills, customRoles: [r, ...(p.customRoles ?? [])], targetRoleId: r.id })} />
              <SelectMenu label="How much time can you study each week?" value={p.weeklyHours} onChange={(v) => set('weeklyHours', v)} options={HOURS.some((h) => h.value === p.weeklyHours) ? HOURS : [...HOURS, { value: p.weeklyHours, label: `${p.weeklyHours} hours / week` }]} className="max-w-xs" />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">What can you already do?</h2>
                <p className="text-sm text-white/60">Rate yourself honestly — these count as <em>unverified claims</em> until a project, certificate or assessment backs them.</p>
              </div>
              {p.skills.length === 0 && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-white/60 ring-1 ring-white/10">No skills added yet.</p>}
              <ul className="space-y-2">
                {p.skills.map((s) => (
                  <li key={s.skillId} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                    <span className="text-sm text-white">{skillName(s.skillId)}</span>
                    <div className="flex items-center gap-2">
                      <SelectMenu label={`${skillName(s.skillId)} level`} srOnlyLabel className="w-36" value={s.selfLevel} options={LEVELS}
                        onChange={(v) => set('skills', p.skills.map((x) => (x.skillId === s.skillId ? { ...x, selfLevel: v } : x)))} />
                      <button aria-label={`Remove ${skillName(s.skillId)}`} onClick={() => set('skills', p.skills.filter((x) => x.skillId !== s.skillId))} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"><XMarkIcon className="size-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
              <SkillCombobox label="Add a skill" options={available} onPick={(id) => set('skills', [...p.skills, { skillId: id, selfLevel: 1 }])} onCreate={addTyped} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">A little about you</h2>
                <p className="text-sm text-white/60">Projects and certificates become evidence — the Skill Intelligence Agent links them to skills.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Background / education" value={p.background} onChange={(v) => set('background', v)} />
                <TextField label="Current role" value={p.currentRole} onChange={(v) => set('currentRole', v)} />
              </div>
              <TextField label="Career interests" value={p.interests} onChange={(v) => set('interests', v)} />
              <div>
                <div className="mb-2 text-sm font-medium text-white">Certifications</div>
                {p.certifications.map((c, i) => (
                  <div key={i} className="mb-2 grid grid-cols-12 items-end gap-2">
                    <div className="col-span-6"><TextField label="Name" value={c.name} onChange={(v) => set('certifications', p.certifications.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></div>
                    <div className="col-span-5"><TextField label="Issuer" value={c.issuer} onChange={(v) => set('certifications', p.certifications.map((x, j) => (j === i ? { ...x, issuer: v } : x)))} /></div>
                    <button aria-label="Remove certification" onClick={() => set('certifications', p.certifications.filter((_, j) => j !== i))} className="col-span-1 rounded p-1.5 text-white/60 hover:bg-white/10"><XMarkIcon className="mx-auto size-4" /></button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => set('certifications', [...p.certifications, { name: '', issuer: '' }])}><PlusIcon aria-hidden className="size-4" /> Add certification</Button>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium text-white">Projects & experience</div>
                {p.projects.map((pr, i) => (
                  <div key={i} className="mb-3 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1"><TextField label="Project name" value={pr.name} onChange={(v) => set('projects', p.projects.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></div>
                      <button aria-label="Remove project" onClick={() => set('projects', p.projects.filter((_, j) => j !== i))} className="rounded p-1.5 text-white/60 hover:bg-white/10"><XMarkIcon className="size-4" /></button>
                    </div>
                    <TextAreaField label="What did you build, and with which tools?" value={pr.description} onChange={(v) => set('projects', p.projects.map((x, j) => (j === i ? { ...x, description: v } : x)))} />
                  </div>
                ))}
                <Button variant="secondary" onClick={() => set('projects', [...p.projects, { name: '', description: '' }])}><PlusIcon aria-hidden className="size-4" /> Add project</Button>
              </div>
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-400/30">{error}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <button onClick={() => finish(false)} disabled={busy} className="text-sm font-semibold text-white/70 hover:text-white">Skip for now</button>
            <div className="flex items-center gap-2">
              {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={busy}>Back</Button>}
              {step < STEPS.length - 1
                ? <Button onClick={() => setStep(step + 1)} disabled={busy}>Next</Button>
                : <Button onClick={() => finish(true)} disabled={busy}>{busy ? <Spinner /> : null} Finish & analyze</Button>}
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-sm text-white/60">
          Just exploring? <button onClick={useSample} disabled={busy} className="font-semibold text-indigo-300 hover:text-indigo-200">Load the sample learner</button> (Python, SQL, basic HTML → Full Stack Developer).
        </p>
      </div>
    </main>
  );
}
