import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RateLimiter } from '../server/rateLimit';

describe('rate limiter', () => {
  it('blocks after the limit and recovers when the window slides', () => {
    const l = new RateLimiter(2, 1_000);
    assert.equal(l.hit('a', 0), false);
    assert.equal(l.hit('a', 10), false);
    assert.equal(l.hit('a', 20), true);
    assert.equal(l.hit('b', 20), false, 'keys are independent');
    assert.equal(l.hit('a', 1_011), false, 'oldest hit expired');
  });
  it('bounds memory without resetting recently active keys', () => {
    const l = new RateLimiter(1, 60_000, 100);
    l.hit('victim', 0);
    for (let i = 0; i < 98; i++) l.hit(`flood-${i}`, 1);
    assert.equal(l.hit('victim', 2), true);
    for (let i = 98; i < 150; i++) l.hit(`flood-${i}`, 3); // over capacity: the oldest flood keys are evicted
    assert.equal(l.hit('victim', 4), true, 'victim still blocked');
  });
});
