// Smart layout generator for system design diagrams
// Automatically calculates coordinates and spacing for better visual layouts

export interface LayoutElement {
  id: string
  type: 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'text'
  text: string
  layer?: 'frontend' | 'api' | 'service' | 'data' | 'external'
  category?: string
  connectsTo?: string[] // IDs of elements this connects to
}

export interface PositionedElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  text: string
}

const LAYOUT_CONFIG = {
  // Canvas dimensions and margins
  canvasWidth: 1000,
  canvasHeight: 800,
  marginX: 100,
  marginY: 100,
  
  // Layer positioning
  layerSpacing: 150,
  elementSpacing: 200,
  
  // Element dimensions
  rectangleWidth: 140,
  rectangleHeight: 80,
  ellipseWidth: 120,
  ellipseHeight: 60,
  diamondWidth: 100,
  diamondHeight: 80,
  
  // Layer Y positions
  layers: {
    frontend: 100,
    api: 250,
    service: 400,
    data: 550,
    external: 650
  }
}

export function generateSmartLayout(elements: LayoutElement[]): {
  positioned: PositionedElement[]
  arrows: PositionedElement[]
} {
  const positioned: PositionedElement[] = []
  const arrows: PositionedElement[] = []
  
  // Group elements by layer
  const elementsByLayer: Record<string, LayoutElement[]> = {}
  elements.forEach(element => {
    const layer = element.layer || 'service'
    if (!elementsByLayer[layer]) {
      elementsByLayer[layer] = []
    }
    elementsByLayer[layer].push(element)
  })
  
  // Position elements in each layer
  Object.entries(elementsByLayer).forEach(([layer, layerElements]) => {
    const yPosition = LAYOUT_CONFIG.layers[layer as keyof typeof LAYOUT_CONFIG.layers] || 400
    const totalWidth = layerElements.length * LAYOUT_CONFIG.elementSpacing
    const startX = LAYOUT_CONFIG.marginX + (LAYOUT_CONFIG.canvasWidth - totalWidth) / 2
    
    layerElements.forEach((element, index) => {
      const x = startX + index * LAYOUT_CONFIG.elementSpacing
      const dimensions = getElementDimensions(element.type)
      
      positioned.push({
        id: element.id,
        type: element.type,
        x: x,
        y: yPosition,
        width: dimensions.width,
        height: dimensions.height,
        text: element.text
      })
    })
  })
  
  // Generate arrows for connections
  elements.forEach(element => {
    if (element.connectsTo && element.connectsTo.length > 0) {
      const sourceEl = positioned.find(p => p.id === element.id)
      if (sourceEl) {
        element.connectsTo.forEach(targetId => {
          const targetEl = positioned.find(p => p.id === targetId)
          if (targetEl) {
            const arrow = createArrow(sourceEl, targetEl)
            arrows.push(arrow)
          }
        })
      }
    }
  })
  
  return { positioned, arrows }
}

function getElementDimensions(type: string): { width: number; height: number } {
  switch (type) {
    case 'rectangle':
      return { width: LAYOUT_CONFIG.rectangleWidth, height: LAYOUT_CONFIG.rectangleHeight }
    case 'ellipse':
      return { width: LAYOUT_CONFIG.ellipseWidth, height: LAYOUT_CONFIG.ellipseHeight }
    case 'diamond':
      return { width: LAYOUT_CONFIG.diamondWidth, height: LAYOUT_CONFIG.diamondHeight }
    case 'text':
      return { width: 100, height: 30 }
    default:
      return { width: 100, height: 60 }
  }
}

function createArrow(source: PositionedElement, target: PositionedElement): PositionedElement {
  // Calculate connection points based on element edges, not centers
  let startX, startY, endX, endY
  
  // If target is below source (normal flow), connect bottom of source to top of target
  if (target.y > source.y) {
    startX = source.x + source.width / 2
    startY = source.y + source.height
    endX = target.x + target.width / 2
    endY = target.y
  } 
  // If target is above source, connect top of source to bottom of target
  else if (target.y < source.y) {
    startX = source.x + source.width / 2
    startY = source.y
    endX = target.x + target.width / 2
    endY = target.y + target.height
  }
  // If on same level, connect side to side
  else {
    if (target.x > source.x) {
      startX = source.x + source.width
      startY = source.y + source.height / 2
      endX = target.x
      endY = target.y + target.height / 2
    } else {
      startX = source.x
      startY = source.y + source.height / 2
      endX = target.x + target.width
      endY = target.y + target.height / 2
    }
  }
  
  const deltaX = endX - startX
  const deltaY = endY - startY
  
  return {
    id: `arrow_${source.id}_to_${target.id}`,
    type: 'arrow',
    x: startX,
    y: startY,
    width: deltaX,
    height: deltaY,
    text: ''
  }
}

// Predefined layout patterns for common system design scenarios
export const LAYOUT_PATTERNS = {
  microservices: {
    frontend: ['Web App', 'Mobile App'],
    api: ['API Gateway', 'Load Balancer'],
    service: ['User Service', 'Order Service', 'Payment Service', 'Notification Service'],
    data: ['PostgreSQL', 'Redis Cache', 'Message Queue'],
    external: ['Third Party API', 'CDN']
  },
  
  monolith: {
    frontend: ['Web Interface'],
    api: ['Load Balancer'],
    service: ['Application Server', 'Business Logic'],
    data: ['Database', 'File Storage'],
    external: ['External Services']
  },
  
  eventDriven: {
    frontend: ['Producer Apps'],
    api: ['Event Gateway'],
    service: ['Event Bus', 'Consumer Services', 'Event Store'],
    data: ['Event Database', 'Analytics DB'],
    external: ['Monitoring', 'Alerting']
  }
}

