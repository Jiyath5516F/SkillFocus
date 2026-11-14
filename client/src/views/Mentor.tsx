import { useEffect, useRef, useState } from 'react';
import type { MentorMessage } from '../../../shared/types';
import { useApp } from '../App';
import { api } from '../api';
import { Badge, Button, Spinner, fmtTime } from '../components/ui';

const SUGGESTIONS = [
  'Why should I learn JavaScript before React?',
  'What is my biggest career skill gap?',
  'Why did my roadmap change?',
  'What should I study next?',
  'How can I improve my assessment performance?',
  'What changes if I become a Data Analyst instead?',
];

export function Mentor() {
  const { notify, state } = useApp();
  const refreshKey = state.roadmap?.id;
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.messages().then((m) => { setMessages(m); setLoaded(true); }).catch((e) => notify(e.message)); }, [refreshKey, notify, state.attempts.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setSending(true);
    setInput('');
    setMessages((m) => [...m, { id: -Date.now(), role: 'user', kind: 'chat', content: q, createdAt: new Date().toISOString() }]);
    try { setMessages(await api.ask(q)); } catch (e) { notify((e as Error).message); setMessages(await api.messages()); } finally { setSending(false); }
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ask Mira</h1>
        <p className="mt-1 text-sm text-slate-500">Your mentor answers from your actual profile, evidence, assessments and roadmap history — never invented achievements.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-white p-4" aria-live="polite">
        {!loaded && <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Loading conversation…</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-brand-700 text-white' : m.kind === 'summary' ? 'border border-brand-100 bg-brand-50/60 text-slate-700' : 'bg-stone-100 text-slate-800'}`}>
              {m.kind === 'summary' && <div className="mb-1"><Badge tone="brand">Update from Mira</Badge></div>}
              <div className="whitespace-pre-wrap">{m.content}</div>
              <div className={`mt-1 text-[10px] ${m.role === 'user' ? 'text-white/70' : 'text-slate-400'}`}>{fmtTime(m.createdAt)}</div>
            </div>
          </div>
        ))}
        {sending && <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Mira is thinking about your data…</div>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} disabled={sending} className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-600 hover:text-brand-800 disabled:opacity-50">{s}</button>)}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask about your skills, roadmap or career goal…" aria-label="Message to Mira"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none" />
        <Button type="submit" disabled={sending || !input.trim()}>Send</Button>
      </form>
    </div>
  );
}
