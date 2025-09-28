import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Run, Project } from '@/lib/db'
import { logger } from '@/lib/logger'
import { generateId } from '@/lib/id'

export async function POST(request: NextRequest) {
  const correlationId = generateId()
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      logger.warn('Unauthorized run create', { correlationId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = await request.json()
    if (!projectId) {
      logger.warn('Missing projectId', { correlationId })
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    await connectDB()

    const project = await Project.findById(projectId)
    if (!project || project.ownerId.toString() !== session.user.id) {
      logger.warn('Project not found or unauthorized', { correlationId, projectId })
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check for existing running run
    let run = await Run.findOne({ 
      projectId, 
      userId: session.user.id, 
      status: 'RUNNING' 
    })

    if (!run) {
      run = new Run({
        projectId,
        userId: session.user.id,
        status: 'RUNNING',
        step: 'REQUIREMENTS',
        deepDiveNo: 0,
        checkpoint: {},
      })
      await run.save()
      logger.info('Run created', { correlationId, runId: run._id.toString(), projectId })
    } else {
      logger.info('Existing run reused', { correlationId, runId: run._id.toString(), projectId })
    }
    return NextResponse.json({ runId: run._id.toString(), correlationId })
  } catch (error) {
    logger.error('Create run error', { correlationId, message: (error as any)?.message, stack: (error as any)?.stack })
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 })
  }
}