import { createBasicElement, createShapeWithText } from './excali'
import { generateSmartLayout, type LayoutElement } from './layout-generator'

export type Patch = {
  adds?: any[]
  updates?: any[]
  deletes?: string[]
  label?: string
}

const ALLOWED_TYPES = ['rectangle', 'ellipse', 'diamond', 'arrow', 'text']
const MAX_ELEMENTS = 1000
const MAX_TEXT_LENGTH = 5000
const COORD_MIN = -5000
const COORD_MAX = 5000

// Layer configuration for proper positioning
const LAYER_CONFIG = {
  frontend: { y: 50, priority: 1 },
  api: { y: 200, priority: 2 },
  service: { y: 350, priority: 3 },
  data: { y: 500, priority: 4 },
  external: { y: 650, priority: 5 },
  storage: { y: 500, priority: 4 }, // Same level as data
  cache: { y: 450, priority: 3.5 } // Between service and data
}

export function validatePatch(patch: Patch): { valid: boolean; error?: string } {
  if (!patch || typeof patch !== 'object') {
    return { valid: false, error: 'Invalid patch format' }
  }

  const { adds = [], updates = [] } = patch

  // Check element count
  if (adds.length + updates.length > MAX_ELEMENTS) {
    return { valid: false, error: `Too many elements (max ${MAX_ELEMENTS})` }
  }

  // Validate adds
  for (const element of adds) {
    const validation = validateElement(element)
    if (!validation.valid) {
      return validation
    }
  }

  // Validate updates (type is optional for updates)
  for (const element of updates) {
    const validation = validateElement(element, true)
    if (!validation.valid) {
      return validation
    }
  }

  return { valid: true }
}

function validateElement(element: any, isUpdate: boolean = false): { valid: boolean; error?: string } {
  if (!element || typeof element !== 'object') {
    return { valid: false, error: 'Invalid element format' }
  }

  // Check type (only required for new elements, optional for updates)
  if (!isUpdate && (!element.type || !ALLOWED_TYPES.includes(element.type))) {
    return { valid: false, error: `Invalid element type: ${element.type}` }
  }
  if (isUpdate && element.type && !ALLOWED_TYPES.includes(element.type)) {
    return { valid: false, error: `Invalid element type: ${element.type}` }
  }

  // Check coordinates
  if (typeof element.x === 'number') {
    if (element.x < COORD_MIN || element.x > COORD_MAX) {
      return { valid: false, error: 'Coordinates out of range' }
    }
  }
  if (typeof element.y === 'number') {
    if (element.y < COORD_MIN || element.y > COORD_MAX) {
      return { valid: false, error: 'Coordinates out of range' }
    }
  }

  // Check text length
  if (element.text && element.text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: 'Text too long' }
  }

  return { valid: true }
}

export function applyPatch(elements: any[], patch: Patch): any[] {
  let result = [...elements]

  // Remove deleted elements
  if (patch.deletes) {
    result = result.filter(el => !patch.deletes!.includes(el.id))
  }

  // Update existing elements
  if (patch.updates) {
    for (const update of patch.updates) {
      const index = result.findIndex(el => el.id === update.id)
      if (index >= 0) {
        result[index] = { ...result[index], ...update }
      }
    }
  }

  // Add new elements with smart positioning to prevent overlaps
  if (patch.adds && patch.adds.length > 0) {
    const newElements = applySmartLayout(result, patch.adds)
    result.push(...newElements)
  }

  return result
}

// Enhanced version using smart layout but safer element creation
export function applyPatchWithSmartLayout(elements: any[], patch: Patch): any[] {
  let result = [...elements]

  // Remove deleted elements
  if (patch.deletes) {
    result = result.filter(el => !patch.deletes!.includes(el.id))
  }

  // Update existing elements
  if (patch.updates) {
    for (const update of patch.updates) {
      const index = result.findIndex(el => el.id === update.id)
      if (index >= 0) {
        result[index] = { ...result[index], ...update }
      }
    }
  }

  // Add new elements with smart positioning but use original formatting
  if (patch.adds && patch.adds.length > 0) {
    const newElements = applySmartLayout(result, patch.adds)
    result.push(...newElements)
  }

  return result
}

function applySmartLayout(existingElements: any[], newElements: any[]): any[] {
  const formattedElements: any[] = []
  const occupiedPositions = getOccupiedPositions(existingElements)
  
  // Process elements by layer priority to ensure proper positioning
  const elementsByLayer = groupElementsByLayer(newElements)
  const layerKeys = Object.keys(elementsByLayer).sort((a, b) => {
    const priorityA = LAYER_CONFIG[a as keyof typeof LAYER_CONFIG]?.priority || 3
    const priorityB = LAYER_CONFIG[b as keyof typeof LAYER_CONFIG]?.priority || 3
    return priorityA - priorityB
  })
  
  for (const layerKey of layerKeys) {
    const layerElements = elementsByLayer[layerKey]
    const baseY = LAYER_CONFIG[layerKey as keyof typeof LAYER_CONFIG]?.y || 350
    
    layerElements.forEach((element, index) => {
      const position = findAvailablePosition(
        occupiedPositions,
        element,
        baseY,
        index * 180 + 100 // Horizontal spacing
      )
      
      const positioned = { ...element, x: position.x, y: position.y }
      const formatted = formatExcalidrawElement(positioned)
      formattedElements.push(...formatted)
      
      // Mark this position as occupied
      occupiedPositions.push({
        x: position.x,
        y: position.y,
        width: position.width || 140,
        height: position.height || 80
      })
    })
  }
  
  return formattedElements
}

