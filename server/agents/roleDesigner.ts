// Career Matching Agent — role design: turns a free-text career aim into role profiles.
// Catalog skills are preferred; when the domain needs skills outside the catalog (e.g. "PCB layout"),
// the agent may name new ones, which become the learner's custom skills when they pick the role.
import { z } from 'zod';
import { SKILLS } from '../../shared/catalog';
import type { Profile, Weight } from '../../shared/types';
import { structured, type LLMResult } from '../llm';

const Schema = z.object({
  options: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      requirements: z.array(z.object({ skill: z.string(), level: z.number(), weight: z.number() })),
    }),
  ),
});

const SYSTEM = `You are the Career Matching Agent in Mira, designing target-role profiles from a learner's free-text career aim.
Return exactly 3 distinct, realistic role interpretations of the aim (e.g. different seniority or specialisation).
Rules:
- requirements: 4 to 8 skills that the role genuinely needs. For each, "skill" is EITHER a catalog skill id (preferred when it truly applies)
  OR a short new skill name (max 4 words, e.g. "PCB layout", "KiCad", "Circuit design") when the domain needs something the catalog lacks.
  Do not force software/data skills onto non-software roles.
- level: 1 Basic, 2 Working, 3 Proficient, 4 Advanced (entry-level roles rarely need 4).
- weight: 3 critical, 2 important, 1 nice-to-have. At least one critical skill.
- title: a concise job title (max 6 words); summary: one sentence on what the role does.
- These are illustrative benchmarks, not hiring standards. Avoid titles listed in "avoid".`;

/** A requirement either references a known skill id, or names a new skill to be created on selection. */
export interface DesignedRequirement {
  skillId?: string;
  name?: string;
  level: number;
  weight: Weight;
}
export interface DesignedRole {
  title: string;
  summary: string;
  requirements: DesignedRequirement[];
}

/** Resolves a skill id or name against the built-in catalog and this learner's own custom skills only. */
export function resolveSkill(idOrName: string, profile: Profile | null): string | null {
  const k = idOrName.trim().toLowerCase();
  const pool = [...SKILLS, ...(profile?.customSkills ?? [])];
  return pool.find((s) => s.id === idOrName || s.id === k || s.name.toLowerCase() === k)?.id ?? null;
}

export async function designRoles(
  aim: string,
  avoid: string[],
  profile: Profile | null,
): Promise<LLMResult<DesignedRole[]>> {
  const catalog = [...SKILLS, ...(profile?.customSkills ?? [])].map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
  }));
  const r = await structured({
    system: SYSTEM,
    user: JSON.stringify({ aim, avoid, catalogSkills: catalog }),
    schema: Schema,
  });
  const options = r.data.options.map((o) =>
    sanitizeRole(
      {
        title: o.title,
        summary: o.summary,
        requirements: o.requirements.map((q) => ({ name: q.skill, level: q.level, weight: q.weight })),
      },
      profile,
    ),
  );
  return { ...r, data: options.filter((x): x is DesignedRole => x !== null).slice(0, 3) };
}

/**
 * Normalises a role: known skills become ids, other names stay as new-skill names (max 6), levels/weights are clamped,
 * duplicates removed. Explicit skillIds must be known skills. Rejects roles with fewer than 3 requirements.
 */
export function sanitizeRole(
  o: {
    title: string;
    summary: string;
    requirements: { skillId?: string; name?: string; level: number; weight: number }[];
  },
  profile: Profile | null,
): DesignedRole | null {
  const seen = new Set<string>();
  let newCount = 0;
  const requirements: DesignedRequirement[] = [];
  for (const q of o.requirements) {
    const level = Math.min(4, Math.max(1, Math.round(q.level || 1)));
    const weight = Math.min(3, Math.max(1, Math.round(q.weight || 1))) as Weight;
    const known = q.skillId ? resolveSkill(q.skillId, profile) : q.name ? resolveSkill(q.name, profile) : null;
    if (known) {
      if (seen.has(known)) continue;
      seen.add(known);
      requirements.push({ skillId: known, level, weight });
    } else if (!q.skillId && q.name) {
      const name = q.name.trim().replace(/\s+/g, ' ').slice(0, 40);
      const key = name.toLowerCase();
      if (name.length < 2 || seen.has(key) || newCount >= 6) continue;
      seen.add(key);
      newCount++;
      requirements.push({ name, level, weight });
    }
    if (requirements.length >= 8) break;
  }
  const title = o.title.trim().slice(0, 60);
  if (!title || requirements.length < 3) return null;
  return { title, summary: o.summary.trim().slice(0, 200), requirements };
}
