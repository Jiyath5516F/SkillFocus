# Mira — Approved Implementation Plan

> **Product name:** Mira (repository: `SkillFocus`). Built for PromptWars × Rathinam Technical Campus.
> **Hard deadline:** 1:30 PM IST. Feature freeze 1:00 PM IST. Plan approved 11:20 IST.
> **Tagline:** *Mira sees what you really know — and aims you where you want to go.*
> *(Spanish "mira": "look" and "aim".)*

---

## 0. Instructions for the implementing session (read first)

- **API key:** read from `SKILLFOCUS_ANTHROPIC_API_KEY`. Fall back to `ANTHROPIC_API_KEY` only outside this cloud container, i.e. on the VPS through `.env`.
  - Never print the key, log it, or commit it.
  - First action: one real API call to verify the key. Print only the HTTP status and the model ID.
- **Base URL:** the cloud container sets `ANTHROPIC_BASE_URL` for Claude Code's own use, so the app must **not** inherit it.
  - Construct the SDK client with an explicit `baseURL` taken from `SKILLFOCUS_ANTHROPIC_BASE_URL`, default `https://api.anthropic.com`.
- **Model and effort:** env `MIRA_MODEL` (default `claude-opus-5-5`) and `MIRA_EFFORT` (default `low`, for latency).
  - On Opus 5.5 thinking cannot be disabled, so lower the effort instead.
  - Forced `tool_choice` returns a 400, so use structured outputs (`output_config.format`) plus zod re-validation instead.
  - No assistant prefill.
  - Enable server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) and check `stop_reason` before reading content.
  - Load the `claude-api` skill and read `typescript/claude-api/README.md` before writing SDK code.
- **Verified in the container:**
  - Node 22.23.
  - Built-in `node:sqlite` works (experimental warning only, no flag needed).
  - npm registry reachable.
  - `@anthropic-ai/sdk` 1.8.0, `vite` 8.3.8, `recharts` 3.10.1.
- **Git:**
  - The repo was empty, so commit to `main`.
  - Commit working increments early and often, and push with `git push -u origin main`.
  - Never claim a push succeeded without the git output to show it.
- **Never fabricate** AI calls, test results, resource links or scores.
  - Use deterministic math for numbers.
  - A fallback must be labelled as a fallback.

---

## 1. Requirements

### Official (mandatory)
1. **User profile:** learner details, existing skills, certifications, projects, career goals. Editable and saved.
2. **Skill analysis:** strengths and weaknesses from skills and assessments.
3. **Career matching:** current skills vs. the requirements of a selected role.
4. **Learning recommendations:** courses, tutorials, practical exercises.
5. **Progress tracking:** learning progress and assessment performance.
6. **AI mentor:** guidance, and updated recommendations based on performance.
7. **Agentic AI:** several specialised AI agents collaborating to analyse skills, recommend resources, evaluate progress and guide the learner.
8. **Adaptation:** recommendations change when the career goal changes or an assessment goes poorly.
9. **Official scenario:** a learner with Python, SQL and basic HTML targets Full Stack Developer and is missing JS, React and Node.js. The app finds the gaps, builds a roadmap, recommends resources and tracks progress.

### Team requirements
- **3 roles:** Full Stack Developer, Data Analyst, AI/ML Engineer. These are illustrative benchmarks, not hiring standards.
- **Career Twin:** evidence-based readiness model (see §5).
- **Agent Activity panel:** shows real executions, with LLM calls and deterministic steps clearly distinguished.
- **Data handling:**
  - Deterministic readiness numbers; the AI gives reasoning only.
  - Persistence across refresh and server restart.
  - Reproducible demo through a seed and a reset endpoint.
- **Safety and deployment:**
  - Secrets stay server-side.
  - Runtime validation of all AI output and all inputs.
  - VPS deploy: static client plus one Node service behind Caddy/Nginx. No Docker.
- **Interface:**
  - Professional, restrained SaaS look: no gradient soup, no fake stats, no dead buttons.
  - Responsive, with loading, empty and error states.

---

## 2. Architecture

```
/shared   domain types, skill catalog (prereqs), 3 roles, curated resources (real URLs),
          question banks (with concept tags), readiness engine (pure TS — used by server AND client)
/server   Express + TypeScript (tsx), node:sqlite, zod, @anthropic-ai/sdk, orchestrator, 5 agents
/client   Vite + React + TypeScript + Tailwind, Recharts (radar + line)
```

