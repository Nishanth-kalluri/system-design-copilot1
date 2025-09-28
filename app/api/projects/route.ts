import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Project } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    await connectDB()

    const project = new Project({
      ownerId: session.user.id,
      name,
    })

    await project.save()

    return NextResponse.json({ projectId: project._id.toString() })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}