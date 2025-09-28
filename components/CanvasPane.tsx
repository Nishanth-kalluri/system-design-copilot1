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
      console.log('CanvasPane: Updating scene with', scene?.elements?.length || 0, 'elements, scene version:', scene?.version)
      console.log('CanvasPane: Full scene object:', JSON.stringify(scene, null, 2))
      if (scene?.elements?.length > 0) {
        console.log('CanvasPane: First element details:', JSON.stringify(scene.elements[0], null, 2))
      }
      try {
        excalidrawAPI.updateScene(scene)
        console.log('CanvasPane: Scene update successful')
      } catch (error) {
        console.error('CanvasPane: Scene update failed:', error)
      }
    } else {
      console.log('CanvasPane: Cannot update scene', { hasAPI: !!excalidrawAPI, hasScene: !!scene })
    }
  }, [excalidrawAPI, scene])

  // Create a simple test scene to avoid corrupted data
  const testScene = scene ? scene : {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [],
    appState: {
      gridSize: null,
      viewBackgroundColor: '#ffffff',
    },
    files: {},
  }

  return (
    <div className="h-full">
      <Excalidraw
        initialData={testScene}
        onChange={handleChange}
        ref={(api: any) => setExcalidrawAPI(api as ExcalidrawAPI)}
      />
    </div>
  )
}
