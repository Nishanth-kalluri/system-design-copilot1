'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
) as any

interface CanvasPaneProps { 
  scene: any
  projectId: string 
}

interface ExcalidrawAPI { 
  updateScene: (scene: any) => void 
}

export function CanvasPane({ scene, projectId }: CanvasPaneProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(null)
  const [lastSave, setLastSave] = useState(Date.now())

  const handleChange = useCallback((
    elements: readonly any[],
    _appState: any,
    _files: any
  ) => {
    const now = Date.now()
    if (now - lastSave > 2000) {
      setLastSave(now)
      fetch(`/api/projects/${projectId}/scenes/user-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(console.error)
    }
  }, [projectId, lastSave])

  useEffect(() => {
    if (excalidrawAPI && scene) {
      excalidrawAPI.updateScene(scene)
    }
  }, [excalidrawAPI, scene])

  return (
    <div className="h-full">
      <Excalidraw
        initialData={scene}
        onChange={handleChange}
        ref={(api: any) => setExcalidrawAPI(api as ExcalidrawAPI)}
      />
    </div>
  )
}
