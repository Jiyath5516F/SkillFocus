// End-to-end acceptance tests against a running Mira API (real agent runs, real Claude calls).
// Usage: npm run acceptance            (tests 1–3)
//        npm run acceptance -- persist (after a server restart: checks the Data Analyst plan survived)
import { RESOURCE_BY_ID } from '../shared/catalog';
import { computeTwin } from '../shared/engine';
import type { AgentRun, AppState, AssessmentAttempt, MentorMessage, PublicAssessment } from '../shared/types';

const API = process.env.MIRA_API ?? 'http://localhost:8090/api';
let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json as T;
}
async function waitRun(id: number): Promise<AgentRun> {
  for (let i = 0; i < 120; i++) {
    const run = await call<AgentRun>(`/runs/${id}`);
    if (run.status !== 'running') return run;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`run ${id} did not finish`);
}
const llmDone = (run: AgentRun) => run.steps.filter((s) => s.kind === 'llm' && s.status === 'completed' && s.model && (s.tokensOut ?? 0) > 0);
const ask = async (q: string) => (await call<MentorMessage[]>('/mentor', 'POST', { message: q })).filter((m) => m.role === 'assistant').pop()!.content;

async function test1() {
  console.log('\nTest 1 — Profile → roadmap (Full Stack Developer)');
  await call('/demo/reset', 'POST');
  const run = await waitRun((await call<{ runId: number }>('/analyze', 'POST')).runId);
  const s = await call<AppState>('/state');
  check(run.status === 'completed', 'agent run completed without fallback', run.status);
  const agents = new Set(llmDone(run).map((x) => x.agent));
  check(llmDone(run).length >= 3 && agents.size >= 3, '≥3 distinct LLM agents completed with model + tokens', [...agents].join(', '));
  check(['javascript', 'react', 'nodejs'].every((k) => s.twin.orderedGaps.includes(k)), 'JavaScript, React, Node.js identified as gaps', s.twin.orderedGaps.join(' → '));
  check(s.twin.orderedGaps.indexOf('javascript') < s.twin.orderedGaps.indexOf('react'), 'JavaScript ordered before React');
  const local = computeTwin(s.profile, s.evidence, s.profile.targetRoleId);
  check(local.readiness === s.twin.readiness, 'readiness equals deterministic engine output', `${s.twin.readiness}%`);
  const ms = s.roadmap?.milestones ?? [];
  check(ms.length >= 4, '≥4 roadmap milestones', String(ms.length));
  check(ms.every((m) => m.resourceIds.length > 0 && m.resourceIds.every((id) => RESOURCE_BY_ID[id])), 'every resource comes from the curated catalog');
  const reply = await ask('Why should I learn JavaScript before React?');
  check(/prereq|foundation|built on|builds on|depends|first|before/i.test(reply), 'Mira explains the prerequisite', reply.slice(0, 110).replace(/\n/g, ' '));
}

