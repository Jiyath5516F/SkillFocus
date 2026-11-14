// Mira Express application: /api routes and, in production, the built client — optionally under a base path (e.g. /Mira).
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ROLES, ROLE_BY_ID, RESOURCES, SKILLS, customSkill, registerRoles, registerSkills } from '../shared/catalog';
import type { MilestoneStatus } from '../shared/types';
import { mentorReply } from './agents/mentor';
import { designRoles, resolveSkill, sanitizeRole } from './agents/roleDesigner';
import {
  authenticate, clearSessionCookie, createSession, createUser, deleteSession, findUserByEmail, readSessionCookie, setSessionCookie, tooManyAttempts, userForSession, type User,
} from './auth';
import { cohortReport } from './cohort';
import { ASSESSMENTS, ASSESSMENT_BY_ID, toPublic } from './assessments';
import * as store from './db';
import { countAnswered, grade } from './grading';
import { aiConfigured, describeError, MODEL } from './llm';
import { BusyError, currentSnapshot, startAnalyze, startAssessmentRun, startGoalChange } from './orchestrator';
import { seedDemo, seedNewAccount } from './seed';
import { buildState, mentorSnapshot } from './state';

const BASE = (process.env.MIRA_BASE_PATH || '').replace(/\/+$/, '');

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});
app.use(express.json({ limit: '100kb' }));

// Per-client in-memory limiter for AI-triggering endpoints (single-instance deployment).
const AI_LIMIT_PER_MIN = Number(process.env.MIRA_AI_LIMIT_PER_MIN || 30);
const hits = new Map<string, number[]>();
function aiLimit(req: Request, res: Response, next: NextFunction) {
  const t = Date.now();
  if (hits.size > 5_000) hits.clear(); // bound memory under abuse
  const key = req.ip ?? 'unknown';
  const recent = (hits.get(key) ?? []).filter((x) => t - x < 60_000);
  if (recent.length >= AI_LIMIT_PER_MIN) return res.status(429).json({ error: 'Too many AI requests. Please wait a minute.' });
  recent.push(t);
  hits.set(key, recent);
  next();
}

const BUSY = 'Agents are busy with a previous request. Please wait a moment.';
const RETAKE_COOLDOWN_MS = Number(process.env.MIRA_RETAKE_COOLDOWN_MIN ?? 10) * 60_000;

const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true, aiConfigured, model: aiConfigured ? MODEL : null }));

// ---- Accounts (public) ----
const SignupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.email('Enter a valid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number'),
});
const LoginSchema = z.object({ email: z.string().trim().min(1).max(254), password: z.string().min(1).max(128) });
const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email });

api.post('/auth/signup', (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid sign-up details' });
  // Generous per IP: judges may share one venue network.
  if (tooManyAttempts([`signup:${req.ip}`], 40, 60 * 60_000)) return res.status(429).json({ error: 'Too many sign-ups from this network. Try again later.' });
  if (findUserByEmail(parsed.data.email)) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  const user = createUser(parsed.data.name, parsed.data.email, parsed.data.password);
  store.runAsUser(user.id, () => seedNewAccount(user.name)); // empty profile; the setup wizard collects the details
  setSessionCookie(req, res, createSession(user.id), BASE);
  res.status(201).json({ user: publicUser(user) });
});

api.post('/auth/login', (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your email and password' });
  // Strict per account (stops password guessing), generous per IP (shared venue networks).
  if (tooManyAttempts([`login-email:${parsed.data.email.toLowerCase()}`], 10) || tooManyAttempts([`login-ip:${req.ip}`], 100)) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Please wait 15 minutes.' });
  }
  const user = authenticate(parsed.data.email, parsed.data.password);
  if (!user) return res.status(401).json({ error: 'Incorrect email or password' }); // generic: no account enumeration
  setSessionCookie(req, res, createSession(user.id), BASE);
  res.json({ user: publicUser(user) });
});

api.post('/auth/logout', (req, res) => {
  deleteSession(readSessionCookie(req));
  clearSessionCookie(res, BASE);
  res.json({ ok: true });
});

api.get('/auth/me', (req, res) => {
  const user = userForSession(readSessionCookie(req));
  res.json({ user: user ? publicUser(user) : null }); // 200 either way: "not signed in" is a normal state here
});