- **Production:** `npm run build` builds `client/dist`. Express serves it plus `/api` on one port, behind Caddy, run by systemd.
  - Ship a sample `deploy/Caddyfile` and `deploy/mira.service`.
- **Persistence:** `node:sqlite`, which needs Node ≥ 22.13 on the VPS.
  - If it causes trouble, fall back to a JSON file store behind the same repository interface, and document it.
- **AI client:**
  - Structured JSON output (`output_config.format`) plus zod `safeParse`.
  - Each call has a 45 s timeout and `maxRetries: 1`.
  - Typed SDK error handling: auth / rate limit / timeout / bad request.

### Data model (SQLite, JSON columns where it saves time)
- `learner`: the profile JSON, containing:
  - name, background, current role
  - `skills [{skillId, selfLevel 0–4}]`
  - certifications, projects, interests
  - `targetRoleId`, `weeklyHours`
- `skill_evidence`: learnerId, skillId, `source` (`self | milestone_claim | project_link | assessment`), level, detail, refId, createdAt.
- `assessment_attempt`: id, learnerId, assessmentId, answers, score, conceptResults, verifiedLevel, createdAt.
- `roadmap_revision`: id, learnerId, roleId, version, trigger, milestones JSON, readiness, breakdown JSON, changeSummary, createdAt. **Never deleted.**
- `milestone_progress`: learnerId, milestoneKey (skill-based), status, completedAt.
- `agent_run`: id, learnerId, trigger, status, startedAt, finishedAt.
- `agent_step`: runId, agent, kind (`llm | deterministic | fallback`), model, status, startedAt, durationMs, inputSummary, outputSummary, tokensIn, tokensOut, error.
- `mentor_message`: learnerId, role, content, createdAt.

### API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + whether AI is configured (boolean only) |
| GET | `/api/meta` | roles, skills, resources |
| GET | `/api/state` | learner, twin (computed), current roadmap, revisions, attempts, recent runs |
| PUT | `/api/profile` | validated update → starts a `profile_updated` run |
| POST | `/api/analyze` | starts a run |
| POST | `/api/goal` | `{roleId}`; history preserved → run |
| GET | `/api/assessments` / `/api/assessments/:id` | questions **without answer keys** |
| POST | `/api/assessments/:id/submit` | deterministic grading → saves the attempt → run |
| PATCH | `/api/milestones/:key` | status `todo / in_progress / done` |
| GET | `/api/runs`, `/api/runs/:id` | live agent activity; the client polls about every 1 s |
| POST | `/api/mentor` | grounded chat |
| POST | `/api/demo/reset` | reseeds the demo learner |

- Actions that start a run return `{runId}` immediately. The client polls the run until it finishes, then refetches `/api/state`.
- Input limits: JSON body limit 100 kb, plus a simple in-memory rate limit on AI endpoints.

---

## 3. Multi-agent design

Each agent is a real, separate LLM call. It has its own system prompt, zod-typed input and output, and is recorded as an `agent_step`. **LLMs never produce percentages; the engine does.**

