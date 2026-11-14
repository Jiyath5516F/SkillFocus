// API integration tests: in-memory database, AI deliberately disabled to exercise validation and the rule-based fallback.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { AgentRun, AppState } from '../shared/types';

process.env.MIRA_DB_PATH = ':memory:';
for (const k of ['SKILLFOCUS_ANTHROPIC_API_KEY', 'MIRA_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY']) process.env[k] = '';

const { app } = await import('../server/app');
const { seedDemo } = await import('../server/seed');

let base = '';
let server: ReturnType<typeof app.listen>;
before(async () => {
  seedDemo(true);
  await new Promise<void>((r) => { server = app.listen(0, '127.0.0.1', () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

const call = async (path: string, method = 'GET', body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, headers: res.headers, json: (await res.json()) as any };
};

describe('API validation & security', () => {
  it('reports AI as not configured and sets security headers', async () => {
    const r = await call('/health');
    assert.equal(r.json.aiConfigured, false);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  });
  it('never returns answer keys', async () => {
    const r = await call('/assessments/js-core');
    assert.equal(r.status, 200);
    assert.ok(!JSON.stringify(r.json).includes('"answer"'));
  });
  it('rejects incomplete or malformed assessment submissions', async () => {
    assert.equal((await call('/assessments/js-core/submit', 'POST', { answers: { js1: 1 } })).status, 400);
    assert.equal((await call('/assessments/js-core/submit', 'POST', { answers: 'nope' })).status, 400);
    assert.equal((await call('/assessments/unknown/submit', 'POST', { answers: {} })).status, 404);
  });
  it('rejects invalid profiles and unknown career goals', async () => {
    const { json: s } = await call('/state');
    assert.equal((await call('/profile', 'PUT', { ...s.profile, targetRoleId: 'astronaut' })).status, 400);
    assert.equal((await call('/profile', 'PUT', { ...s.profile, skills: [{ skillId: 'python', selfLevel: 9 }] })).status, 400);
    assert.equal((await call('/profile', 'PUT', { ...s.profile, name: '' })).status, 400);
    assert.equal((await call('/goal', 'POST', { roleId: 'astronaut' })).status, 400);
  });
  it('rejects milestone updates for unknown milestones', async () => {
    assert.equal((await call('/milestones/learn%3Anope', 'PATCH', { status: 'done' })).status, 404);
  });
});

describe('cohort insights', () => {
  it('aggregates the sample cohort plus the live learner, ranked by impact', async () => {
    const r = await call('/cohort?role=all');
    assert.equal(r.status, 200);
    assert.equal(r.json.summary.learners, 13);
    assert.ok(r.json.learners.some((l: { sample: boolean }) => !l.sample), 'live learner included');
    const impacts = r.json.priorities.map((p: { impactPoints: number }) => p.impactPoints);
    assert.deepEqual(impacts, [...impacts].sort((a: number, b: number) => b - a));
  });
  it('filters by role and rejects unknown roles', async () => {
    const r = await call('/cohort?role=data_analyst');
    assert.ok(r.json.learners.every((l: { roleId: string }) => l.roleId === 'data_analyst'));
    assert.equal((await call('/cohort?role=astronaut')).status, 400);
  });
});

describe('graceful degradation without AI', () => {
  it('still produces a clearly labelled rule-based roadmap', async () => {
    const { json } = await call('/analyze', 'POST');
    let run: AgentRun;
    do { run = (await call(`/runs/${json.runId}`)).json; } while (run.status === 'running');
    assert.equal(run.status, 'completed_with_fallback');
    assert.ok(run.steps.some((s) => s.kind === 'fallback'));
    assert.ok(!run.steps.some((s) => s.kind === 'llm' && s.status === 'completed'), 'no AI step may claim success');
    const state: AppState = (await call('/state')).json;
    assert.ok(state.roadmap && state.roadmap.milestones.length >= 4);
    assert.ok(state.roadmap.milestones.every((m) => m.authoredBy === 'rule-based'));
  });
  it('mentor reports the outage instead of inventing an answer', async () => {
    const r = await call('/mentor', 'POST', { message: 'What should I study next?' });
    assert.equal(r.status, 502);
    assert.match(r.json.error, /not configured/i);
  });
});
