import { ArrowRightStartOnRectangleIcon, ChatBubbleLeftRightIcon, ClipboardDocumentCheckIcon, CpuChipIcon, FingerPrintIcon, HomeIcon, MapIcon, UserCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import type { AgentRun, AppState } from '../../shared/types';
import { api, type Meta, type SessionUser } from './api';
import { AgentDrawer } from './components/AgentDrawer';
import { FloatingMira } from './components/FloatingMira';
import { MiraAvatar } from './components/MiraAvatar';
import { Badge, Button, Spinner } from './components/ui';
import { Assessments } from './views/Assessments';
import { Onboarding } from './views/Onboarding';
import { Cohort } from './views/Cohort';
import { Overview } from './views/Overview';
import { ProfileView } from './views/Profile';
import { Roadmap } from './views/Roadmap';

// Career Twin pulls in the charting library, so it is loaded on demand to keep the first load small.
const Twin = lazy(() => import('./views/Twin').then((m) => ({ default: m.Twin })));
const Mentor = lazy(() => import('./views/Mentor').then((m) => ({ default: m.Mentor })));

export type View = 'overview' | 'twin' | 'roadmap' | 'assessments' | 'mentor' | 'profile' | 'cohort';
const VIEWS: { id: View; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'overview', label: 'Overview', icon: HomeIcon },
  { id: 'twin', label: 'Career Twin', icon: FingerPrintIcon },
  { id: 'roadmap', label: 'Roadmap', icon: MapIcon },
  { id: 'assessments', label: 'Assessments', icon: ClipboardDocumentCheckIcon },
  { id: 'mentor', label: 'Ask Mira', icon: ChatBubbleLeftRightIcon },
  { id: 'profile', label: 'Profile', icon: UserCircleIcon },
  { id: 'cohort', label: 'Cohort insights', icon: UserGroupIcon },
];