async function test2() {
  console.log('\nTest 2 — Assessment → adaptation');
  const before = await call<AppState>('/state');
  const after = await call<AppState>('/milestones/learn%3Ajavascript', 'PATCH', { status: 'done' });
  check(after.twin.readiness > before.twin.readiness, 'completing JS milestone raises readiness as an unverified claim', `${before.twin.readiness}% → ${after.twin.readiness}%`);
  const quiz = await call<PublicAssessment>('/assessments/js-core');
  check(!JSON.stringify(quiz).includes('"answer"'), 'answer keys are not sent to the client');
  // Deliberately weak attempt: correct on the two "types" questions, wrong elsewhere → 2/8.
  const KEY: Record<string, number> = { js1: 1, js2: 2, js3: 2, js4: 1, js5: 1, js6: 2, js7: 1, js8: 1 };
  const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.concept === 'types' ? KEY[q.id] : (KEY[q.id] + 1) % 4]));
  const sub = await call<{ attempt: AssessmentAttempt; runId: number }>('/assessments/js-core/submit', 'POST', { answers });
  check(sub.attempt.score === 25, 'score graded deterministically: 25%', `${sub.attempt.correct}/${sub.attempt.total}`);
  check(JSON.stringify(sub.attempt.weakConcepts.sort()) === JSON.stringify(['arrays_objects', 'async', 'closures', 'dom']), 'weak concepts match the wrong answers', sub.attempt.weakConcepts.join(', '));
  const run = await waitRun(sub.runId);
  check(run.status === 'completed', 'adaptation run completed', run.status);
  check(new Set(llmDone(run).map((x) => x.agent)).size >= 4, '≥4 agents collaborated', [...new Set(llmDone(run).map((x) => x.agent))].join(', '));
  const s = await call<AppState>('/state');
  const js = s.twin.requirements.find((r) => r.skillId === 'javascript')!;
  check(js.confidence === 'assessed' && js.effective === 1, 'JS estimate is now assessment-backed at level 1', `effective ${js.effective}, ${js.confidence}`);
  check(s.twin.readiness < after.twin.readiness, 'readiness dropped after the weak result', `${after.twin.readiness}% → ${s.twin.readiness}%`);
  const keys = s.roadmap!.milestones.map((m) => m.key);
  const fixIdx = keys.findIndex((k) => k.startsWith('fix:javascript:'));
  check(s.roadmap!.version === 2 && fixIdx >= 0 && fixIdx < keys.indexOf('learn:react'), 'roadmap v2 inserts remediation before React', keys.join(', '));
  check((s.roadmap!.diff?.added.length ?? 0) > 0, 'revision diff recorded', `added ${s.roadmap!.diff?.added.length}`);
  check(s.roadmap!.previous?.readiness === after.twin.readiness && s.roadmap!.snapshot.readiness === s.twin.readiness, 'Career Twin before/after shows the drop', `${s.roadmap!.previous?.readiness}% → ${s.roadmap!.snapshot.readiness}%`);
  check(s.attempts.some((a) => a.id === sub.attempt.id && a.score === 25), 'attempt saved');
  const reply = await ask('Why did my roadmap change?');
  check(/25|2\/8|2 of 8|two of|assessment|quiz/i.test(reply), 'Mira cites the actual assessment', reply.slice(0, 110).replace(/\n/g, ' '));
}

async function test3() {
  console.log('\nTest 3 — Career change → Data Analyst');
  const before = await call<AppState>('/state');
  const run = await waitRun((await call<{ runId: number }>('/goal', 'POST', { roleId: 'data_analyst' })).runId);
  const s = await call<AppState>('/state');
  check(run.status === 'completed', 'goal-change run completed', run.status);
  check(s.profile.targetRoleId === 'data_analyst' && s.roadmap?.roleId === 'data_analyst', 'new Data Analyst roadmap is current');
  check(JSON.stringify(s.twin.orderedGaps) !== JSON.stringify(before.twin.orderedGaps), 'gaps recalculated for the new role', s.twin.orderedGaps.join(' → '));
  check(s.revisions.filter((r) => r.roleId === 'fullstack').length >= 2, 'Full Stack plan history preserved');
  check(s.attempts.length === before.attempts.length, 'assessment history preserved');
  check(JSON.stringify(s.profile.certifications) === JSON.stringify(before.profile.certifications) && JSON.stringify(s.profile.projects) === JSON.stringify(before.profile.projects), 'certifications and projects preserved');
}

async function persist() {
  console.log('\nTest 3b — persistence after server restart');
  const s = await call<AppState>('/state');
  check(s.profile.targetRoleId === 'data_analyst' && s.roadmap?.roleId === 'data_analyst', 'Data Analyst plan survives restart');
  check(s.revisions.some((r) => r.roleId === 'fullstack') && s.attempts.length > 0, 'history survives restart', `${s.revisions.length} revisions, ${s.attempts.length} attempts`);
}

(async () => {
  try {
    if (process.argv.includes('persist')) await persist();
    else { await test1(); await test2(); await test3(); }
  } catch (e) {
    failures++;
    console.error('ERROR', (e as Error).message);
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
