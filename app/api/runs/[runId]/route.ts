import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Run } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const run = await Run.findById(params.runId)
    if (!run || run.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    return NextResponse.json({
      run: {
        id: run._id.toString(),
        step: run.step,
        deepDiveNo: run.deepDiveNo,
        status: run.status,
        checkpoint: run.checkpoint,
      },
    })
  } catch (error) {
    console.error('Get run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}