interface Ctx {
  state: AppState;
  meta: Meta;
  refresh: () => Promise<void>;
  track: (runId: number) => void;
  busy: boolean;
  activeRun: AgentRun | null;
  go: (v: View) => void;
  notify: (msg: string, tone?: 'error' | 'info') => void;
  setState: (s: AppState) => void;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

const viewFromHash = (): View => {
  const h = window.location.hash.replace('#', '') as View;
  return VIEWS.some((v) => v.id === h) ? h : 'overview';
};

export default function App({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [state, setState] = useState<AppState | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>(viewFromHash());
  const [drawer, setDrawer] = useState(false);
  const [activeRun, setActiveRun] = useState<AgentRun | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'error' | 'info' } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const polling = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const s = await api.state();
    setState(s);
    setRefreshKey((k) => k + 1);
  }, []);

  const notify = useCallback((msg: string, tone: 'error' | 'info' = 'error') => {
    setToast({ msg, tone });
    window.setTimeout(() => setToast(null), 6000);
  }, []);

  const track = useCallback((runId: number) => {
    setDrawer(true);
    if (polling.current) window.clearInterval(polling.current);
    const tick = async () => {
      try {
        const run = await api.run(runId);
        setActiveRun(run);
        if (run.status !== 'running') {
          if (polling.current) window.clearInterval(polling.current);
          polling.current = null;
          await refresh();
          if (run.status === 'failed') notify('The agent run failed. Details are in Agent activity.');
          else if (run.status === 'completed_with_fallback') notify('Some AI steps failed — rule-based results were used where needed.', 'info');
        }
      } catch { /* keep polling */ }
    };
    void tick();
    polling.current = window.setInterval(tick, 1000);
  }, [refresh, notify]);

  useEffect(() => {
    Promise.all([api.state(), api.meta()])
      .then(([s, m]) => {
        setState(s);
        setMeta(m);
        if (s.activeRunId) track(s.activeRunId);
      })
      .catch((e) => setLoadError(e.message));
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [track]);

  const go = (v: View) => { window.location.hash = v; setView(v); window.scrollTo({ top: 0 }); };

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-white/5 p-6 text-center ring-1 ring-rose-400/30">
          <p className="font-semibold text-white">Mira can't load</p>
          <p className="mt-1 text-sm text-white/70">{loadError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }
  if (!state || !meta) {
    return <div className="flex min-h-screen items-center justify-center gap-2 text-white/60"><Spinner /> Loading Mira…</div>;
  }

  if (state.profile.onboarded === false) {
    return <Onboarding meta={meta} profile={state.profile} onDone={async (runId) => { await refresh(); if (runId) track(runId); }} />;
  }

  const busy = activeRun?.status === 'running';
  const role = meta.roles.find((r) => r.id === state.profile.targetRoleId)!;
  const ctx: Ctx = { state, meta, refresh, track, busy, activeRun, go, notify, setState };

  return (
    <AppCtx.Provider value={ctx}>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only z-50 rounded bg-neutral-900 px-3 py-2 text-sm text-white shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to content</a>
      <div className="min-h-screen lg:flex">
        <aside className="border-b border-white/10 bg-black/40 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-5 py-4 lg:block">
            <div className="flex items-center gap-2.5">
              <MiraAvatar size="md" />
              <div>
                <div className="text-lg font-semibold leading-tight text-white">Mira</div>
                <div className="text-xs leading-tight text-white/60">Career learning, proven</div>
              </div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0" aria-label="Main">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => go(v.id)} aria-current={view === v.id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${view === v.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                <v.icon aria-hidden className="size-5 shrink-0" />
                {v.label}
              </button>
            ))}
          </nav>
          <div className="hidden px-3 pb-4 lg:mt-auto lg:block">
            <div className="rounded-lg bg-white/5 p-3 text-xs text-white/70 ring-1 ring-white/10">
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">{user.name.trim().charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{user.name}</div>
                  <div className="truncate text-white/60">{user.email}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${state.aiConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {state.aiConfigured ? 'AI agents online' : 'AI offline — rule-based mode'}
              </div>
              <button onClick={onSignOut} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white">
                <ArrowRightStartOnRectangleIcon aria-hidden className="size-4" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 lg:pl-64">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur-xl sm:px-8">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="text-white/60">Goal</span>
              <span className="font-semibold text-white">{role.title}</span>
              <Badge tone="brand">{state.twin.readiness}% ready (est.)</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="lg:hidden" onClick={onSignOut} title="Sign out"><ArrowRightStartOnRectangleIcon aria-hidden className="size-4" /><span className="sr-only">Sign out</span></Button>
              <button onClick={() => setDrawer(true)} aria-live="polite"
                className={`relative inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white transition ${busy
                  ? 'bg-indigo-500/20 shadow-[0_0_24px_-2px_rgba(129,140,248,0.75)] ring-1 ring-indigo-400/70'
                  : 'bg-white/5 ring-1 ring-inset ring-white/10 hover:bg-white/10'}`}>
                {busy && <span aria-hidden className="absolute -top-1 -right-1 flex size-3"><span className="absolute inline-flex size-full animate-ping rounded-full bg-indigo-400 opacity-75" /><span className="relative inline-flex size-3 rounded-full bg-indigo-400" /></span>}
                <CpuChipIcon aria-hidden className={`size-4 ${busy ? 'animate-spin [animation-duration:3s] text-indigo-300' : ''}`} />
                {busy ? 'Agents working…' : 'Agent activity'}
              </button>
            </div>
          </header>

          {!state.aiConfigured && (
            <div className="mx-4 mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-300 sm:mx-8">
              AI is not configured on the server — showing rule-based results only. Numbers are unaffected (they are always deterministic).
            </div>
          )}

          <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 focus:outline-none sm:px-8">
            {view === 'overview' && <Overview />}
            {view === 'twin' && <Suspense fallback={<div className="flex items-center gap-2 text-white/60"><Spinner /> Loading Career Twin…</div>}><Twin /></Suspense>}
            {view === 'roadmap' && <Roadmap />}
            {view === 'assessments' && <Assessments />}
            {view === 'mentor' && <Suspense fallback={<div className="flex items-center gap-2 text-white/60"><Spinner /> Loading Mira…</div>}><Mentor /></Suspense>}
            {view === 'profile' && <ProfileView />}
            {view === 'cohort' && <Cohort />}
          </main>
        </div>
      </div>

      {/* Hidden on the full chat page, and during assessments so answers stay the learner's own. */}
      {view !== 'mentor' && view !== 'assessments' && <FloatingMira onOpenFull={() => go('mentor')} />}

      <AgentDrawer open={drawer} onClose={() => setDrawer(false)} activeRun={activeRun} refreshKey={refreshKey} />

      {toast && (
        <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg ${toast.tone === 'error' ? 'bg-rose-500/90 text-white' : 'bg-neutral-800 text-white ring-1 ring-white/10'}`}>
          {toast.msg}
        </div>
      )}
    </AppCtx.Provider>
  );
}
