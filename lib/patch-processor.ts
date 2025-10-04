import { Patch } from './patches'
import { generateSmartLayout, type LayoutElement, generateAutoConnections } from './layout-generator'

export interface ProcessedPatch {
  elements: any[]
  connections: any[]
  metadata?: {
    totalElements: number
    layerCounts: Record<string, number>
  }
}

/**
 * Process a raw patch into a properly laid out set of Excalidraw elements
 * with automatic positioning, collision avoidance, and smart connections
 */
export function processPatchWithSmartLayout(
  existingElements: any[],
  patch: Patch
): ProcessedPatch {
  // Convert patch elements to layout elements
  const layoutElements: LayoutElement[] = (patch.adds || []).map((element, index) => ({
    id: element.id || `generated_${Date.now()}_${index}`,
    type: element.type,
    text: element.text || '',
    layer: element.layer || inferLayerFromElement(element),
    connectsTo: element.connectsTo || []
  }))

  // Generate automatic connections based on system design patterns
  const elementsWithConnections = generateAutoConnections(layoutElements)

  // Apply smart layout to get positioned elements and arrows
  const { positioned, arrows } = generateSmartLayout(elementsWithConnections)

  // Convert to Excalidraw format using proper element creation
  const { createBasicElement, createShapeWithText } = require('./excali')
  const formattedElements: any[] = []
  
  positioned.forEach(pos => {
    if (pos.type === 'text') {
      const textElement = createBasicElement('text', pos.x, pos.y, pos.width, pos.height, pos.text)
      textElement.id = pos.id
      formattedElements.push(textElement)
    } else if (pos.type === 'arrow') {
      const arrowElement = createBasicElement('arrow', pos.x, pos.y, pos.width, pos.height, pos.text)
      arrowElement.id = pos.id
      formattedElements.push(arrowElement)
    } else {
      // For shapes, use createShapeWithText to get proper text binding
      const shapeElements = createShapeWithText(pos.type, pos.x, pos.y, pos.width, pos.height, pos.text)
      if (shapeElements.length > 0) {
        shapeElements[0].id = pos.id
        // Set proper background color
        shapeElements[0].backgroundColor = getBackgroundColorForType(pos.type)
      }
      formattedElements.push(...shapeElements)
    }
  })

  const formattedArrows: any[] = []
  arrows.forEach(arrow => {
    const arrowElement = createBasicElement('arrow', arrow.x, arrow.y, arrow.width, arrow.height)
    arrowElement.id = arrow.id
    // Set arrow-specific properties
    arrowElement.points = [[0, 0], [arrow.width, arrow.height]]
    arrowElement.lastCommittedPoint = null
    arrowElement.startBinding = null
    arrowElement.endBinding = null
    arrowElement.startArrowhead = null
    arrowElement.endArrowhead = 'arrow'
    formattedArrows.push(arrowElement)
  })

  // Generate metadata
  const layerCounts: Record<string, number> = {}
  elementsWithConnections.forEach(el => {
    const layer = el.layer || 'unknown'
    layerCounts[layer] = (layerCounts[layer] || 0) + 1
  })

  return {
    elements: formattedElements,
    connections: formattedArrows,
    metadata: {
      totalElements: formattedElements.length,
      layerCounts
    }
  }
}

function inferLayerFromElement(element: any): string {
  const text = (element.text || '').toLowerCase()
  const type = element.type

  // Frontend layer
  if (text.includes('web') || text.includes('mobile') || text.includes('client') || text.includes('ui') || text.includes('frontend')) {
    return 'frontend'
  }

  // API layer
  if (text.includes('gateway') || text.includes('api') || text.includes('load balancer') || text.includes('proxy') || text.includes('nginx')) {
    return 'api'
  }

  // Data layer
  if (type === 'ellipse' || text.includes('database') || text.includes('db') || text.includes('storage') ||
      text.includes('postgres') || text.includes('mongo') || text.includes('mysql') || text.includes('sql')) {
    return 'data'
  }

  // Cache layer (special case of data)
  if (text.includes('cache') || text.includes('redis') || text.includes('memcached')) {
    return 'cache'
  }

  // External services
  if (text.includes('cdn') || text.includes('s3') || text.includes('external') || text.includes('third party') ||
      text.includes('aws') || text.includes('cloud') || text.includes('payment') && text.includes('service')) {
    return 'external'
  }

  // Queue/messaging (diamond shape typically)
  if (type === 'diamond' || text.includes('queue') || text.includes('kafka') || text.includes('message') || text.includes('event')) {
    return 'service' // Place messaging in service layer
  }

  // Default to service layer
  return 'service'
}

function getBackgroundColorForType(type: string): string {
  switch (type) {
    case 'rectangle':
      return '#f8f9fa' // Light gray for services
    case 'ellipse':
      return '#e3f2fd' // Light blue for databases
    case 'diamond':
      return '#fff3e0' // Light orange for gateways/queues
    default:
      return 'transparent'
  }
}

/**
 * Validate that a patch won't create overlapping elements
 */
export function validatePatchLayout(
  existingElements: any[],
  patch: Patch
): { valid: boolean; issues?: string[] } {
  const issues: string[] = []
  
  // Check for duplicate IDs
  const existingIds = new Set(existingElements.map(el => el.id))
  const newIds = (patch.adds || []).map(el => el.id).filter(Boolean)
  
  for (const id of newIds) {
    if (existingIds.has(id)) {
      issues.push(`Duplicate element ID: ${id}`)
    }
  }
  
  // Check for reasonable element count
  const totalElements = existingElements.length + (patch.adds?.length || 0)
  if (totalElements > 50) {
    issues.push(`Too many elements (${totalElements}). Consider using fewer components or grouping related services.`)
  }
  
  // Validate layer distribution
  const newElements = patch.adds || []
  const layerCounts: Record<string, number> = {}
  
  newElements.forEach(el => {
    const layer = el.layer || inferLayerFromElement(el)
    layerCounts[layer] = (layerCounts[layer] || 0) + 1
  })
  
  // Warn if any single layer has too many elements
  Object.entries(layerCounts).forEach(([layer, count]) => {
    if (count > 8) {
      issues.push(`Too many elements in ${layer} layer (${count}). Consider grouping or simplifying.`)
    }
  })
  
  return {
    valid: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined
  }
}