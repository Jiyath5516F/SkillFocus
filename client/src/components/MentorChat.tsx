import { PaperAirplaneIcon } from '@heroicons/react/20/solid';
import { useEffect, useRef, useState } from 'react';
import type { MentorMessage } from '../../../shared/types';
import { useApp } from '../App';
import { api } from '../api';
import { Markdown } from './Markdown';
import { MiraAvatar } from './MiraAvatar';
import { Badge, Spinner, fmtTime } from './ui';

export const SUGGESTIONS = [
  'Why should I learn JavaScript before React?',
  'What is my biggest career skill gap?',
  'Why did my roadmap change?',
  'What should I study next?',
  'How can I improve my assessment performance?',
  'What changes if I become a Data Analyst instead?',
  'When could I reach 70% readiness?',
];

/** Conversation with Mira, shared by the full "Ask Mira" page and the floating launcher. */
export function MentorChat({ compact = false }: { compact?: boolean }) {
  const { notify, state } = useApp();
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const refreshKey = state.roadmap?.id;

  useEffect(() => { api.messages().then((m) => { setMessages(m); setLoaded(true); }).catch((e) => notify(e.message)); }, [refreshKey, notify, state.attempts.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setSending(true);
    setInput('');
    setMessages((m) => [...m, { id: -Date.now(), role: 'user', kind: 'chat', content: q, createdAt: new Date().toISOString() }]);
    try { setMessages(await api.ask(q)); } catch (e) { notify((e as Error).message); setMessages(await api.messages()); } finally { setSending(false); }
  };

  const shown = compact ? messages.slice(-8) : messages;
  const chips = compact ? SUGGESTIONS.slice(1, 4) : SUGGESTIONS;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto ${compact ? 'px-4 py-3' : 'rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10'}`} aria-live="polite" role="log" aria-label="Conversation with Mira" tabIndex={0}>
        {!loaded && <p className="flex items-center gap-2 text-sm text-white/60"><Spinner /> Loading conversation…</p>}
        {shown.map((m) => (
          <div key={m.id} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && <MiraAvatar size="sm" />}
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-md bg-gray-700 text-white shadow-inner shadow-white/10' : m.kind === 'summary' ? 'rounded-bl-md bg-indigo-400/10 text-white/90 ring-1 ring-indigo-400/20' : 'rounded-bl-md bg-white/10 text-white/90'}`}>
              {m.kind === 'summary' && <div className="mb-1"><Badge tone="brand">Update from Mira</Badge></div>}
              {m.role === 'assistant' ? <Markdown text={m.content} /> : <div className="whitespace-pre-wrap">{m.content}</div>}
              <div className="mt-1 text-[10px] text-white/60">{fmtTime(m.createdAt)}</div>
            </div>
          </div>
        ))}
        {sending && <div className="flex items-center gap-2 text-sm text-white/60"><MiraAvatar size="sm" /><Spinner /> Mira is thinking about your data…</div>}
        <div ref={endRef} />
      </div>
      <div className={`flex flex-wrap gap-2 ${compact ? 'px-4 pt-2' : 'mt-3'}`}>
        {chips.map((s) => <button key={s} onClick={() => send(s)} disabled={sending} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50">{s}</button>)}
      </div>
      <form className={`flex gap-2 ${compact ? 'p-4 pt-2' : 'mt-3'}`} onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask about your skills, roadmap or goal…" aria-label="Message to Mira"
          className="min-w-0 flex-1 rounded-lg border-none bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-2 focus:-outline-offset-2 focus:outline-white/25" />
        <button type="submit" disabled={sending || !input.trim()} aria-label="Send message"
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-700 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 hover:bg-gray-600 disabled:opacity-50">
          <PaperAirplaneIcon className="size-4" />{!compact && 'Send'}
        </button>
      </form>
    </div>
  );
}
