// Learner routes: profile, goals, custom aims and skills, roadmap progress, mentor, cohort and agent runs.
import express from 'express';
import { z } from 'zod';
import { ROLES, ROLE_BY_ID, SKILLS, customSkill, registerRoles, registerSkills } from '../../shared/catalog';
import type { MilestoneStatus } from '../../shared/types';
import { mentorReply } from '../agents/mentor';
import { designRoles, resolveSkill, sanitizeRole } from '../agents/roleDesigner';
import { type User } from '../auth';
import { cohortReport } from '../cohort';
import { ASSESSMENTS, toSummary } from '../assessments';
import * as store from '../db';
import { describeError } from '../llm';
import { BusyError, recordSingleStep, startAnalyze, startGoalChange } from '../orchestrator';
import { seedDemo } from '../seed';
import { buildState, mentorSnapshot } from '../state';
import { aiLimit, BUSY, sendErr } from '../http';

export const learnerRouter = express.Router();

learnerRouter.get('/meta', (_req, res) =>
  res.json({
    roles: ROLES,
    skills: SKILLS,
    assessments: ASSESSMENTS.map(toSummary),
  }),
);
learnerRouter.get('/state', (_req, res) => res.json(buildState()));

const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  background: z.string().trim().max(200),
  currentRole: z.string().trim().max(100),
  skills: z.array(z.object({ skillId: z.string(), selfLevel: z.number().int().min(0).max(4) })).max(30),
  certifications: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        issuer: z.string().trim().max(80),
        year: z.number().int().min(1990).max(2100).optional(),
      }),
    )
    .max(20),
  projects: z
    .array(z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500) }))
    .max(20),
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

learnerRouter.put('/profile', aiLimit, (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: 'Invalid profile',
      details: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
    });
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
  } catch (e) {
    sendErr(res, e);
  }
});

learnerRouter.post('/analyze', aiLimit, (_req, res) => {
  try {
    res.json({ runId: startAnalyze('analyze') });
  } catch (e) {
    sendErr(res, e);
  }
});

learnerRouter.post('/goal', aiLimit, (req, res) => {
  const roleId = z.object({ roleId: z.string() }).safeParse(req.body);
  if (!roleId.success || !roleAllowed(roleId.data.roleId))
    return res.status(400).json({ error: 'Unknown career goal' });
  const profile = store.getProfile()!;
  if (profile.targetRoleId === roleId.data.roleId)
    return res.status(400).json({ error: 'That is already your current goal' });
  try {
    if (store.activeRunId()) throw new BusyError(BUSY);
    const from = profile.targetRoleId;
    store.saveProfile({ ...profile, targetRoleId: roleId.data.roleId });
    res.json({ runId: startGoalChange(from, roleId.data.roleId) });
  } catch (e) {
    sendErr(res, e);
  }
});

// ---- Custom career aims designed with Mira ----
learnerRouter.post('/roles/suggest', aiLimit, async (req, res) => {
  const body = z
    .object({ aim: z.string().trim().min(3).max(160), avoid: z.array(z.string().max(80)).max(12).optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Describe your aim in 3–160 characters' });
  try {
    const options = await recordSingleStep(
      'role_design',
      'Career Matching',
      `Design role profiles for aim: "${body.data.aim.slice(0, 120)}"`,
      () => designRoles(body.data.aim, body.data.avoid ?? [], store.getProfile()),
      (d) => d.map((o) => `${o.title} (${o.requirements.length} skills)`).join(' · '),
    );
    res.json({ options });
  } catch (e) {
    res.status(502).json({ error: `Mira couldn't design roles right now: ${describeError(e)}` });
  }
});

learnerRouter.post('/roles', (req, res) => {
  const body = z
    .object({
      title: z.string().trim().min(1).max(60),
      summary: z.string().trim().max(200),
      requirements: z
        .array(
          z.object({
            skillId: z.string().optional(),
            name: z.string().max(60).optional(),
            level: z.number(),
            weight: z.number(),
          }),
        )
        .min(3)
        .max(8),
    })
    .safeParse(req.body);
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
    id: `custom-${userId}-${Date.now().toString(36)}`,
    title: designed.title,
    summary: designed.summary,
    requirements: designed.requirements.map((q) => ({
      skillId: q.skillId ?? customSkill(userId, q.name!).id,
      level: q.level,
      weight: q.weight,
    })),
  };
  store.saveProfile({
    ...profile,
    customSkills: customSkills.slice(-40),
    customRoles: [role, ...(profile.customRoles ?? [])].filter((r, i) => i < 6 || r.id === profile.targetRoleId),
  });
  registerRoles([role]);
  res.status(201).json({ role, skills: customSkills });
});

// A learner can add any skill by name; catalog matches are reused, anything else becomes a custom skill.
learnerRouter.post('/skills', (req, res) => {
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

learnerRouter.patch('/milestones/:key', (req, res) => {
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
    store.addEvidence({
      skillId: m.skillId,
      source: 'milestone_claim',
      level: m.targetLevel,
      detail: `Completed milestone "${m.title}" (not yet assessed)`,
      refId: `milestone:${key}`,
    });
  }
  res.json(buildState());
});

learnerRouter.get('/cohort', (req, res) => {
  const role = String(req.query.role ?? 'all');
  if (role !== 'all' && !ROLE_BY_ID[role]) return res.status(400).json({ error: 'Unknown role' });
  res.json(cohortReport(role));
});

learnerRouter.get('/runs', (_req, res) => res.json(store.listRuns(15)));
learnerRouter.get('/runs/:id', (req, res) => {
  const run = store.getRun(Number(req.params.id));
  return run ? res.json(run) : res.status(404).json({ error: 'Run not found' });
});

learnerRouter.get('/mentor', (_req, res) => res.json(store.listMessages(60)));
learnerRouter.post('/mentor', aiLimit, async (req, res) => {
  const body = z.object({ message: z.string().trim().min(1).max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Message must be 1–1000 characters' });
  store.addMessage('user', 'chat', body.data.message);
  const history = store
    .listMessages(12)
    .filter((m) => m.kind === 'chat')
    .map((m) => ({ role: m.role, content: m.content }));
  while (history.length && history[0].role !== 'user') history.shift();
  try {
    const reply = await recordSingleStep(
      'mentor_question',
      'Mira (Mentor)',
      `Question: ${body.data.message.slice(0, 200)}`,
      () => mentorReply(mentorSnapshot(), history),
      (d) => d,
    );
    store.addMessage('assistant', 'chat', reply);
    res.json(store.listMessages(60));
  } catch (e) {
    res.status(502).json({ error: `Mira could not answer: ${describeError(e)}` });
  }
});

learnerRouter.post('/demo/reset', (_req, res) => {
  if (store.activeRunId()) return res.status(409).json({ error: BUSY });
  seedDemo(true, (res.locals.user as User).name);
  res.json(buildState());
});
