'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const startSession = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Design ${new Date().toLocaleString()}` }),
      })
      
      if (res.ok) {
        const { projectId } = await res.json()
        router.push(`/projects/${projectId}`)
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            System Design Copilot
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            AI-powered assistant for system architecture design
          </p>
          
          {session ? (
            <div className="space-y-4">
              <p className="text-lg text-gray-700">
                Welcome back, {session.user.name || session.user.username}!
              </p>
              <button
                onClick={startSession}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-lg transition-colors"
              >
                {loading ? 'Starting...' : 'Start Design Session'}
              </button>
            </div>
          ) : (
            <div className="space-x-4">
              <Link
                href="/auth/signin"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors inline-block"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg transition-colors inline-block"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}