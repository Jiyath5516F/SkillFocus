// Assessment routes: questions without answer keys, and deterministic grading that triggers adaptation.
import express from 'express';
import { z } from 'zod';
import { ROLE_BY_ID } from '../../shared/catalog';
import { ASSESSMENTS, ASSESSMENT_BY_ID, toPublic } from '../assessments';
import * as store from '../db';
import { countAnswered, grade } from '../grading';
import { currentSnapshot, startAssessmentRun } from '../orchestrator';
import { aiLimit, BUSY, RETAKE_COOLDOWN_MS, sendErr } from '../http';

export const assessmentRouter = express.Router();

assessmentRouter.get('/assessments', (_req, res) => res.json(ASSESSMENTS.map(toPublic)));
assessmentRouter.get('/assessments/:id', (req, res) => {
  const a = ASSESSMENT_BY_ID[String(req.params.id)];
  return a ? res.json(toPublic(a)) : res.status(404).json({ error: 'Assessment not found' });
});

assessmentRouter.post('/assessments/:id/submit', aiLimit, (req, res) => {
  const def = ASSESSMENT_BY_ID[String(req.params.id)];
  if (!def) return res.status(404).json({ error: 'Assessment not found' });
  const body = z
    .object({ answers: z.record(z.string(), z.number().int().min(0).max(9).nullable()) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid submission' });
  const answers = body.data.answers;
  const answered = countAnswered(def, answers);
  if (answered < def.questions.length)
    return res
      .status(400)
      .json({ error: `Please answer all ${def.questions.length} questions (${answered} answered).` });
  if (store.activeRunId()) return res.status(409).json({ error: BUSY });

  // The answer review is shown after each attempt, so immediate retakes are rate-limited.
  const last = store.listAttempts().find((a) => a.assessmentId === def.id);
  const waitMs = last ? RETAKE_COOLDOWN_MS - (Date.now() - new Date(last.createdAt).getTime()) : 0;
  if (waitMs > 0)
    return res.status(429).json({
      error: `Please review your feedback and practise first — you can retake this assessment in ${Math.ceil(waitMs / 60_000)} min.`,
    });

  const before = currentSnapshot(); // Career Twin state just before this result is applied
  const t0 = Date.now();
  const g = grade(def, answers); // deterministic, against the answer key
  const profile = store.getProfile()!;
  const requiredLevel =
    ROLE_BY_ID[profile.targetRoleId].requirements.find((r) => r.skillId === def.skillId)?.level ?? null;
  const attempt = store.addAttempt({
    assessmentId: def.id,
    skillId: def.skillId,
    ...g,
    diagnosis: null,
    createdAt: store.now(),
  });
  store.clearRemediationProgress(def.skillId); // remediation restarts from this attempt's weak concepts
  store.addEvidence({
    skillId: def.skillId,
    source: 'assessment',
    level: g.verifiedLevel,
    detail: `${def.title} attempt #${attempt.id}: ${g.score}%`,
    refId: `attempt:${attempt.id}`,
  });
  const gradingMs = Date.now() - t0;
  try {
    res.json({ attempt, runId: startAssessmentRun(def, attempt, gradingMs, requiredLevel, before) });
  } catch (e) {
    sendErr(res, e);
  }
});
