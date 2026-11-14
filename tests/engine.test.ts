import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeTwin, diffMilestones, estimateSkill, orderByPrereqs, scoreToLevel } from '../shared/engine';
import type { Evidence, Profile, RoadmapRevision } from '../shared/types';

const profile: Profile = {
  name: 'Test', background: '', currentRole: '', interests: '', targetRoleId: 'fullstack', weeklyHours: 8,
  skills: [{ skillId: 'python', selfLevel: 3 }, { skillId: 'sql', selfLevel: 2 }, { skillId: 'html', selfLevel: 1 }],
  certifications: [], projects: [],
};
let id = 0;
const ev = (skillId: string, source: Evidence['source'], level: number, createdAt: string): Evidence => ({ id: ++id, skillId, source, level, detail: 'test', createdAt });

describe('scoreToLevel', () => {
  it('maps score bands to verified levels', () => {
    assert.equal(scoreToLevel(25), 1);
    assert.equal(scoreToLevel(40), 2);
    assert.equal(scoreToLevel(70), 3);
    assert.equal(scoreToLevel(95), 4);
  });
});

describe('estimateSkill', () => {
  it('discounts self-reported levels as unverified (×0.75)', () => {
    const e = estimateSkill('sql', profile, []);
    assert.equal(e.effective, 1.5);
    assert.equal(e.confidence, 'unverified');
  });
  it('uses ×0.9 when a project or certification backs the skill', () => {
    const e = estimateSkill('sql', profile, [ev('sql', 'project_link', 1, '2026-01-01T00:00:00.000Z')]);
    assert.equal(e.effective, 1.8);
    assert.equal(e.confidence, 'evidence');
  });
  it('lets an assessment supersede earlier claims, even when it is lower', () => {
    const evidence = [ev('javascript', 'milestone_claim', 3, '2026-01-01T00:00:00.000Z'), ev('javascript', 'assessment', 1, '2026-01-02T00:00:00.000Z')];
    const e = estimateSkill('javascript', profile, evidence);
    assert.equal(e.effective, 1);
    assert.equal(e.confidence, 'assessed');
    assert.equal(e.verifiedLevel, 1);
  });
  it('counts claims made after an assessment (discounted)', () => {
    const evidence = [ev('javascript', 'assessment', 1, '2026-01-02T00:00:00.000Z'), ev('javascript', 'milestone_claim', 3, '2026-01-03T00:00:00.000Z')];
    assert.equal(estimateSkill('javascript', profile, evidence).effective, 2.3);
  });
  it('returns zero for unknown skills', () => {
    assert.equal(estimateSkill('react', profile, []).effective, 0);
  });
});

describe('computeTwin', () => {
  it('computes weighted readiness and ranks gaps', () => {
    const t = computeTwin(profile, [], 'fullstack');
    // Uses the displayed (1-decimal) effective levels so anyone can reproduce it from the UI:
    // html 0.8/2 × weight 2 + sql 1.5/2 × weight 2 = 0.8 + 1.5 = 2.3 of total weight 17 → 13.5%
    assert.equal(t.readiness, 13.5);
    assert.ok(t.orderedGaps.indexOf('javascript') < t.orderedGaps.indexOf('react'), 'JS before React');
    assert.ok(t.orderedGaps.indexOf('nodejs') < t.orderedGaps.indexOf('rest_api'), 'Node before REST');
  });
  it('supports what-if overrides without mutating evidence', () => {
    const base = computeTwin(profile, [], 'fullstack');
    const sim = computeTwin(profile, [], 'fullstack', { javascript: 3 });
    assert.ok(sim.readiness > base.readiness);
    assert.ok(!sim.orderedGaps.includes('javascript'));
  });
  it('rejects unknown roles', () => {
    assert.throws(() => computeTwin(profile, [], 'astronaut'));
  });
});

describe('orderByPrereqs', () => {
  it('never places a skill before its prerequisites', () => {
    const order = orderByPrereqs(['react', 'html', 'javascript'], { react: 50, html: 1, javascript: 1 });
    assert.ok(order.indexOf('javascript') < order.indexOf('react'));
    assert.ok(order.indexOf('html') < order.indexOf('react'));
  });
});

describe('diffMilestones', () => {
  it('reports added, removed and moved milestones', () => {
    const prev = { milestones: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] } as unknown as RoadmapRevision;
    const d = diffMilestones(prev, ['a', 'x', 'c', 'b'])!;
    assert.deepEqual(d.added, ['x']);
    assert.deepEqual(d.removed, []);
    assert.ok(d.moved.length > 0);
    assert.equal(diffMilestones(null, ['a']), null);
  });
});
