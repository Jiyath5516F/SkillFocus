import { Field, Input, Label, Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { useState, type FormEvent } from 'react';
import { api, type SessionUser } from '../api';
import { ChartBarIcon, CpuChipIcon, FingerPrintIcon, MapIcon } from '@heroicons/react/24/outline';
import { MiraAvatar } from '../components/MiraAvatar';

const FEATURES = [
  { icon: FingerPrintIcon, title: 'Career Twin', text: 'Evidence-weighted skills: self-reports, projects and assessments each count differently.' },
  { icon: CpuChipIcon, title: 'Five collaborating agents', text: 'Skill Intelligence, Career Matching, Path Architect, Assessment and Mira the mentor.' },
  { icon: MapIcon, title: 'Adaptive roadmap', text: 'A failed quiz inserts targeted remediation before the skills that depend on it.' },
  { icon: ChartBarIcon, title: 'Readiness forecast', text: 'See when you could reach your target at your weekly study time.' },
];
import { Spinner } from '../components/ui';

const inputCls = 'mt-1 block w-full rounded-lg border-none bg-white/5 px-3 py-2 text-sm/6 text-white placeholder:text-white/50 focus:outline-2 focus:-outline-offset-2 focus:outline-white/25';
const tabCls = 'rounded-full px-3 py-1 text-sm/6 font-semibold text-white/70 focus:outline-none data-hover:bg-white/5 data-selected:bg-white/10 data-selected:text-white data-focus:outline-1 data-focus:outline-white';

function TextInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field>
      <Label className="text-sm/6 font-medium text-white">{label}</Label>
      <Input {...props} className={inputCls} />
    </Field>
  );
}

/** Sign in / create account. Errors from the server are shown verbatim (they are deliberately generic). */
export function AuthPage({ onAuthed }: { onAuthed: (u: SessionUser) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (fn: () => Promise<{ user: SessionUser }>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onAuthed((await fn()).user); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const [login, setLogin] = useState({ email: '', password: '' });
  const [signup, setSignup] = useState({ name: '', email: '', password: '' });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <section aria-label="About Mira" className="hidden lg:block">
          <div className="flex items-center gap-3">
            <MiraAvatar size="lg" />
            <span className="text-2xl font-bold tracking-tight text-white">Mira</span>
          </div>
          <h1 className="mt-8 text-4xl font-bold tracking-tight text-balance text-white">Know what you <span className="bg-linear-to-r from-sky-300 via-violet-300 to-indigo-300 bg-clip-text text-transparent">really</span> know.<br />Learn what your goal actually needs.</h1>
          <p className="mt-4 max-w-md text-white/70">Mira treats every skill as a claim until there is evidence, then five AI agents turn that evidence into a roadmap that adapts when you pass — or fail — an assessment.</p>
          <ul className="mt-8 grid max-w-lg gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <Icon aria-hidden className="size-5 text-indigo-300" />
                <div className="mt-2 text-sm font-semibold text-white">{title}</div>
                <p className="mt-1 text-xs text-white/60">{text}</p>
              </li>
            ))}
          </ul>
        </section>
        <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <MiraAvatar size="lg" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Mira</h1>
          <p className="mt-1 text-sm text-white/60">Evidence-based career learning, guided by a team of AI agents.</p>
        </div>
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-2xl">
          <TabGroup onChange={() => setError(null)}>
            <TabList className="mb-5 flex gap-2" aria-label="Account">
              <Tab className={tabCls}>Sign in</Tab>
              <Tab className={tabCls}>Create account</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <form className="space-y-4" onSubmit={submit(() => api.login(login.email, login.password))}>
                  <TextInput label="Email" type="email" autoComplete="email" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
                  <TextInput label="Password" type="password" autoComplete="current-password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
                  <SubmitButton busy={busy}>Sign in</SubmitButton>
                </form>
              </TabPanel>
              <TabPanel>
                <form className="space-y-4" onSubmit={submit(() => api.signup(signup.name, signup.email, signup.password))}>
                  <TextInput label="Name" autoComplete="name" required maxLength={80} value={signup.name} onChange={(e) => setSignup({ ...signup, name: e.target.value })} />
                  <TextInput label="Email" type="email" autoComplete="email" required value={signup.email} onChange={(e) => setSignup({ ...signup, email: e.target.value })} />
                  <TextInput label="Password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} />
                  <p className="text-xs text-white/60">At least 8 characters, including a letter and a number. Your account starts with a sample learner profile you can edit.</p>
                  <SubmitButton busy={busy}>Create account</SubmitButton>
                </form>
              </TabPanel>
            </TabPanels>
          </TabGroup>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-400/30">{error}</p>}
        </div>
        <p className="mt-6 text-center text-xs text-white/60">Passwords are hashed with scrypt; sessions use HttpOnly, SameSite=Strict cookies.</p>
        </div>
      </div>
    </main>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-700 px-3 py-2 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 hover:bg-gray-600 disabled:opacity-60">
      {busy && <Spinner />}{children}
    </button>
  );
}
