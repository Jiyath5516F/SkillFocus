// Shared HTTP helpers: base path, AI rate limit, session guard and error responses.
import { type NextFunction, type Request, type Response } from 'express';
import { readSessionCookie, userForSession } from './auth';
import * as store from './db';
import { describeError } from './llm';
import { BusyError } from './orchestrator';
import { RateLimiter } from './rateLimit';

export const BASE = (process.env.MIRA_BASE_PATH || '').replace(/\/+$/, '');

// Per-client limiter for AI-triggering endpoints.
const aiPerIp = new RateLimiter(Number(process.env.MIRA_AI_LIMIT_PER_MIN || 30), 60_000);
export function aiLimit(req: Request, res: Response, next: NextFunction) {
  if (aiPerIp.hit(req.ip ?? 'unknown'))
    return res.status(429).json({ error: 'Too many AI requests. Please wait a minute.' });
  next();
}

export const BUSY = 'Agents are busy with a previous request. Please wait a moment.';
export const RETAKE_COOLDOWN_MS = Number(process.env.MIRA_RETAKE_COOLDOWN_MIN ?? 10) * 60_000;

export function sendErr(res: Response, e: unknown) {
  if (e instanceof BusyError) return res.status(409).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: describeError(e) });
}

/** Every learner route requires a valid session and runs against that user's own database. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = userForSession(readSessionCookie(req));
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  res.locals.user = user;
  store.runAsUser(user.id, () => {
    store.getProfile(); // registers this learner's custom aims before any route resolves a role id
    next();
  });
}
