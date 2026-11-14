// Claude provider adapter. Key and model are server-side only and configurable via env.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

// In the cloud dev container ANTHROPIC_* vars belong to the coding agent, so Mira uses its own names first.
const apiKey =
  process.env.SKILLFOCUS_ANTHROPIC_API_KEY || process.env.MIRA_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
export const MODEL = process.env.MIRA_MODEL || 'claude-opus-5-5';
/** Smaller model for short outputs (mentor summaries, matching explanations). */
export const FAST_MODEL = process.env.MIRA_FAST_MODEL || 'claude-haiku-5-5';
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORT = (process.env.MIRA_EFFORT || 'low') as Effort;
export const aiConfigured = apiKey.length > 0;

const client = aiConfigured
  ? new Anthropic({
      apiKey,
      authToken: null,
      baseURL: process.env.SKILLFOCUS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      timeout: 60_000,
      maxRetries: 1,
    })
  : null;

export class AIError extends Error {}

export interface LLMResult<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export function describeError(e: unknown): string {
  if (e instanceof AIError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'AI provider rejected the API key (401).';
  if (e instanceof Anthropic.PermissionDeniedError) return 'AI provider denied access (403).';
  if (e instanceof Anthropic.RateLimitError) return 'AI provider rate limit or quota reached (429). Try again shortly.';
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'AI request timed out.';
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the AI provider (network error).';
  if (e instanceof Anthropic.BadRequestError) return `AI request was invalid (400): ${e.message.slice(0, 200)}`;
  if (e instanceof Anthropic.APIError) return `AI provider error (${e.status ?? 'unknown'}).`;
  return e instanceof Error ? e.message : String(e);
}

function requireClient(): Anthropic {
  if (!client)
    throw new AIError('AI not configured: set SKILLFOCUS_ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY on the server).');
  return client;
}

/** Structured call: JSON output constrained by schema, then re-validated with zod. */
export async function structured<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
  model?: string;
}): Promise<LLMResult<z.infer<S>>> {
  const c = requireClient();
  const res = await c.messages.parse({
    model: opts.model ?? MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    output_config: { effort: EFFORT, format: zodOutputFormat(opts.schema) },
  });
  if (res.stop_reason === 'refusal') throw new AIError('Model declined this request.');
  if (res.stop_reason === 'max_tokens') throw new AIError('Model output was truncated (max_tokens).');
  const checked = opts.schema.safeParse(res.parsed_output);
  if (!checked.success) throw new AIError('Model output failed schema validation.');
  return { data: checked.data, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens, model: res.model };
}

/** Plain-text call (mentor). */
export async function text(opts: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  model?: string;
}): Promise<LLMResult<string>> {
  const c = requireClient();
  const res = await c.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: EFFORT },
  });
  if (res.stop_reason === 'refusal') throw new AIError('Model declined this request.');
  const out = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim();
  if (!out) throw new AIError('Model returned an empty response.');
  return { data: out, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens, model: res.model };
}
