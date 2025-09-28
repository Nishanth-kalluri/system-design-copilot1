export function createEmptyScene() {
  return {
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
}

export function createBasicElement(type: string, x: number, y: number, width: number, height: number, text = '') {
  const id = Math.random().toString(36).substring(2, 15)
  
  const base = {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    versionNonce: Math.floor(Math.random() * 1000000000),
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  }

  if (type === 'text') {
    return {
      ...base,
      text,
      fontSize: 20,
      fontFamily: 1,
      textAlign: 'left' as const,
      verticalAlign: 'top' as const,
      containerId: null,
      originalText: text,
    }
  }

  if (type === 'arrow') {
    return {
      ...base,
      points: [[0, 0], [width, height]],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: 'arrow',
    }
  }

  return base
}