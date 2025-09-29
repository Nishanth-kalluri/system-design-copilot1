'use client'

interface StepperProps {
  currentStep: string
  deepDiveNo: number
  onNext: () => void
  onBack: () => void
  onDeepDive: () => void
}

const STEPS = [
  'INITIAL_DESIGN',
  'HLD',
  'DEEPDIVE',
  'CONCLUSION'
]

const STEP_LABELS = {
  'INITIAL_DESIGN': 'Initial Design',
  'HLD': 'High Level Design', 
  'DEEPDIVE': 'Deep Dive',
  'CONCLUSION': 'Conclusion'
}

export function Stepper({ currentStep, deepDiveNo, onNext, onBack, onDeepDive }: StepperProps) {
  const currentIndex = STEPS.indexOf(currentStep)
  
  return (
    <div className="p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Design Steps</h3>
      
      <div className="space-y-2 mb-6">
        {STEPS.map((step, index) => {
          let status = 'upcoming'
          if (index < currentIndex) status = 'completed'
          if (index === currentIndex) status = 'current'
          
          return (
            <div
              key={step}
              className={`p-2 rounded text-sm ${
                status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : status === 'current'
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'bg-gray-50 text-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    status === 'completed' ? 'bg-green-600' :
                    status === 'current' ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                  {STEP_LABELS[step as keyof typeof STEP_LABELS]}
                  {step === 'DEEPDIVE' && deepDiveNo > 0 && (
                    <span className="ml-1 text-xs bg-purple-200 text-purple-800 px-1 rounded">#{deepDiveNo}</span>
                  )}
                </div>
                {step === 'DEEPDIVE' && status === 'current' && deepDiveNo > 0 && deepDiveNo < 3 && (
                  <span className="text-xs text-gray-500">Can add {3 - deepDiveNo} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="space-y-2">
        <button
          onClick={onNext}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          {currentStep === 'INITIAL_DESIGN' ? 'Approve Design' : 
           currentStep === 'HLD' ? 'Start Deep Dive' :
           currentStep === 'DEEPDIVE' ? 'Continue to Conclusion' : 'Complete'}
        </button>
        
        <button
          onClick={onBack}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
        >
          Back
        </button>
        
        {currentStep === 'DEEPDIVE' && deepDiveNo < 3 && (
          <button
            onClick={onDeepDive}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Add Another Deep Dive ({deepDiveNo + 1}/3)
          </button>
        )}
      </div>
    </div>
  )
}