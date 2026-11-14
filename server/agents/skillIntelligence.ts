// Agent 1 — Skill Intelligence: links certifications/projects to skills as evidence; strengths, weaknesses, uncertainty.
import { z } from 'zod';
import { SKILLS, SKILL_BY_ID } from '../../shared/catalog';
import type { AssessmentAttempt, Profile } from '../../shared/types';
import { structured, type LLMResult } from '../llm';

const Schema = z.object({
  links: z.array(z.object({ skillId: z.string(), evidenceName: z.string(), reason: z.string() })),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  uncertainties: z.array(z.string()),
  summary: z.string(),
});
export type SkillIntelOutput = z.infer<typeof Schema>;

const SYSTEM = `You are the Skill Intelligence Agent in Mira, a career-learning platform.
Your job: build an honest picture of a learner's skills from their profile, certifications, projects and assessment results.
Rules:
- Self-reported levels are claims, not verified expertise. Say so when relevant.
- "links": only link a certification or project to a skill when its name/description clearly demonstrates that skill. evidenceName must be the exact name of the certification or project. skillId must be one of the provided catalog IDs.
- Assessment results outrank self-reports and claims.
- strengths/weaknesses/uncertainties: at most 4 short items each (one sentence each), specific to this learner.
- summary: 2 sentences, plain language, addressed to the learner as "you".
- Never invent certifications, projects, scores or experience that are not in the input.`;

export async function runSkillIntelligence(profile: Profile, attempts: AssessmentAttempt[]): Promise<LLMResult<SkillIntelOutput>> {
  const input = {
    catalogSkillIds: SKILLS.map((s) => ({ id: s.id, name: s.name })),
    learner: {
      background: profile.background, currentRole: profile.currentRole, interests: profile.interests,
      selfReportedSkills: profile.skills.map((s) => ({ skill: SKILL_BY_ID[s.skillId]?.name ?? s.skillId, skillId: s.skillId, selfLevel: s.selfLevel })),
      certifications: profile.certifications, projects: profile.projects,
    },
    assessmentHistory: attempts.slice(0, 5).map((a) => ({ skillId: a.skillId, scorePercent: a.score, verifiedLevel: a.verifiedLevel, weakConcepts: a.weakConcepts, date: a.createdAt })),
    levelScale: '0 None, 1 Basic, 2 Working, 3 Proficient, 4 Advanced',
  };
  return structured({ system: SYSTEM, user: `Analyze this learner:\n${JSON.stringify(input)}`, schema: Schema });
}

/** Keep only links whose skill exists and whose evidence name matches a real certification/project. */
export function validLinks(out: SkillIntelOutput, profile: Profile) {
  const names = [...profile.certifications.map((c) => c.name), ...profile.projects.map((p) => p.name)].map((n) => n.toLowerCase().trim());
  const seen = new Set<string>();
  return out.links.filter((l) => {
    const key = `${l.skillId}|${l.evidenceName.toLowerCase().trim()}`;
    if (!SKILL_BY_ID[l.skillId] || !names.includes(l.evidenceName.toLowerCase().trim()) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}
