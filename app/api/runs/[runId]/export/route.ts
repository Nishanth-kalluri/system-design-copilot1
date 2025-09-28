import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Run, Message, SceneVersion } from '@/lib/db'
import { createZipContent } from '@/lib/zip'

interface LeanRun { _id: any; userId: any; projectId: any }
interface LeanSceneVersion { _id: any; scene?: any }

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    await connectDB()

  const run = await Run.findById(params.runId).lean<LeanRun | null>() as LeanRun | null
    if (!run || run.userId.toString() !== session.user.id) {
      return new Response('Run not found', { status: 404 })
    }

    // Get latest scene
    const latestScene = await SceneVersion.findOne({ projectId: run.projectId })
      .sort({ version: -1 })
      .lean<LeanSceneVersion | null>() as LeanSceneVersion | null

    // Get all principal messages grouped by step
    // Stream-like accumulation: only pull required fields, lean docs to reduce overhead
    const messages = await Message.find({ 
      runId: params.runId, 
      role: 'PRINCIPAL' 
    }, { 'content.text': 1, 'content.step': 1, createdAt: 1 })
      .sort({ createdAt: 1 })
      .lean()

    // Basic guardrail to avoid OOM if something goes wrong (e.g., runaway generation)
    const MAX_MESSAGES = 5000
    if (messages.length > MAX_MESSAGES) {
      return new Response(`Export too large (>${MAX_MESSAGES} messages). Please narrow scope.`, { status: 413 })
    }

    const stepSummaries: Record<string, string[]> = {}
    messages.forEach(msg => {
      const step = msg.content.step || 'UNKNOWN'
      if (!stepSummaries[step]) {
        stepSummaries[step] = []
      }
      stepSummaries[step].push(msg.content.text || '')
    })

    // Create summary markdown
    let summary = '# System Design Summary\n\n'
    Object.entries(stepSummaries).forEach(([step, texts]) => {
      summary += `## ${step}\n\n${texts.join('\n\n')}\n\n`
    })

    const scene = latestScene?.scene || { elements: [] }
    const stream = createZipContent(scene, summary)

    return new Response(stream, {
      headers: {
        // Still advertise as zip for compatibility; consider custom mime if keeping pseudo format long term.
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="design-export.zip"',
        'Cache-Control': 'no-store',
        'Transfer-Encoding': 'chunked'
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}