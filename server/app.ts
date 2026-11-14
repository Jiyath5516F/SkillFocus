// Mira Express application: /api routes and, in production, the built client — optionally under a base path (e.g. /Mira).
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE, requireAuth } from './http';
import { assessmentRouter } from './routes/assessments';
import { learnerRouter } from './routes/learner';
import { publicRouter } from './routes/public';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
});
app.use(express.json({ limit: '100kb' }));

// /api: public routes first, then the session guard, then the learner's own routes.
const api = express.Router();
api.use(publicRouter);
api.use(requireAuth);
api.use(learnerRouter);
api.use(assessmentRouter);
api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(`${BASE}/api`, api);

// Production: serve the built client.
const dist = resolve('dist');
if (existsSync(dist)) {
  app.use(BASE || '/', express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || (!req.path.startsWith(`${BASE}/`) && req.path !== BASE)) return next();
    res.sendFile(resolve(dist, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status;
  if (status === 400) return res.status(400).json({ error: 'Malformed JSON body' });
  if (status === 413) return res.status(413).json({ error: 'Request body too large' });
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});
