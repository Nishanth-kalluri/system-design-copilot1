import { Step } from '../db'

export function getNextStep(currentStep: Step, deepDiveNo: number): Step | null {
  const stepOrder: Step[] = ['INITIAL_DESIGN', 'HLD', 'DEEPDIVE', 'CONCLUSION']
  
  const currentIndex = stepOrder.indexOf(currentStep)
  
  // From INITIAL_DESIGN, always go to HLD
  if (currentStep === 'INITIAL_DESIGN') {
    return 'HLD'
  }
  
  // From HLD, always go to DEEPDIVE (first one)
  if (currentStep === 'HLD') {
    return 'DEEPDIVE'
  }
  
  // From DEEPDIVE, can continue to more DEEPDIVEs or go to CONCLUSION
  // This will be controlled by user action, so we default to CONCLUSION
  if (currentStep === 'DEEPDIVE') {
    return 'CONCLUSION'
  }
  
  // CONCLUSION is the final step
  if (currentStep === 'CONCLUSION') {
    return null
  }
  
  return null
}

export function getPrevStep(currentStep: Step): Step | null {
  const stepOrder: Step[] = ['INITIAL_DESIGN', 'HLD', 'DEEPDIVE', 'CONCLUSION']
  
  const currentIndex = stepOrder.indexOf(currentStep)
  
  // From DEEPDIVE, we can go back to HLD
  if (currentStep === 'DEEPDIVE') {
    return 'HLD'
  }
  
  // From CONCLUSION, we can go back to DEEPDIVE
  if (currentStep === 'CONCLUSION') {
    return 'DEEPDIVE'
  }
  
  if (currentIndex > 0) {
    return stepOrder[currentIndex - 1]
  }
  
  return null
}

export function canAddDeepDive(currentStep: Step, deepDiveNo: number): boolean {
  return currentStep === 'DEEPDIVE' && deepDiveNo < 3
}

export function getNextDeepDiveStep(deepDiveNo: number): Step {
  return 'DEEPDIVE'
}