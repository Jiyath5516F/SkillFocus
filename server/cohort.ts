// Cohort insights for universities and employers: aggregates evidence-based gaps across learners.
// The sample cohort is clearly labelled illustrative data; the real learner is always included.
import { ROLE_BY_ID, ROLES } from '../shared/catalog';
import { computeTwin, proofBreakdown } from '../shared/engine';
import type { Evidence, Profile } from '../shared/types';
import * as store from './db';

interface SampleLearner {
  name: string;
  role: string;
  skills: Record<string, number>;
  assessed?: Record<string, number>;
}

// Illustrative sample cohort (not real people) — self-reported levels plus a few assessment-verified levels.
const SAMPLE: SampleLearner[] = [
  {
    name: 'Arjun S.',
    role: 'fullstack',
    skills: { html: 3, javascript: 2, react: 1, git: 2 },
    assessed: { javascript: 2 },
  },
  {
    name: 'Divya K.',
    role: 'fullstack',
    skills: { html: 2, javascript: 3, react: 2, nodejs: 1, sql: 2 },
    assessed: { javascript: 3 },
  },
  { name: 'Karthik R.', role: 'fullstack', skills: { python: 3, sql: 2, html: 1 } },
  {
    name: 'Meena P.',
    role: 'fullstack',
    skills: { html: 3, javascript: 2, git: 3, rest_api: 1 },
    assessed: { javascript: 1 },
  },
  { name: 'Naveen T.', role: 'data_analyst', skills: { sql: 3, excel: 3, python: 1 }, assessed: { sql: 2 } },
  { name: 'Lakshmi V.', role: 'data_analyst', skills: { excel: 3, statistics: 2, bi_tools: 2 } },
  {
    name: 'Rahul M.',
    role: 'data_analyst',
    skills: { python: 3, pandas: 2, sql: 2, data_viz: 1 },
    assessed: { sql: 3 },
  },
  { name: 'Sneha J.', role: 'data_analyst', skills: { sql: 1, excel: 2, statistics: 1 } },
  { name: 'Vignesh B.', role: 'aiml', skills: { python: 3, statistics: 2, ml: 2, git: 2 } },
  { name: 'Aisha F.', role: 'aiml', skills: { python: 3, math_ml: 3, ml: 2, deep_learning: 1 } },
  { name: 'Pranav D.', role: 'aiml', skills: { python: 2, ml: 1, llm_apps: 2 } },
  { name: 'Keerthana N.', role: 'aiml', skills: { python: 3, statistics: 3, ml: 3, mlops: 1, git: 2 } },
];

function sampleProfile(s: SampleLearner): { profile: Profile; evidence: Evidence[] } {
  const profile: Profile = {
    name: s.name,
    background: 'Sample learner',
    currentRole: 'Student',
    interests: '',
    targetRoleId: s.role,
    weeklyHours: 8,
    skills: Object.entries(s.skills).map(([skillId, selfLevel]) => ({ skillId, selfLevel })),
    certifications: [],
    projects: [],
  };
  const evidence: Evidence[] = Object.entries(s.assessed ?? {}).map(([skillId, level], i) => ({
    id: i + 1,
    skillId,
    source: 'assessment',
    level,
    detail: 'Sample assessment',
    createdAt: '2026-11-01T00:00:00.000Z',
  }));
  return { profile, evidence };
}

export interface CohortLearner {
  name: string;
  sample: boolean;
  roleId: string;
  readiness: number;
  provenShare: number;
  topGap: string | null;
  assessed: number;
}
export interface SkillPriority {
  skillId: string;
  learnersNeeding: number;
  learnersAssessedBelow: number;
  unverifiedClaims: number;
  impactPoints: number;
  action: string;
}
export interface CohortReport {
  roleId: string | 'all';
  learners: CohortLearner[];
  summary: { learners: number; avgReadiness: number; avgProvenShare: number; assessedLearners: number };
  priorities: SkillPriority[];
}

/** Deterministic training-priority analysis for a role (or all roles). */
export function cohortReport(roleFilter: string | 'all'): CohortReport {
  const people: { name: string; sample: boolean; profile: Profile; evidence: Evidence[] }[] = SAMPLE.map((s) => ({
    name: s.name,
    sample: true,
    ...sampleProfile(s),
  }));
  const me = store.getProfile();
  if (me) people.unshift({ name: `${me.name} (you)`, sample: false, profile: me, evidence: store.listEvidence() });

  const inScope = people.filter((p) => roleFilter === 'all' || p.profile.targetRoleId === roleFilter);
  const bySkill = new Map<string, SkillPriority>();
  const learners: CohortLearner[] = inScope.map((p) => {
    const twin = computeTwin(p.profile, p.evidence, p.profile.targetRoleId);
    for (const r of twin.requirements) {
      if (r.status === 'met') continue;
      const e = bySkill.get(r.skillId) ?? {
        skillId: r.skillId,
        learnersNeeding: 0,
        learnersAssessedBelow: 0,
        unverifiedClaims: 0,
        impactPoints: 0,
        action: '',
      };
      e.learnersNeeding += 1;
      e.impactPoints += r.impact;
      if (r.confidence === 'assessed') e.learnersAssessedBelow += 1;
      if (r.confidence === 'unverified' && r.selfLevel > 0) e.unverifiedClaims += 1;
      bySkill.set(r.skillId, e);
    }
    const proof = proofBreakdown(twin.requirements);
    return {
      name: p.name,
      sample: p.sample,
      roleId: p.profile.targetRoleId,
      readiness: twin.readiness,
      provenShare: proof.provenShare,
      topGap: twin.orderedGaps[0] ?? null,
      assessed: p.evidence.filter((e) => e.source === 'assessment').length,
    };
  });

  const n = Math.max(1, learners.length);
  const priorities = [...bySkill.values()]
    .map((p) => ({
      ...p,
      impactPoints: Math.round(p.impactPoints * 10) / 10,
      action:
        p.learnersNeeding / n >= 0.5
          ? 'Run a cohort-wide course or workshop'
          : p.unverifiedClaims >= p.learnersNeeding / 2
            ? 'Assess first — most claims are unverified'
            : 'Targeted mentoring for the learners affected',
    }))
    .sort((a, b) => b.impactPoints - a.impactPoints);

  return {
    roleId: roleFilter,
    learners: learners.sort((a, b) => b.readiness - a.readiness),
    summary: {
      learners: learners.length,
      avgReadiness: Math.round((learners.reduce((s, l) => s + l.readiness, 0) / n) * 10) / 10,
      avgProvenShare: Math.round(learners.reduce((s, l) => s + l.provenShare, 0) / n),
      assessedLearners: learners.filter((l) => l.assessed > 0).length,
    },
    priorities,
  };
}

export const cohortRoles = () => ROLES.map((r) => ({ id: r.id, title: ROLE_BY_ID[r.id].title }));
