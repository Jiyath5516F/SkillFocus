// API integration tests: in-memory database, AI deliberately disabled to exercise validation and the rule-based fallback.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { AgentRun, AppState } from '../shared/types';

process.env.MIRA_DB_PATH = ':memory:';
for (const k of ['SKILLFOCUS_ANTHROPIC_API_KEY', 'MIRA_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY']) process.env[k] = '';

const { app } = await import('../server/app');

let base = '';
let server: ReturnType<typeof app.listen>;
let cookie = '';

const call = async (path: string, method = 'GET', body?: unknown, auth: string | null = cookie) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers.Cookie = auth;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, headers: res.headers, json: (await res.json()) as any };
};
const sessionFrom = (headers: Headers) => (headers.get('set-cookie') ?? '').split(';')[0];

before(async () => {
  await new Promise<void>((r) => { server = app.listen(0, '127.0.0.1', () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const r = await call('/auth/signup', 'POST', { name: 'Test Learner', email: 'test@example.com', password: 'secret-pass-1' }, null);
  assert.equal(r.status, 201);
  cookie = sessionFrom(r.headers);
});
after(() => server.close());

describe('authentication & account isolation', () => {
  it('requires a session for learner data', async () => {
    assert.equal((await call('/state', 'GET', undefined, null)).status, 401);
    assert.equal((await call('/state', 'GET', undefined, 'mira_session=forged-token')).status, 401);
    assert.equal((await call('/health', 'GET', undefined, null)).status, 200);
    assert.equal((await call('/auth/me', 'GET', undefined, null)).json.user, null);
    assert.equal((await call('/auth/me')).json.user.email, 'test@example.com');
  });
  it('sets an HttpOnly, SameSite=Strict session cookie', async () => {
    const r = await call('/auth/login', 'POST', { email: 'TEST@example.com', password: 'secret-pass-1' }, null);
    assert.equal(r.status, 200);
    const set = r.headers.get('set-cookie') ?? '';
    assert.match(set, /HttpOnly/i);
    assert.match(set, /SameSite=Strict/i);
  });
  it('rejects wrong passwords with a generic message, weak passwords and duplicate accounts', async () => {
    const wrong = await call('/auth/login', 'POST', { email: 'test@example.com', password: 'nope-nope-1' }, null);
    assert.equal(wrong.status, 401);
    const unknown = await call('/auth/login', 'POST', { email: 'nobody@example.com', password: 'nope-nope-1' }, null);
    assert.equal(unknown.json.error, wrong.json.error, 'no account enumeration');
    assert.equal((await call('/auth/signup', 'POST', { name: 'X', email: 'weak@example.com', password: 'short' }, null)).status, 400);
    assert.equal((await call('/auth/signup', 'POST', { name: 'X', email: 'test@example.com', password: 'secret-pass-1' }, null)).status, 409);
  });
  it("keeps each account's data separate", async () => {
    const other = await call('/auth/signup', 'POST', { name: 'Other Person', email: 'other@example.com', password: 'another-pass-2' }, null);
    const otherCookie = sessionFrom(other.headers);
    const mine = (await call('/state')).json;
    const theirs = (await call('/state', 'GET', undefined, otherCookie)).json;
    assert.equal(mine.profile.name, 'Test Learner');
    assert.equal(theirs.profile.name, 'Other Person');
  });
  it('logout invalidates the session server-side', async () => {
    const r = await call('/auth/login', 'POST', { email: 'other@example.com', password: 'another-pass-2' }, null);
    const c = sessionFrom(r.headers);
    assert.equal((await call('/auth/logout', 'POST', {}, c)).status, 200);
    assert.equal((await call('/state', 'GET', undefined, c)).status, 401);
  });
});

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
  it('treats prototype property names as unknown IDs', async () => {
    const { json: st } = await call('/state');
    assert.equal((await call('/profile', 'PUT', { ...st.profile, targetRoleId: 'toString' })).status, 400);
    assert.equal((await call('/goal', 'POST', { roleId: '__proto__' })).status, 400);
    assert.equal((await call('/assessments/constructor')).status, 404);
    assert.equal((await call('/state')).status, 200);
  });
  it('returns 400 for malformed JSON', async () => {
    const res = await fetch(base + '/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
    assert.equal(res.status, 400);
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

describe('custom career aims', () => {
  it('saves a sanitised custom aim that only its owner can target', async () => {
    const created = await call('/roles', 'POST', { title: 'Cloud Support Engineer', summary: 'Keeps cloud apps running.', requirements: [
      { skillId: 'python', level: 2, weight: 3 }, { skillId: 'git', level: 2, weight: 2 }, { skillId: 'rest_api', level: 9, weight: 7 }, { skillId: 'kubernetes', level: 2, weight: 2 }] });
    assert.equal(created.status, 201);
    const role = created.json.role;
    assert.match(role.id, /^custom-/);
    assert.deepEqual(role.requirements.map((r: { skillId: string }) => r.skillId), ['python', 'git', 'rest_api'], 'unknown skills dropped');
    assert.equal(role.requirements[2].level, 4, 'level clamped');
    const other = await call('/auth/signup', 'POST', { name: 'Intruder', email: 'intruder@example.com', password: 'intruder-pass-1' }, null);
    const otherCookie = sessionFrom(other.headers);
    assert.equal((await call('/goal', 'POST', { roleId: role.id }, otherCookie)).status, 400, "cannot target another learner's aim");
    const mine = (await call('/state')).json;
    assert.ok(mine.profile.customRoles.some((r: { id: string }) => r.id === role.id));
  });
  it('adds typed skills: catalog names are reused, new names become owned custom skills with search resources', async () => {
    const reused = await call('/skills', 'POST', { name: 'python' });
    assert.equal(reused.json.skill.id, 'python');
    const created = await call('/skills', 'POST', { name: 'KiCad' });
    assert.equal(created.status, 201);
    const kicad = created.json.skill;
    assert.match(kicad.id, /^cs-/);
    const { json: st } = await call('/state');
    assert.equal((await call('/profile?analyze=false', 'PUT', { ...st.profile, skills: [{ skillId: kicad.id, selfLevel: 2 }] })).status, 200);
    const other = await call('/auth/login', 'POST', { email: 'intruder@example.com', password: 'intruder-pass-1' }, null);
    const otherState = (await call('/state', 'GET', undefined, sessionFrom(other.headers))).json;
    const r = await call('/profile?analyze=false', 'PUT', { ...otherState.profile, skills: [{ skillId: kicad.id, selfLevel: 2 }] }, sessionFrom(other.headers));
    assert.equal(r.status, 400, "cannot claim another learner's custom skill");
  });
  it('turns new skill names in a designed aim into custom skills', async () => {
    const r = await call('/roles', 'POST', { title: 'PCB Designer', summary: 'Designs circuit boards.', requirements: [
      { name: 'PCB layout', level: 3, weight: 3 }, { name: 'Circuit design', level: 2, weight: 2 }, { skillId: 'git', level: 2, weight: 1 }] });
    assert.equal(r.status, 201);
    assert.equal(r.json.role.requirements.length, 3);
    assert.ok(r.json.role.requirements.slice(0, 2).every((q: { skillId: string }) => q.skillId.startsWith('cs-')));
    const goal = await call('/profile?analyze=false', 'PUT', { ...(await call('/state')).json.profile, targetRoleId: r.json.role.id });
    assert.equal(goal.status, 200);
    const twin = (await call('/state')).json.twin;
    assert.ok(twin.orderedGaps.some((id: string) => id.startsWith('cs-')), 'custom skills are real requirements in the Career Twin');
  });
  it('rejects aims without enough catalog skills', async () => {
    assert.equal((await call('/roles', 'POST', { title: 'X', summary: '', requirements: [{ skillId: 'nope', level: 1, weight: 1 }, { skillId: 'nah', level: 1, weight: 1 }, { skillId: 'no', level: 1, weight: 1 }] })).status, 400);
  });
});

describe('graceful degradation without AI', () => {
  it('still produces a clearly labelled rule-based roadmap', async () => {
    await call('/demo/reset', 'POST'); // independent of earlier tests' profile changes
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
