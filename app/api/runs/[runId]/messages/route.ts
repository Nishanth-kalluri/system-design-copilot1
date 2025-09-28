import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { connectDB, Run, Message } from '@/lib/db'

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

    const messages = await Message.find({ runId: params.runId })
      .sort({ createdAt: 1 })

    return NextResponse.json({
      messages: messages.map(msg => ({
        id: msg._id.toString(),
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}