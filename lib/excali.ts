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

  // For shapes (rectangle, ellipse, diamond) - create shape without text
  const shapeElement = {
    ...base,
  }

  // Add shape-specific properties
  if (type === 'rectangle') {
    shapeElement.backgroundColor = '#f8f9fa'  // Light background for better text contrast
  } else if (type === 'ellipse') {
    shapeElement.backgroundColor = '#e3f2fd'  // Light blue for databases
  } else if (type === 'diamond') {
    shapeElement.backgroundColor = '#fff3e0'  // Light orange for gateways/queues
  }

  return shapeElement
}

// Create a shape with bound text element
export function createShapeWithText(type: string, x: number, y: number, width: number, height: number, text = '') {
  const shapeId = Math.random().toString(36).substring(2, 15)
  const textId = Math.random().toString(36).substring(2, 15)
  
  const shape = createBasicElement(type, x, y, width, height)
  shape.id = shapeId
  
  // Create bound text element if text is provided
  if (text && text.trim()) {
    // Set up binding relationship
    ;(shape as any).boundElements = [{
      id: textId,
      type: 'text'
    }]
    
    const boundText = {
      id: textId,
      type: 'text',
      x: x + width / 2 - (text.length * 4), // Approximate centering
      y: y + height / 2 - 10, // Center vertically
      width: Math.max(text.length * 8, 20), // Approximate width based on text length
      height: 20,
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
      text,
      fontSize: 16,
      fontFamily: 1,
      textAlign: 'center' as const,
      verticalAlign: 'middle' as const,
      containerId: shapeId, // This binds the text to the shape
      originalText: text,
    }
    
    return [shape, boundText]
  }
  
  return [shape]
}