// Career Matching Agent — role design: turns a free-text career aim into role profiles built from catalog skills.
import { z } from 'zod';
import { SKILLS, SKILL_BY_ID } from '../../shared/catalog';
import type { RoleRequirement, Weight } from '../../shared/types';
import { structured, type LLMResult } from '../llm';

const Schema = z.object({
  options: z.array(z.object({
    title: z.string(), summary: z.string(),
    requirements: z.array(z.object({ skillId: z.string(), level: z.number(), weight: z.number() })),
  })),
});

const SYSTEM = `You are the Career Matching Agent in Mira, designing target-role profiles from a learner's free-text career aim.
Return exactly 3 distinct, realistic role interpretations of the aim (e.g. different seniority or specialisation).
Rules:
- requirements: 4 to 8 skills chosen ONLY from the provided catalog skill IDs; pick the ones genuinely needed for the role.
- level: 1 Basic, 2 Working, 3 Proficient, 4 Advanced (entry-level roles rarely need 4).
- weight: 3 critical, 2 important, 1 nice-to-have. At least one critical skill.
- title: a concise job title (max 6 words); summary: one sentence on what the role does.
- These are illustrative benchmarks, not hiring standards. Avoid titles listed in "avoid".`;

export interface DesignedRole { title: string; summary: string; requirements: RoleRequirement[] }

export async function designRoles(aim: string, avoid: string[]): Promise<LLMResult<DesignedRole[]>> {
  const r = await structured({
    system: SYSTEM,
    user: JSON.stringify({ aim, avoid, catalogSkills: SKILLS.map((s) => ({ id: s.id, name: s.name, category: s.category })) }),
    schema: Schema,
  });
  return { ...r, data: r.data.options.map(sanitizeRole).filter((x): x is DesignedRole => x !== null).slice(0, 3) };
}

/** Keeps only catalog skills, clamps levels/weights, de-duplicates; rejects roles that end up too thin. */
export function sanitizeRole(o: { title: string; summary: string; requirements: { skillId: string; level: number; weight: number }[] }): DesignedRole | null {
  const seen = new Set<string>();
  const requirements = o.requirements
    .filter((q) => SKILL_BY_ID[q.skillId] && !seen.has(q.skillId) && seen.add(q.skillId))
    .slice(0, 8)
    .map((q) => ({ skillId: q.skillId, level: Math.min(4, Math.max(1, Math.round(q.level))), weight: Math.min(3, Math.max(1, Math.round(q.weight))) as Weight }));
  const title = o.title.trim().slice(0, 60);
  if (!title || requirements.length < 3) return null;
  return { title, summary: o.summary.trim().slice(0, 200), requirements };
}
