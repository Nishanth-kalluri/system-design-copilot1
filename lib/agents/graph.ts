import { Step } from '../db'

export function getNextStep(currentStep: Step, deepDiveNo: number): Step | null {
  const stepOrder: Step[] = ['REQUIREMENTS', 'FNFRS', 'ENTITIES', 'API', 'HLD', 'DEEPDIVE', 'CONCLUSION']
  
  const currentIndex = stepOrder.indexOf(currentStep)
  
  if (currentStep === 'HLD') {
    return deepDiveNo === 0 ? 'DEEPDIVE' : 'CONCLUSION'
  }
  
  if (currentStep === 'DEEPDIVE') {
    return 'CONCLUSION'
  }
  
  if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
    return stepOrder[currentIndex + 1]
  }
  
  return null
}

export function getPrevStep(currentStep: Step): Step | null {
  const stepOrder: Step[] = ['REQUIREMENTS', 'FNFRS', 'ENTITIES', 'API', 'HLD', 'DEEPDIVE', 'CONCLUSION']
  
  const currentIndex = stepOrder.indexOf(currentStep)
  
  if (currentIndex > 0) {
    return stepOrder[currentIndex - 1]
  }
  
  return null
}