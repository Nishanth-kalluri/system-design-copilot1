import { logger } from './logger'
import { generateId } from './id'
import Groq from 'groq-sdk'

// Allow overriding both base and model via env vars
// We now use the official Groq SDK (mirrors the Python example provided by user)
// Defaults can still be overridden via env vars.
const LLM_API_BASE = process.env.LLM_API_BASE || 'https://api.groq.com/openai/v1'
export const DEFAULT_GROQ_MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
const LLM_API_KEY = process.env.LLM_API_KEY

// Lazy singleton Groq client (so build tools that tree-shake don't eagerly include polyfills)
let _groqClient: Groq | null = null
function getGroqClient(): Groq {
  if (!_groqClient) {
    if (!LLM_API_KEY) throw new Error('LLM_API_KEY is not set')
    _groqClient = new Groq({ apiKey: LLM_API_KEY, baseURL: LLM_API_BASE })
  }
  return _groqClient
}

interface LLMCallMeta {
  correlationId?: string
  runId?: string
  step?: string
}

function truncate(str: string, max = 800): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + `... [truncated ${str.length - max} chars]` : str
}

/**
 * Core Groq chat invocation. Accepts either an array of messages (OpenAI format) or a raw prompt string.
 * If a string is provided it is wrapped as a single user message (Python ChatGroq parity: llm.invoke(prompt)).
 */
export async function callGroq(
  input: string | { role: string; content: string }[],
  model = DEFAULT_GROQ_MODEL,
  meta: LLMCallMeta = {}
): Promise<string> {
  const correlationId = meta.correlationId || generateId()
  const client = getGroqClient()

  const messages = (typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input) as { role: 'user' | 'assistant' | 'system'; content: string }[]

  logger.info('LLM request start', {
    correlationId,
    model,
    runId: meta.runId,
    step: meta.step,
    messagesCount: messages.length
  })

  try {
    const started = Date.now()
    const chatCompletion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.2, // aligned with user's Python example
      max_tokens: 1024,
    })
    const latencyMs = Date.now() - started
    const content = chatCompletion.choices?.[0]?.message?.content || ''

    logger.info('LLM request success', {
      correlationId,
      latencyMs,
      contentSnippet: truncate(content, 400)
    })
    return content
  } catch (err: any) {
    logger.error('LLM exception', { correlationId, message: err?.message })
    throw err
  }
}

/** Convenience alias paralleling Python ChatGroq llm.invoke(prompt). */
export async function invokeGroq(prompt: string, model = DEFAULT_GROQ_MODEL, meta: LLMCallMeta = {}) {
  return callGroq(prompt, model, meta)
}

/**
 * buildLlamaChatStylePrompt replicates the Python example shared by the user.
 * It creates a SINGLE user message that already embeds system / examples / history / context
 * using the Llama 3 style special tokens (<|begin_of_text|>, <|start_header_id|>, etc.).
 * This is intentionally different from the standard multi-message OpenAI style above and
 * matches the EXACT method the user provided (single call with messages=[{"role":"user","content": prompt}]).
 */
export function buildLlamaChatStylePrompt(opts: {
  systemPrompt: string
  fewShotExamples?: string
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
  contextDocuments?: string[]
  query: string
}): string {
  const {
    systemPrompt,
    fewShotExamples = '',
    conversationHistory = [],
    contextDocuments = [],
    query
  } = opts

  // Recent conversation limited to last 4 (mirroring Python snippet logic)
  const recent = conversationHistory.slice(-4)
  let convHistoryStr = ''
  for (const msg of recent) {
    if (msg.role === 'user') convHistoryStr += `User: ${msg.content}\n`
    else convHistoryStr += `Assistant: ${msg.content}\n`
  }

  const context = contextDocuments.join('\n')

  let prompt = ''
  prompt += `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${systemPrompt}<|eot_id|>`

  if (fewShotExamples) {
    prompt += `<|start_header_id|>user<|end_header_id|>\nHere are some examples of how you should respond:\n${fewShotExamples}<|eot_id|>`
    prompt += `<|start_header_id|>assistant<|end_header_id|>\nI understand. I'll follow these examples when answering questions.<|eot_id|>`
  }

  if (convHistoryStr) {
    prompt += `<|start_header_id|>user<|end_header_id|>\nHere's our recent conversation history:\n${convHistoryStr}<|eot_id|>`
    prompt += `<|start_header_id|>assistant<|end_header_id|>\nThank you for providing the conversation history. I'll keep it in mind for context.<|eot_id|>`
  }

  if (context) {
    prompt += `<|start_header_id|>user<|end_header_id|>\nHere is additional relevant context:\n${context}<|eot_id|>`
    prompt += `<|start_header_id|>assistant<|end_header_id|>\nThank you for providing the context. I'll use this information to answer accurately.<|eot_id|>`
  }

  // Final user query
  prompt += `<|start_header_id|>user<|end_header_id|>\n${query}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`
  return prompt
}

/**
 * invokeGroqSinglePrompt: EXACT calling method requested (single user message containing the whole
 * formatted prompt). This bypasses the multi-message separation and mirrors the Python example.
 */
export async function invokeGroqSinglePrompt(
  prompt: string,
  model = DEFAULT_GROQ_MODEL,
  meta: LLMCallMeta = {}
): Promise<string> {
  const correlationId = meta.correlationId || generateId()
  const client = getGroqClient()
  logger.info('LLM single-prompt request start', { correlationId, model, step: meta.step })
  try {
    const started = Date.now()
    const chatCompletion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    })
    const latencyMs = Date.now() - started
    const content = chatCompletion.choices?.[0]?.message?.content || ''
    logger.info('LLM single-prompt success', { correlationId, latencyMs, contentSnippet: truncate(content, 400) })
    return content
  } catch (err: any) {
    logger.error('LLM single-prompt exception', { correlationId, message: err?.message })
    throw err
  }
}

/**
 * Stream tokens from a GPT-OSS style model using the exact single-message streaming pattern
 * shown in the official example the user provided. It returns both the full accumulated text
 * and yields partial chunks via an async generator interface.
 */
export async function *streamGroqGptOss(
  prompt: string,
  options: {
    model?: string
    temperature?: number
    maxCompletionTokens?: number
    topP?: number
    reasoningEffort?: 'low' | 'medium' | 'high'
    correlationId?: string
  } = {}
): AsyncGenerator<{ chunk: string; full: string }, { full: string }, void> {
  const {
    model = 'openai/gpt-oss-20b', // Model name exactly as in example (version not hard-coded elsewhere)
    temperature = 1,
    maxCompletionTokens = 8192,
    topP = 1,
    reasoningEffort = 'medium',
    correlationId = generateId(),
  } = options

  const client = getGroqClient()
  logger.info('LLM streaming start', { correlationId, model })
  let full = ''
  try {
    const started = Date.now()
    const stream = await client.chat.completions.create({
      model,
      messages: [ { role: 'user', content: prompt } ],
      temperature,
      max_completion_tokens: maxCompletionTokens,
      top_p: topP,
      reasoning_effort: reasoningEffort,
      stream: true,
      stop: null as any, // match example; explicit null
    } as any)

    for await (const chunk of stream as any) {
      const delta: string = chunk?.choices?.[0]?.delta?.content || ''
      if (delta) {
        full += delta
        yield { chunk: delta, full }
      }
    }
    const latencyMs = Date.now() - started
    logger.info('LLM streaming complete', { correlationId, model, latencyMs, totalChars: full.length })
    return { full }
  } catch (err: any) {
    logger.error('LLM streaming error', { correlationId, message: err?.message })
    throw err
  }
}