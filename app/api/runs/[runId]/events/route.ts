import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Run } from '@/lib/db'
import { sseHeaders, SSEEmitter, sseStore } from '@/lib/sse'

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

    const run = await Run.findById(params.runId)
    if (!run || run.userId.toString() !== session.user.id) {
      return new Response('Run not found', { status: 404 })
    }

    const stream = new ReadableStream({
      start(controller) {
        // If an existing emitter for this runId exists, close it to avoid orphaned heartbeat intervals
        const existing = sseStore.get(params.runId)
        if (existing) {
          console.log('Closing existing SSE emitter for runId:', params.runId)
          try { existing.close() } catch {}
          sseStore.delete(params.runId)
        }

        const emitter = new SSEEmitter()
        emitter.setController(controller)
        console.log('Setting new SSE emitter for runId:', params.runId)
        sseStore.set(params.runId, emitter)

        // Send initial status
        console.log('SSE connection established for runId:', params.runId, 'userId:', session.user.id)
        const initialStatus = {
          step: run.step,
          deepDiveNo: run.deepDiveNo,
          status: run.status,
          pendingPatch: run.checkpoint?.pendingPatch || null,
        }
        console.log('Sending initial status:', initialStatus)
        emitter.emit('run.status', initialStatus)
      },
      cancel() {
        const emitter = sseStore.get(params.runId)
        if (emitter) {
          emitter.close()
          sseStore.delete(params.runId)
        }
      },
    })

    return new Response(stream, { headers: sseHeaders() })
  } catch (error) {
    console.error('SSE error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}