import { Step } from '../../db'
import type { MessageType } from '../../db'
import { callGroq, DEFAULT_GROQ_MODEL } from '../../llm'
import { readFileSync } from 'fs'
import { join } from 'path'
import { logger } from '../../logger'
import { generateId } from '../../id'

const SYSTEM_PROMPT = `You are the Principal Architect, a world-class system design expert. You guide users through a comprehensive 7-step design process, providing detailed analysis at each stage similar to top-tier system design interviews.

DESIGN PROCESS OVERVIEW:
1. REQUIREMENTS - Functional & out-of-scope requirements with clear boundaries
2. FNFRS - Non-functional requirements with specific metrics and constraints
3. ENTITIES - Core data models, relationships, and capacity estimation
4. API - Complete API contracts with request/response examples and data flows
5. HLD - High-level architecture with component interactions (with Excalidraw patch)
6. DEEPDIVE - Deep technical analysis of critical components with tradeoffs
7. CONCLUSION - Final architecture summary with key design decisions

RESPONSE FORMAT:
Always respond with valid JSON in this exact format:
{
  "summary": "Comprehensive summary covering all key aspects of this step",
  "bullet_points": ["Detailed point 1 with specifics", "Detailed point 2 with numbers/examples", "Detailed point 3 with constraints"],
  "next_action_hint": "Clear guidance on what the user should focus on next",
  "proposed_patch": {
    "adds": [{"id": "el1", "type": "rectangle", "x": 100, "y": 100, "width": 120, "height": 80, "text": "Component Name"}],
    "updates": [],
    "deletes": [],
    "label": "Architecture v1"
  }
}

QUALITY STANDARDS FOR EACH STEP:

REQUIREMENTS:
- List 4-6 specific functional requirements with clear user actions
- Define explicit out-of-scope items to set boundaries
- Include user personas or usage patterns if relevant
- Be specific about what the system MUST do vs what it won't handle

FNFRS (Non-Functional Requirements):
- Provide specific metrics (latency <300ms, 99.9% availability, etc.)
- Include scale requirements (DAU, requests/sec, data volume)
- Address consistency requirements (strong vs eventual)
- Cover security, compliance, and operational constraints
- Mention explicit out-of-scope qualities

ENTITIES:
- Define 4-6 core entities with key attributes
- Show relationships between entities
- Include capacity estimation with calculations
- Consider data access patterns and storage requirements
- Estimate storage needs, read/write ratios, and growth patterns

API:
- Design 4-8 RESTful endpoints with full HTTP details
- Provide complete request/response JSON examples
- Include authentication/authorization approach
- Show error handling and status codes
- Document rate limiting and validation rules
- Describe complete data flow for key user journeys

HLD (High-Level Design):
- Identify 6-10 major system components
- Show clear component responsibilities and boundaries
- Include databases, caches, external services
- Consider load balancers, CDNs, and infrastructure
- MUST include Excalidraw patch with key architectural components
- Address data flow between components

DEEPDIVE:
- Pick 2-3 most critical/complex areas for deep analysis
- Present multiple solution options with explicit tradeoffs
- Include specific technology choices with justification
- Address scalability bottlenecks and solutions
- Consider failure modes and mitigation strategies
- Optionally include Excalidraw patch for detailed component design

CONCLUSION:
- Summarize key architectural decisions and rationale
- Highlight main scalability and reliability strategies
- List critical tradeoffs made and their implications
- Provide deployment and operational considerations
- Suggest monitoring and metrics strategy

TECHNICAL DEPTH REQUIREMENTS:
- Use specific numbers and calculations where possible
- Reference real technologies (Redis, Cassandra, Kafka, etc.)
- Consider CAP theorem implications
- Address horizontal vs vertical scaling strategies
- Include caching strategies and data partitioning approaches
- Consider failure handling and circuit breaker patterns

Allowed Excalidraw element types: rectangle, ellipse, diamond, arrow, text
Keep patches focused. Always propose patches at HLD step and optionally at DEEPDIVE.
Make responses comprehensive and interview-ready with the depth expected at senior engineering levels.`

