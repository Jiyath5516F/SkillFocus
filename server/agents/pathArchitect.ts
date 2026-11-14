// Agent 3 — Learning Path Architect: writes personalised milestone content within deterministic slots.
import { z } from 'zod';
import { LEVEL_LABELS, ROLE_BY_ID, skillName } from '../../shared/catalog';
import type { Profile, TwinResult } from '../../shared/types';
import { structured, type LLMResult } from '../llm';
import type { Slot } from '../roadmap';

const Schema = z.object({
  milestones: z.array(z.object({
    key: z.string(), title: z.string(), reason: z.string(), resourceIds: z.array(z.string()), exercise: z.string(), effortHours: z.number(),
  })),
  changeSummary: z.string(),
});
export type PathOutput = z.infer<typeof Schema>;

const SYSTEM = `You are the Learning Path Architect Agent in Mira.
You receive an ordered list of roadmap slots (already sorted by prerequisites, with remediation placed before dependent skills).
For EVERY slot, write one milestone with the same "key":
- title: short and specific (max 10 words).
- reason: one or two sentences explaining why this is next for THIS learner (reference their background, existing skills, or assessment results when given).
- resourceIds: 1–3 IDs chosen ONLY from that slot's candidateResources.
- exercise: one concrete practical exercise or mini-project, ideally connected to the learner's interests or existing projects.
- effortHours: realistic hours, considering the learner's weekly study hours.
For remediation slots, target the specific misconception described in the assessment diagnosis.
changeSummary: 1–2 sentences describing what this roadmap version changes and why (mention the trigger).
Never invent resources, URLs, completed courses or scores.`;

export async function runPathArchitect(profile: Profile, twin: TwinResult, slots: Slot[], context: { trigger: string; diagnosis?: string | null; previousKeys?: string[] }): Promise<LLMResult<PathOutput>> {
  const input = {
    targetRole: ROLE_BY_ID[twin.roleId].title,
    learner: { background: profile.background, interests: profile.interests, weeklyHours: profile.weeklyHours, projects: profile.projects.map((p) => p.name), strengths: twin.strengths.map(skillName) },
    trigger: context.trigger,
    assessmentDiagnosis: context.diagnosis ?? null,
    previousRoadmapKeys: context.previousKeys ?? [],
    slots: slots.map((s) => ({
      key: s.key, skill: skillName(s.skillId), kind: s.kind, concept: s.conceptLabel ?? null, targetLevel: LEVEL_LABELS[s.targetLevel], priority: s.priority,
      candidateResources: s.candidates.map((c) => ({ id: c.id, title: c.title, provider: c.provider, kind: c.kind, hours: c.hours })),
    })),
  };
  return structured({ system: SYSTEM, user: JSON.stringify(input), schema: Schema, maxTokens: 12000 });
}
