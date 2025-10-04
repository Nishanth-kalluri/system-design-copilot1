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
  const [currentStep, setCurrentStep] = useState('INITIAL_DESIGN')
  const [deepDiveNo, setDeepDiveNo] = useState(0)
  const [pendingPatch, setPendingPatch] = useState<any>(null)
  const [scene, setScene] = useState<any>(null)
  const [sceneVersion, setSceneVersion] = useState<number>(0)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [conversationWidth, setConversationWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('conversationPanelWidth')
      return saved ? parseInt(saved, 10) : 320
    }
    return 320 // Default 320px (w-80)
  })
  const [isResizing, setIsResizing] = useState(false)
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
    if (!runId || deepDiveNo >= 3) return
    
    try {
      const response = await fetch(`/api/runs/${runId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADD_DEEP_DIVE' }),
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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  const handleDoubleClick = () => {
    const defaultWidth = 320
    setConversationWidth(defaultWidth)
    localStorage.setItem('conversationPanelWidth', defaultWidth.toString())
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return
    
    const containerWidth = window.innerWidth
    const newWidth = containerWidth - e.clientX
    const minWidth = 250 // Minimum width
    const maxWidth = containerWidth * 0.6 // Maximum 60% of screen
    
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    setConversationWidth(clampedWidth)
    
    // Save to localStorage
    localStorage.setItem('conversationPanelWidth', clampedWidth.toString())
  }

  const handleMouseUp = () => {
    setIsResizing(false)
  }

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing])

  // Keyboard shortcut to toggle panel sizes
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '[') {
        e.preventDefault()
        // Toggle between small (250px), medium (400px), and large (600px)
        const sizes = [250, 400, 600]
        const currentIndex = sizes.findIndex(size => Math.abs(size - conversationWidth) < 50)
        const nextSize = sizes[(currentIndex + 1) % sizes.length]
        setConversationWidth(nextSize)
        localStorage.setItem('conversationPanelWidth', nextSize.toString())
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [conversationWidth])

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
      <div className="flex-1 flex overflow-hidden relative">
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
        <div className="flex-1" style={{ marginRight: conversationWidth }}>
          <CanvasPane
            key={sceneVersion} // Force re-render when scene version changes
            scene={scene}
            projectId={params.projectId}
          />
        </div>
        
        {/* Resize handle */}
        <div
          className={`w-2 cursor-col-resize transition-all duration-150 group ${
            isResizing ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'
          }`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize | Double-click to reset | Ctrl+[ to cycle sizes"
          style={{ 
            position: 'absolute',
            right: conversationWidth,
            top: 0,
            bottom: 0,
            zIndex: 10
          }}
        >
          {/* Visual grip indicator */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-8 flex flex-col justify-center space-y-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-0.5 h-0.5 bg-white rounded-full mx-auto"></div>
            <div className="w-0.5 h-0.5 bg-white rounded-full mx-auto"></div>
            <div className="w-0.5 h-0.5 bg-white rounded-full mx-auto"></div>
            <div className="w-0.5 h-0.5 bg-white rounded-full mx-auto"></div>
          </div>
        </div>
        
        {/* Right sidebar - Conversation Panel */}
        <div 
          className="bg-white border-l border-gray-200" 
          style={{ 
            width: conversationWidth,
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0
          }}
        >
          {/* Panel header with resize info */}
          <div className="px-3 py-1 border-b border-gray-200 text-xs text-gray-500 flex justify-between items-center">
            <span>Design Conversation</span>
            <span className="text-xs opacity-60">Ctrl+[ to resize</span>
          </div>
          <div style={{ height: 'calc(100% - 28px)' }}>
            <Transcript
              messages={messages}
              onUserInput={handleUserInput}
              isLoading={processing}
            />
          </div>
        </div>
      </div>
    </div>
  )
}