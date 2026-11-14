import { ArrowPathIcon, PlayIcon } from '@heroicons/react/20/solid';
import { Radio, RadioGroup } from '@headlessui/react';
import { useState } from 'react';
import { LEVEL_LABELS, skillName } from '../../../shared/catalog';
import type { AssessmentAttempt, PublicAssessment } from '../../../shared/types';
import { useApp } from '../App';
import { allRoles } from '../roles';
import { api } from '../api';
import { Badge, Button, Card, Spinner, fmtDate } from '../components/ui';

export function Assessments() {
  const { state, meta, track, busy, notify, go } = useApp();
  const [quiz, setQuiz] = useState<PublicAssessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentAttempt | null>(null);
  const [loading, setLoading] = useState(false);
  const role = allRoles(meta, state.profile).find((r) => r.id === state.profile.targetRoleId) ?? meta.roles[0];

  const start = async (id: string) => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    try {
      setQuiz(await api.assessment(id));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const submit = async () => {
    if (!quiz) return;
    setLoading(true);
    try {
      const r = await api.submit(quiz.id, answers);
      setResult(r.attempt);
      track(r.runId);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const latestFull = result ? (state.attempts.find((a) => a.id === result.id) ?? result) : null;

  if (quiz && latestFull) {
    const req = role.requirements.find((r) => r.skillId === quiz.skillId)?.level;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{quiz.title} — result</h1>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Score" subtitle="Graded deterministically against the answer key">
            <div className="text-4xl font-semibold tabular-nums text-white">{latestFull.score}%</div>
            <div className="mt-1 text-sm text-white/70">
              {latestFull.correct}/{latestFull.total} correct
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="emerald">
                Verified level:{' '}
                {latestFull.verifiedLevel ? LEVEL_LABELS[latestFull.verifiedLevel] : 'not yet demonstrated'}
              </Badge>
              {req !== undefined && (
                <Badge tone={latestFull.verifiedLevel >= req ? 'emerald' : 'rose'}>
                  {role.title} needs {LEVEL_LABELS[req]}
                </Badge>
              )}
            </div>
          </Card>
          <Card className="lg:col-span-2" title="By concept">
            <ul className="space-y-2.5">
              {latestFull.conceptResults.map((c) => (
                <li key={c.concept} className="text-sm">
                  <div className="mb-1 flex justify-between">
                    <span className="text-white">{c.label}</span>
                    <span className={c.correct / c.total < 0.5 ? 'font-medium text-rose-300' : 'text-emerald-300'}>
                      {c.correct}/{c.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className={`h-2 rounded-full ${c.correct / c.total < 0.5 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${(c.correct / c.total) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title="Assessment & Progress Agent" subtitle="Diagnosis of your answers">
          {latestFull.diagnosis ? (
            <div className="space-y-2 text-sm text-white/80">
              {latestFull.diagnosis.split('\n').map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
          ) : busy ? (
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Spinner /> Agents are analyzing your answers and adapting your roadmap…
            </p>
          ) : (
            <p className="text-sm text-white/60">No AI diagnosis available for this attempt (see Agent activity).</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => go('roadmap')} disabled={busy}>
              See adapted roadmap
            </Button>
            <Button variant="secondary" onClick={() => go('twin')} disabled={busy}>
              See Career Twin change
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setQuiz(null);
                setResult(null);
              }}
            >
              Back to assessments
            </Button>
          </div>
        </Card>
        <Card title="Answer review">
          <ol className="space-y-4">
            {quiz.questions.map((q, i) => {
              const r = latestFull.questionResults.find((x) => x.questionId === q.id)!;
              return (
                <li key={q.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className={r.correct ? 'text-emerald-300' : 'text-rose-300'}>{r.correct ? '✓' : '✕'}</span>
                    <span className="font-medium text-white">
                      {i + 1}. {q.prompt}
                    </span>
                  </div>
                  <div className="ml-5 mt-1 text-white/70">
                    Your answer: {r.chosen !== null ? q.options[r.chosen] : '—'}
                    {!r.correct && (
                      <>
                        {' '}
                        · Correct: <span className="font-medium text-white">{q.options[r.correctIndex]}</span>
                      </>
                    )}
                  </div>
                  <div className="ml-5 mt-0.5 text-white/60">{r.explanation}</div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    );
  }

  if (quiz) {
    const answered = Object.keys(answers).length;
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{quiz.title}</h1>
            <p className="mt-1 text-sm text-white/60">
              {quiz.questions.length} questions · {skillName(quiz.skillId)} · answers are graded against a fixed key
            </p>
          </div>
          <Button variant="ghost" onClick={() => setQuiz(null)}>
            Cancel
          </Button>
        </div>
        <ol className="space-y-4">
          {quiz.questions.map((q, i) => (
            <li key={q.id}>
              <fieldset className="rounded-xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                <legend className="sr-only">Question {i + 1}</legend>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {i + 1}. {q.prompt}
                  </span>
                  <Badge>{quiz.concepts[q.concept]}</Badge>
                </div>
                {q.code && (
                  <pre className="code-block mt-3 overflow-x-auto rounded-lg bg-black/60 p-3 ring-1 ring-white/10 text-[13px] leading-relaxed text-white/90">
                    {q.code}
                  </pre>
                )}
                {/* Headless UI RadioGroup: roving focus + arrow-key navigation, styled via data-checked/data-focus */}
                <RadioGroup
                  value={answers[q.id] ?? null}
                  onChange={(v: number) => setAnswers({ ...answers, [q.id]: v })}
                  aria-label={`Answer to question ${i + 1}`}
                  className="mt-3 grid gap-2 sm:grid-cols-2"
                >
                  {q.options.map((o, oi) => (
                    <Radio
                      key={oi}
                      value={oi}
                      data-question={q.id}
                      className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10 focus:outline-none data-checked:border-indigo-400/60 data-checked:bg-indigo-500/15 data-checked:ring-1 data-checked:ring-indigo-400/60 data-focus:ring-2 data-focus:outline-2 data-focus:outline-white/40"
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 group-data-checked:border-white"
                        aria-hidden
                      >
                        <span className="invisible h-2 w-2 rounded-full bg-white group-data-checked:visible" />
                      </span>
                      <span className="code-block">{o}</span>
                    </Radio>
                  ))}
                </RadioGroup>
              </fieldset>
            </li>
          ))}
        </ol>
        <div className="sticky bottom-4 flex items-center justify-between rounded-xl bg-neutral-900/90 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
          <span className="text-sm text-white/70">
            {answered}/{quiz.questions.length} answered
          </span>
          <Button onClick={submit} disabled={answered < quiz.questions.length || loading || busy}>
            {loading ? (
              <>
                <Spinner /> Grading…
              </>
            ) : busy ? (
              'Agents busy…'
            ) : (
              'Submit answers'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Assessments</h1>
        <p className="mt-1 text-sm text-white/60">
          Short, objective checks. A result replaces self-reported levels and claims made before it, and weak concepts
          trigger targeted remediation.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {meta.assessments.map((a) => {
          const last = state.attempts.find((x) => x.assessmentId === a.id);
          const inRole = role.requirements.some((r) => r.skillId === a.skillId);
          return (
            <Card
              key={a.id}
              title={a.title}
              subtitle={`${a.questions} questions · ${skillName(a.skillId)}`}
              action={inRole ? <Badge tone="brand">In your goal</Badge> : undefined}
            >
              <p className="text-sm text-white/70">
                {last ? (
                  <>
                    Last attempt: <span className="font-medium">{last.score}%</span> → verified{' '}
                    {LEVEL_LABELS[last.verifiedLevel]} ({fmtDate(last.createdAt)})
                  </>
                ) : (
                  'Not attempted yet.'
                )}
              </p>
              <Button className="mt-4" onClick={() => start(a.id)} disabled={loading}>
                {last ? (
                  <>
                    <ArrowPathIcon aria-hidden className="size-4" /> Retake
                  </>
                ) : (
                  <>
                    <PlayIcon aria-hidden className="size-4" /> Start
                  </>
                )}
              </Button>
            </Card>
          );
        })}
      </div>
      <Card title="Attempt history" subtitle="Saved permanently — kept across goal changes">
        {state.attempts.length === 0 ? (
          <p className="text-sm text-white/60">No attempts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th className="py-2 pr-4">#</th>
                  <th className="pr-4">Skill</th>
                  <th className="pr-4">Score</th>
                  <th className="pr-4">Verified</th>
                  <th className="pr-4">Weak concepts</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {state.attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-4 text-white/60">{a.id}</td>
                    <td className="pr-4">{skillName(a.skillId)}</td>
                    <td className="pr-4 tabular-nums">{a.score}%</td>
                    <td className="pr-4">{LEVEL_LABELS[a.verifiedLevel]}</td>
                    <td className="pr-4 text-white/70">{a.weakConcepts.join(', ') || '—'}</td>
                    <td className="text-white/60">{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