| # | Agent | Deterministic part | LLM part (validated output) |
|---|---|---|---|
| 1 | **Skill Intelligence** | builds the evidence table | links certifications and projects to catalog skill IDs (unknown IDs rejected); strengths, weaknesses and uncertainty notes |
| 2 | **Career Matching** | gaps, readiness, per-skill impact, prerequisite order | critical-path explanation; priority ranking that must be a permutation of the actual gap set |
| 3 | **Learning Path Architect** | prerequisite order (topological sort), effort budget from weekly hours | milestones that choose resources **only by ID from the curated catalog**, with a reason, an exercise, effort, and remediation steps |
| 4 | **Assessment & Progress** | grades the multiple-choice answers against the key; per-concept results; maps score to a verified level; adaptation rule (score below the role's required level ⇒ adapt) | diagnoses misconceptions and sets the remediation focus handed to agent 3 |
| 5 | **Mira (Mentor)** | context snapshot: profile, twin, roadmap, latest revision diff, attempts | chat grounded only in that snapshot; must never invent courses, certifications, scores or achievements |

### Orchestrated flows (no loops; at most 5 LLM calls per action)
- **Analyze / profile update:** Skill Intelligence → deterministic matching → **[Matching explanation ‖ Path Architect, in parallel]** → Mira summary.
- **Assessment submitted:** grade (deterministic) → Assessment agent → Skill Intelligence → deterministic matching → Matching ‖ Path Architect (remediation; revision v+1) → Mira summary.
- **Goal change:** keep history → deterministic matching → Matching ‖ Path Architect → Mira summary.

### Fallback
- With no key, or when a call fails, the deterministic engine still produces the gaps and a **rule-based roadmap** built from catalog templates.
- That step is logged with `kind = fallback` and `status = failed` / "rule-based". **It is never shown as an AI step that completed.**
- The UI shows a banner: "AI unavailable — showing rule-based results."

---

## 4. Readiness engine (shared, deterministic, explained in the UI)

- **Levels:** 0 None, 1 Basic, 2 Working, 3 Proficient, 4 Advanced.
- **Effective level** for a skill, using the first rule that applies:
  1. the latest assessment-verified level, if one exists;
  2. otherwise the max of the self-reported level and the milestone-claim level, × **0.75** (unverified);
  3. or × **0.9** if Skill Intelligence linked a project or certification to that skill.
- **Role requirement:** skillId, requiredLevel, weight. Weights: critical 3, important 2, nice-to-have 1.
- **Formulas:**
  - `coverage = min(effective / required, 1)`
  - `readiness = Σ w·coverage / Σ w × 100`
- **Impact per skill** = `w·(1 − coverage)/Σw × 100`: the readiness points gained if that skill is mastered. It drives the "skills that matter most" view and the what-if.
- **Score → verified level:** < 40 % → 1, 40–69 % → 2, 70–89 % → 3, ≥ 90 % → 4.
- **Labelling:** always show "Readiness estimate — not a hiring probability."

---

## 5. Career Twin (the differentiator)

- **Evidence ledger:** every proficiency number traces to its source: self-report, milestone claim, project linked by agent 1, or assessment attempt #n. Badges: *Unverified / Evidence-backed / Assessed*.
- **Charts:**
  - Readiness gauge plus per-skill impact bars.
  - Radar chart: required vs. effective vs. self-reported.
- **Roadmap revision diff, v(n−1) → v(n):** added (remediation), removed, reordered, unchanged. Shown with the trigger and the change summary.
- **Goal switch:** recompute for the new role. Revisions, attempts, certifications and projects are kept.
- **What-if ✂ (optional):** pick a gap skill and see the readiness change and new priority order computed on the client. Labelled "Simulation — not saved"; it never writes to the database.

### Demo-learner design (important)
- **Seed:** Python 3, SQL 2, HTML 1, JS 0, target Full Stack, 8 h/week, one Python project, one SQL certification.
- **Story:**
  1. Analyze. JavaScript comes first, React depends on it.
  2. The learner **marks the JS Fundamentals milestone done**. That counts as a claimed level 2 (unverified × 0.75), so readiness rises slightly.
  3. The learner takes the JS quiz and scores **2/8 → verified level 1**. Readiness **drops**.
  4. The weak concepts (e.g. closures, async/promises) get remediation milestones inserted **before React**, producing revision v2 with a visible diff.
- **Message:** *completing a course is not proficiency.*

---

## 6. Feature set

- **Essential:**
  - Profile view and edit.
  - 3 roles, with about 7 requirements each.
  - Engine.
  - 5 agents, orchestrator, run log.
  - Roadmap with real resources and exercises, and milestones that can be marked done.
  - JS quiz: 8 questions across 5 concepts.
  - Grading, saving and adaptation.
  - Revision history and diff.
  - Goal switch.
  - Grounded Mira chat.
  - Demo seed and reset.
  - Loading, empty and error states.
- **Differentiator:** the Career Twin view (§5).
- **Optional (✂ first):** what-if, SQL and Python quizzes, readiness-history line chart, Playwright screenshots, VPS configs beyond samples.

### Views
- **Overview:** goal, readiness, top 3 gaps, next action, recent activity.
- **Career Twin.**
- **Roadmap.**
- **Assessments.**
- **Mira:** the mentor chat.
- **Profile.**
- **Agent Activity:** a slide-over drawer reachable from every view.
  - Pipeline chips show the flow between agents.
  - Each step shows kind (LLM · model / Deterministic / Fallback), status, timestamp, duration, tokens, input and output summaries, and any error.

---

## 7. Acceptance tests (`npm run acceptance`, against the live API, plus a manual UI pass)

1. **Profile → roadmap.** Seed the demo learner, then analyze. Pass when:
   - JS, React and Node.js are among the gaps, with JS before React.
   - Readiness equals the engine's output.
   - The run has at least 3 steps with `kind=llm` and status `completed`, each with a model and token counts.
   - The roadmap has at least 4 milestones, and every resource ID is in the catalog.
   - Mira's answer to "Why JS before React?" mentions the prerequisite.
2. **Assessment → adaptation.** Mark the JS milestone done, then submit a fixed answer set worth 2/8. Pass when:
   - The saved score is exactly 25 %.
   - The weak concepts match the wrong answers.
   - JS evidence is `assessment` at level 1.
   - Readiness is lower than before.
   - Revision v2 has at least 1 remediation milestone before React, and the diff isn't empty.
   - Mira's answer to "Why did my roadmap change?" cites the attempt.
3. **Career change + persistence.** Set the goal to Data Analyst. Pass when:
   - The gaps differ from the Full Stack ones.
   - A new revision exists for the new role.
   - The Full Stack revisions and the JS attempt are still stored.
   - Certifications and projects are unchanged.
   - After a server restart, `GET /api/state` still returns the Data Analyst plan.

---

## 8. Timeline (IST)

| Time | Work | Exit criterion |
|---|---|---|
| 11:25–11:35 | Scaffold all 3 packages, Tailwind, SQLite, `.env.example`, key check | health OK; a real AI ping succeeds |
| 11:35–12:00 | Shared catalog, roles, resources, JS quiz; engine; persistence; REST; seed | deterministic gaps returned by the API |
| 12:00–12:25 | Claude adapter, 5 agents, orchestrator, run log, fallback | flow 1 completes with real calls |
| 12:25–12:50 | UI shell, Overview, Career Twin, Roadmap, Assessments, Agent drawer, Profile, Mira | click-through works |
| 12:50–13:00 | Revision diff, goal switch, ✂ what-if | flows 2 and 3 work |
| **13:00 freeze** | Acceptance script, fixes, production build, typecheck, secret scan | all 3 tests pass |
| 13:15–13:30 | README, demo script, honest status report, final push | push confirmed |

If development falls behind, cut the ✂ items first and keep the full demo journey intact.

---

## 9. Risks and fallbacks

| Risk | Mitigation |
|---|---|
| Key missing or invalid | Deterministic mode stays usable and labelled; report it to the user right away |
| LLM latency on stage | effort `low`, compact inputs, Matching ‖ Path in parallel, live Agent drawer |
| Malformed AI output | structured output + zod + ID whitelists → 1 retry → step marked failed + rule-based fallback |
| Rate limit / timeout / network | typed SDK errors → clear user message; nothing fabricated |
| Invented links | resources only from the curated catalog; URLs checked with HEAD where the network allows |
| `node:sqlite` on the VPS | Node ≥ 22.13 required; JSON-store fallback |

---

## 10. Demo script (about 4 min)

1. **Problem:** learning platforms hand everyone the same courses and never check whether a skill is real.
2. **Overview:** goal Full Stack, readiness estimate. Open Agent Activity and run **Analyze**: Skill Intelligence → Matching ‖ Path Architect → Mira, each showing model, duration and tokens.
3. **Career Twin:** evidence ledger, impact bars, why JS before React.
4. **Roadmap:** mark JS Fundamentals done → readiness rises slightly, labelled "claimed, unverified".
5. **JS quiz:** answer poorly on stage → 2/8, per-concept feedback → watch the 4 agents re-run.
6. **Twin diff v1 → v2:** remediation inserted, JS estimate lowered, readiness down.
7. **Ask Mira:** "Why did my roadmap change?" → she cites the actual attempt.
8. **Switch to Data Analyst:** new gaps and roadmap, history kept → refresh → everything persists.
9. **Impact:** universities and employers can aggregate *verified* gaps to set training priorities. No claims about outcomes.

---

## 11. Final report format
Completed & tested / Implemented but untested / Incomplete / Known limitations. Be honest.
