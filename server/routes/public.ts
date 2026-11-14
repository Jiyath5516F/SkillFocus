// Public routes: health check and accounts (sign-up, sign-in, sign-out, session).
import express from 'express';
import { z } from 'zod';
import {
  authenticate,
  clearSessionCookie,
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  readSessionCookie,
  setSessionCookie,
  tooManyAttempts,
  userForSession,
  type User,
} from '../auth';
import * as store from '../db';
import { aiConfigured, MODEL } from '../llm';
import { seedNewAccount } from '../seed';
import { BASE } from '../http';

export const publicRouter = express.Router();

publicRouter.get('/health', (_req, res) => res.json({ ok: true, aiConfigured, model: aiConfigured ? MODEL : null }));

// ---- Accounts (public) ----
const SignupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.email('Enter a valid email address').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});
const LoginSchema = z.object({ email: z.string().trim().min(1).max(254), password: z.string().min(1).max(128) });
const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email });

publicRouter.post('/auth/signup', (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid sign-up details' });
  // Generous per IP: judges may share one venue network.
  if (tooManyAttempts([`signup:${req.ip}`], 40, 60 * 60_000))
    return res.status(429).json({ error: 'Too many sign-ups from this network. Try again later.' });
  if (findUserByEmail(parsed.data.email))
    return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  const user = createUser(parsed.data.name, parsed.data.email, parsed.data.password);
  store.runAsUser(user.id, () => seedNewAccount(user.name)); // empty profile; the setup wizard collects the details
  setSessionCookie(req, res, createSession(user.id), BASE);
  res.status(201).json({ user: publicUser(user) });
});

publicRouter.post('/auth/login', (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your email and password' });
  // Strict per account (stops password guessing), generous per IP (shared venue networks).
  if (
    tooManyAttempts([`login-email:${parsed.data.email.toLowerCase()}`], 10) ||
    tooManyAttempts([`login-ip:${req.ip}`], 100)
  ) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Please wait 15 minutes.' });
  }
  const user = authenticate(parsed.data.email, parsed.data.password);
  if (!user) return res.status(401).json({ error: 'Incorrect email or password' }); // generic: no account enumeration
  setSessionCookie(req, res, createSession(user.id), BASE);
  res.json({ user: publicUser(user) });
});

publicRouter.post('/auth/logout', (req, res) => {
  deleteSession(readSessionCookie(req));
  clearSessionCookie(res, BASE);
  res.json({ ok: true });
});

publicRouter.get('/auth/me', (req, res) => {
  const user = userForSession(readSessionCookie(req));
  res.json({ user: user ? publicUser(user) : null }); // 200 either way: "not signed in" is a normal state here
});