// ---- Everything below requires a valid session and runs against that user's own database ----
api.use((req, res, next) => {
  const user = userForSession(readSessionCookie(req));
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  res.locals.user = user;
  store.runAsUser(user.id, () => {
    store.getProfile(); // registers this learner's custom aims before any route resolves a role id
    next();
  });
});

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
  onboarded: z.boolean().optional(),
});

/** A role id is usable if it is built-in, or a custom aim owned by the signed-in learner. */
function roleAllowed(roleId: string): boolean {
  if (!ROLE_BY_ID[roleId]) return false;
  return !roleId.startsWith('custom-') || (store.getProfile()?.customRoles ?? []).some((r) => r.id === roleId);
}

function sendErr(res: Response, e: unknown) {
  if (e instanceof BusyError) return res.status(409).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: describeError(e) });
}

api.put('/profile', aiLimit, (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid profile', details: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) });
  const p = parsed.data;
  if (!roleAllowed(p.targetRoleId)) return res.status(400).json({ error: 'Unknown career goal' });
  const own = store.getProfile();
  const unknown = p.skills.find((s) => !resolveSkill(s.skillId, own)); // built-in or this learner's own custom skill
  if (unknown) return res.status(400).json({ error: `Unknown skill: ${unknown.skillId}` });
  // De-duplicate skills (keep the last entry for each skill).
  const skills = [...new Map(p.skills.map((s) => [s.skillId, s])).values()].filter((s) => s.selfLevel > 0);
  try {
    if (store.activeRunId()) throw new BusyError(BUSY);
    store.saveProfile({ ...p, skills, customRoles: own?.customRoles, customSkills: own?.customSkills }); // managed by /roles and /skills
    // ?analyze=false saves without running the agents (e.g. "Skip for now" in the setup wizard).
    res.json({ runId: req.query.analyze === 'false' ? null : startAnalyze('profile_updated') });
  } catch (e) { sendErr(res, e); }
});

api.post('/analyze', aiLimit, (_req, res) => {
  try { res.json({ runId: startAnalyze('analyze') }); } catch (e) { sendErr(res, e); }
});

api.post('/goal', aiLimit, (req, res) => {
  const roleId = z.object({ roleId: z.string() }).safeParse(req.body);
  if (!roleId.success || !roleAllowed(roleId.data.roleId)) return res.status(400).json({ error: 'Unknown career goal' });
  const profile = store.getProfile()!;
  if (profile.targetRoleId === roleId.data.roleId) return res.status(400).json({ error: 'That is already your current goal' });
  try {
    if (store.activeRunId()) throw new BusyError(BUSY);
    const from = profile.targetRoleId;
    store.saveProfile({ ...profile, targetRoleId: roleId.data.roleId });
    res.json({ runId: startGoalChange(from, roleId.data.roleId) });
  } catch (e) { sendErr(res, e); }
});

