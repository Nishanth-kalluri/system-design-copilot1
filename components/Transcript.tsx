'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'USER' | 'PRINCIPAL' | 'SYSTEM'
  content: {
    text: string
    step?: string
  }
  createdAt: string
}

interface TranscriptProps {
  messages: Message[]
  onUserInput: (input: string) => Promise<void>
  isLoading?: boolean
}

export function Transcript({ messages, onUserInput, isLoading = false }: TranscriptProps) {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('=== FORM SUBMITTED ===', { input: input.trim(), isSubmitting })
    if (input.trim() && !isSubmitting) {
      setIsSubmitting(true)
      console.log('Calling onUserInput with:', input.trim())
      try {
        await onUserInput(input.trim())
        console.log('onUserInput completed successfully')
        setInput('')
      } catch (error) {
        console.error('Failed to send message:', error)
        // Keep the input so user can retry
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Design Conversation</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${
              message.role === 'USER'
                ? 'ml-8'
                : message.role === 'PRINCIPAL'
                ? 'mr-8'
                : 'mx-4'
            }`}
          >
            <div
              className={`rounded-lg p-3 ${
                message.role === 'USER'
                  ? 'bg-blue-100 text-blue-900'
                  : message.role === 'PRINCIPAL'
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-yellow-50 text-yellow-800'
              }`}
            >
              <div className="text-xs font-medium mb-1 opacity-70">
                {message.role === 'USER' ? 'You' : 
                 message.role === 'PRINCIPAL' ? 'Principal Architect' : 'System'}
                {message.content.step && ` • ${message.content.step}`}
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {message.content.text}
              </div>
            </div>
          </div>
        ))}
        {(isLoading || isSubmitting) && (
          <div className="flex justify-center py-4">
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Processing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border border-gray-300 rounded-md resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isSubmitting || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
