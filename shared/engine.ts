// Deterministic, explainable readiness engine. Pure functions — used by server and client (what-if).
import { ROLE_BY_ID, SKILL_BY_ID } from './catalog';
import type {
  Confidence,
  Evidence,
  Profile,
  RequirementResult,
  RoleDef,
  RoadmapRevision,
  RevisionDiff,
  SkillEstimate,
  TwinResult,
} from './types';

export const UNVERIFIED_FACTOR = 0.75;
export const EVIDENCE_FACTOR = 0.9;

/** Map an assessment percentage to a verified proficiency level. */
export function scoreToLevel(score: number): number {
  if (score >= 90) return 4;
  if (score >= 80) return 3;
  if (score >= 60) return 2;
  if (score >= 40) return 1;
  return 0; // under 40% demonstrates nothing yet, so a failed quiz can never raise readiness
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Effective level rules:
 *  - The latest assessment supersedes the self-report and any milestone claims made before it.
 *  - Unverified claims (self-report / completed milestones) count at ×0.75, or ×0.9 when a project/cert backs the skill.
 *  - With an assessment: effective = max(verified level, later claims × factor).
 */
export function estimateSkill(skillId: string, profile: Profile, evidence: Evidence[]): SkillEstimate {
  const ev = evidence
    .filter((e) => e.skillId === skillId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const selfLevel = profile.skills.find((s) => s.skillId === skillId)?.selfLevel ?? 0;
  const assessments = ev.filter((e) => e.source === 'assessment');
  const latestA = assessments[assessments.length - 1];
  const linked = ev.some((e) => e.source === 'project_link');
  const factor = linked ? EVIDENCE_FACTOR : UNVERIFIED_FACTOR;
  const claims = ev.filter(
    (e) =>
      e.source === 'milestone_claim' &&
      (!latestA || e.createdAt > latestA.createdAt || (e.createdAt === latestA.createdAt && e.id > latestA.id)),
  );
  const claimLevel = claims.reduce((m, e) => Math.max(m, e.level), 0);
  const sources: string[] = [];
  let effective: number;
  let confidence: Confidence;
  if (latestA) {
    effective = Math.max(latestA.level, claimLevel * factor);
    confidence = 'assessed';
    sources.push(`Assessment: verified level ${latestA.level} (${latestA.detail})`);
    if (claimLevel) sources.push(`Milestone completed after assessment: claimed level ${claimLevel} ×${factor}`);
  } else {
    const linkLevel = linked ? 1 : 0;
    const base = Math.max(selfLevel, claimLevel, linkLevel);
    effective = base * factor;
    confidence = base === 0 ? 'none' : linked ? 'evidence' : 'unverified';
    if (selfLevel) sources.push(`Self-reported level ${selfLevel}`);
    if (claimLevel) sources.push(`Milestone completed: claimed level ${claimLevel}`);
    if (linked) ev.filter((e) => e.source === 'project_link').forEach((e) => sources.push(`Evidence: ${e.detail}`));
    if (base) sources.push(`Unverified → counted at ×${factor}`);
  }
  return {
    skillId,
    selfLevel,
    claimLevel,
    verifiedLevel: latestA ? latestA.level : null,
    linked,
    effective: round1(effective),
    confidence,
    sources,
  };
}

/** Prerequisite-respecting order (Kahn), ties broken by higher impact. */
export function orderByPrereqs(skillIds: string[], impactIn: Record<string, number>): string[] {
  const set = new Set(skillIds);
  // Unlock value: a prerequisite also earns half the impact of the gaps it unblocks.
  const impact: Record<string, number> = {};
  for (const id of skillIds) {
    const unlocks = skillIds
      .filter((o) => (SKILL_BY_ID[o]?.prereqs ?? []).includes(id))
      .reduce((s, o) => s + (impactIn[o] ?? 0), 0);
    impact[id] = (impactIn[id] ?? 0) + 0.5 * unlocks;
  }
  const remaining = new Set(skillIds);
  const out: string[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((id) =>
      (SKILL_BY_ID[id]?.prereqs ?? []).every((p) => !set.has(p) || !remaining.has(p)),
    );
    const pool = ready.length ? ready : [...remaining]; // cycle guard
    pool.sort((a, b) => (impact[b] ?? 0) - (impact[a] ?? 0));
    out.push(pool[0]);
    remaining.delete(pool[0]);
  }
  return out;
}

export function computeTwin(
  profile: Profile,
  evidence: Evidence[],
  roleId: string,
  overrides: Record<string, number> = {},
): TwinResult {
  const role: RoleDef | undefined = ROLE_BY_ID[roleId];
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  const totalW = role.requirements.reduce((s, r) => s + r.weight, 0);
  const requirements: RequirementResult[] = role.requirements.map((req) => {
    const est = estimateSkill(req.skillId, profile, evidence);
    const effective = overrides[req.skillId] ?? est.effective;
    const coverage = Math.min(effective / req.level, 1);
    const impact = ((req.weight * (1 - coverage)) / totalW) * 100;
    const status = coverage >= 1 ? 'met' : effective > 0 ? 'partial' : 'missing';
    const priority =
      coverage >= 1 ? 'low' : req.weight === 3 && coverage < 0.67 ? 'high' : req.weight >= 2 ? 'medium' : 'low';
    return {
      skillId: req.skillId,
      required: req.level,
      weight: req.weight,
      selfLevel: est.selfLevel,
      effective: round1(effective),
      coverage: Math.round(coverage * 100) / 100,
      impact: round1(impact),
      status,
      priority,
      confidence: est.confidence,
      verifiedLevel: est.verifiedLevel,
    };
  });
  const readiness = round1(
    (requirements.reduce((s, r) => s + r.weight * Math.min(r.effective / r.required, 1), 0) / totalW) * 100,
  );
  const impactMap = Object.fromEntries(requirements.map((r) => [r.skillId, r.impact]));
  const orderedGaps = orderByPrereqs(
    requirements.filter((r) => r.status !== 'met').map((r) => r.skillId),
    impactMap,
  );
  const strengths = requirements
    .filter((r) => r.coverage >= 0.75)
    .sort((a, b) => b.coverage - a.coverage)
    .map((r) => r.skillId);
  return { roleId, readiness, requirements, orderedGaps, strengths };
}

/** Indices of one longest strictly increasing subsequence of `xs` (O(n²), n is small). */
function longestIncreasing(xs: number[]): number[] {
  const len = xs.map(() => 1);
  const prev = xs.map(() => -1);
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < i; j++)
      if (xs[j] < xs[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
  }
  let end = len.indexOf(Math.max(0, ...len));
  const out: number[] = [];
  while (end >= 0) {
    out.unshift(end);
    end = prev[end];
  }
  return out;
}

export function diffMilestones(prev: RoadmapRevision | null, nextKeys: string[]): RevisionDiff | null {
  if (!prev) return null;
  const prevKeys = prev.milestones.map((m) => m.key);
  const added = nextKeys.filter((k) => !prevKeys.includes(k));
  const removed = prevKeys.filter((k) => !nextKeys.includes(k));
  const commonPrev = prevKeys.filter((k) => nextKeys.includes(k));
  const commonNext = nextKeys.filter((k) => prevKeys.includes(k));
  // Items kept in relative order form the longest increasing subsequence of their previous positions;
  // only the rest actually moved (so moving one milestone reports one move, not a cascade).
  const pos = commonNext.map((k) => commonPrev.indexOf(k));
  const keep = new Set(longestIncreasing(pos).map((i) => commonNext[i]));
  const moved = commonNext.filter((k) => !keep.has(k));
  const unchanged = commonNext.filter((k) => !moved.includes(k));
  return { added, removed, moved, unchanged };
}

export interface ProofBreakdown {
  assessed: number;
  evidence: number;
  unverified: number;
  total: number;
  provenShare: number;
}

/**
 * Splits readiness points by how well they are proven (same formula as readiness):
 * points = weight × min(effective / required, 1) ÷ Σ weight × 100.
 */
export function proofBreakdown(
  requirements: Pick<RequirementResult, 'weight' | 'effective' | 'required' | 'confidence'>[],
): ProofBreakdown {
  const totalW = requirements.reduce((s, r) => s + r.weight, 0) || 1;
  const pts = { assessed: 0, evidence: 0, unverified: 0 };
  for (const r of requirements) {
    const p = ((r.weight * Math.min(r.effective / r.required, 1)) / totalW) * 100;
    if (r.confidence === 'assessed') pts.assessed += p;
    else if (r.confidence === 'evidence') pts.evidence += p;
    else pts.unverified += p;
  }
  const total = pts.assessed + pts.evidence + pts.unverified;
  return { ...pts, total, provenShare: total ? Math.round(((pts.assessed + pts.evidence) / total) * 100) : 0 };
}

export interface ForecastPoint {
  week: number;
  readiness: number;
  milestone: string | null;
}

/**
 * Readiness forecast (projection, never saved): walks the pending roadmap in order, spending the learner's
 * weekly hours, and assumes each skill reaches its required level — verified by assessment — once its last
 * pending milestone is finished. Deterministic, so the same inputs always give the same timeline.
 */
export function forecastReadiness(
  profile: Profile,
  evidence: Evidence[],
  roleId: string,
  milestones: { key: string; skillId: string; title: string; effortHours: number }[],
  doneKeys: Set<string>,
  weeklyHours: number,
): ForecastPoint[] {
  const role = ROLE_BY_ID[roleId];
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  const hours = Math.max(1, weeklyHours);
  const pending = milestones.filter((m) => !doneKeys.has(m.key));
  const lastIdx: Record<string, number> = {};
  pending.forEach((m, i) => {
    lastIdx[m.skillId] = i;
  });
  const overrides: Record<string, number> = {};
  const points: ForecastPoint[] = [
    { week: 0, readiness: computeTwin(profile, evidence, roleId).readiness, milestone: null },
  ];
  let spent = 0;
  pending.forEach((m, i) => {
    spent += m.effortHours;
    const req = role.requirements.find((r) => r.skillId === m.skillId);
    if (req && lastIdx[m.skillId] === i) overrides[m.skillId] = Math.max(req.level, overrides[m.skillId] ?? 0);
    points.push({
      week: round1(spent / hours),
      readiness: computeTwin(profile, evidence, roleId, overrides).readiness,
      milestone: m.title,
    });
  });
  return points;
}

/** First projected week at which readiness reaches `target`, or null if the roadmap never gets there. */
export const weeksToReach = (points: ForecastPoint[], target: number) =>
  points.find((p) => p.readiness >= target)?.week ?? null;

export interface RoleRanking {
  roleId: string;
  title: string;
  readiness: number;
  provenShare: number;
  topGaps: string[];
}

/** Career matching across roles: the same evidence scored against every role, best fit first. */
export function rankRoles(profile: Profile, evidence: Evidence[], roleIds: string[]): RoleRanking[] {
  return roleIds
    .filter((id) => ROLE_BY_ID[id])
    .map((id) => {
      const t = computeTwin(profile, evidence, id);
      return {
        roleId: id,
        title: ROLE_BY_ID[id].title,
        readiness: t.readiness,
        provenShare: proofBreakdown(t.requirements).provenShare,
        topGaps: t.orderedGaps.slice(0, 3),
      };
    })
    .sort((a, b) => b.readiness - a.readiness || a.title.localeCompare(b.title));
}
