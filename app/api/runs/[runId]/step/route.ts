import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Run, Message } from '@/lib/db'
import { executePrincipal } from '@/lib/agents/nodes/principal'
import { getNextStep } from '@/lib/agents/graph'
import { sseStore, broadcastMessage } from '@/lib/sse'
import { logger } from '@/lib/logger'
import { generateId } from '@/lib/id'

export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const correlationId = generateId()
  console.log('=== STEP API CALLED ===', { correlationId, runId: params.runId, timestamp: new Date().toISOString() })
  try {
    logger.info('Step route POST start', { correlationId, runId: params.runId })
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      logger.warn('Unauthorized step attempt', { correlationId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, userInput } = await request.json()
    logger.info('Step route payload', { correlationId, action, hasUserInput: !!userInput, userId: session.user.id })

    await connectDB()

    const run = await Run.findById(params.runId)
    if (!run || run.userId.toString() !== session.user.id) {
      logger.warn('Run not found or unauthorized access', { correlationId, runExists: !!run })
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const emitter = sseStore.get(params.runId)
    logger.info('SSE emitter lookup', { correlationId, runId: params.runId, hasEmitter: !!emitter, storeSize: sseStore.size })

    // Handle user input
    if (userInput) {
      const userMessage = new Message({
        runId: params.runId,
        role: 'USER',
        content: { text: userInput, step: run.step },
      })
      try {
        await userMessage.save()
        logger.info('User message saved', { correlationId, messageId: userMessage._id.toString(), step: run.step })
      } catch (saveError) {
        logger.error('Failed to save user message', { correlationId, error: (saveError as any)?.message })
        throw saveError
      }

      const userMessageData = {
        id: userMessage._id.toString(),
        role: 'USER',
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      }
      logger.info('Broadcasting user message', { correlationId, messageId: userMessageData.id })
      const broadcasted = broadcastMessage(params.runId, 'message.added', userMessageData)
      if (!broadcasted) {
        logger.warn('No active SSE connections found for user message', { correlationId, runId: params.runId })
      }
    }

    // Get recent messages for context
    const recentMessages = await Message.find({ runId: params.runId })
      .sort({ createdAt: -1 })
      .limit(10)
    logger.info('Fetched recent messages', { correlationId, count: recentMessages.length })

    // Execute Principal agent
    const { textForTranscript, pendingPatch } = await executePrincipal(
      run.step,
      run.deepDiveNo,
      userInput,
      recentMessages,
      { runId: params.runId, correlationId }
    )
    logger.info('Principal message produced', { correlationId, textSnippet: textForTranscript.slice(0, 160), hasPatch: !!pendingPatch })

    // Create Principal message
    const principalMessage = new Message({
      runId: params.runId,
      role: 'PRINCIPAL',
      content: { text: textForTranscript, step: run.step },
    })
    try {
      await principalMessage.save()
      logger.info('Principal message saved', { correlationId, messageId: principalMessage._id.toString(), step: run.step })
    } catch (saveError) {
      logger.error('Failed to save principal message', { correlationId, error: (saveError as any)?.message })
      throw saveError
    }

    const principalMessageData = {
      id: principalMessage._id.toString(),
      role: 'PRINCIPAL',
      content: principalMessage.content,
      createdAt: principalMessage.createdAt,
    }
    logger.info('Broadcasting principal message', { correlationId, messageId: principalMessageData.id })
    const broadcasted = broadcastMessage(params.runId, 'message.added', principalMessageData)
    if (!broadcasted) {
      logger.warn('No active SSE connections found for principal message', { correlationId, runId: params.runId })
    }

    // Advance step
    let nextStep = run.step
    let newDeepDiveNo = run.deepDiveNo

    if (action === 'NEXT' || !action) {
      const calculated = getNextStep(run.step, run.deepDiveNo)
      if (calculated) {
        nextStep = calculated
        if (calculated === 'DEEPDIVE') {
          newDeepDiveNo = run.deepDiveNo + 1
        }
      }
    } else if (action === 'DEEP_DIVE_ONCE' && run.deepDiveNo === 0) {
      nextStep = 'DEEPDIVE'
      newDeepDiveNo = 1
    }
    logger.info('Step progression decision', { correlationId, prevStep: run.step, nextStep, prevDeepDive: run.deepDiveNo, newDeepDiveNo })

    // Update run
    run.step = nextStep
    run.deepDiveNo = newDeepDiveNo
    run.checkpoint = { ...run.checkpoint, pendingPatch }
    try {
      await run.save()
      logger.info('Run updated', { correlationId, runId: run._id.toString(), step: run.step, deepDiveNo: run.deepDiveNo, hasPendingPatch: !!pendingPatch })
    } catch (saveError) {
      logger.error('Failed to save run', { correlationId, error: (saveError as any)?.message })
      throw saveError
    }

    broadcastMessage(params.runId, 'run.status', {
      step: nextStep,
      deepDiveNo: newDeepDiveNo,
      status: run.status,
      pendingPatch,
    })

    logger.info('Step route POST success', { correlationId })
    return NextResponse.json({ ok: true, correlationId })
  } catch (error) {
    logger.error('Step route error', { correlationId, message: (error as any)?.message, stack: (error as any)?.stack })
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 })
  }
}