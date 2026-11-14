// Mira API server (Express). Serves /api and, in production, the built client — optionally under a base path (e.g. /Mira).
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ROLES, ROLE_BY_ID, RESOURCES, SKILLS, SKILL_BY_ID } from '../shared/catalog';
import { scoreToLevel } from '../shared/engine';
import type { ConceptResult, MilestoneStatus, QuestionResult } from '../shared/types';
import { mentorReply } from './agents/mentor';
import { ASSESSMENTS, ASSESSMENT_BY_ID, toPublic } from './assessments';
import * as store from './db';
import { aiConfigured, describeError, MODEL } from './llm';
import { BusyError, startAnalyze, startAssessmentRun, startGoalChange } from './orchestrator';
import { seedDemo } from './seed';
import { buildState, mentorSnapshot } from './state';

const PORT = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || '0.0.0.0';
const BASE = (process.env.MIRA_BASE_PATH || '').replace(/\/+$/, '');

store.failStaleRuns();
seedDemo();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Simple in-memory limiter for AI-triggering endpoints.
const hits: number[] = [];
function aiLimit(_req: Request, res: Response, next: NextFunction) {
  const t = Date.now();
  while (hits.length && t - hits[0] > 60_000) hits.shift();
  if (hits.length >= 30) return res.status(429).json({ error: 'Too many AI requests. Please wait a minute.' });
  hits.push(t);
  next();
}

const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true, aiConfigured, model: aiConfigured ? MODEL : null }));
api.get('/meta', (_req, res) => res.json({ roles: ROLES, skills: SKILLS, resources: RESOURCES, assessments: ASSESSMENTS.map((a) => ({ id: a.id, skillId: a.skillId, title: a.title, questions: a.questions.length })) }));
api.get('/state', (_req, res) => res.json(buildState()));

const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  background: z.string().trim().max(200),
  currentRole: z.string().trim().max(100),
  skills: z.array(z.object({ skillId: z.string(), selfLevel: z.number().int().min(0).max(4) })).max(30),
  certifications: z.array(z.object({ name: z.string().trim().min(1).max(120), issuer: z.string().trim().max(80), year: z.number().int().min(1990).max(2100).optional() })).max(20),
  projects: z.array(z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500) })).max(20),
  interests: z.string().trim().max(300),
  targetRoleId: z.string(),
  weeklyHours: z.number().min(1).max(60),
});

function sendErr(res: Response, e: unknown) {
  if (e instanceof BusyError) return res.status(409).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: describeError(e) });
}

api.put('/profile', aiLimit, (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid profile', details: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) });
  const p = parsed.data;
  if (!ROLE_BY_ID[p.targetRoleId]) return res.status(400).json({ error: 'Unknown career goal' });
  const unknown = p.skills.find((s) => !SKILL_BY_ID[s.skillId]);
  if (unknown) return res.status(400).json({ error: `Unknown skill: ${unknown.skillId}` });
  // De-duplicate skills (keep the last entry for each skill).
  const skills = [...new Map(p.skills.map((s) => [s.skillId, s])).values()].filter((s) => s.selfLevel > 0);
  try {
    if (store.activeRunId()) throw new BusyError('Agents are busy with a previous request. Please wait a moment.');
    store.saveProfile({ ...p, skills });
    res.json({ runId: startAnalyze('profile_updated') });
  } catch (e) { sendErr(res, e); }
});

api.post('/analyze', aiLimit, (_req, res) => {
  try { res.json({ runId: startAnalyze('analyze') }); } catch (e) { sendErr(res, e); }
});

api.post('/goal', aiLimit, (req, res) => {
  const roleId = z.object({ roleId: z.string() }).safeParse(req.body);
  if (!roleId.success || !ROLE_BY_ID[roleId.data.roleId]) return res.status(400).json({ error: 'Unknown career goal' });
  const profile = store.getProfile()!;
  if (profile.targetRoleId === roleId.data.roleId) return res.status(400).json({ error: 'That is already your current goal' });
  try {
    if (store.activeRunId()) throw new BusyError('Agents are busy with a previous request. Please wait a moment.');
    const from = profile.targetRoleId;
    store.saveProfile({ ...profile, targetRoleId: roleId.data.roleId });
    res.json({ runId: startGoalChange(from, roleId.data.roleId) });
  } catch (e) { sendErr(res, e); }
});

api.get('/assessments', (_req, res) => res.json(ASSESSMENTS.map(toPublic)));
api.get('/assessments/:id', (req, res) => {
  const a = ASSESSMENT_BY_ID[String(req.params.id)];
  return a ? res.json(toPublic(a)) : res.status(404).json({ error: 'Assessment not found' });
});

