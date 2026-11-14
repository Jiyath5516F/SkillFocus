// Agent 4 — Assessment & Progress: diagnoses misconceptions from deterministically graded answers.
import { z } from 'zod';
import type { AssessmentAttempt } from '../../shared/types';
import type { AssessmentDef } from '../assessments';
import { structured, type LLMResult } from '../llm';

const Schema = z.object({
  diagnosis: z.string(),
  concepts: z.array(z.object({ concept: z.string(), misconception: z.string(), advice: z.string() })),
  focus: z.string(),
});
export type AssessmentOutput = z.infer<typeof Schema>;

const SYSTEM = `You are the Assessment & Progress Agent in Mira.
Answers were already graded deterministically against an answer key; the score is final — do not re-grade or change it.
From the wrong answers, infer the most likely misconceptions.
- diagnosis: 2 sentences addressed to the learner ("you"), honest but encouraging.
- concepts: one entry per weak concept ID provided, plus any other concept from conceptLabels where a wrong answer reveals a misconception worth practising (use exact concept IDs, most important first), each with the likely misconception and one concrete practice tip. You decide this remediation focus; it is applied only to concepts the learner actually answered wrongly.
- focus: one sentence telling the Learning Path Architect what remediation should target.`;

export async function runAssessmentAgent(
  def: AssessmentDef,
  attempt: Omit<AssessmentAttempt, 'id'>,
  requiredLevel: number | null,
): Promise<LLMResult<AssessmentOutput>> {
  const qById = Object.fromEntries(def.questions.map((q) => [q.id, q]));
  const input = {
    assessment: def.title,
    scorePercent: attempt.score,
    verifiedLevel: attempt.verifiedLevel,
    roleRequiredLevel: requiredLevel,
    weakConceptIds: attempt.weakConcepts,
    conceptLabels: def.concepts,
    answers: attempt.questionResults.map((r) => {
      const q = qById[r.questionId];
      return {
        concept: r.concept,
        question: q.prompt,
        code: q.code ?? null,
        chosen: r.chosen === null ? 'no answer' : q.options[r.chosen],
        correctAnswer: q.options[r.correctIndex],
        correct: r.correct,
      };
    }),
  };
  return structured({ system: SYSTEM, user: JSON.stringify(input), schema: Schema });
}
