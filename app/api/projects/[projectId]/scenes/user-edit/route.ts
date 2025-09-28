import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Project } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const project = await Project.findById(params.projectId)
    if (!project || project.ownerId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Log user edit (MVP implementation)
    logger.info('User edited scene', { projectId: params.projectId, userId: session.user.id })

    return NextResponse.json({ changed: true })
  } catch (error) {
    console.error('User edit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}