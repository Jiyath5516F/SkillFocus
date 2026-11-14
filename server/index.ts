// Mira server entry point: load env, prepare the database, start listening.
import './env';
import { app } from './app';
import { aiConfigured, MODEL } from './llm';

const PORT = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || '0.0.0.0';
const BASE = (process.env.MIRA_BASE_PATH || '').replace(/\/+$/, '');


app.listen(PORT, HOST, () => {
  console.log(`Mira listening on http://${HOST}:${PORT}${BASE}/ (AI ${aiConfigured ? `enabled: ${MODEL}` : 'NOT configured — rule-based fallback'})`);
});