export function generateLayoutFromPattern(
  patternName: keyof typeof LAYOUT_PATTERNS, 
  customElements?: Partial<typeof LAYOUT_PATTERNS.microservices>
): LayoutElement[] {
  const pattern = { ...LAYOUT_PATTERNS[patternName], ...customElements }
  const elements: LayoutElement[] = []
  
  Object.entries(pattern).forEach(([layer, elementNames]) => {
    elementNames.forEach((name, index) => {
      const elementType = getElementTypeFromName(name, layer)
      elements.push({
        id: `${layer}_${index}`,
        type: elementType,
        text: name,
        layer: layer as any,
        connectsTo: [] // Will be populated later
      })
    })
  })
  
  // Generate connections after all elements are created
  elements.forEach(element => {
    element.connectsTo = generateConnectionsForElement(element.text, element.layer!, elements)
  })
  
  return elements
}

// Helper to generate automatic arrows based on layer relationships
export function generateAutoConnections(elements: LayoutElement[]): LayoutElement[] {
  const connections: LayoutElement[] = []
  const elementsByLayer = elements.reduce((acc, el) => {
    if (!acc[el.layer!]) acc[el.layer!] = []
    acc[el.layer!].push(el)
    return acc
  }, {} as Record<string, LayoutElement[]>)
  
  // Generate standard flow connections
  const layerFlow = ['frontend', 'api', 'service', 'data']
  
  for (let i = 0; i < layerFlow.length - 1; i++) {
    const currentLayer = elementsByLayer[layerFlow[i]]
    const nextLayer = elementsByLayer[layerFlow[i + 1]]
    
    if (currentLayer && nextLayer) {
      // Connect first element of each layer to first element of next layer
      if (currentLayer[0] && nextLayer[0]) {
        currentLayer[0].connectsTo = currentLayer[0].connectsTo || []
        currentLayer[0].connectsTo.push(nextLayer[0].id)
      }
    }
  }
  
  // Connect services to external components where appropriate
  const services = elementsByLayer.service || []
  const external = elementsByLayer.external || []
  
  services.forEach(service => {
    external.forEach(ext => {
      if (ext.text.toLowerCase().includes('cdn') || 
          ext.text.toLowerCase().includes('s3') ||
          (service.text.toLowerCase().includes('media') && ext.text.toLowerCase().includes('storage'))) {
        service.connectsTo = service.connectsTo || []
        service.connectsTo.push(ext.id)
      }
    })
  })
  
  return elements
}

function getElementTypeFromName(name: string, layer: string): 'rectangle' | 'ellipse' | 'diamond' {
  const nameLower = name.toLowerCase()
  
  // Databases, storage, and data-related services -> ellipse
  if (nameLower.includes('database') || 
      nameLower.includes('db') || 
      nameLower.includes('cache') ||
      nameLower.includes('storage') ||
      nameLower.includes('redis') ||
      nameLower.includes('mongodb') ||
      nameLower.includes('postgresql') ||
      nameLower.includes('mysql') ||
      nameLower.includes('elasticsearch') ||
      nameLower.includes('data') && (nameLower.includes('store') || nameLower.includes('warehouse') || nameLower.includes('lake'))) {
    return 'ellipse'
  }
  
  // Load balancers, gateways, proxies, and routing components -> diamond  
  if (nameLower.includes('load balancer') ||
      nameLower.includes('gateway') ||
      nameLower.includes('proxy') ||
      nameLower.includes('router') ||
      nameLower.includes('nginx') ||
      nameLower.includes('api gateway') ||
      nameLower.includes('ingress') ||
      nameLower.includes('cdn') ||
      nameLower.includes('queue') ||
      nameLower.includes('broker') ||
      nameLower.includes('kafka') ||
      nameLower.includes('rabbitmq') ||
      nameLower.includes('event bus')) {
    return 'diamond'
  }
  
  // External services and third-party integrations -> diamond
  if (layer === 'external' || 
      nameLower.includes('external') ||
      nameLower.includes('third party') ||
      nameLower.includes('api') && nameLower.includes('external') ||
      nameLower.includes('payment') && nameLower.includes('gateway') ||
      nameLower.includes('auth') && nameLower.includes('service')) {
    return 'diamond'
  }
  
  // Microservices and business logic components -> rectangle (default)
  return 'rectangle'
}

function generateConnectionsForElement(name: string, layer: string, existingElements: LayoutElement[]): string[] {
  // Basic connection logic - can be enhanced based on common patterns
  const connections: string[] = []
  
  // Frontend typically connects to API layer
  if (layer === 'frontend') {
    const apiElements = existingElements.filter(el => el.layer === 'api')
    if (apiElements.length > 0) {
      connections.push(apiElements[0].id)
    }
  }
  
  // API layer connects to service layer
  if (layer === 'api') {
    const serviceElements = existingElements.filter(el => el.layer === 'service')
    if (serviceElements.length > 0) {
      connections.push(serviceElements[0].id)
    }
  }
  
  // Services connect to data layer
  if (layer === 'service') {
    const dataElements = existingElements.filter(el => el.layer === 'data')
    if (dataElements.length > 0) {
      connections.push(dataElements[0].id)
    }
  }
  
  return connections
}