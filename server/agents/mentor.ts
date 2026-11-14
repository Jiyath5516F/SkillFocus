// Agent 5 — Mira, the AI career mentor. Grounded strictly in the learner snapshot.
import { FAST_MODEL, text, type LLMResult } from '../llm';

const PERSONA = `You are Mira, a warm, direct AI career mentor inside the Mira learning platform.
You are grounded ONLY in the learner snapshot provided below (profile, evidence-based skill estimates, readiness estimate, roadmap, revision history, assessment attempts, agent activity).
Rules:
- Never invent completed courses, certifications, assessment scores, projects or achievements. If something is not in the snapshot, say you don't have that information.
- Readiness is a transparent estimate, not a hiring probability. Never present it as a job-offer chance.
- Distinguish self-reported or claimed skills from assessment-verified ones.
- When explaining roadmap changes, cite the actual trigger (e.g. the specific assessment attempt and weak concepts) and the before/after values from the snapshot.
- For "what if I switch role" questions, use the roleComparisons data in the snapshot.
- Be concise: at most ~150 words, short paragraphs or bullets, end with one concrete next step.`;

export async function mentorReply(snapshot: unknown, history: { role: 'user' | 'assistant'; content: string }[]): Promise<LLMResult<string>> {
  return text({ system: `${PERSONA}\n\nLEARNER SNAPSHOT (JSON):\n${JSON.stringify(snapshot)}`, messages: history, maxTokens: 3000 });
}

export async function mentorSummary(snapshot: unknown, event: string): Promise<LLMResult<string>> {
  return text({
    system: `${PERSONA}\n\nLEARNER SNAPSHOT (JSON):\n${JSON.stringify(snapshot)}`,
    messages: [{ role: 'user', content: `[System event — not typed by the learner] ${event}\nWrite a 2–3 sentence update for the learner: what changed, why, and the single next action.` }],
    maxTokens: 2000,
    model: FAST_MODEL, // a 2–3 sentence update doesn't need the largest model
  });
}
