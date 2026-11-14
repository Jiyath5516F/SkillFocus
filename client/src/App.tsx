import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AgentRun, AppState } from '../../shared/types';
import { api, type Meta } from './api';
import { AgentDrawer } from './components/AgentDrawer';
import { Badge, Button, Spinner } from './components/ui';
import { Assessments } from './views/Assessments';
import { Mentor } from './views/Mentor';
import { Overview } from './views/Overview';
import { ProfileView } from './views/Profile';
import { Roadmap } from './views/Roadmap';
import { Twin } from './views/Twin';

export type View = 'overview' | 'twin' | 'roadmap' | 'assessments' | 'mentor' | 'profile';
const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'twin', label: 'Career Twin' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'mentor', label: 'Ask Mira' },
  { id: 'profile', label: 'Profile' },
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
        <div className="max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center">
          <p className="font-semibold text-slate-900">Mira can't load</p>
          <p className="mt-1 text-sm text-slate-600">{loadError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }
  if (!state || !meta) {
    return <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500"><Spinner /> Loading Mira…</div>;
  }

  const busy = activeRun?.status === 'running';
  const role = meta.roles.find((r) => r.id === state.profile.targetRoleId)!;
  const ctx: Ctx = { state, meta, refresh, track, busy, activeRun, go, notify, setState };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-screen lg:flex">
        <aside className="border-b border-stone-200 bg-white lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-5 py-4 lg:block">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 font-bold text-white">M</div>
              <div>
                <div className="font-semibold leading-tight text-slate-900">Mira</div>
                <div className="text-[11px] leading-tight text-slate-500">Career learning, proven</div>
              </div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0" aria-label="Main">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => go(v.id)} aria-current={view === v.id ? 'page' : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${view === v.id ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-stone-100'}`}>
                {v.label}
              </button>
            ))}
          </nav>
          <div className="hidden px-5 pt-6 lg:block">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
              <div className="font-medium text-slate-800">{state.profile.name}</div>
              <div>{state.profile.background}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${state.aiConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {state.aiConfigured ? 'AI agents online' : 'AI offline — rule-based mode'}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 lg:pl-60">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur sm:px-8">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="text-slate-500">Goal</span>
              <span className="font-semibold text-slate-900">{role.title}</span>
              <Badge tone="brand">{state.twin.readiness}% ready (est.)</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                {busy ? <><span className="pulse-dot h-2 w-2 rounded-full bg-brand-600" /> Agents working…</> : 'Agent activity'}
              </Button>
            </div>
          </header>

          {!state.aiConfigured && (
            <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:mx-8">
              AI is not configured on the server — showing rule-based results only. Numbers are unaffected (they are always deterministic).
            </div>
          )}

          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
            {view === 'overview' && <Overview />}
            {view === 'twin' && <Twin />}
            {view === 'roadmap' && <Roadmap />}
            {view === 'assessments' && <Assessments />}
            {view === 'mentor' && <Mentor />}
            {view === 'profile' && <ProfileView />}
          </main>
        </div>
      </div>

      <AgentDrawer open={drawer} onClose={() => setDrawer(false)} activeRun={activeRun} refreshKey={refreshKey} />

      {toast && (
        <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg ${toast.tone === 'error' ? 'bg-rose-700 text-white' : 'bg-slate-900 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </AppCtx.Provider>
  );
}