function getOccupiedPositions(elements: any[]): Array<{x: number, y: number, width: number, height: number}> {
  return elements
    .filter(el => el.type !== 'text' && el.type !== 'arrow') // Exclude text and arrows from collision
    .map(el => ({
      x: el.x || 0,
      y: el.y || 0,
      width: el.width || 140,
      height: el.height || 80
    }))
}

function groupElementsByLayer(elements: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {}
  
  elements.forEach(element => {
    const layer = inferLayerFromElement(element)
    if (!groups[layer]) groups[layer] = []
    groups[layer].push(element)
  })
  
  return groups
}

function inferLayerFromElement(element: any): string {
  const text = (element.text || '').toLowerCase()
  const type = element.type
  
  // Frontend layer
  if (text.includes('web') || text.includes('mobile') || text.includes('client') || text.includes('ui')) {
    return 'frontend'
  }
  
  // API layer
  if (text.includes('gateway') || text.includes('api') || text.includes('load balancer') || text.includes('proxy')) {
    return 'api'
  }
  
  // Data layer
  if (type === 'ellipse' || text.includes('database') || text.includes('db') || text.includes('storage') || 
      text.includes('postgres') || text.includes('mongo') || text.includes('mysql')) {
    return 'data'
  }
  
  // Cache layer
  if (text.includes('cache') || text.includes('redis') || text.includes('memcached')) {
    return 'cache'
  }
  
  // External services
  if (text.includes('cdn') || text.includes('s3') || text.includes('external') || text.includes('third party')) {
    return 'external'
  }
  
  // Default to service layer
  return 'service'
}

function findAvailablePosition(
  occupiedPositions: Array<{x: number, y: number, width: number, height: number}>,
  element: any,
  baseY: number,
  preferredX: number
): {x: number, y: number, width: number, height: number} {
  const width = element.width || 140
  const height = element.height || 80
  const margin = 20
  
  // Try preferred position first
  if (!hasCollision(occupiedPositions, preferredX, baseY, width, height, margin)) {
    return { x: preferredX, y: baseY, width, height }
  }
  
  // Try positions to the right
  for (let offset = 180; offset < 1000; offset += 180) {
    const x = preferredX + offset
    if (x + width < 1200 && !hasCollision(occupiedPositions, x, baseY, width, height, margin)) {
      return { x, y: baseY, width, height }
    }
  }
  
  // Try positions to the left
  for (let offset = 180; offset < 1000; offset += 180) {
    const x = preferredX - offset
    if (x > 50 && !hasCollision(occupiedPositions, x, baseY, width, height, margin)) {
      return { x, y: baseY, width, height }
    }
  }
  
  // Fallback: move to next row
  return findAvailablePosition(occupiedPositions, element, baseY + 120, preferredX)
}

function hasCollision(
  occupiedPositions: Array<{x: number, y: number, width: number, height: number}>,
  x: number,
  y: number,
  width: number,
  height: number,
  margin: number = 20
): boolean {
  return occupiedPositions.some(pos => {
    return !(x + width + margin < pos.x || 
             x - margin > pos.x + pos.width ||
             y + height + margin < pos.y ||
             y - margin > pos.y + pos.height)
  })
}

function formatExcalidrawElement(element: any): any[] {
  const x = element.x || 0
  const y = element.y || 0
  const width = element.width || 140 // Default width
  const height = element.height || 80 // Default height  
  const text = element.text || ''
  
  // Use the proper createBasicElement function from excali.ts
  let excalidrawElements: any[]
  
  if (element.type === 'text') {
    const textElement = createBasicElement('text', x, y, width, height, text)
    if (element.id) {
      textElement.id = element.id
    }
    excalidrawElements = [textElement]
  } else if (element.type === 'arrow') {
    const arrowElement = createBasicElement('arrow', x, y, width, height, text)
    if (element.id) {
      arrowElement.id = element.id
    }
    excalidrawElements = [arrowElement]
  } else {
    // For rectangles, ellipses, diamonds - use createShapeWithText for proper text binding
    const shapeElements = createShapeWithText(element.type, x, y, width, height, text)
    
    // Override the shape id if provided and set proper background
    if (element.id && shapeElements.length > 0) {
      shapeElements[0].id = element.id
      // Set background color based on type
      if (element.type === 'rectangle') {
        shapeElements[0].backgroundColor = '#f8f9fa'
      } else if (element.type === 'ellipse') {
        shapeElements[0].backgroundColor = '#e3f2fd'
      } else if (element.type === 'diamond') {
        shapeElements[0].backgroundColor = '#fff3e0'
      }
    }
    
    excalidrawElements = shapeElements
  }
  
  return excalidrawElements
}