import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Run, SceneVersion } from '@/lib/db'
import { validatePatch, applyPatch } from '@/lib/patches'
import { sseStore } from '@/lib/sse'

export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type } = await request.json()
    if (type !== 'PATCH') {
      return NextResponse.json({ error: 'Invalid approval type' }, { status: 400 })
    }

    await connectDB()

    const run = await Run.findById(params.runId)
    if (!run || run.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const pendingPatch = run.checkpoint?.pendingPatch
    if (!pendingPatch) {
      return NextResponse.json({ error: 'No pending patch' }, { status: 400 })
    }

    // Validate patch
    const validation = validatePatch(pendingPatch)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Load latest scene
    const latestScene = await SceneVersion.findOne({ projectId: run.projectId })
      .sort({ version: -1 })

    const currentElements = latestScene?.scene?.elements || []
    const newElements = applyPatch(currentElements, pendingPatch)

    // Create new scene version
    const newVersion = (latestScene?.version || 0) + 1
    const newScene = {
      type: 'excalidraw',
      version: 2,
      source: 'https://excalidraw.com',
      elements: newElements,
      appState: {
        gridSize: null,
        viewBackgroundColor: '#ffffff',
      },
      files: {},
    }

    const sceneVersion = new SceneVersion({
      projectId: run.projectId,
      runId: params.runId,
      version: newVersion,
      scene: newScene,
    })
    await sceneVersion.save()

    // Clear pending patch
    run.checkpoint = { ...run.checkpoint, pendingPatch: null }
    await run.save()

    const emitter = sseStore.get(params.runId)
    if (emitter) {
      emitter.emit('scene.updated', {
        version: newVersion,
        scene: newScene,
      })
      emitter.emit('run.status', {
        step: run.step,
        deepDiveNo: run.deepDiveNo,
        status: run.status,
        pendingPatch: null,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}