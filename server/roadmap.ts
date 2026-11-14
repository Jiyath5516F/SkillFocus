// Deterministic roadmap structure: slot order (prerequisites + remediation placement), templates, assembly.
import { orderByPrereqs } from '../shared/engine';
import { LEVEL_LABELS, ROLE_BY_ID, SKILL_BY_ID, resourcesForSkill, skillName } from '../shared/catalog';
import type {
  AssessmentAttempt,
  Milestone,
  MilestoneKind,
  RequirementResult,
  Resource,
  TwinResult,
} from '../shared/types';
import { ASSESSMENTS } from './assessments';

export interface Slot {
  key: string;
  skillId: string;
  kind: MilestoneKind;
  concept?: string;
  conceptLabel?: string;
  targetLevel: number;
  prerequisites: string[];
  candidates: Resource[];
  impact: number;
  priority: RequirementResult['priority'];
}

export function conceptLabel(skillId: string, concept: string): string {
  return ASSESSMENTS.find((a) => a.skillId === skillId)?.concepts[concept] ?? concept;
}

/** Weak concepts from the latest attempt per skill (only if that skill is still a gap). */
export function latestWeakConcepts(attempts: AssessmentAttempt[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of [...attempts].sort((x, y) => x.id - y.id)) out[a.skillId] = a.weakConcepts;
  return out;
}

/**
 * Roadmap slots in prerequisite order. When the Career Matching Agent supplies a critical path, its priorities decide
 * the order among skills that are ready to learn; prerequisites are always enforced.
 */
export function buildSlots(twin: TwinResult, attempts: AssessmentAttempt[], criticalPath: string[] = []): Slot[] {
  const role = ROLE_BY_ID[twin.roleId];
  const weak = latestWeakConcepts(attempts);
  const gapSet = new Set(twin.orderedGaps);
  const priority: Record<string, number> = Object.fromEntries(twin.requirements.map((r) => [r.skillId, r.impact]));
  criticalPath.forEach((id, i) => {
    if (gapSet.has(id)) priority[id] = 1000 - i;
  });
  const order = criticalPath.length ? orderByPrereqs(twin.orderedGaps, priority) : twin.orderedGaps;
  const slots: Slot[] = [];
  for (const skillId of order) {
    const req = twin.requirements.find((r) => r.skillId === skillId)!;
    const resources = resourcesForSkill(skillId);
    const prereqs = (SKILL_BY_ID[skillId]?.prereqs ?? []).filter((p) => role.requirements.some((r) => r.skillId === p));
    slots.push({
      key: `learn:${skillId}`,
      skillId,
      kind: 'learn',
      targetLevel: req.required,
      prerequisites: prereqs,
      candidates: resources.filter((r) => !r.concepts),
      impact: req.impact,
      priority: req.priority,
    });
    // Targeted remediation goes right after the skill's learn milestone — i.e. before anything that depends on it.
    if (gapSet.has(skillId)) {
      for (const concept of weak[skillId] ?? []) {
        const specific = resources.filter((r) => r.concepts?.includes(concept));
        slots.push({
          key: `fix:${skillId}:${concept}`,
          skillId,
          kind: 'remediation',
          concept,
          conceptLabel: conceptLabel(skillId, concept),
          targetLevel: req.required,
          prerequisites: [skillId],
          candidates: specific.length ? specific : resources,
          impact: req.impact,
          priority: 'high',
        });
      }
    }
  }
  return slots;
}

export function templateMilestone(s: Slot): Milestone {
  const chosen = s.candidates.slice(0, 2);
  const name = skillName(s.skillId);
  return {
    key: s.key,
    skillId: s.skillId,
    kind: s.kind,
    concept: s.concept,
    title:
      s.kind === 'learn'
        ? `${name}: reach ${LEVEL_LABELS[s.targetLevel]} level`
        : `Remediate ${name}: ${s.conceptLabel}`,
    reason:
      s.kind === 'learn'
        ? `${s.priority[0].toUpperCase()}${s.priority.slice(1)} priority — mastering it adds up to ${s.impact} readiness points.`
        : `Your latest ${name} assessment showed a gap in ${s.conceptLabel}.`,
    prerequisites: s.prerequisites,
    resourceIds: chosen.map((r) => r.id),
    exercise:
      s.kind === 'learn'
        ? (SKILL_BY_ID[s.skillId]?.defaultExercise ?? 'Build a small project using this skill.')
        : `Write 3 small snippets that exercise ${s.conceptLabel}, predict their output, then verify by running them.`,
    effortHours: Math.max(
      1,
      Math.min(
        40,
        chosen.reduce((h, r) => h + r.hours, 0),
      ),
    ),
    targetLevel: s.targetLevel,
    authoredBy: 'rule-based',
  };
}

export interface AIMilestone {
  key: string;
  title: string;
  reason: string;
  resourceIds: string[];
  exercise: string;
  effortHours: number;
}

/** Merge AI-authored content into the deterministic slot order; reject anything outside the slot's candidate set. */
export function assemble(slots: Slot[], ai: AIMilestone[] | null): Milestone[] {
  const byKey = new Map((ai ?? []).map((m) => [m.key, m]));
  return slots.map((s) => {
    const base = templateMilestone(s);
    const m = byKey.get(s.key);
    if (!m) return base;
    const allowed = new Set(s.candidates.map((c) => c.id));
    const ids = [...new Set(m.resourceIds.filter((id) => allowed.has(id)))].slice(0, 3);
    return {
      ...base,
      title: m.title.trim().slice(0, 120) || base.title,
      reason: m.reason.trim().slice(0, 400) || base.reason,
      resourceIds: ids.length ? ids : base.resourceIds,
      exercise: m.exercise.trim().slice(0, 500) || base.exercise,
      effortHours: Number.isFinite(m.effortHours)
        ? Math.max(1, Math.min(80, Math.round(m.effortHours)))
        : base.effortHours,
      authoredBy: 'ai',
    };
  });
}
