import type {
  AgentRun,
  AppState,
  AssessmentAttempt,
  MentorMessage,
  Profile,
  PublicAssessment,
  Resource,
  RoleDef,
  SkillDef,
  MilestoneStatus,
} from '../../shared/types';

const BASE = `${import.meta.env.BASE_URL}api`;

export class ApiError extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError('Cannot reach the Mira server. Check that the API is running.');
  }
  const body = await res.json().catch(() => ({}));
  // An expired or missing session anywhere in the app sends the user back to the sign-in page.
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('mira:signed-out'));
  if (!res.ok)
    throw new ApiError(
      (body as { error?: string; details?: string[] }).error +
        ((body as { details?: string[] }).details ? `: ${(body as { details: string[] }).details.join('; ')}` : '') ||
        `Request failed (${res.status})`,
    );
  return body as T;
}

export interface CohortReport {
  roleId: string;
  learners: {
    name: string;
    sample: boolean;
    roleId: string;
    readiness: number;
    provenShare: number;
    topGap: string | null;
    assessed: number;
  }[];
  summary: { learners: number; avgReadiness: number; avgProvenShare: number; assessedLearners: number };
  priorities: {
    skillId: string;
    learnersNeeding: number;
    learnersAssessedBelow: number;
    unverifiedClaims: number;
    impactPoints: number;
    action: string;
  }[];
}

export interface Meta {
  roles: RoleDef[];
  skills: SkillDef[];
  resources: Resource[];
  assessments: { id: string; skillId: string; title: string; questions: number }[];
}

export interface DesignedRole {
  title: string;
  summary: string;
  requirements: { skillId?: string; name?: string; level: number; weight: number }[];
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

export const api = {
  me: () => req<{ user: SessionUser | null }>('/auth/me'),
  login: (email: string, password: string) =>
    req<{ user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (name: string, email: string, password: string) =>
    req<{ user: SessionUser }>('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST', body: '{}' }),
  meta: () => req<Meta>('/meta'),
  state: () => req<AppState>('/state'),
  analyze: () => req<{ runId: number }>('/analyze', { method: 'POST' }),
  saveProfile: (p: Profile, analyze = true) =>
    req<{ runId: number | null }>(`/profile${analyze ? '' : '?analyze=false'}`, {
      method: 'PUT',
      body: JSON.stringify(p),
    }),
  changeGoal: (roleId: string) => req<{ runId: number }>('/goal', { method: 'POST', body: JSON.stringify({ roleId }) }),
  assessment: (id: string) => req<PublicAssessment>(`/assessments/${id}`),
  submit: (id: string, answers: Record<string, number | null>) =>
    req<{ attempt: AssessmentAttempt; runId: number }>(`/assessments/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  setMilestone: (key: string, status: MilestoneStatus) =>
    req<AppState>(`/milestones/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  runs: () => req<AgentRun[]>('/runs'),
  run: (id: number) => req<AgentRun>(`/runs/${id}`),
  messages: () => req<MentorMessage[]>('/mentor'),
  ask: (message: string) => req<MentorMessage[]>('/mentor', { method: 'POST', body: JSON.stringify({ message }) }),
  reset: () => req<AppState>('/demo/reset', { method: 'POST' }),
  suggestRoles: (aim: string, avoid: string[]) =>
    req<{ options: DesignedRole[] }>('/roles/suggest', { method: 'POST', body: JSON.stringify({ aim, avoid }) }),
  createRole: (role: DesignedRole) =>
    req<{ role: RoleDef; skills: SkillDef[] }>('/roles', { method: 'POST', body: JSON.stringify(role) }),
  addSkill: (name: string) => req<{ skill: SkillDef }>('/skills', { method: 'POST', body: JSON.stringify({ name }) }),
  cohort: (role: string) => req<CohortReport>(`/cohort?role=${encodeURIComponent(role)}`),
};
