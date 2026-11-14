import type { AgentRun, AppState, AssessmentAttempt, MentorMessage, Profile, PublicAssessment, Resource, RoleDef, SkillDef, MilestoneStatus } from '../../shared/types';

const BASE = `${import.meta.env.BASE_URL}api`;

export class ApiError extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError('Cannot reach the Mira server. Check that the API is running.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string; details?: string[] }).error + ((body as { details?: string[] }).details ? `: ${(body as { details: string[] }).details.join('; ')}` : '') || `Request failed (${res.status})`);
  return body as T;
}

export interface Meta { roles: RoleDef[]; skills: SkillDef[]; resources: Resource[]; assessments: { id: string; skillId: string; title: string; questions: number }[] }

export const api = {
  meta: () => req<Meta>('/meta'),
  state: () => req<AppState>('/state'),
  analyze: () => req<{ runId: number }>('/analyze', { method: 'POST' }),
  saveProfile: (p: Profile) => req<{ runId: number }>('/profile', { method: 'PUT', body: JSON.stringify(p) }),
  changeGoal: (roleId: string) => req<{ runId: number }>('/goal', { method: 'POST', body: JSON.stringify({ roleId }) }),
  assessment: (id: string) => req<PublicAssessment>(`/assessments/${id}`),
  submit: (id: string, answers: Record<string, number | null>) => req<{ attempt: AssessmentAttempt; runId: number }>(`/assessments/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  setMilestone: (key: string, status: MilestoneStatus) => req<AppState>(`/milestones/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  runs: () => req<AgentRun[]>('/runs'),
  run: (id: number) => req<AgentRun>(`/runs/${id}`),
  messages: () => req<MentorMessage[]>('/mentor'),
  ask: (message: string) => req<MentorMessage[]>('/mentor', { method: 'POST', body: JSON.stringify({ message }) }),
  reset: () => req<AppState>('/demo/reset', { method: 'POST' }),
};