api.post('/assessments/:id/submit', aiLimit, (req, res) => {
  const def = ASSESSMENT_BY_ID[String(req.params.id)];
  if (!def) return res.status(404).json({ error: 'Assessment not found' });
  const body = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(9).nullable()) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid submission' });
  const answers = body.data.answers;
  const answered = def.questions.filter((q) => typeof answers[q.id] === 'number').length;
  if (answered < def.questions.length) return res.status(400).json({ error: `Please answer all ${def.questions.length} questions (${answered} answered).` });
  if (store.activeRunId()) return res.status(409).json({ error: 'Agents are busy with a previous request. Please wait a moment.' });

  // Deterministic grading against the answer key.
  const t0 = Date.now();
  const questionResults: QuestionResult[] = def.questions.map((q) => {
    const chosen = answers[q.id] ?? null;
    return { questionId: q.id, concept: q.concept, chosen, correctIndex: q.answer, correct: chosen === q.answer, explanation: q.explanation };
  });
  const correct = questionResults.filter((r) => r.correct).length;
  const score = Math.round((correct / def.questions.length) * 100);
  const conceptResults: ConceptResult[] = Object.entries(def.concepts).map(([concept, label]) => {
    const qs = questionResults.filter((r) => r.concept === concept);
    return { concept, label, correct: qs.filter((r) => r.correct).length, total: qs.length };
  }).filter((c) => c.total > 0);
  const weakConcepts = conceptResults.filter((c) => c.correct / c.total < 0.5).map((c) => c.concept);
  const verifiedLevel = scoreToLevel(score);
  const profile = store.getProfile()!;
  const requiredLevel = ROLE_BY_ID[profile.targetRoleId].requirements.find((r) => r.skillId === def.skillId)?.level ?? 2;
  const attempt = store.addAttempt({ assessmentId: def.id, skillId: def.skillId, score, correct, total: def.questions.length, verifiedLevel, conceptResults, questionResults, weakConcepts, diagnosis: null, createdAt: store.now() });
  store.addEvidence({ skillId: def.skillId, source: 'assessment', level: verifiedLevel, detail: `${def.title} attempt #${attempt.id}: ${score}%`, refId: `attempt:${attempt.id}` });
  const gradingMs = Date.now() - t0;
  try {
    res.json({ attempt, runId: startAssessmentRun(def, attempt, gradingMs, requiredLevel) });
  } catch (e) { sendErr(res, e); }
});

api.patch('/milestones/:key', (req, res) => {
  const body = z.object({ status: z.enum(['todo', 'in_progress', 'done']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid status' });
  const key = String(req.params.key);
  const s = buildState();
  const m = s.roadmap?.milestones.find((x) => x.key === key);
  if (!m) return res.status(404).json({ error: 'Milestone not found in the current roadmap' });
  const status = body.data.status as MilestoneStatus;
  store.setProgress(key, status);
  // Completing a learning milestone is a *claim* (unverified), never verified proficiency.
  store.deleteEvidenceByRef(`milestone:${key}`);
  if (status === 'done' && m.kind === 'learn') {
    store.addEvidence({ skillId: m.skillId, source: 'milestone_claim', level: m.targetLevel, detail: `Completed milestone "${m.title}" (not yet assessed)`, refId: `milestone:${key}` });
  }
  res.json(buildState());
});

api.get('/runs', (_req, res) => res.json(store.listRuns(15)));
api.get('/runs/:id', (req, res) => {
  const run = store.getRun(Number(req.params.id));
  return run ? res.json(run) : res.status(404).json({ error: 'Run not found' });
});

api.get('/mentor', (_req, res) => res.json(store.listMessages(60)));
api.post('/mentor', aiLimit, async (req, res) => {
  const body = z.object({ message: z.string().trim().min(1).max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Message must be 1–1000 characters' });
  store.addMessage('user', 'chat', body.data.message);
  const history = store.listMessages(12).filter((m) => m.kind === 'chat').map((m) => ({ role: m.role, content: m.content }));
  while (history.length && history[0].role !== 'user') history.shift();
  const runId = store.createRun('mentor_question');
  const t0 = Date.now();
  const stepId = store.startStep(runId, 'Mira (Mentor)', 'llm', MODEL, `Question: ${body.data.message.slice(0, 200)}`);
  try {
    const r = await mentorReply(mentorSnapshot(), history);
    store.endStep(stepId, { status: 'completed', durationMs: Date.now() - t0, outputSummary: r.data.slice(0, 280), tokensIn: r.tokensIn, tokensOut: r.tokensOut });
    store.finishRun(runId, 'completed');
    store.addMessage('assistant', 'chat', r.data);
    res.json(store.listMessages(60));
  } catch (e) {
    const msg = describeError(e);
    store.endStep(stepId, { status: 'failed', durationMs: Date.now() - t0, error: msg });
    store.finishRun(runId, 'failed');
    res.status(502).json({ error: `Mira could not answer: ${msg}` });
  }
});

api.post('/demo/reset', (_req, res) => {
  if (store.activeRunId()) return res.status(409).json({ error: 'Agents are busy. Try again in a moment.' });
  seedDemo(true);
  res.json(buildState());
});

api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(`${BASE}/api`, api);

// Production: serve the built client.
const dist = resolve('dist');
if (existsSync(dist)) {
  app.use(BASE || '/', express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.path.startsWith(`${BASE}/`) && req.path !== BASE) return next();
    res.sendFile(resolve(dist, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, HOST, () => console.log(`Mira API listening on http://${HOST}:${PORT}${BASE}/api (AI ${aiConfigured ? `enabled: ${MODEL}` : 'NOT configured — rule-based fallback'})`));
