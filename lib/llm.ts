import Groq from 'groq-sdk'
import { logger } from './logger'
import { generateId } from './id'

// Minimal, official-style Groq Chat Completions usage.
// We intentionally ignore any custom base URL env var to avoid misconfiguration.

export const DEFAULT_GROQ_MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-120b'
const LLM_API_KEY = process.env.LLM_API_KEY
if (!LLM_API_KEY) throw new Error('LLM_API_KEY is not set')

let _client: Groq | null = null
function client(): Groq {
  if (!_client) _client = new Groq({ apiKey: LLM_API_KEY }) // default base handled by SDK
  return _client
}

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

interface CallOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
  correlationId?: string
  runId?: string
  step?: string
}

// Dynamic token limits based on step complexity
function getTokenLimitForStep(step?: string, fallbackTokens?: number): number {
  if (fallbackTokens) return fallbackTokens // Explicit override
  
  // Early steps: smaller responses, basic analysis
  const earlySteps = ['REQUIREMENTS', 'FNFRS', 'ENTITIES']
  
  // Complex steps: detailed JSON with patches, comprehensive analysis
  const complexSteps = ['API', 'HLD', 'DEEPDIVE', 'CONCLUSION']
  
  if (step && earlySteps.includes(step)) {
    return 2048 // 2K tokens for early steps
  } else if (step && complexSteps.includes(step)) {
    return 8192 // 8K tokens for complex steps with patches
  }
  
  return 4096 // Default fallback
}

export async function callGroq(
  input: string | ChatMessage[],
  model: string = DEFAULT_GROQ_MODEL,
  opts: CallOptions = {}
): Promise<string> {
  const correlationId = opts.correlationId || generateId()
  const messages: ChatMessage[] = typeof input === 'string' ? [{ role: 'user', content: input }] : input
  const dynamicTokenLimit = getTokenLimitForStep(opts.step, opts.maxTokens)

  logger.info('LLM call', { 
    correlationId, 
    model, 
    count: messages.length, 
    step: opts.step,
    maxTokens: dynamicTokenLimit
  })
  const started = Date.now()
  const resp = await client().chat.completions.create({
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    // Dynamic token limit based on step complexity
    max_tokens: dynamicTokenLimit,
    // For GPT-OSS reasoning models the Python example shows reasoning_effort; in JS SDK this is experimental.
    // We pass it through only if provided to avoid errors on models that don't support it.
    ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } as any : {}),
  } as any)
  const content = resp.choices?.[0]?.message?.content || ''
  logger.info('LLM done', { correlationId, ms: Date.now() - started, chars: content.length })
  return content
}

// Simple streaming helper mirroring the Python pattern shown by the user.
export async function *streamGroq(
  prompt: string,
  options: CallOptions = {}
): AsyncGenerator<string, string, void> {
  const correlationId = options.correlationId || generateId()
  const model = options.model || DEFAULT_GROQ_MODEL
  const dynamicTokenLimit = getTokenLimitForStep(options.step, options.maxTokens)
  
  logger.info('LLM stream start', { 
    correlationId, 
    model,
    step: options.step,
    maxTokens: dynamicTokenLimit
  })
  let full = ''
  const stream = await client().chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.7,
    // Dynamic token limit based on step complexity
    max_tokens: dynamicTokenLimit,
    stream: true,
    ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } as any : {}),
  } as any)

  for await (const part of stream as any) {
    const delta: string = part?.choices?.[0]?.delta?.content || ''
    if (delta) {
      full += delta
      yield delta
    }
  }
  logger.info('LLM stream complete', { correlationId, chars: full.length })
  return full
}

// Convenience alias matching earlier code references if any.
export const invokeGroq = callGroq