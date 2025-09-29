import { createBasicElement, createShapeWithText } from './excali'

export type Patch = {
  adds?: any[]
  updates?: any[]
  deletes?: string[]
  label?: string
}

const ALLOWED_TYPES = ['rectangle', 'ellipse', 'diamond', 'arrow', 'text']
const MAX_ELEMENTS = 1000 // Allow up to 25 elements for comprehensive system design diagrams
const MAX_TEXT_LENGTH = 5000 // Allow longer text for detailed entity descriptions
const COORD_MIN = -5000
const COORD_MAX = 5000

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

  // Add new elements with proper Excalidraw formatting
  if (patch.adds) {
    const formattedElements = patch.adds.flatMap(element => formatExcalidrawElement(element))
    result.push(...formattedElements)
  }

  return result
}

function formatExcalidrawElement(element: any): any[] {
  const x = element.x || 0
  const y = element.y || 0
  const width = element.width || 100
  const height = element.height || 100
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
    
    // Override the shape id if provided
    if (element.id && shapeElements.length > 0) {
      shapeElements[0].id = element.id
    }
    
    excalidrawElements = shapeElements
  }
  
  return excalidrawElements
}