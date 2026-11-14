import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AgentRun, AppState } from '../../shared/types';
import { api, type Meta } from './api';
import { AgentDrawer } from './components/AgentDrawer';
import { Badge, Button, Spinner } from './components/ui';
import { Assessments } from './views/Assessments';
import { Cohort } from './views/Cohort';
import { Mentor } from './views/Mentor';
import { Overview } from './views/Overview';
import { ProfileView } from './views/Profile';
import { Roadmap } from './views/Roadmap';

// Career Twin pulls in the charting library, so it is loaded on demand to keep the first load small.
const Twin = lazy(() => import('./views/Twin').then((m) => ({ default: m.Twin })));

export type View = 'overview' | 'twin' | 'roadmap' | 'assessments' | 'mentor' | 'profile' | 'cohort';
const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'twin', label: 'Career Twin' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'mentor', label: 'Ask Mira' },
  { id: 'profile', label: 'Profile' },
  { id: 'cohort', label: 'Cohort insights' },
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

export default function App() {
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

  const busy = activeRun?.status === 'running';
  const role = meta.roles.find((r) => r.id === state.profile.targetRoleId)!;
  const ctx: Ctx = { state, meta, refresh, track, busy, activeRun, go, notify, setState };

  return (
    <AppCtx.Provider value={ctx}>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only z-50 rounded bg-neutral-900 px-3 py-2 text-sm text-white shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to content</a>
      <div className="min-h-screen lg:flex">
        <aside className="border-b border-white/10 bg-black/40 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:w-64 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-5 py-4 lg:block">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 text-base font-bold text-white" aria-hidden>M</div>
              <div>
                <div className="text-lg font-semibold leading-tight text-white">Mira</div>
                <div className="text-xs leading-tight text-white/60">Career learning, proven</div>
              </div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0" aria-label="Main">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => go(v.id)} aria-current={view === v.id ? 'page' : undefined}
                className={`shrink-0 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${view === v.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                {v.label}
              </button>
            ))}
          </nav>
          <div className="hidden px-5 pt-6 lg:block">
            <div className="rounded-lg bg-white/5 p-3 text-xs text-white/70 ring-1 ring-white/10">
              <div className="font-semibold text-white">{state.profile.name}</div>
              <div>{state.profile.background}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${state.aiConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {state.aiConfigured ? 'AI agents online' : 'AI offline — rule-based mode'}
              </div>
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
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                {busy ? <><span className="pulse-dot h-2 w-2 rounded-full bg-indigo-400" /> Agents working…</> : 'Agent activity'}
              </Button>
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
            {view === 'mentor' && <Mentor />}
            {view === 'profile' && <ProfileView />}
            {view === 'cohort' && <Cohort />}
          </main>
        </div>
      </div>

      <AgentDrawer open={drawer} onClose={() => setDrawer(false)} activeRun={activeRun} refreshKey={refreshKey} />

      {toast && (
        <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg ${toast.tone === 'error' ? 'bg-rose-500/90 text-white' : 'bg-neutral-800 text-white ring-1 ring-white/10'}`}>
          {toast.msg}
        </div>
      )}
    </AppCtx.Provider>
  );
}
