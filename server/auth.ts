// Accounts and sessions. Passwords: scrypt with a per-user random salt, verified in constant time.
// Sessions: 256-bit random tokens in an HttpOnly cookie; only their SHA-256 hash is stored server-side.
import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { DATA_DIR, IN_MEMORY, openDatabase } from './db';
import { RateLimiter } from './rateLimit';

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

const SESSION_DAYS = 7;
export const SESSION_COOKIE = 'mira_session';
const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64 } as const;

const authDb = openDatabase(IN_MEMORY ? ':memory:' : join(DATA_DIR, 'auth.db'));
authDb.exec(`
CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS session (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);
`);

type Row = Record<string, unknown>;
const toUser = (r: Row): User => ({
  id: r.id as number,
  email: r.email as string,
  name: r.name as string,
  createdAt: r.created_at as string,
});

/** scrypt on libuv's thread pool, so hashing never blocks the event loop. */
const deriveKey = (password: string, salt: Buffer, keyLen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keyLen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, SCRYPT.keyLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await deriveKey(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

// Used when the email is unknown so a failed login takes the same time either way (no account enumeration by timing).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(12).toString('hex')));

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function findUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const r = authDb.prepare('SELECT * FROM user WHERE email = ?').get(normalizeEmail(email)) as Row | undefined;
  return r ? { ...toUser(r), passwordHash: r.password_hash as string } : null;
}

export async function createUser(name: string, email: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password);
  const res = authDb
    .prepare('INSERT INTO user (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(normalizeEmail(email), name.trim(), passwordHash, new Date().toISOString());
  return {
    id: Number(res.lastInsertRowid),
    email: normalizeEmail(email),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
}

/** Returns the user when the password matches; always spends one scrypt computation. */
export async function authenticate(email: string, password: string): Promise<User | null> {
  const u = findUserByEmail(email);
  const ok = await verifyPassword(password, u?.passwordHash ?? (await getDummyHash()));
  return u && ok ? { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt } : null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  authDb
    .prepare('INSERT INTO session (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, expires, new Date().toISOString());
  authDb.prepare('DELETE FROM session WHERE expires_at < ?').run(new Date().toISOString()); // opportunistic cleanup
  return token;
}

export function userForSession(token: string | undefined): User | null {
  if (!token) return null;
  const r = authDb
    .prepare('SELECT u.* FROM session s JOIN user u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .get(sha256(token), new Date().toISOString()) as Row | undefined;
  return r ? toUser(r) : null;
}

export function deleteSession(token: string | undefined) {
  if (token) authDb.prepare('DELETE FROM session WHERE token_hash = ?').run(sha256(token));
}

export function readSessionCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function setSessionCookie(req: Request, res: Response, token: string, basePath: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    path: basePath || '/',
    maxAge: SESSION_DAYS * 86_400_000,
  });
}

export function clearSessionCookie(res: Response, basePath: string) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', path: basePath || '/' });
}

// Sign-in: strict per account (stops password guessing), generous per IP (judges may share one venue network).
export const loginPerAccount = new RateLimiter(10, 15 * 60_000);
export const loginPerIp = new RateLimiter(100, 15 * 60_000);
export const signupPerIp = new RateLimiter(40, 60 * 60_000);
