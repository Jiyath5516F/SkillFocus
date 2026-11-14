// Builds the client state and the grounded mentor snapshot from persisted data.
import { computeTwin, forecastReadiness, weeksToReach } from '../shared/engine';
import { ROLES, ROLE_BY_ID, skillName } from '../shared/catalog';
import type { AppState } from '../shared/types';
import * as store from './db';
import { aiConfigured } from './llm';

export function buildState(): AppState {
  const profile = store.getProfile();
  if (!profile) throw new Error('No learner profile');
  const evidence = store.listEvidence();
  const twin = computeTwin(profile, evidence, profile.targetRoleId);
  const revisions = store.listRevisions();
  return {
    profile, evidence, twin,
    roadmap: revisions.find((r) => r.roleId === profile.targetRoleId) ?? null,
    revisions,
    progress: store.listProgress(),
    attempts: store.listAttempts(),
    insights: store.getLearnerJson('insights') as AppState['insights'],
    matching: store.getLearnerJson('matching') as AppState['matching'],
    aiConfigured,
    activeRunId: store.activeRunId(),
  };
}

export function mentorSnapshot() {
  const s = buildState();
  const role = ROLE_BY_ID[s.profile.targetRoleId];
  const prevForRole = s.revisions.filter((r) => r.roleId === s.profile.targetRoleId);
  return {
    learner: { name: s.profile.name, background: s.profile.background, interests: s.profile.interests, weeklyHours: s.profile.weeklyHours, certifications: s.profile.certifications, projects: s.profile.projects },
    targetRole: role.title,
    readinessEstimate: s.twin.readiness,
    skills: s.twin.requirements.map((r) => ({ skill: skillName(r.skillId), required: r.required, effectiveLevel: r.effective, selfReported: r.selfLevel, verifiedLevel: r.verifiedLevel, confidence: r.confidence, status: r.status, impactPoints: r.impact, priority: r.priority })),
    gapOrder: s.twin.orderedGaps.map(skillName),
    insights: s.insights,
    matching: s.matching,
    currentRoadmap: s.roadmap && {
      version: s.roadmap.version, trigger: s.roadmap.trigger, changeSummary: s.roadmap.changeSummary,
      readinessAfterThisChange: s.roadmap.snapshot.readiness, readinessBeforeThisChange: s.roadmap.previous?.readiness ?? null, skillLevelsBefore: s.roadmap.previous?.levels ?? null, diff: s.roadmap.diff,
      milestones: s.roadmap.milestones.map((m) => ({ key: m.key, title: m.title, kind: m.kind, status: s.progress[m.key]?.status ?? 'todo', reason: m.reason })),
    },
    previousRoadmapVersions: prevForRole.slice(1, 4).map((r) => ({ version: r.version, trigger: r.trigger, readiness: r.snapshot.readiness, milestoneKeys: r.milestones.map((m) => m.key) })),
    otherRoleHistory: s.revisions.filter((r) => r.roleId !== s.profile.targetRoleId).slice(0, 3).map((r) => ({ role: ROLE_BY_ID[r.roleId]?.title, version: r.version, readiness: r.snapshot.readiness })),
    assessmentAttempts: s.attempts.slice(0, 4).map((a) => ({ id: a.id, skill: skillName(a.skillId), scorePercent: a.score, correct: a.correct, total: a.total, verifiedLevel: a.verifiedLevel, weakConcepts: a.weakConcepts, diagnosis: a.diagnosis, date: a.createdAt })),
    readinessForecast: s.roadmap && (() => {
      const done = new Set(Object.values(s.progress).filter((p) => p.status === 'done').map((p) => p.key));
      const pts = forecastReadiness(s.profile, s.evidence, s.profile.targetRoleId, s.roadmap.milestones, done, s.profile.weeklyHours);
      return { note: 'Deterministic projection assuming each milestone is completed and verified by assessment; not a promise', weeklyHours: s.profile.weeklyHours, weeksTo70Percent: weeksToReach(pts, 70), projectedFinalReadiness: pts[pts.length - 1].readiness, totalWeeks: pts[pts.length - 1].week };
    })(),
    roleComparisons: ROLES.map((r) => {
      const t = computeTwin(s.profile, s.evidence, r.id);
      return { role: r.title, readinessEstimate: t.readiness, topGaps: t.orderedGaps.slice(0, 4).map(skillName) };
    }),
    recentAgentRuns: store.listRuns(3).map((r) => ({ trigger: r.trigger, status: r.status, steps: r.steps.map((st) => `${st.agent} (${st.kind}, ${st.status})`) })),
  };
}
