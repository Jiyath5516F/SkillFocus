// Shared domain types for Mira (server + client).

export type Weight = 1 | 2 | 3; // 1 nice-to-have, 2 important, 3 critical

export interface SkillDef {
  id: string;
  name: string;
  category: string;
  prereqs: string[];
  defaultExercise: string;
}

export interface RoleRequirement {
  skillId: string;
  level: number; // required level 1–4
  weight: Weight;
}

export interface RoleDef {
  id: string;
  title: string;
  summary: string;
  requirements: RoleRequirement[];
}

export type ResourceKind = 'course' | 'tutorial' | 'docs' | 'book' | 'practice';

export interface Resource {
  id: string;
  skillId: string;
  title: string;
  provider: string;
  url: string;
  kind: ResourceKind;
  hours: number;
  concepts?: string[];
}

export interface LearnerSkill {
  skillId: string;
  selfLevel: number; // 0–4 self-reported
}

export interface Certification {
  name: string;
  issuer: string;
  year?: number;
}

export interface Project {
  name: string;
  description: string;
}

export interface Profile {
  name: string;
  background: string;
  currentRole: string;
  skills: LearnerSkill[];
  certifications: Certification[];
  projects: Project[];
  interests: string;
  targetRoleId: string;
  weeklyHours: number;
  /** false only for new accounts that haven't finished (or skipped) the setup wizard. */
  onboarded?: boolean;
  /** Career aims the learner designed with Mira (requirements use catalog skills only). */
  customRoles?: RoleDef[];
}

export type EvidenceSource = 'milestone_claim' | 'project_link' | 'assessment';

export interface Evidence {
  id: number;
  skillId: string;
  source: EvidenceSource;
  level: number;
  detail: string;
  refId?: string | null;
  createdAt: string;
}

export type Confidence = 'none' | 'unverified' | 'evidence' | 'assessed';

export interface SkillEstimate {
  skillId: string;
  selfLevel: number;
  claimLevel: number;
  verifiedLevel: number | null;
  linked: boolean;
  effective: number;
  confidence: Confidence;
  sources: string[];
}

export interface RequirementResult {
  skillId: string;
  required: number;
  weight: Weight;
  selfLevel: number;
  effective: number;
  coverage: number; // 0–1
  impact: number; // readiness points gained if mastered
  status: 'met' | 'partial' | 'missing';
  priority: 'high' | 'medium' | 'low';
  confidence: Confidence;
  verifiedLevel: number | null;
}

export interface TwinResult {
  roleId: string;
  readiness: number; // 0–100, estimate — not a hiring probability
  requirements: RequirementResult[];
  orderedGaps: string[]; // prerequisite-respecting order
  strengths: string[];
}

export type MilestoneKind = 'learn' | 'remediation';
export type MilestoneStatus = 'todo' | 'in_progress' | 'done';

export interface Milestone {
  key: string; // stable: learn:<skill> | fix:<skill>:<concept>
  skillId: string;
  kind: MilestoneKind;
  concept?: string;
  title: string;
  reason: string;
  prerequisites: string[];
  resourceIds: string[];
  exercise: string;
  effortHours: number;
  targetLevel: number;
  authoredBy: 'ai' | 'rule-based';
}

export interface RevisionDiff {
  added: string[];
  removed: string[];
  moved: string[];
  unchanged: string[];
}

export interface RevisionSnapshot {
  readiness: number;
  levels: Record<string, number>;
}

export interface RoadmapRevision {
  id: number;
  roleId: string;
  version: number;
  trigger: string;
  milestones: Milestone[];
  snapshot: RevisionSnapshot;
  changeSummary: string;
  diff: RevisionDiff | null;
  previous: RevisionSnapshot | null;
  createdAt: string;
}

export interface PublicQuestion {
  id: string;
  concept: string;
  prompt: string;
  code?: string;
  options: string[];
}

export interface PublicAssessment {
  id: string;
  skillId: string;
  title: string;
  concepts: Record<string, string>;
  questions: PublicQuestion[];
}

export interface ConceptResult {
  concept: string;
  label: string;
  correct: number;
  total: number;
}

export interface QuestionResult {
  questionId: string;
  concept: string;
  chosen: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

export interface AssessmentAttempt {
  id: number;
  assessmentId: string;
  skillId: string;
  score: number; // percent 0–100
  correct: number;
  total: number;
  verifiedLevel: number;
  conceptResults: ConceptResult[];
  questionResults: QuestionResult[];
  weakConcepts: string[];
  diagnosis: string | null;
  createdAt: string;
}

export type StepKind = 'llm' | 'deterministic' | 'fallback';
export type StepStatus = 'running' | 'completed' | 'failed' | 'skipped';

export interface AgentStep {
  id: number;
  runId: number;
  agent: string;
  kind: StepKind;
  model: string | null;
  status: StepStatus;
  startedAt: string;
  durationMs: number | null;
  inputSummary: string;
  outputSummary: string;
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
}

export interface AgentRun {
  id: number;
  trigger: string;
  status: 'running' | 'completed' | 'completed_with_fallback' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  steps: AgentStep[];
}

export interface MentorMessage {
  id: number;
  role: 'user' | 'assistant';
  kind: 'chat' | 'summary';
  content: string;
  createdAt: string;
}

export interface MilestoneProgress {
  key: string;
  status: MilestoneStatus;
  updatedAt: string;
}

export interface AppState {
  profile: Profile;
  evidence: Evidence[];
  twin: TwinResult;
  roadmap: RoadmapRevision | null;
  revisions: RoadmapRevision[];
  progress: Record<string, MilestoneProgress>;
  attempts: AssessmentAttempt[];
  insights: { strengths: string[]; weaknesses: string[]; uncertainties: string[]; summary: string } | null;
  matching: { headline: string; criticalPath: string[]; notes: { skillId: string; note: string }[] } | null;
  aiConfigured: boolean;
  activeRunId: number | null;
}
