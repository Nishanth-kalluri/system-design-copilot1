import { Step } from '../../db'
import type { MessageType } from '../../db'
import { callGroq, DEFAULT_GROQ_MODEL } from '../../llm'
import { readFileSync } from 'fs'
import { join } from 'path'
import { logger } from '../../logger'
import { generateId } from '../../id'

const SYSTEM_PROMPT = `You are the Principal Architect, an expert system designer. You guide users through a 7-step design process:

1. REQUIREMENTS - Gather functional requirements
2. FNFRS - Define non-functional requirements  
3. ENTITIES - Identify key entities and relationships
4. API - Design API endpoints and contracts
5. HLD - Create high-level design diagram (with Excalidraw patch)
6. DEEPDIVE - Optional deep dive into one area (with optional patch)
7. CONCLUSION - Summarize the design

Always respond with valid JSON in this format:
{
  "summary": "Brief summary of this step",
  "bullet_points": ["Key point 1", "Key point 2", "Key point 3"],
  "next_action_hint": "What the user should do next",
  "proposed_patch": {
    "adds": [{"id": "el1", "type": "rectangle", "x": 100, "y": 100, "width": 120, "height": 80, "text": "API Gateway"}],
    "updates": [],
    "deletes": [],
    "label": "HLD v1"
  }
}

Allowed element types: rectangle, ellipse, diamond, arrow, text
Keep patches simple (max 3 elements). Propose patches at HLD step and optionally at DEEPDIVE.
Text should be concise and professional.`

export async function executePrincipal(
  step: Step,
  deepDiveNo: number,
  userInput?: string,
  recentMessages: MessageType[] = [],
  meta: { runId?: string; correlationId?: string } = {}
): Promise<{ textForTranscript: string; pendingPatch?: any }> {
  const correlationId = meta.correlationId || generateId()
  try {
    logger.info('Principal.execute start', { correlationId, step, deepDiveNo, userInputPresent: !!userInput, recentMessages: recentMessages.length })

    const contextMessages = recentMessages.slice(-10).map(msg => ({
      role: msg.role.toLowerCase(),
      content: msg.content?.text || '',
    }))

    const userPrompt = buildUserPrompt(step, deepDiveNo, contextMessages, userInput)
    logger.info('Principal.prompt built', { correlationId, promptSnippet: userPrompt.slice(0, 300) })

    // Preferred: keep system + user separated for better grounding
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    const response = await callGroq(messages, DEFAULT_GROQ_MODEL, { correlationId, runId: meta.runId, step })
    logger.info('Principal.LLM raw response', { correlationId, responseSnippet: response.slice(0, 400) })

    // Try to parse JSON response
    let parsed: any
    try {
      parsed = JSON.parse(response)
    } catch (e) {
      logger.warn('Principal JSON parse failed, using fallback', { correlationId, error: (e as Error).message })
      // Fallback if JSON parsing fails
      parsed = {
        summary: response,
        bullet_points: ['Analysis completed'],
        next_action_hint: 'Please proceed to the next step'
      }
    }

    const textForTranscript = formatForTranscript(parsed)
    const pendingPatch = parsed.proposed_patch
    logger.info('Principal.execute success', { correlationId, textSnippet: textForTranscript.slice(0, 200), hasPatch: !!pendingPatch })
    return { textForTranscript, pendingPatch }
  } catch (error: any) {
    logger.error('Principal execution error', { correlationId, message: error?.message, stack: error?.stack })
    return {
      textForTranscript: 'I encountered an issue processing your request. Please try again.',
    }
  }
}

function buildUserPrompt(step: Step, deepDiveNo: number, context: any[], userInput?: string): string {
  let prompt = `Current step: ${step}\nDeep dive number: ${deepDiveNo}\n\n`
  
  if (context.length > 0) {
    prompt += 'Recent conversation:\n'
    context.forEach(msg => {
      prompt += `${msg.role}: ${msg.content}\n`
    })
    prompt += '\n'
  }

  if (userInput) {
    prompt += `User input: ${userInput}\n\n`
  }

  prompt += getStepInstructions(step, deepDiveNo)
  
  return prompt
}

function getStepInstructions(step: Step, deepDiveNo: number): string {
  const instructions = {
    REQUIREMENTS: 'Help the user define the functional requirements for their system. Ask clarifying questions about what the system should do.',
    FNFRS: 'Define non-functional requirements like scalability, performance, availability, security, etc.',
    ENTITIES: 'Identify the key entities, data models, and relationships in the system.',
    API: 'Design the API endpoints, request/response formats, and integration points.',
    HLD: 'Create a high-level design diagram. MUST propose an Excalidraw patch with key components.',
    DEEPDIVE: `Deep dive analysis (attempt ${deepDiveNo + 1}). Focus on one specific area that needs more detail or identify potential bottlenecks.`,
    CONCLUSION: 'Summarize the entire design and provide final recommendations.',
  }
  
  return instructions[step] || 'Continue with the design process.'
}

function formatForTranscript(parsed: any): string {
  let text = parsed.summary || 'Analysis completed.'
  
  if (parsed.bullet_points && parsed.bullet_points.length > 0) {
    text += '\n\nKey points:\n'
    parsed.bullet_points.forEach((point: string, index: number) => {
      text += `${index + 1}. ${point}\n`
    })
  }
  
  if (parsed.next_action_hint) {
    text += `\nNext: ${parsed.next_action_hint}`
  }
  
  return text
}