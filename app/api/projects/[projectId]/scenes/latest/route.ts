import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Project, SceneVersion } from '@/lib/db'
import { createEmptyScene } from '@/lib/excali'

export async function GET(
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

    const latestScene = await SceneVersion.findOne({ projectId: params.projectId })
      .sort({ version: -1 })

    if (!latestScene) {
      // Return empty scene
      return NextResponse.json({
        version: 0,
        scene: createEmptyScene(),
      })
    }

    return NextResponse.json({
      version: latestScene.version,
      scene: latestScene.scene,
    })
  } catch (error) {
    console.error('Get latest scene error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}