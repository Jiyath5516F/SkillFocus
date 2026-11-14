// "AI succeeded" path against a local fake of the Messages API: exercises the real agents, orchestrator
// and validation (including rejection of invented resource IDs) without network access or cost.
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { AgentRun, AppState } from '../shared/types';

const seenModels: string[] = [];
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => {
    raw += c;
  });
  req.on('end', () => {
    const body = JSON.parse(raw) as { model: string; system: string; messages: { content: string }[] };
    seenModels.push(body.model);
    const sys = body.system; // each agent is identified by the first line of its own system prompt
    let out: unknown = 'Stub mentor reply grounded in your data.';
    if (sys.startsWith('You are the Skill Intelligence Agent'))
      out = {
        links: [{ skillId: 'python', evidenceName: 'Campus Library Tracker', reason: 'Python app' }],
        strengths: ['Python'],
        weaknesses: ['JavaScript'],
        uncertainties: [],
        summary: 'stub insights',
      };
    else if (sys.startsWith('You are the Learning Path Architect')) {
      const input = JSON.parse(body.messages[0].content) as {
        slots: { key: string; candidateResources: { id: string }[] }[];
      };
      out = {
        milestones: input.slots.map((sl) => ({
          key: sl.key,
          title: `AI ${sl.key}`,
          reason: 'because',
          resourceIds: ['made-up-course', sl.candidateResources[0].id],
          exercise: 'build it',
          effortHours: 5,
        })),
        changeSummary: 'stub plan',
      };
    } else if (sys.startsWith('You are the Career Matching Agent'))
      out = { headline: 'stub headline', criticalPath: ['javascript', 'astrology'], notes: [] };
    else if (sys.startsWith('You are the Assessment & Progress Agent'))
      out = { diagnosis: 'stub diagnosis', concepts: [], focus: 'closures' };
    const text = typeof out === 'string' ? out : JSON.stringify(out);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'msg_stub',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 11, output_tokens: 7 },
      }),
    );
  });
});
await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()));

process.env.MIRA_DB_PATH = ':memory:';
process.env.SKILLFOCUS_ANTHROPIC_API_KEY = 'test-key';
process.env.SKILLFOCUS_ANTHROPIC_BASE_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
const { app } = await import('../server/app');

let base = '';
let cookie = '';
let server: ReturnType<typeof app.listen>;
const call = async (path: string, method = 'GET', body?: unknown) => {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { headers: r.headers, json: (await r.json()) as any };
};
before(async () => {
  await new Promise<void>((r) => {
    server = app.listen(0, '127.0.0.1', () => r());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const r = await call('/auth/signup', 'POST', {
    name: 'Stub User',
    email: 'stub@example.com',
    password: 'stub-pass-1',
  });
  cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
  await call('/demo/reset', 'POST');
});
after(() => {
  server.close();
  fake.close();
});

describe('agents with a (fake) model', () => {
  it('completes a full analysis with validated AI output', async () => {
    const { json } = await call('/analyze', 'POST');
    let run: AgentRun;
    do {
      run = (await call(`/runs/${json.runId}`)).json;
    } while (run.status === 'running');
    assert.equal(run.status, 'completed', JSON.stringify(run.steps.filter((s) => s.status === 'failed')));
    assert.ok(run.steps.filter((s) => s.kind === 'llm' && s.status === 'completed').length >= 4);
    const state: AppState = (await call('/state')).json;
    const ms = state.roadmap!.milestones;
    assert.ok(ms.every((m) => m.authoredBy === 'ai'));
    assert.ok(
      ms.every((m) => !m.resourceIds.includes('made-up-course')),
      'invented resource IDs are rejected',
    );
    assert.deepEqual(state.matching!.criticalPath, ['javascript'], 'critical path limited to real gaps');
    assert.equal(state.insights!.summary, 'stub insights');
    assert.ok(
      state.evidence.some((e) => e.source === 'project_link' && e.skillId === 'python'),
      'Skill Intelligence links feed the engine',
    );
    assert.ok(seenModels.includes('claude-haiku-5-5'), 'short outputs use the fast model');
  });
});
