// Test file to verify shape generation and text visibility improvements
const { generateLayoutFromPattern, getElementTypeFromName } = require('./lib/layout-generator.ts')
const { createBasicElement } = require('./lib/excali.ts')

// Test shape type assignment
console.log('Testing shape type assignment:')
console.log('PostgreSQL Database ->', getElementTypeFromName('PostgreSQL Database', 'data')) // Should be ellipse
console.log('Redis Cache ->', getElementTypeFromName('Redis Cache', 'data')) // Should be ellipse
console.log('User Service ->', getElementTypeFromName('User Service', 'service')) // Should be rectangle
console.log('API Gateway ->', getElementTypeFromName('API Gateway', 'api')) // Should be diamond
console.log('Load Balancer ->', getElementTypeFromName('Load Balancer', 'api')) // Should be diamond
console.log('Message Queue ->', getElementTypeFromName('Message Queue', 'service')) // Should be diamond
console.log('External Payment API ->', getElementTypeFromName('External Payment API', 'external')) // Should be diamond

// Test text properties in shapes
console.log('\nTesting text in shapes:')
const rectElement = createBasicElement('rectangle', 100, 100, 120, 80, 'User Service')
console.log('Rectangle with text has fontSize:', rectElement.fontSize)
console.log('Rectangle with text has textAlign:', rectElement.textAlign)
console.log('Rectangle text content:', rectElement.text)

const ellipseElement = createBasicElement('ellipse', 200, 200, 120, 80, 'PostgreSQL')
console.log('Ellipse with text has fontSize:', ellipseElement.fontSize)
console.log('Ellipse background color:', ellipseElement.backgroundColor)

const diamondElement = createBasicElement('diamond', 300, 300, 120, 80, 'Load Balancer')
console.log('Diamond with text has fontSize:', diamondElement.fontSize)
console.log('Diamond background color:', diamondElement.backgroundColor)