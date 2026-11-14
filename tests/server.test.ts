import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RESOURCE_BY_ID } from '../shared/catalog';
import { computeTwin } from '../shared/engine';
import type { AssessmentAttempt, Profile } from '../shared/types';
import { sanitizeMatching } from '../server/agents/careerMatching';
import { validLinks } from '../server/agents/skillIntelligence';
import { ASSESSMENT_BY_ID, toPublic } from '../server/assessments';
import { countAnswered, grade } from '../server/grading';
import { assemble, buildSlots } from '../server/roadmap';

const js = ASSESSMENT_BY_ID['js-core'];
const profile: Profile = {
  name: 'Test', background: '', currentRole: '', interests: '', targetRoleId: 'fullstack', weeklyHours: 8,
  skills: [{ skillId: 'python', selfLevel: 3 }], certifications: [{ name: 'SQL (Basic) Certificate', issuer: 'HackerRank' }],
  projects: [{ name: 'Campus Library Tracker', description: 'Python + SQLite' }],
};

describe('grading', () => {
  it('grades a perfect attempt', () => {
    const all = Object.fromEntries(js.questions.map((q) => [q.id, q.answer]));
    const g = grade(js, all);
    assert.equal(g.score, 100);
    assert.equal(g.verifiedLevel, 4);
    assert.deepEqual(g.weakConcepts, []);
  });
  it('identifies weak concepts from wrong answers', () => {
    const answers = Object.fromEntries(js.questions.map((q) => [q.id, q.concept === 'types' ? q.answer : (q.answer + 1) % 4]));
    const g = grade(js, answers);
    assert.equal(g.correct, 2);
    assert.equal(g.score, 25);
    assert.equal(g.verifiedLevel, 1);
    assert.deepEqual([...g.weakConcepts].sort(), ['arrays_objects', 'async', 'closures', 'dom']);
  });
  it('counts unanswered questions', () => {
    assert.equal(countAnswered(js, { js1: 0, js2: null }), 1);
  });
  it('never exposes answer keys publicly', () => {
    assert.ok(!JSON.stringify(toPublic(js)).includes('"answer"'));
    assert.ok(!JSON.stringify(toPublic(js)).includes('explanation'));
  });
});

describe('roadmap assembly', () => {
  const twin = computeTwin({ ...profile, skills: [{ skillId: 'javascript', selfLevel: 1 }] }, [], 'fullstack');
  const attempt = { id: 1, skillId: 'javascript', weakConcepts: ['closures'] } as AssessmentAttempt;
  const slots = buildSlots(twin, [attempt]);

  it('places remediation after the skill and before its dependents', () => {
    const keys = slots.map((s) => s.key);
    assert.ok(keys.indexOf('fix:javascript:closures') > keys.indexOf('learn:javascript'));
    assert.ok(keys.indexOf('fix:javascript:closures') < keys.indexOf('learn:react'));
  });
  it('rejects AI-proposed resources outside the curated candidate set', () => {
    const ms = assemble(slots, [{ key: 'learn:javascript', title: 'JS', reason: 'r', resourceIds: ['made-up-course', 'jsinfo'], exercise: 'e', effortHours: 500 }]);
    const m = ms.find((x) => x.key === 'learn:javascript')!;
    assert.deepEqual(m.resourceIds, ['jsinfo']);
    assert.equal(m.effortHours, 80, 'effort is clamped');
    assert.equal(m.authoredBy, 'ai');
    assert.ok(ms.every((x) => x.resourceIds.every((id) => RESOURCE_BY_ID[id])));
  });
  it('falls back to rule-based templates when AI output is missing', () => {
    const ms = assemble(slots, null);
    assert.equal(ms.length, slots.length);
    assert.ok(ms.every((m) => m.authoredBy === 'rule-based' && m.resourceIds.length > 0));
  });
});

describe('agent output validation', () => {
  it('keeps only evidence links to real skills and real certifications/projects', () => {
    const links = validLinks({
      links: [
        { skillId: 'python', evidenceName: 'Campus Library Tracker', reason: 'ok' },
        { skillId: 'sql', evidenceName: 'sql (basic) certificate', reason: 'case-insensitive ok' },
        { skillId: 'kubernetes', evidenceName: 'Campus Library Tracker', reason: 'unknown skill' },
        { skillId: 'react', evidenceName: 'Invented Startup', reason: 'invented project' },
      ],
      strengths: [], weaknesses: [], uncertainties: [], summary: '',
    }, profile);
    assert.deepEqual(links.map((l) => l.skillId), ['python', 'sql']);
  });
  it('restricts the critical path to actual gaps', () => {
    const twin = computeTwin(profile, [], 'fullstack');
    const out = sanitizeMatching({ headline: 'h', criticalPath: ['javascript', 'python', 'astrology'], notes: [{ skillId: 'zzz', note: 'x' }] }, twin);
    assert.deepEqual(out.criticalPath, ['javascript']);
    assert.deepEqual(out.notes, []);
  });
});
