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
    console.log('Approve route called for runId:', params.runId)
    
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      console.log('Approve: Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type } = await request.json()
    console.log('Approve: Request type:', type)
    if (type !== 'PATCH') {
      console.log('Approve: Invalid type, expected PATCH, got:', type)
      return NextResponse.json({ error: 'Invalid approval type' }, { status: 400 })
    }

    await connectDB()

    const run = await Run.findById(params.runId)
    console.log('Approve: Run found:', !!run, 'User match:', run?.userId.toString() === session.user.id)
    if (!run || run.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const pendingPatch = run.checkpoint?.pendingPatch
    console.log('Approve: Pending patch exists:', !!pendingPatch)
    if (!pendingPatch) {
      return NextResponse.json({ error: 'No pending patch' }, { status: 400 })
    }

    // Validate patch
    console.log('Approve: Validating patch:', JSON.stringify(pendingPatch, null, 2))
    const validation = validatePatch(pendingPatch)
    console.log('Approve: Validation result:', validation)
    if (!validation.valid) {
      console.log('Approve: Validation failed:', validation.error)
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

    // Log patch application for debugging
    console.log('Patch applied successfully:', {
      runId: params.runId,
      projectId: run.projectId,
      newVersion,
      elementCount: newElements.length,
      patchLabel: pendingPatch.label || 'Untitled'
    })

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