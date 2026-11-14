// Deterministic assessment grading against the answer key. Pure function — no AI involved.
import { scoreToLevel } from '../shared/engine';
import type { ConceptResult, QuestionResult } from '../shared/types';
import type { AssessmentDef } from './assessments';

export interface GradeResult {
  questionResults: QuestionResult[];
  correct: number;
  total: number;
  score: number; // percent, rounded
  conceptResults: ConceptResult[];
  weakConcepts: string[]; // concepts with < 50% correct
  verifiedLevel: number;
}

export type Answers = Record<string, number | null>;

/** Returns the number of questions with an answer, so callers can reject incomplete submissions. */
export const countAnswered = (def: AssessmentDef, answers: Answers) => def.questions.filter((q) => typeof answers[q.id] === 'number').length;

export function grade(def: AssessmentDef, answers: Answers): GradeResult {
  const questionResults: QuestionResult[] = def.questions.map((q) => {
    const chosen = answers[q.id] ?? null;
    return { questionId: q.id, concept: q.concept, chosen, correctIndex: q.answer, correct: chosen === q.answer, explanation: q.explanation };
  });
  const correct = questionResults.filter((r) => r.correct).length;
  const total = def.questions.length;
  const score = Math.round((correct / total) * 100);
  const conceptResults: ConceptResult[] = Object.entries(def.concepts)
    .map(([concept, label]) => {
      const qs = questionResults.filter((r) => r.concept === concept);
      return { concept, label, correct: qs.filter((r) => r.correct).length, total: qs.length };
    })
    .filter((c) => c.total > 0);
  const weakConcepts = conceptResults.filter((c) => c.correct / c.total < 0.5).map((c) => c.concept);
  return { questionResults, correct, total, score, conceptResults, weakConcepts, verifiedLevel: scoreToLevel(score) };
}
