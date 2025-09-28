'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MessagePoller } from '@/lib/message-polling'
import { CanvasPane } from '@/components/CanvasPane'
import { Transcript } from '@/components/Transcript'
import { Stepper } from '@/components/Stepper'
import { Controls } from '@/components/Controls'
import { ApprovalDrawer } from '@/components/ApprovalDrawer'

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [runId, setRunId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [currentStep, setCurrentStep] = useState('REQUIREMENTS')
  const [deepDiveNo, setDeepDiveNo] = useState(0)
  const [pendingPatch, setPendingPatch] = useState<any>(null)
  const [scene, setScene] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const pollerRef = useRef<MessagePoller | null>(null)
  const MAX_MESSAGES = 500 // prevent unbounded growth in client memory

  useEffect(() => {
    console.log('=== EFFECT TRIGGERED ===', { session: !!session, projectId: params.projectId })
    if (!session) {
      console.log('No session, waiting for authentication')
      return
    }

    console.log('Session found, initializing...')
    initializeSession()
  }, [session, params.projectId])

  const initializeSession = async () => {
    try {
      // Create/get run
      const runRes = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.projectId }),
      })
      
      if (!runRes.ok) throw new Error('Failed to create run')
      
      const { runId: newRunId } = await runRes.json()
      console.log('=== RUN CREATED ===', { newRunId, projectId: params.projectId })
      setRunId(newRunId)

      // Load scene
      const sceneRes = await fetch(`/api/projects/${params.projectId}/scenes/latest`)
      if (sceneRes.ok) {
        const { scene: sceneData } = await sceneRes.json()
        setScene(sceneData)
      }

      // Load messages
      const messagesRes = await fetch(`/api/runs/${newRunId}/messages`)
      if (messagesRes.ok) {
        const { messages: messagesData } = await messagesRes.json()
        console.log('Initial messages loaded:', messagesData)
        setMessages(messagesData)
      } else {
        console.error('Failed to load messages:', messagesRes.status, messagesRes.statusText)
      }

      // Setup polling
      setupPolling(newRunId)
      
      setLoading(false)
    } catch (error) {
      console.error('Session initialization error:', error)
      setLoading(false)
    }
  }

  const setupPolling = (runId: string) => {
    console.log('Setting up message polling for runId:', runId)
    
    // Cleanup existing poller
    if (pollerRef.current) {
      pollerRef.current.stop()
    }

    const poller = new MessagePoller(
      runId,
      (newMessages) => {
        console.log('Polling received messages:', newMessages.length)
        setMessages(newMessages)
      },
      (error) => {
        console.error('Polling error:', error)
        setConnected(false)
      }
    )

    pollerRef.current = poller
    poller.start()
    setConnected(true)
    
    // Also poll for run status updates
    pollRunStatus(runId)
  }

  const pollRunStatus = async (runId: string) => {
    try {
      const response = await fetch(`/api/runs/${runId}`)
      if (response.ok) {
        const { run } = await response.json()
        setCurrentStep(run.step)
        setDeepDiveNo(run.deepDiveNo)
        setPendingPatch(run.checkpoint?.pendingPatch || null)
      }
    } catch (error) {
      console.error('Run status polling error:', error)
    }
  }

  const cleanupPoller = () => {
    if (pollerRef.current) {
      pollerRef.current.stop()
      pollerRef.current = null
    }
    setConnected(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPoller()
    }
  }, [])

  const handleNext = async () => {
    if (!runId) return
    
    try {
      await fetch(`/api/runs/${runId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'NEXT' }),
      })
    } catch (error) {
      console.error('Next step error:', error)
    }
  }

  const handleBack = () => {
    // Toast: not implemented
    console.log('Back not implemented')
  }

  const handleDeepDive = async () => {
    if (!runId || deepDiveNo > 0) return
    
    try {
      await fetch(`/api/runs/${runId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DEEP_DIVE_ONCE' }),
      })
    } catch (error) {
      console.error('Deep dive error:', error)
    }
  }

  const handleUserInput = async (input: string) => {
    console.log('=== USER INPUT TRIGGERED ===', { input, runId, processing, connected })
    if (!runId || processing) {
      console.log('Blocked: no runId or already processing')
      return
    }
    
    if (!connected) {
      console.warn('Polling not connected, cannot process user input')
      throw new Error('Connection not established. Please wait and try again.')
    }
    
    setProcessing(true)
    console.log('Processing user input:', input)
    try {
      const stepUrl = `/api/runs/${runId}/step`
      console.log('Making API call to:', stepUrl, 'with payload:', { userInput: input })
      const response = await fetch(stepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: input }),
      })
      
      console.log('API Response status:', response.status, response.statusText)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error details:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      console.log('User input processed successfully:', result)
      
      // Force immediate update of messages and status
      if (pollerRef.current) {
        pollerRef.current.forceUpdate()
      }
      pollRunStatus(runId)
      
    } catch (error) {
      console.error('User input error:', error)
      throw error // Re-throw so Transcript component can handle it
    } finally {
      setProcessing(false)
    }
  }



  const handleApplyPatch = async () => {
    if (!runId || !pendingPatch) return
    
    try {
      await fetch(`/api/runs/${runId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PATCH' }),
      })
    } catch (error) {
      console.error('Apply patch error:', error)
    }
  }

  const handleExport = async () => {
    if (!runId) return
    
    try {
      const response = await fetch(`/api/runs/${runId}/export`)
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'design-export.zip'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Controls 
        connected={connected}
        hasPendingPatch={!!pendingPatch}
        onApplyPatch={handleApplyPatch}
        onExport={handleExport}
      />
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <Stepper
            currentStep={currentStep}
            deepDiveNo={deepDiveNo}
            onNext={handleNext}
            onBack={handleBack}
            onDeepDive={handleDeepDive}
          />
        </div>
        
        {/* Center canvas */}
        <div className="flex-1">
          <CanvasPane
            scene={scene}
            projectId={params.projectId}
          />
        </div>
        
        {/* Right sidebar */}
        <div className="w-80 bg-white border-l border-gray-200">
          <Transcript
            messages={messages}
            onUserInput={handleUserInput}
            isLoading={processing}
          />
        </div>
      </div>
      
      {/* Approval drawer */}
      {pendingPatch && (
        <ApprovalDrawer
          patch={pendingPatch}
          onApprove={handleApplyPatch}
        />
      )}
    </div>
  )
}