export async function executePrincipal(
  step: Step,
  deepDiveNo: number,
  userInput?: string,
  recentMessages: MessageType[] = [],
  currentScene?: any,
  meta: { runId?: string; correlationId?: string } = {}
): Promise<{ textForTranscript: string; pendingPatch?: any }> {
  const correlationId = meta.correlationId || generateId()
  try {
    logger.info('Principal.execute start', { correlationId, step, deepDiveNo, userInputPresent: !!userInput, recentMessages: recentMessages.length })

    const contextMessages = recentMessages.slice(-10).map(msg => ({
      role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: msg.content?.text || '',
    }))

    const userPrompt = buildUserPrompt(step, deepDiveNo, contextMessages, userInput, currentScene)
    logger.info('Principal.prompt built', { correlationId, promptSnippet: userPrompt.slice(0, 300) })

    // Preferred: keep system + user separated for better grounding
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt }
    ]

    const response = await callGroq(messages, DEFAULT_GROQ_MODEL, { correlationId, runId: meta.runId, step })
    logger.info('Principal.LLM raw response', { correlationId, responseSnippet: response })

    // Try to parse JSON response
    let parsed: any
    try {
      parsed = JSON.parse(response)
    } catch (e) {
      logger.warn('Principal JSON parse failed, using fallback', { 
        correlationId, 
        error: (e as Error).message,
        responseLength: response.length,
        responseEnd: response.slice(-100) // Last 100 chars to see where it cut off
      })
      // Fallback if JSON parsing fails
      parsed = {
        summary: response.length > 200 ? response.slice(0, 200) + '...' : response,
        bullet_points: ['JSON parsing failed - likely due to truncated response'],
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

function buildUserPrompt(step: Step, deepDiveNo: number, context: any[], userInput?: string, currentScene?: any): string {
  let prompt = `Current step: ${step}\nDeep dive number: ${deepDiveNo}\n\n`
  
  // Add intelligent scene context (token-efficient)
  if (currentScene?.elements && currentScene.elements.length > 0) {
    prompt += `Current diagram state (${currentScene.elements.length} elements):\n`
    prompt += summarizeSceneElements(currentScene.elements)
    prompt += '\n'
  } else {
    prompt += 'Current diagram: Empty (no elements)\n\n'
  }
  
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
    REQUIREMENTS: `Define comprehensive functional requirements with clear boundaries. Include 4-6 specific user actions the system must support. Explicitly list what's out of scope to set clear expectations. Consider different user types and their core workflows. Ask clarifying questions about edge cases and business constraints.`,
    
    FNFRS: `Establish specific non-functional requirements with measurable targets. Include scale metrics (DAU, requests/sec, data volume), performance targets (latency <Xms, throughput), availability requirements (99.X%), consistency needs (strong vs eventual), security constraints, and compliance requirements. Mention what quality attributes are explicitly out of scope.`,
    
    ENTITIES: `Identify 4-6 core data entities with their key attributes and relationships. Provide capacity estimation with calculations (storage size, growth rate, read/write ratios). Consider data access patterns and how entities relate to user workflows. Include data lifecycle considerations and archival strategies.`,
    
    API: `Design a complete REST API with 4-8 endpoints covering all major user journeys. Provide full HTTP method details, request/response JSON examples, authentication approach, error codes, and validation rules. Show the complete data flow from client request to database and back. Include rate limiting and security considerations.`,
    
    HLD: `Create a comprehensive high-level architecture with 6-10 major components. Show clear responsibilities for each service, data flow between components, database choices, caching layers, and external integrations. MUST include an Excalidraw patch showing the key architectural components and their relationships. Consider load balancers, CDNs, and infrastructure components.`,
    
    DEEPDIVE: `Perform deep technical analysis (attempt ${deepDiveNo + 1}) of 2-3 critical system areas. Present multiple solution options with explicit tradeoffs, specific technology choices with justification, scalability bottlenecks and solutions, failure modes and mitigation strategies. Consider caching strategies, data partitioning, and consistency patterns. Optionally include detailed Excalidraw patches.`,
    
    CONCLUSION: `Provide a comprehensive architecture summary highlighting key design decisions and their rationale. Include main scalability and reliability strategies, critical tradeoffs and their implications, deployment considerations, monitoring strategy, and potential future optimizations. Summarize the complete solution from requirements to implementation.`,
  }
  
  return instructions[step] || 'Continue with the comprehensive design process following the established quality standards.'
}

function summarizeSceneElements(elements: any[]): string {
  if (!elements || elements.length === 0) {
    return 'No elements present'
  }

  // Group elements by type for efficient summarization
  const elementsByType: Record<string, any[]> = {}
  elements.forEach(el => {
    if (!elementsByType[el.type]) {
      elementsByType[el.type] = []
    }
    elementsByType[el.type].push(el)
  })

  let summary = ''
  
  // Summarize each type
  Object.entries(elementsByType).forEach(([type, elements]) => {
    const count = elements.length
    const textsWithPositions = elements
      .filter(el => el.text && el.text.trim().length > 0)
      .map(el => `"${el.text.slice(0, 30)}${el.text.length > 30 ? '...' : ''}" at (${Math.round(el.x)},${Math.round(el.y)})`)
      .slice(0, 3) // Limit to first 3 elements per type
    
    if (textsWithPositions.length > 0) {
      summary += `- ${count} ${type}(s): ${textsWithPositions.join(', ')}`
      if (count > 3) {
        summary += ` + ${count - 3} more`
      }
      summary += '\\n'
    } else {
      summary += `- ${count} ${type}(s) (no text)\\n`
    }
  })

  // Add layout bounds info
  const xs = elements.map(el => el.x).filter(x => typeof x === 'number')
  const ys = elements.map(el => el.y).filter(y => typeof y === 'number')
  if (xs.length > 0 && ys.length > 0) {
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    summary += `- Layout bounds: (${Math.round(minX)},${Math.round(minY)}) to (${Math.round(maxX)},${Math.round(maxY)})\\n`
  }

  return summary
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