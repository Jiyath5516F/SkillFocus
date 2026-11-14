// Orchestrator: coordinates specialised agents per event, records every step (LLM vs deterministic vs fallback).
import { ROLE_BY_ID, skillName } from '../shared/catalog';
import { computeTwin, diffMilestones } from '../shared/engine';
import type { AgentRun, AssessmentAttempt } from '../shared/types';
import { runAssessmentAgent } from './agents/assessmentAgent';
import { runCareerMatching, sanitizeMatching } from './agents/careerMatching';
import { mentorSummary } from './agents/mentor';
import { runPathArchitect } from './agents/pathArchitect';
import { runSkillIntelligence, validLinks } from './agents/skillIntelligence';
import type { AssessmentDef } from './assessments';
import * as store from './db';
import { describeError, MODEL, type LLMResult } from './llm';
import { assemble, buildSlots } from './roadmap';
import { mentorSnapshot } from './state';

export class BusyError extends Error {}

const clip = (s: string, n = 280) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

class RunCtx {
  usedFallback = false;
  constructor(public runId: number) {}

  det<T>(agent: string, input: string, fn: () => T, out: (t: T) => string): T {
    const t0 = Date.now();
    const id = store.startStep(this.runId, agent, 'deterministic', null, clip(input));
    try {
      const r = fn();
      store.endStep(id, { status: 'completed', durationMs: Date.now() - t0, outputSummary: clip(out(r)) });
      return r;
    } catch (e) {
      store.endStep(id, { status: 'failed', durationMs: Date.now() - t0, error: describeError(e) });
      throw e;
    }
  }

  async llm<T>(agent: string, input: string, fn: () => Promise<LLMResult<T>>, out: (t: T) => string): Promise<T | null> {
    const t0 = Date.now();
    const id = store.startStep(this.runId, agent, 'llm', MODEL, clip(input));
    try {
      const r = await fn();
      store.endStep(id, { status: 'completed', durationMs: Date.now() - t0, outputSummary: clip(out(r.data)), tokensIn: r.tokensIn, tokensOut: r.tokensOut });
      return r.data;
    } catch (e) {
      this.usedFallback = true;
      store.endStep(id, { status: 'failed', durationMs: Date.now() - t0, error: describeError(e) });
      return null;
    }
  }

  fallback(agent: string, input: string, output: string) {
    const id = store.startStep(this.runId, agent, 'fallback', null, clip(input));
    store.endStep(id, { status: 'completed', durationMs: 0, outputSummary: clip(output) });
  }
}

function launch(trigger: string, work: (ctx: RunCtx) => Promise<void>): number {
  if (store.activeRunId()) throw new BusyError('Agents are already working on a previous request. Please wait for it to finish.');
  const runId = store.createRun(trigger);
  const ctx = new RunCtx(runId);
  work(ctx)
    .then(() => store.finishRun(runId, ctx.usedFallback ? 'completed_with_fallback' : 'completed'))
    .catch((e) => {
      console.error(`[run ${runId}] failed:`, describeError(e));
      store.finishRun(runId, 'failed');
    });
  return runId;
}

interface PlanOpts { trigger: string; skillIntel: 'full' | 'reassess' | 'none'; diagnosis?: string | null; event: string }

