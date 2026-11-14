import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { api, type SessionUser } from './api';
import { Spinner } from './components/ui';
import './styles.css';
import { AuthPage } from './views/Auth';

/** Auth gate: shows the sign-in page until the server confirms a session. */
function Root() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
    const onSignedOut = () => setUser(null);
    window.addEventListener('mira:signed-out', onSignedOut);
    return () => window.removeEventListener('mira:signed-out', onSignedOut);
  }, []);
  if (user === undefined) return <div className="flex min-h-screen items-center justify-center gap-2 text-white/60"><Spinner /> Loading…</div>;
  if (!user) return <AuthPage onAuthed={setUser} />;
  return <App key={user.id} user={user} onSignOut={async () => { await api.logout().catch(() => undefined); setUser(null); }} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