// ---- Custom career aims designed with Mira ----
api.post('/roles/suggest', aiLimit, async (req, res) => {
  const body = z.object({ aim: z.string().trim().min(3).max(160), avoid: z.array(z.string().max(80)).max(12).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Describe your aim in 3–160 characters' });
  const runId = store.createRun('role_design');
  const t0 = Date.now();
  const stepId = store.startStep(runId, 'Career Matching', 'llm', MODEL, `Design role profiles for aim: "${body.data.aim.slice(0, 120)}"`);
  try {
    const r = await designRoles(body.data.aim, body.data.avoid ?? [], store.getProfile());
    store.endStep(stepId, { status: 'completed', durationMs: Date.now() - t0, outputSummary: r.data.map((o) => `${o.title} (${o.requirements.length} skills)`).join(' · '), tokensIn: r.tokensIn, tokensOut: r.tokensOut });
    store.finishRun(runId, 'completed');
    res.json({ options: r.data });
  } catch (e) {
    const msg = describeError(e);
    store.endStep(stepId, { status: 'failed', durationMs: Date.now() - t0, error: msg });
    store.finishRun(runId, 'failed');
    res.status(502).json({ error: `Mira couldn't design roles right now: ${msg}` });
  }
});

api.post('/roles', (req, res) => {
  const body = z.object({
    title: z.string().trim().min(1).max(60), summary: z.string().trim().max(200),
    requirements: z.array(z.object({ skillId: z.string().optional(), name: z.string().max(60).optional(), level: z.number(), weight: z.number() })).min(3).max(8),
  }).safeParse(req.body);
  const profile = store.getProfile()!;
  const designed = body.success ? sanitizeRole(body.data, profile) : null;
  if (!designed) return res.status(400).json({ error: 'A role needs a title and at least 3 skills' });
  const userId = (res.locals.user as User).id;
  // New skill names become this learner's custom skills (with search-based resources).
  const created = designed.requirements.filter((q) => !q.skillId && q.name).map((q) => customSkill(userId, q.name!));
  const customSkills = [...(profile.customSkills ?? [])];
  for (const sk of created) if (!customSkills.some((x) => x.id === sk.id)) customSkills.push(sk);
  registerSkills(customSkills);
  const role = {
    id: `custom-${userId}-${Date.now().toString(36)}`, title: designed.title, summary: designed.summary,
    requirements: designed.requirements.map((q) => ({ skillId: q.skillId ?? customSkill(userId, q.name!).id, level: q.level, weight: q.weight })),
  };
  store.saveProfile({ ...profile, customSkills: customSkills.slice(-40), customRoles: [role, ...(profile.customRoles ?? [])].filter((r, i) => i < 6 || r.id === profile.targetRoleId) });
  registerRoles([role]);
  res.status(201).json({ role, skills: customSkills });
});

// A learner can add any skill by name; catalog matches are reused, anything else becomes a custom skill.
api.post('/skills', (req, res) => {
  const body = z.object({ name: z.string().trim().min(2).max(60) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Skill name must be 2–60 characters' });
  const profile = store.getProfile()!;
  const existing = resolveSkill(body.data.name, profile);
  if (existing) return res.json({ skill: [...SKILLS, ...(profile.customSkills ?? [])].find((s) => s.id === existing) });
  const skill = customSkill((res.locals.user as User).id, body.data.name);
  const customSkills = [...(profile.customSkills ?? []), skill].slice(-40);
  store.saveProfile({ ...profile, customSkills });
  registerSkills([skill]);
  res.status(201).json({ skill });
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
  const answered = countAnswered(def, answers);
  if (answered < def.questions.length) return res.status(400).json({ error: `Please answer all ${def.questions.length} questions (${answered} answered).` });
  if (store.activeRunId()) return res.status(409).json({ error: BUSY });

  // The answer review is shown after each attempt, so immediate retakes are rate-limited.
  const last = store.listAttempts().find((a) => a.assessmentId === def.id);
  const waitMs = last ? RETAKE_COOLDOWN_MS - (Date.now() - new Date(last.createdAt).getTime()) : 0;
  if (waitMs > 0) return res.status(429).json({ error: `Please review your feedback and practise first — you can retake this assessment in ${Math.ceil(waitMs / 60_000)} min.` });

  const before = currentSnapshot(); // Career Twin state just before this result is applied
  const t0 = Date.now();
  const g = grade(def, answers); // deterministic, against the answer key
  const profile = store.getProfile()!;
  const requiredLevel = ROLE_BY_ID[profile.targetRoleId].requirements.find((r) => r.skillId === def.skillId)?.level ?? null;
  const attempt = store.addAttempt({ assessmentId: def.id, skillId: def.skillId, ...g, diagnosis: null, createdAt: store.now() });
  store.clearRemediationProgress(def.skillId); // remediation restarts from this attempt's weak concepts
  store.addEvidence({ skillId: def.skillId, source: 'assessment', level: g.verifiedLevel, detail: `${def.title} attempt #${attempt.id}: ${g.score}%`, refId: `attempt:${attempt.id}` });
  const gradingMs = Date.now() - t0;
  try {
    res.json({ attempt, runId: startAssessmentRun(def, attempt, gradingMs, requiredLevel, before) });
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

api.get('/cohort', (req, res) => {
  const role = String(req.query.role ?? 'all');
  if (role !== 'all' && !ROLE_BY_ID[role]) return res.status(400).json({ error: 'Unknown role' });
  res.json(cohortReport(role));
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
  if (store.activeRunId()) return res.status(409).json({ error: BUSY });
  seedDemo(true, (res.locals.user as User).name);
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
  const status = (err as { status?: number }).status;
  if (status === 400) return res.status(400).json({ error: 'Malformed JSON body' });
  if (status === 413) return res.status(413).json({ error: 'Request body too large' });
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});