async function planFlow(ctx: RunCtx, o: PlanOpts) {
  let profile = store.getProfile()!;
  const attempts = store.listAttempts();

  // 1) Skill Intelligence Agent
  if (o.skillIntel !== 'none') {
    const intel = await ctx.llm('Skill Intelligence', `${profile.skills.length} self-reported skills, ${profile.certifications.length} certifications, ${profile.projects.length} projects, ${attempts.length} assessment attempts`,
      () => runSkillIntelligence(profile, attempts),
      (d) => `${d.links.length} evidence links proposed · strengths: ${d.strengths.slice(0, 2).join('; ')}`);
    if (intel) {
      if (o.skillIntel === 'full') {
        const links = validLinks(intel, profile);
        store.deleteEvidence('project_link');
        for (const l of links) store.addEvidence({ skillId: l.skillId, source: 'project_link', level: 1, detail: `${l.evidenceName} — ${l.reason}`.slice(0, 240), refId: l.evidenceName });
      }
      store.setLearnerJson('insights', { strengths: intel.strengths.slice(0, 4), weaknesses: intel.weaknesses.slice(0, 4), uncertainties: intel.uncertainties.slice(0, 3), summary: intel.summary });
    } else {
      ctx.fallback('Skill Intelligence', 'AI unavailable', 'Kept existing evidence links; skill estimates use self-reports and assessments only.');
    }
  }

  // 2) Career Matching — deterministic engine
  profile = store.getProfile()!;
  const twin = ctx.det('Career Matching', `Role: ${ROLE_BY_ID[profile.targetRoleId].title} · explicit weighted requirements`,
    () => computeTwin(profile, store.listEvidence(), profile.targetRoleId),
    (t) => `Readiness estimate ${t.readiness}% · gaps (prereq order): ${t.orderedGaps.map(skillName).join(' → ') || 'none'}`);

  // 3) Learning Path Architect — deterministic slot ordering (prerequisites + remediation placement)
  const slots = ctx.det('Learning Path Architect', `Order ${twin.orderedGaps.length} gaps by prerequisites; place remediation from latest assessments`,
    () => buildSlots(twin, attempts),
    (s) => `${s.length} slots: ${s.map((x) => x.key).join(', ')}`);
  const prev = store.latestRevision(profile.targetRoleId);

  // 4) Career Matching explanation ‖ Path Architect content (independent → parallel)
  const [matching, path] = await Promise.all([
    ctx.llm('Career Matching', `Explain ${twin.orderedGaps.length} gaps at readiness ${twin.readiness}%`, () => runCareerMatching(profile, twin), (d) => d.headline),
    ctx.llm('Learning Path Architect', `${slots.length} slots · trigger: ${o.trigger}${o.diagnosis ? ' · with assessment diagnosis' : ''}`,
      () => runPathArchitect(profile, twin, slots, { trigger: o.trigger, diagnosis: o.diagnosis, previousKeys: prev?.milestones.map((m) => m.key) }),
      (d) => `${d.milestones.length} milestones · ${d.changeSummary}`),
  ]);
  if (matching) store.setLearnerJson('matching', sanitizeMatching(matching, twin));
  else {
    ctx.fallback('Career Matching', 'AI unavailable', 'Rule-based critical path from impact and prerequisites.');
    store.setLearnerJson('matching', { headline: `Readiness estimate ${twin.readiness}% for ${ROLE_BY_ID[twin.roleId].title} (rule-based).`, criticalPath: twin.orderedGaps.slice(0, 3), notes: [] });
  }
  if (!path) ctx.fallback('Learning Path Architect', 'AI unavailable', 'Rule-based milestones from curated catalog templates.');

  // 5) Persist a new roadmap revision (history is never overwritten)
  const milestones = assemble(slots, path?.milestones ?? null);
  const diff = diffMilestones(prev, milestones.map((m) => m.key));
  const rev = ctx.det('Learning Path Architect', `Save roadmap revision for ${ROLE_BY_ID[profile.targetRoleId].title}`, () => store.addRevision({
    roleId: profile.targetRoleId,
    version: (prev?.version ?? 0) + 1,
    trigger: o.trigger,
    milestones,
    snapshot: { readiness: twin.readiness, levels: Object.fromEntries(twin.requirements.map((r) => [r.skillId, r.effective])) },
    previous: prev?.snapshot ?? null,
    diff,
    changeSummary: path?.changeSummary?.slice(0, 400) ?? `Rule-based roadmap (${o.trigger}).${diff ? ` Added ${diff.added.length}, removed ${diff.removed.length}.` : ''}`,
    createdAt: store.now(),
  }), (r) => `Roadmap v${r.version}${r.diff ? ` · +${r.diff.added.length} added, −${r.diff.removed.length} removed, ${r.diff.moved.length} moved` : ' · first version'}`);

  // 6) Mira summarises what changed
  const summary = await ctx.llm('Mira (Mentor)', o.event, () => mentorSummary(mentorSnapshot(), `${o.event} Roadmap is now v${rev.version}.`), (d) => d);
  if (summary) store.addMessage('assistant', 'summary', summary);
}

export function startAnalyze(trigger: 'analyze' | 'profile_updated'): number {
  return launch(trigger, (ctx) => planFlow(ctx, {
    trigger: trigger === 'analyze' ? 'Skill analysis requested' : 'Profile updated', skillIntel: 'full',
    event: trigger === 'analyze' ? 'The learner ran a full skill analysis.' : 'The learner updated their profile.',
  }));
}

export function startGoalChange(fromRole: string, toRole: string): number {
  return launch('goal_change', (ctx) => planFlow(ctx, {
    trigger: `Career goal changed: ${ROLE_BY_ID[fromRole]?.title ?? fromRole} → ${ROLE_BY_ID[toRole].title}`, skillIntel: 'none',
    event: `The learner changed their career goal from ${ROLE_BY_ID[fromRole]?.title ?? fromRole} to ${ROLE_BY_ID[toRole].title}. Earlier history is preserved.`,
  }));
}

export function startAssessmentRun(def: AssessmentDef, attempt: AssessmentAttempt, gradingMs: number, requiredLevel: number): number {
  return launch('assessment', async (ctx) => {
    const sid = store.startStep(ctx.runId, 'Assessment & Progress', 'deterministic', null, `Grade ${attempt.total} answers against the answer key`);
    store.endStep(sid, { status: 'completed', durationMs: gradingMs, outputSummary: `Score ${attempt.score}% (${attempt.correct}/${attempt.total}) → verified level ${attempt.verifiedLevel} (role needs ${requiredLevel}) · weak: ${attempt.weakConcepts.join(', ') || 'none'}` });

    const diag = await ctx.llm('Assessment & Progress', `${def.title}: ${attempt.correct}/${attempt.total}, weak concepts: ${attempt.weakConcepts.join(', ') || 'none'}`,
      () => runAssessmentAgent(def, attempt, requiredLevel), (d) => d.focus);
    const adapt = attempt.verifiedLevel < requiredLevel;
    if (diag) {
      const conceptNotes = diag.concepts.filter((c) => attempt.weakConcepts.includes(c.concept)).map((c) => `${def.concepts[c.concept]}: ${c.misconception} Tip: ${c.advice}`);
      store.updateAttempt({ ...attempt, diagnosis: [diag.diagnosis, ...conceptNotes].join('\n') });
    }
    await planFlow(ctx, {
      trigger: adapt
        ? `Assessment #${attempt.id} (${def.title}) scored ${attempt.score}% — below the required level; targeted remediation added`
        : `Assessment #${attempt.id} (${def.title}) scored ${attempt.score}% — skill verified`,
      skillIntel: 'reassess',
      diagnosis: diag ? `${diag.diagnosis} Focus: ${diag.focus}` : `Weak concepts: ${attempt.weakConcepts.join(', ')}`,
      event: `The learner completed the ${def.title} assessment: ${attempt.correct}/${attempt.total} (${attempt.score}%), verified level ${attempt.verifiedLevel} vs required ${requiredLevel}. Weak concepts: ${attempt.weakConcepts.join(', ') || 'none'}.`,
    });
  });
}

export type { AgentRun };
