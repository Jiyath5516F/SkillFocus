// Loads a local .env (if present) before any module reads process.env. Import this first.
import { existsSync } from 'node:fs';

const file = process.env.MIRA_ENV_FILE ?? '.env';
if (existsSync(file)) process.loadEnvFile(file);
