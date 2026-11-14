// SQLite persistence via Node's built-in node:sqlite (Node >= 22.13). Single-learner prototype.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
  AgentRun, AgentStep, AssessmentAttempt, Evidence, MentorMessage, MilestoneProgress, MilestoneStatus, Profile, RoadmapRevision,
} from '../shared/types';

const RAW_PATH = process.env.MIRA_DB_PATH || 'data/mira.db';
const DB_PATH = RAW_PATH === ':memory:' ? RAW_PATH : resolve(RAW_PATH);
if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
if (DB_PATH !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS learner (id INTEGER PRIMARY KEY, profile TEXT NOT NULL, insights TEXT, matching TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS skill_evidence (id INTEGER PRIMARY KEY AUTOINCREMENT, skill_id TEXT NOT NULL, source TEXT NOT NULL, level REAL NOT NULL, detail TEXT NOT NULL, ref_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assessment_attempt (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS roadmap_revision (id INTEGER PRIMARY KEY AUTOINCREMENT, role_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS milestone_progress (key TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agent_run (id INTEGER PRIMARY KEY AUTOINCREMENT, trigger TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT);
CREATE TABLE IF NOT EXISTS agent_step (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, agent TEXT NOT NULL, kind TEXT NOT NULL, model TEXT, status TEXT NOT NULL, started_at TEXT NOT NULL, duration_ms INTEGER, input_summary TEXT NOT NULL, output_summary TEXT NOT NULL DEFAULT '', tokens_in INTEGER, tokens_out INTEGER, error TEXT);
CREATE INDEX IF NOT EXISTS idx_step_run ON agent_step(run_id);
CREATE INDEX IF NOT EXISTS idx_revision_role ON roadmap_revision(role_id, id);
CREATE TABLE IF NOT EXISTS mentor_message (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
`);

// Monotonic ISO timestamps so ordering by time is unambiguous even within the same millisecond.
let lastTs = 0;
export function now(): string {
  const t = Math.max(Date.now(), lastTs + 1);
  lastTs = t;
  return new Date(t).toISOString();
}

type Row = Record<string, unknown>;

// ---- learner ----
export function getProfile(): Profile | null {
  const row = db.prepare('SELECT profile FROM learner WHERE id = 1').get() as Row | undefined;
  return row ? (JSON.parse(row.profile as string) as Profile) : null;
}
export function saveProfile(p: Profile) {
  db.prepare('INSERT INTO learner (id, profile, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET profile = excluded.profile, updated_at = excluded.updated_at').run(JSON.stringify(p), now());
}
export function getLearnerJson(col: 'insights' | 'matching'): unknown {
  const row = db.prepare(`SELECT ${col} AS v FROM learner WHERE id = 1`).get() as Row | undefined;
  return row?.v ? JSON.parse(row.v as string) : null;
}
export function setLearnerJson(col: 'insights' | 'matching', value: unknown) {
  db.prepare(`UPDATE learner SET ${col} = ? WHERE id = 1`).run(JSON.stringify(value));
}

// ---- evidence ----
export function listEvidence(): Evidence[] {
  return (db.prepare('SELECT * FROM skill_evidence ORDER BY created_at, id').all() as Row[]).map((r) => ({
    id: r.id as number, skillId: r.skill_id as string, source: r.source as Evidence['source'], level: r.level as number,
    detail: r.detail as string, refId: (r.ref_id as string) ?? null, createdAt: r.created_at as string,
  }));
}
export function addEvidence(e: Omit<Evidence, 'id' | 'createdAt'>) {
  db.prepare('INSERT INTO skill_evidence (skill_id, source, level, detail, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(e.skillId, e.source, e.level, e.detail, e.refId ?? null, now());
}
export function deleteEvidence(source: Evidence['source'], skillId?: string) {
  if (skillId) db.prepare('DELETE FROM skill_evidence WHERE source = ? AND skill_id = ?').run(source, skillId);
  else db.prepare('DELETE FROM skill_evidence WHERE source = ?').run(source);
}

// ---- attempts ----
export function addAttempt(a: Omit<AssessmentAttempt, 'id'>): AssessmentAttempt {
  const res = db.prepare('INSERT INTO assessment_attempt (data, created_at) VALUES (?, ?)').run(JSON.stringify(a), a.createdAt);
  return { ...a, id: Number(res.lastInsertRowid) };
}
export function updateAttempt(a: AssessmentAttempt) {
  const { id, ...rest } = a;
  db.prepare('UPDATE assessment_attempt SET data = ? WHERE id = ?').run(JSON.stringify(rest), id);
}
export function listAttempts(): AssessmentAttempt[] {
  return (db.prepare('SELECT id, data FROM assessment_attempt ORDER BY id DESC').all() as Row[]).map((r) => ({ ...JSON.parse(r.data as string), id: r.id as number }));
}

// ---- roadmap revisions ----
export function addRevision(r: Omit<RoadmapRevision, 'id'>): RoadmapRevision {
  const res = db.prepare('INSERT INTO roadmap_revision (role_id, version, data, created_at) VALUES (?, ?, ?, ?)').run(r.roleId, r.version, JSON.stringify(r), r.createdAt);
  return { ...r, id: Number(res.lastInsertRowid) };
}
export function listRevisions(): RoadmapRevision[] {
  return (db.prepare('SELECT id, data FROM roadmap_revision ORDER BY id DESC').all() as Row[]).map((r) => ({ ...JSON.parse(r.data as string), id: r.id as number }));
}
export function latestRevision(roleId: string): RoadmapRevision | null {
  const row = db.prepare('SELECT id, data FROM roadmap_revision WHERE role_id = ? ORDER BY id DESC LIMIT 1').get(roleId) as Row | undefined;
  return row ? { ...JSON.parse(row.data as string), id: row.id as number } : null;
}

// ---- milestone progress ----
export function listProgress(): Record<string, MilestoneProgress> {
  const rows = db.prepare('SELECT * FROM milestone_progress').all() as Row[];
  return Object.fromEntries(rows.map((r) => [r.key as string, { key: r.key as string, status: r.status as MilestoneStatus, updatedAt: r.updated_at as string }]));
}
export function setProgress(key: string, status: MilestoneStatus) {
  db.prepare('INSERT INTO milestone_progress (key, status, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at').run(key, status, now());
}

// ---- agent runs ----
export function createRun(trigger: string): number {
  return Number(db.prepare("INSERT INTO agent_run (trigger, status, started_at) VALUES (?, 'running', ?)").run(trigger, now()).lastInsertRowid);
}
export function finishRun(id: number, status: AgentRun['status']) {
  db.prepare('UPDATE agent_run SET status = ?, finished_at = ? WHERE id = ?').run(status, now(), id);
}
export function startStep(runId: number, agent: string, kind: AgentStep['kind'], model: string | null, inputSummary: string): number {
  return Number(db.prepare("INSERT INTO agent_step (run_id, agent, kind, model, status, started_at, input_summary) VALUES (?, ?, ?, ?, 'running', ?, ?)").run(runId, agent, kind, model, now(), inputSummary).lastInsertRowid);
}
export function endStep(id: number, f: { status: AgentStep['status']; durationMs: number; outputSummary?: string; tokensIn?: number | null; tokensOut?: number | null; error?: string | null; kind?: AgentStep['kind'] }) {
  db.prepare('UPDATE agent_step SET status = ?, duration_ms = ?, output_summary = ?, tokens_in = ?, tokens_out = ?, error = ?, kind = COALESCE(?, kind) WHERE id = ?')
    .run(f.status, f.durationMs, f.outputSummary ?? '', f.tokensIn ?? null, f.tokensOut ?? null, f.error ?? null, f.kind ?? null, id);
}
function mapStep(r: Row): AgentStep {
  return {
    id: r.id as number, runId: r.run_id as number, agent: r.agent as string, kind: r.kind as AgentStep['kind'], model: (r.model as string) ?? null,
    status: r.status as AgentStep['status'], startedAt: r.started_at as string, durationMs: (r.duration_ms as number) ?? null,
    inputSummary: r.input_summary as string, outputSummary: r.output_summary as string, tokensIn: (r.tokens_in as number) ?? null,
    tokensOut: (r.tokens_out as number) ?? null, error: (r.error as string) ?? null,
  };
}
export function getRun(id: number): AgentRun | null {
  const r = db.prepare('SELECT * FROM agent_run WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  const steps = (db.prepare('SELECT * FROM agent_step WHERE run_id = ? ORDER BY id').all(id) as Row[]).map(mapStep);
  return { id: r.id as number, trigger: r.trigger as string, status: r.status as AgentRun['status'], startedAt: r.started_at as string, finishedAt: (r.finished_at as string) ?? null, steps };
}
export function listRuns(limit = 15): AgentRun[] {
  // Two queries total (runs, then all their steps) instead of one query per run.
  const runs = db.prepare('SELECT * FROM agent_run ORDER BY id DESC LIMIT ?').all(limit) as Row[];
  if (!runs.length) return [];
  const ids = runs.map((r) => r.id as number);
  const steps = (db.prepare(`SELECT * FROM agent_step WHERE run_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids) as Row[]).map(mapStep);
  return runs.map((r) => ({
    id: r.id as number, trigger: r.trigger as string, status: r.status as AgentRun['status'], startedAt: r.started_at as string,
    finishedAt: (r.finished_at as string) ?? null, steps: steps.filter((st) => st.runId === r.id),
  }));
}
export function activeRunId(): number | null {
  const r = db.prepare("SELECT id FROM agent_run WHERE status = 'running' ORDER BY id DESC LIMIT 1").get() as Row | undefined;
  return r ? (r.id as number) : null;
}
export function failStaleRuns() {
  db.prepare("UPDATE agent_step SET status = 'failed', error = 'Server restarted during execution' WHERE status = 'running'").run();
  db.prepare("UPDATE agent_run SET status = 'failed', finished_at = ? WHERE status = 'running'").run(now());
}

// ---- mentor ----
export function addMessage(role: MentorMessage['role'], kind: MentorMessage['kind'], content: string) {
  db.prepare('INSERT INTO mentor_message (role, kind, content, created_at) VALUES (?, ?, ?, ?)').run(role, kind, content, now());
}
export function listMessages(limit = 50): MentorMessage[] {
  return (db.prepare('SELECT * FROM mentor_message ORDER BY id DESC LIMIT ?').all(limit) as Row[]).reverse().map((r) => ({
    id: r.id as number, role: r.role as MentorMessage['role'], kind: r.kind as MentorMessage['kind'], content: r.content as string, createdAt: r.created_at as string,
  }));
}

export function resetAll() {
  db.exec('DELETE FROM learner; DELETE FROM skill_evidence; DELETE FROM assessment_attempt; DELETE FROM roadmap_revision; DELETE FROM milestone_progress; DELETE FROM agent_step; DELETE FROM agent_run; DELETE FROM mentor_message;');
}
export function deleteEvidenceByRef(refId: string) {
  db.prepare('DELETE FROM skill_evidence WHERE ref_id = ?').run(refId);
}
