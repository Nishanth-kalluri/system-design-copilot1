import { NextRequest, NextResponse } from 'next/server'
import { connectDB, User } from '@/lib/db'
import { hashPassword } from '@/lib/crypto'

export async function POST(request: NextRequest) {
  try {
    const { username, password, name } = await request.json()

    // Validation
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
    }

    await connectDB()

    // Check if user exists
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)
    
    const user = new User({
      username,
      name: name || undefined,
      passwordHash,
    })

    await user.save()

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}