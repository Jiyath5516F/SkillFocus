// Agent 2 — Career Matching: explains the deterministic gap analysis and prioritises the critical path.
import { z } from 'zod';
import { ROLE_BY_ID, skillName } from '../../shared/catalog';
import type { Profile, TwinResult } from '../../shared/types';
import { structured, type LLMResult } from '../llm';

const Schema = z.object({
  headline: z.string(),
  criticalPath: z.array(z.string()),
  notes: z.array(z.object({ skillId: z.string(), note: z.string() })),
});
export type MatchingOutput = z.infer<typeof Schema>;

const SYSTEM = `You are the Career Matching Agent in Mira.
You receive a deterministic gap analysis (readiness estimate, coverage, impact) for a learner against a target role.
Rules:
- Do NOT produce or change any numbers or percentages; refer to the provided ones only.
- headline: one sentence on where the learner stands for this role.
- criticalPath: ordered skillIds (only from the provided gap list) that unlock the most progress, respecting prerequisites.
- notes: for each gap skill, one sentence on why it matters for this role and how it connects to the learner's existing skills or interests.
- The readiness value is an estimate, never a hiring probability.`;

export async function runCareerMatching(profile: Profile, twin: TwinResult): Promise<LLMResult<MatchingOutput>> {
  const role = ROLE_BY_ID[twin.roleId];
  const input = {
    role: { title: role.title, summary: role.summary },
    learner: { background: profile.background, interests: profile.interests },
    readinessEstimate: twin.readiness,
    requirements: twin.requirements.map((r) => ({ skillId: r.skillId, skill: skillName(r.skillId), required: r.required, effective: r.effective, status: r.status, impactPoints: r.impact, confidence: r.confidence })),
    gapsInPrerequisiteOrder: twin.orderedGaps,
  };
  return structured({ system: SYSTEM, user: JSON.stringify(input), schema: Schema });
}

export function sanitizeMatching(out: MatchingOutput, twin: TwinResult): MatchingOutput {
  const gaps = new Set(twin.orderedGaps);
  const reqs = new Set(twin.requirements.map((r) => r.skillId));
  return {
    headline: out.headline.slice(0, 300),
    criticalPath: [...new Set(out.criticalPath.filter((s) => gaps.has(s)))],
    notes: out.notes.filter((n) => reqs.has(n.skillId)).map((n) => ({ skillId: n.skillId, note: n.note.slice(0, 300) })),
  };
}
