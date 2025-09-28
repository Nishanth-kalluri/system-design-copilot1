'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MessagePoller } from '@/lib/message-polling'
import { CanvasPane } from '@/components/CanvasPane'
import { Transcript } from '@/components/Transcript'
import { Stepper } from '@/components/Stepper'
import { Controls } from '@/components/Controls'

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [runId, setRunId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [currentStep, setCurrentStep] = useState('REQUIREMENTS')
  const [deepDiveNo, setDeepDiveNo] = useState(0)
  const [pendingPatch, setPendingPatch] = useState<any>(null)
  const [scene, setScene] = useState<any>(null)
  const [sceneVersion, setSceneVersion] = useState<number>(0)
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
      console.log('=== RUN RESOLVED ===', { newRunId, projectId: params.projectId, currentRunId: runId })
      
      if (newRunId !== runId) {
        console.log('RunId changed from', runId, 'to', newRunId)
        setRunId(newRunId)
        
        // Important: If runId changes, stop existing polling and restart with new runId
        if (pollerRef.current) {
          console.log('Stopping existing poller due to runId change')
          pollerRef.current.stop()
          pollerRef.current = null
        }
      } else {
        console.log('Using existing runId:', newRunId)
      }

      // Load scene
      const sceneRes = await fetch(`/api/projects/${params.projectId}/scenes/latest`)
      if (sceneRes.ok) {
        const { scene: sceneData, version } = await sceneRes.json()
        setScene(sceneData)
        setSceneVersion(version || 0)
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

      // Setup polling - always setup with the resolved runId
      setupPolling(newRunId)
      
      console.log('Session initialization complete with runId:', newRunId)
      
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
        // Also update run status and scene when messages update
        pollRunStatus(runId)
        pollSceneUpdates()
      },
      (error) => {
        console.error('Polling error:', error)
        setConnected(false)
      },
      1500 // Reduce polling interval to 1.5 seconds for more responsiveness
    )

    pollerRef.current = poller
    poller.start()
    setConnected(true)
    
    // Initial updates
    pollRunStatus(runId)
    pollSceneUpdates()
  }

  const pollRunStatus = async (runId: string) => {
    try {
      console.log('Polling run status for runId:', runId)
      const response = await fetch(`/api/runs/${runId}`)
      if (response.ok) {
        const { run } = await response.json()
        console.log('Run status:', { step: run.step, deepDive: run.deepDiveNo, hasPatch: !!run.checkpoint?.pendingPatch })
        setCurrentStep(run.step)
        setDeepDiveNo(run.deepDiveNo)
        setPendingPatch(run.checkpoint?.pendingPatch || null)
      }
    } catch (error) {
      console.error('Run status polling error:', error)
    }
  }

  const pollSceneUpdates = async () => {
    try {
      console.log('Polling scene updates, current version:', sceneVersion)
      const response = await fetch(`/api/projects/${params.projectId}/scenes/latest`)
      if (response.ok) {
        const { scene: sceneData, version } = await response.json()
        console.log('Scene poll response:', { currentVersion: sceneVersion, newVersion: version, elementCount: sceneData?.elements?.length })
        if (version !== sceneVersion) {
          console.log('Scene version changed:', { oldVersion: sceneVersion, newVersion: version })
          setScene(sceneData)
          setSceneVersion(version)
        } else {
          console.log('Scene version unchanged, forcing update anyway')
          setScene({...sceneData}) // Force update even if version is same
        }
      }
    } catch (error) {
      console.error('Scene polling error:', error)
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
      const response = await fetch(`/api/runs/${runId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'NEXT' }),
      })
      
      if (response.ok) {
        // Force immediate update of run status, messages, and scene
        pollRunStatus(runId)
        pollSceneUpdates()
        if (pollerRef.current) {
          pollerRef.current.forceUpdate()
        }
      }
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
      const response = await fetch(`/api/runs/${runId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DEEP_DIVE_ONCE' }),
      })
      
      if (response.ok) {
        // Force immediate update of run status, messages, and scene
        pollRunStatus(runId)
        pollSceneUpdates()
        if (pollerRef.current) {
          pollerRef.current.forceUpdate()
        }
      }
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
    if (!runId || !pendingPatch) {
      console.log('Cannot apply patch:', { hasRunId: !!runId, hasPatch: !!pendingPatch })
      return
    }
    
    console.log('Applying patch to runId:', runId, 'patch:', pendingPatch.label)
    
    try {
      const response = await fetch(`/api/runs/${runId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PATCH' }),
      })
      
      if (response.ok) {
        console.log('Patch applied successfully')
        // Clear pending patch immediately
        setPendingPatch(null)
        // Trigger immediate updates with a small delay to ensure DB write is complete
        setTimeout(() => {
          pollSceneUpdates()
          pollRunStatus(runId)
        }, 100)
        if (pollerRef.current) {
          pollerRef.current.forceUpdate()
        }
      } else {
        const errorText = await response.text()
        console.error('Patch application failed:', response.status, errorText)
      }
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
            key={sceneVersion} // Force re-render when scene version changes
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
    </div>
  )
}